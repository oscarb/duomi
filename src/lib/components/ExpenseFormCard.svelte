<script lang="ts">
	import { getContext } from 'svelte';
	import { enhance, deserialize } from '$app/forms';
	import { page } from '$app/state';
	import { invalidateAll, goto } from '$app/navigation';
	import { toasts } from '$lib/toasts.svelte';
	import { slide, fade } from 'svelte/transition';

	// Retrieve localized translations and formatting
	const { locale, t, currencyConfig, formatter } = getContext<{
		locale: string;
		t: (key: string, params?: Record<string, string>) => string;
		currencyConfig: import('$lib/translations').CurrencyConfig;
		formatter: Intl.NumberFormat;
	}>('i18n');

	// Determine thousand separator dynamically from locale
	const thousandSeparator = $derived.by(() => {
		try {
			const parts = new Intl.NumberFormat(locale).formatToParts(1000);
			const groupPart = parts.find(p => p.type === 'group');
			return groupPart ? groupPart.value : ' ';
		} catch (e) {
			return ' ';
		}
	});

	// Props
	let {
		expense = null,
		isCreateMode = false,
		initialPaidBy = 'A',
		accounts = [],
		namePersonA = 'Person A',
		namePersonB = 'Person B',
		dynamicSplitRatioA = 0.5,
		cancelHref = '/expenses',
		actionRoute = '',
		currentYear = new Date().getFullYear(),
		currentMonth = new Date().getMonth() + 1
	}: {
		expense: any;
		isCreateMode: boolean;
		initialPaidBy: 'A' | 'B';
		accounts: any[];
		namePersonA: string;
		namePersonB: string;
		dynamicSplitRatioA: number;
		cancelHref: string;
		actionRoute: string;
		currentYear: number;
		currentMonth: number;
	} = $props();

	// SVG circle circumference constants
	const _C20 = 54.978;

	// Local states
	let editName = $state('');
	let editPaidBy = $state<'A' | 'B'>('A');
	let editInterval = $state(1);
	let editSplitType = $state<'dynamic' | 'static'>('dynamic');
	let editRatio = $state(0.5);
	let editAccountId = $state<number | null>(null);
	let editAmountVal = $state('');
	let editAmountDate = $state('');

	// Amount edit toggler for existing templates
	let isAmountEdit = $state(false);
	let amountInputEl = $state<HTMLInputElement | null>(null);

	let deletedHistoryIds = $state<number[]>([]);

	let latestAmount = $derived(expense?.history && expense.history.length > 0
		? expense.history[expense.history.length - 1].amount
		: (expense?.currentAmount || 0)
	);
	let isFuture = $derived.by(() => {
		if (!expense?.history || expense.history.length === 0) return false;
		const latestDate = expense.history[expense.history.length - 1].validFrom;
		const today = new Date().toISOString().split('T')[0];
		return latestDate > today;
	});

	// Account editing states
	let isEditingAccounts = $state(false);
	let isCreatingAccountInline = $state(false);
	let inlineAccountName = $state('');
	let inlineAccountInputEl = $state<HTMLInputElement | null>(null);

	// Title focus states
	let titleInputEl = $state<HTMLTextAreaElement | null>(null);
	let lastExpenseId = $state<number | null>(null);
	let currentTargetId = $state<number | string | null>(null);

	// Synchronize local states with expense data changes
	$effect(() => {
		const targetId = expense ? expense.id : `new-${initialPaidBy}`;
		if (currentTargetId !== targetId) {
			currentTargetId = targetId;
			if (expense) {
				const idChanged = lastExpenseId !== expense.id;
				lastExpenseId = expense.id;

				if (idChanged) {
					isAmountEdit = false;
				}

				editName = expense.name;
				editPaidBy = expense.paidBy;
				editInterval = expense.intervalMonths;
				editSplitType = expense.splitType;
				editRatio = expense.staticSplitRatio ?? 0.5;
				editAccountId = expense.accountId;

				if (idChanged || !isAmountEdit) {
					editAmountVal = formatAmount(Math.round(latestAmount).toString());
					editAmountDate = expense.history?.[expense.history.length - 1]?.validFrom || new Date().toISOString().split('T')[0];
				}
			} else {
				lastExpenseId = null;
				isAmountEdit = false;
				editName = '';
				editPaidBy = initialPaidBy;
				editInterval = 1;
				editSplitType = 'dynamic';
				editRatio = 0.5;
				editAccountId = parseInt(page.url.searchParams.get('accountId') || '', 10) || null;
				editAmountVal = '';
				editAmountDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
			}
		}
	});

	// Focus title input on mount/trigger in Create Mode
	$effect(() => {
		if (isCreateMode && titleInputEl) {
			titleInputEl.focus();
		}
	});



	// Focus inline account input field when "Lägg till" is clicked
	$effect(() => {
		if (isCreatingAccountInline && inlineAccountInputEl) {
			inlineAccountInputEl.focus();
		}
	});

	// Reset selected account if the new payer does not own it
	$effect(() => {
		if (editAccountId !== null) {
			const selectedAcc = accounts.find(a => a.id === editAccountId);
			if (selectedAcc && selectedAcc.owner !== editPaidBy) {
				editAccountId = null;
				triggerAutoSave();
			}
		}
	});

	// Snaps range slider value to discrete points
	function snapRatio(val: number): number {
		const snapPoints = [0, 0.1, 0.2, 0.3, 0.33, 0.4, 0.5, 0.6, 0.66, 0.7, 0.8, 0.9, 1.0];
		const tolerance = 0.02; // Snap if within 2%
		for (const pt of snapPoints) {
			if (Math.abs(val - pt) < tolerance) {
				return pt;
			}
		}
		return val;
	}

	// Format helpers
	function formatSinceDate(dateStr: string, localeStr: string): string {
		if (!dateStr) return '';
		const date = new Date(dateStr + 'T00:00:00');
		if (isNaN(date.getTime())) return dateStr;
		return date.toLocaleDateString(localeStr, { month: 'short', year: 'numeric' }).toLowerCase();
	}

	function formatOneTimeDate(dateStr: string, localeStr: string): string {
		if (!dateStr) return '';
		const date = new Date(dateStr + 'T00:00:00');
		if (isNaN(date.getTime())) return dateStr;
		const day = date.getDate();
		const year = date.getFullYear();
		let month = date.toLocaleDateString(localeStr, { month: 'short' });
		if (localeStr.startsWith('sv')) {
			month = month.toLowerCase();
		}
		month = month.replace('.', '');
		return `${day} ${month} ${year}`;
	}

	function getNextPaymentDate(startDateStr: string, intervalMonths: number): string {
		if (!startDateStr) return '';
		if (intervalMonths <= 0) return startDateStr;
		const parts = startDateStr.split('-');
		const y = parseInt(parts[0], 10);
		const m = parseInt(parts[1], 10);
		const d = parseInt(parts[2], 10);
		const start = new Date(y, m - 1, d);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		if (start >= today) {
			return startDateStr;
		}

		let current = new Date(start);
		while (current < today) {
			current.setMonth(current.getMonth() + intervalMonths);
		}
		
		const py = current.getFullYear();
		const pm = String(current.getMonth() + 1).padStart(2, '0');
		const pd = String(current.getDate()).padStart(2, '0');
		return `${py}-${pm}-${pd}`;
	}

	function formatRenewalDate(dateStr: string, localeStr: string): string {
		if (!dateStr) return '';
		const parts = dateStr.split('-');
		const y = parseInt(parts[0], 10);
		const m = parseInt(parts[1], 10);
		const d = parseInt(parts[2], 10);
		const date = new Date(y, m - 1, d);
		if (isNaN(date.getTime())) return dateStr;
		
		const day = String(date.getDate()).padStart(2, '0');
		const year = date.getFullYear();
		let month = date.toLocaleDateString(localeStr, { month: 'short' });
		if (localeStr.startsWith('sv')) {
			month = month.toLowerCase();
		} else {
			month = month.charAt(0).toUpperCase() + month.slice(1);
		}
		month = month.replace('.', '');
		return `${day} ${month} ${year}`;
	}

	function formatHistoryDate(dateStr: string, localeStr: string): string {
		if (!dateStr) return '';
		const date = new Date(dateStr + 'T00:00:00');
		if (isNaN(date.getTime())) return dateStr;
		const formatted = date.toLocaleDateString(localeStr, { month: 'long', year: 'numeric' });
		return formatted.charAt(0).toUpperCase() + formatted.slice(1);
	}

	function formatAmount(val: string): string {
		const clean = val.replace(/\D/g, '');
		if (!clean) return '';
		return clean.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
	}

	function handleAmountInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const cursorPosition = input.selectionStart || 0;
		const originalValue = input.value;

		let clean = originalValue.replace(/\D/g, '');
		if (clean.startsWith('0') && clean.length > 1) {
			clean = clean.replace(/^0+/, '');
		}
		if (clean === '') clean = '0';
		clean = clean.slice(0, 7); // Max 7 digits
		const formatted = clean.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);

		const digitsBeforeCursor = originalValue.slice(0, cursorPosition).replace(/\D/g, '').length;

		editAmountVal = formatted;
		input.value = formatted;

		let newCursorPosition = 0;
		let digitsFound = 0;
		for (let i = 0; i < formatted.length; i++) {
			if (formatted[i] !== thousandSeparator) {
				digitsFound++;
			}
			newCursorPosition = i + 1;
			if (digitsFound === digitsBeforeCursor) {
				break;
			}
		}

		queueMicrotask(() => {
			input.setSelectionRange(newCursorPosition, newCursorPosition);
		});
	}

	async function deleteAccount(id: number) {
		const formData = new FormData();
		formData.append('id', id.toString());

		const response = await fetch(`${actionRoute || '/expenses'}?/deleteAccount`, {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			const result = deserialize(await response.text());
			if (result.type === 'success') {
				const { deleted } = result.data as any;
				if (deleted) {
					await invalidateAll();
					toasts.show(t('toastAccountDeleted', { name: deleted.account.name }), 'success', 5000, {
						label: t('undo'),
						callback: async () => {
							const restoreData = new FormData();
							restoreData.append('id', deleted.account.id.toString());
							restoreData.append('name', deleted.account.name);
							restoreData.append('owner', deleted.account.owner);
							restoreData.append('affectedExpenseIds', JSON.stringify(deleted.affectedExpenseIds));

							const restoreResponse = await fetch(`${actionRoute || '/expenses'}?/restoreAccount`, {
								method: 'POST',
								body: restoreData
							});

							if (restoreResponse.ok) {
								const restoreResult = deserialize(await restoreResponse.text());
								if (restoreResult.type === 'success') {
									toasts.show(t('toastAccountRestored', { name: deleted.account.name }), 'success');
									await invalidateAll();
								}
							}
						}
					});
				}
			}
		}
	}

	async function saveAccountInline() {
		if (!inlineAccountName.trim()) return;

		const formData = new FormData();
		formData.append('name', inlineAccountName.trim());
		formData.append('owner', editPaidBy);

		const response = await fetch(`${actionRoute || '/expenses'}?/createAccount`, {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			const result = deserialize(await response.text());
			if (result.type === 'success') {
				await invalidateAll();
				isCreatingAccountInline = false;
				inlineAccountName = '';
			}
		}
	}

	function cancelAccountInline() {
		isCreatingAccountInline = false;
		inlineAccountName = '';
	}

	function horizontalThenCollapse(node: HTMLElement, { duration = 500 }) {
		const style = getComputedStyle(node);
		const height = parseFloat(style.height);
		const paddingTop = parseFloat(style.paddingTop);
		const paddingBottom = parseFloat(style.paddingBottom);
		const marginTop = parseFloat(style.marginTop);
		const marginBottom = parseFloat(style.marginBottom);

		return {
			duration,
			css: (t: number) => {
				if (t > 0.6) {
					// Phase 1: Slide horizontally (t: 0.6 -> 1.0; progress: 100% -> 0%)
					const progress = (1 - t) / 0.4;
					const slidePct = progress * 100;
					const opacity = 1 - progress;
					return `
						transform: translateX(${slidePct}%);
						opacity: ${opacity};
						height: ${height}px;
						padding-top: ${paddingTop}px;
						padding-bottom: ${paddingBottom}px;
						margin-top: ${marginTop}px;
						margin-bottom: ${marginBottom}px;
						overflow: hidden;
					`;
				} else if (t > 0.4) {
					// Phase 2: Pause/Delay (t: 0.4 -> 0.6)
					return `
						transform: translateX(100%);
						opacity: 0;
						height: ${height}px;
						padding-top: ${paddingTop}px;
						padding-bottom: ${paddingBottom}px;
						margin-top: ${marginTop}px;
						margin-bottom: ${marginBottom}px;
						overflow: hidden;
					`;
				} else {
					// Phase 3: Collapse height (t: 0.0 -> 0.4; progress: 0% -> 100%)
					const scale = t / 0.4;
					return `
						transform: translateX(100%);
						opacity: 0;
						height: ${height * scale}px;
						padding-top: ${paddingTop * scale}px;
						padding-bottom: ${paddingBottom * scale}px;
						margin-top: ${marginTop * scale}px;
						margin-bottom: ${marginBottom * scale}px;
						border-bottom-width: 0px;
						overflow: hidden;
					`;
				}
			}
		};
	}

	async function deleteHistoryItem(item: { id: number; date: string; amount: number }) {
		if (combinedHistoryTimeline.filter(h => h.type === 'price').length <= 1) {
			toasts.show(t('cannotDeleteOnlyPrice'), 'error');
			return;
		}

		// Capture the target expense ID at the moment of deletion for the undo closure
		const targetExpenseId = expense.id;

		// Optimistic update
		deletedHistoryIds = [...deletedHistoryIds, item.id];

		const formData = new FormData();
		formData.append('id', item.id.toString());

		const postRoute = actionRoute || '';

		try {
			const response = await fetch(`${postRoute}?/deleteHistoryItem`, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error('Network response not ok');
			}

			const result = deserialize(await response.text());
			if (result.type === 'success' && result.data?.success) {
				await invalidateAll();
				deletedHistoryIds = deletedHistoryIds.filter(id => id !== item.id);

				const formattedDate = formatHistoryDate(item.date, locale);
				toasts.show(t('toastHistoryDeleted', { date: formattedDate }), 'success', 5000, {
					label: t('undo'),
					callback: async () => {
						const restoreForm = new FormData();
						restoreForm.append('id', item.id.toString());
						restoreForm.append('expenseId', targetExpenseId.toString());
						restoreForm.append('amount', item.amount.toString());
						restoreForm.append('validFrom', item.date);

						const restoreResponse = await fetch(`${postRoute}?/restoreHistoryItem`, {
							method: 'POST',
							body: restoreForm
						});

						if (restoreResponse.ok) {
							const restoreResult = deserialize(await restoreResponse.text());
							if (restoreResult.type === 'success') {
								toasts.show(t('toastHistoryRestored', { date: formattedDate }), 'success');
								await invalidateAll();
							}
						}
					}
				});
			} else {
				const errMsg = (result.type === 'success' && result.data && typeof result.data.error === 'string') ? result.data.error : 'Failed to delete';
				throw new Error(errMsg);
			}
		} catch (err: any) {
			// Rollback optimistic update
			deletedHistoryIds = deletedHistoryIds.filter(id => id !== item.id);
			const errMsg = err.message === 'cannotDeleteOnlyPrice' ? t('cannotDeleteOnlyPrice') : err.message;
			toasts.show(errMsg, 'error');
		}
	}

	// Filter sequential unique changes and combine with archive date for a chronological timeline
	let combinedHistoryTimeline = $derived.by(() => {
		if (!expense) return [];
		let sortedChrono = expense.history ? [...expense.history].sort((a, b) => a.validFrom.localeCompare(b.validFrom)) : [];
		
		// Optimistically filter out deleted ids
		sortedChrono = sortedChrono.filter(item => !deletedHistoryIds.includes(item.id));

		const uniquePoints = [];
		
		let lastAmt = null;
		for (let i = 0; i < sortedChrono.length; i++) {
			if (i === 0 || sortedChrono[i].amount !== sortedChrono[i - 1].amount) {
				const currentAmt = sortedChrono[i].amount;
				let pctChange = null;
				if (lastAmt !== null && lastAmt !== 0) {
					pctChange = ((currentAmt - lastAmt) / lastAmt) * 100;
				}
				uniquePoints.push({
					id: sortedChrono[i].id,
					type: 'price',
					date: sortedChrono[i].validFrom,
					amount: currentAmt,
					pctChange
				});
				lastAmt = currentAmt;
			}
		}
		
		if (expense.archivedDate) {
			uniquePoints.push({
				id: null,
				type: 'archive',
				date: expense.archivedDate,
				amount: null,
				pctChange: null
			});
		}
		
		uniquePoints.sort((a, b) => {
			const timeA = new Date(a.date.includes('T') ? a.date : a.date + 'T00:00:00').getTime();
			const timeB = new Date(b.date.includes('T') ? b.date : b.date + 'T00:00:00').getTime();
			return timeB - timeA;
		});
		return uniquePoints;
	});

	let chartPoints = $derived(combinedHistoryTimeline.filter(item => item.type === 'price').reverse());

	let chartCoords = $derived.by(() => {
		if (chartPoints.length < 2) return { coords: [], curvePath: '', areaPath: '', predictedPoint: null, predictedCurvePath: '', predictedAreaPath: '', yearTicks: [] };

		// Parse date to local timestamp
		const parseDateToTime = (dateStr: string) => {
			const parts = dateStr.split('-');
			const y = parseInt(parts[0], 10);
			const m = parseInt(parts[1], 10);
			const d = parseInt(parts[2], 10);
			return new Date(y, m - 1, d).getTime();
		};

		// Only show prediction if the expense template is not archived
		const showPrediction = expense && !expense.archivedDate;

		// 1. Predict next price point based on previous intervals and deltas
		const times = chartPoints.map(p => parseDateToTime(p.date));
		let predictedDateStr = '';
		let predictedYear = new Date(times[times.length - 1]).getFullYear();

		if (showPrediction) {
			const intervals = [];
			for (let i = 1; i < times.length; i++) {
				intervals.push(times[i] - times[i - 1]);
			}
			const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 365 * 24 * 60 * 60 * 1000;
			const predictedTime = times[times.length - 1] + avgInterval;
			const predictedDateObj = new Date(predictedTime);
			predictedDateStr = `${predictedDateObj.getFullYear()}-${String(predictedDateObj.getMonth() + 1).padStart(2, '0')}-${String(predictedDateObj.getDate()).padStart(2, '0')}`;
			predictedYear = predictedDateObj.getFullYear();
		}

		let predictedAmount = chartPoints[chartPoints.length - 1].amount;
		if (showPrediction) {
			const deltas = [];
			for (let i = 1; i < chartPoints.length; i++) {
				deltas.push(chartPoints[i].amount - chartPoints[i - 1].amount);
			}
			const avgDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
			predictedAmount = Math.max(0, chartPoints[chartPoints.length - 1].amount + avgDelta);
		}

		// 2. Set ranges (linear time from Jan 1st of startYear to Jan 1st of endYear + 1)
		const startYear = new Date(times[0]).getFullYear();
		const lastPointYear = new Date(times[times.length - 1]).getFullYear();
		const endYear = (showPrediction ? predictedYear : lastPointYear) + 1;

		const minTime = parseDateToTime(`${startYear}-01-01`);
		const maxTime = parseDateToTime(`${endYear}-01-01`);
		const timeRange = maxTime - minTime;

		const minAmt = Math.min(...chartPoints.map(p => p.amount), predictedAmount);
		const maxAmt = Math.max(...chartPoints.map(p => p.amount), predictedAmount);
		const amtRange = maxAmt - minAmt;

		// Set margins to pad inside the SVG container so that year labels align with the card paddings
		const leftMargin = 15;
		const rightMargin = 15;
		const chartWidth = 400 - leftMargin - rightMargin; // 370

		const getX = (dStr: string) => {
			const t = parseDateToTime(dStr);
			return timeRange === 0 ? 200 : ((t - minTime) / timeRange) * chartWidth + leftMargin;
		};

		const getY = (amt: number) => {
			return amtRange === 0 ? 40 : 70 - ((amt - minAmt) / amtRange) * 60;
		};

		// 3. Map coords (time-linear)
		const coords = chartPoints.map((p) => {
			return {
				x: getX(p.date),
				y: getY(p.amount),
				amount: p.amount,
				date: p.date
			};
		});

		let predictedPoint = null;
		if (showPrediction) {
			predictedPoint = {
				x: getX(predictedDateStr),
				y: getY(predictedAmount),
				amount: predictedAmount,
				date: predictedDateStr
			};
		}

		// Predict the Y for endVirtual using the same slope
		let endVirtualY = coords[coords.length - 1].y;
		let endVirtualAmount = coords[coords.length - 1].amount;
		if (showPrediction && predictedPoint && coords.length > 0) {
			const lastHistorical = coords[coords.length - 1];
			// Only extend if points are not identically positioned
			if (predictedPoint.x !== lastHistorical.x) {
				const slopeY = (predictedPoint.y - lastHistorical.y) / (predictedPoint.x - lastHistorical.x);
				endVirtualY = Math.max(5, Math.min(85, predictedPoint.y + slopeY * (400 - predictedPoint.x)));
				
				const slopeAmount = (predictedAmount - lastHistorical.amount) / (predictedPoint.x - lastHistorical.x);
				endVirtualAmount = predictedAmount + slopeAmount * (400 - predictedPoint.x);
			}
		}

		const endVirtual = {
			x: 400,
			y: endVirtualY,
			amount: endVirtualAmount,
			date: `${endYear}-01-01`
		};

		const historicalSplineCoords = coords;

		const predictedSplineCoords = showPrediction && predictedPoint
			? [coords[coords.length - 1], predictedPoint, endVirtual]
			: [];

		// 4. Compute spline curve paths
		const controlPoint = (current: { x: number; y: number }, previous: { x: number; y: number } | undefined, next: { x: number; y: number } | undefined, reverse: boolean) => {
			const p = previous || current;
			const n = next || current;
			const smoothing = 0.15;
			const lengthX = n.x - p.x;
			const lengthY = n.y - p.y;
			const speed = Math.sqrt(lengthX * lengthX + lengthY * lengthY);
			const angle = Math.atan2(lengthY, lengthX) + (reverse ? Math.PI : 0);
			const x = current.x + Math.cos(angle) * speed * smoothing;
			const y = current.y + Math.sin(angle) * speed * smoothing;
			return { x, y };
		};

		const getSplinePath = (pts: { x: number; y: number }[]) => {
			if (pts.length < 2) return '';
			let path = `M ${pts[0].x} ${pts[0].y}`;
			for (let i = 1; i < pts.length; i++) {
				const prev = pts[i - 1];
				const pt = pts[i];
				const cp1 = controlPoint(prev, pts[i - 2], pt, false);
				const cp2 = controlPoint(pt, prev, pts[i + 1], true);
				path += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${pt.x} ${pt.y}`;
			}
			return path;
		};

		const historicalCurvePath = getSplinePath(historicalSplineCoords);
		const predictedCurvePath = getSplinePath(predictedSplineCoords);

		const historicalAreaPath = historicalCurvePath
			? `${historicalCurvePath} L ${historicalSplineCoords[historicalSplineCoords.length - 1].x} 88 L ${historicalSplineCoords[0].x} 88 Z`
			: '';
			
		const predictedAreaPath = predictedCurvePath
			? `${predictedCurvePath} L ${predictedSplineCoords[predictedSplineCoords.length - 1].x} 88 L ${predictedSplineCoords[0].x} 88 Z`
			: '';

		// 5. Generate year ticks along the x axis (always centered with a vertical line)
		const yearTicks = [];
		for (let yr = startYear; yr <= endYear; yr++) {
			const yrStartStr = `${yr}-01-01`;
			const x = getX(yrStartStr);
			
			if (x >= 0 && x <= 400) {
				yearTicks.push({
					year: yr,
					x,
					showYearLabel: false,
					align: 'middle'
				});
			}
		}

		// Post-process to prevent overlaps and ensure first/last are always shown
		const N_ticks = yearTicks.length;
		if (N_ticks > 0) {
			yearTicks[0].showYearLabel = true;
			yearTicks[0].align = 'start';
		}
		if (N_ticks > 1) {
			yearTicks[N_ticks - 1].showYearLabel = true;
			yearTicks[N_ticks - 1].align = 'end';
		}

		let lastShownX = yearTicks[0] ? yearTicks[0].x : -999;
		const lastYearX = yearTicks[N_ticks - 1] ? yearTicks[N_ticks - 1].x : 9999;

		for (let i = 1; i < N_ticks - 1; i++) {
			const tick = yearTicks[i];
			if (tick.x - lastShownX >= 45 && lastYearX - tick.x >= 45) {
				tick.showYearLabel = true;
				tick.align = 'middle';
				lastShownX = tick.x;
			}
		}

		return { coords, curvePath: historicalCurvePath, areaPath: historicalAreaPath, predictedPoint, predictedCurvePath, predictedAreaPath, yearTicks };
	});

	function handleAmountKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			const step = e.shiftKey ? 10 : 1;
			const currentVal = parseFloat(editAmountVal.replace(/\D/g, '')) || 0;
			const newVal = Math.max(0, currentVal + (e.key === 'ArrowUp' ? step : -step));
			editAmountVal = formatAmount(Math.round(newVal).toString());
		}
	}

	// Auto-submit form element binding and logic
	let editFormElement = $state<HTMLFormElement | null>(null);

	let isDirty = $derived.by(() => {
		if (!expense || isCreateMode) return false;
		return (
			editName !== expense.name ||
			editPaidBy !== expense.paidBy ||
			editInterval !== expense.intervalMonths ||
			editSplitType !== expense.splitType ||
			editRatio !== (expense.staticSplitRatio ?? 0.5) ||
			editAccountId !== expense.accountId
		);
	});

	let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
	function triggerAutoSave() {
		if (autosaveTimeout) clearTimeout(autosaveTimeout);
		autosaveTimeout = setTimeout(() => {
			if (isDirty && editFormElement && !isCreateMode) {
				editFormElement.requestSubmit();
			}
		}, 20);
	}

	// Derive 13 consecutive months starting from the current dashboard view month
	let calendarMonths = $derived.by(() => {
		const months = [];
		let y = currentYear;
		let m = currentMonth;
		for (let i = 0; i < 13; i++) {
			months.push({ year: y, month: m });
			m++;
			if (m > 12) {
				m = 1;
				y++;
			}
		}
		return months;
	});

	// Helper to determine if a payment happens in a month for the visual grid
	function isPaymentMonth(periodYear: number, monthVal: number, interval: number, validFromStr: string): boolean {
		if (!validFromStr) return false;
		const parts = validFromStr.split('-');
		const startY = parseInt(parts[0], 10);
		const startM = parseInt(parts[1], 10);

		if (periodYear < startY) return false;
		if (periodYear === startY && monthVal < startM) return false;

		if (interval === 0) {
			// One-time
			return periodYear === startY && monthVal === startM;
		}

		const diff = (periodYear - startY) * 12 + (monthVal - startM);
		return diff % interval === 0;
	}


</script>

<div class="@container bg-white pt-6 pb-6 px-6 md:pt-10 md:pb-10 md:px-10 rounded-2xl floating-sidebar-card sticky lg:top-8 relative transition-all duration-300">
	{#if isCreateMode}
		<!-- CREATE NEW EXPENSE/TEMPLATE FORM -->
		<form
			method="POST"
			action="{actionRoute}?/create"
			use:enhance={({ formData }) => {
				const name = formData.get('name') as string;
				const intervalMonths = parseInt(formData.get('intervalMonths') as string, 10) || 0;
				const validFrom = (formData.get('validFrom') as string) || new Date().toISOString().split('T')[0];
				
				return async ({ result, update }) => {
					if (result.type === 'success') {
						const dateParts = validFrom.split('-');
						const y = parseInt(dateParts[0], 10);
						const m = parseInt(dateParts[1], 10);
						const dateObj = new Date(y, m - 1, 1);
						const formattedDate = dateObj.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
						const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
						
						if (intervalMonths === 0) {
							toasts.show(t('toastCreatedFor', { name, date: capitalizedDate }), 'success');
						} else {
							toasts.show(t('toastCreatedFrom', { name, date: capitalizedDate }), 'success');
						}

						await update();
						if (cancelHref) {
							goto(cancelHref);
						}
					} else {
						await update();
					}
				};
			}}
			bind:this={editFormElement}
			class="space-y-12"
		>
			<div class="space-y-6">
				<div class="flex flex-col gap-2 pb-2">
					<!-- Row 1: Title and Amount -->
					<div class="flex justify-between items-start gap-4">
						<div class="flex-grow min-w-0">
							<div class="inline-grid grid-cols-1 max-w-full min-w-[1ch]">
								<span class="col-start-1 row-start-1 invisible font-display text-2xl font-bold pb-1 whitespace-pre-wrap break-words">{editName || t('name')}</span>
								<textarea
									bind:this={titleInputEl}
									name="name"
									bind:value={editName}
									rows="1"
									required
									placeholder={t('name')}
									class="col-start-1 row-start-1 w-0 min-w-full h-full resize-none overflow-hidden font-display text-2xl font-bold text-[#2d3142] border-0 border-b border-[#efeeea] hover:border-[#ff7361] focus:border-[#ff7361] p-0 focus:ring-0 outline-none focus:outline-none pb-1 transition-colors duration-200 whitespace-pre-wrap break-words"
									onkeydown={(e) => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											e.currentTarget.form?.requestSubmit();
										}
									}}
								></textarea>
							</div>
						</div>

						<div class="flex flex-col items-end flex-shrink-0">
							<div class="flex items-center text-2xl font-bold text-[#2d3142] tracking-tight p-2 -m-2">
								{#if currencyConfig.isPrefix}
									<span class="text-[#9ca3af] opacity-50 mr-1 inline-block -translate-y-[2px]" style="width: 1ch; display: inline-block; text-align: right;">{currencyConfig.symbol}</span>
								{/if}
								<div class="inline-grid grid-cols-1">
									<span class="col-start-1 row-start-1 invisible font-sans text-2xl font-bold pt-[1px] pb-[4px] whitespace-pre tracking-tight {currencyConfig.isPrefix ? '' : 'pr-[6px]'}">{editAmountVal || '0'}</span>
									<input
										type="text"
										inputmode="numeric"
										pattern="[0-9\s]*"
										value={editAmountVal}
										oninput={handleAmountInput}
										onkeydown={handleAmountKeyDown}
										required
										class="col-start-1 row-start-1 w-0 min-w-full h-full font-sans text-2xl font-bold text-[#2d3142] border-0 border-b border-[#efeeea] hover:border-[#ff7361] focus:border-[#ff7361] p-0 focus:ring-0 outline-none focus:outline-none text-right pb-[4px] tracking-tight transition-colors duration-200 {currencyConfig.isPrefix ? '' : 'pr-[6px]'}"
										placeholder="0"
									/>
								</div>
								<input type="hidden" name="amount" value={editAmountVal.replace(/\D/g, '')} />
								{#if !currencyConfig.isPrefix}
									<span class="text-[#9ca3af] opacity-50 ml-1 inline-block -translate-x-[1px] -translate-y-[2px]">{currencyConfig.symbol}</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Row 2: Badge and Date -->
					<div class="flex justify-between items-center gap-4">
						<div class="flex items-center gap-2">
							<div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider transition-colors duration-200 {editPaidBy === 'A' ? 'bg-[#4a7bb0]/10 text-[#4a7bb0] border border-[#4a7bb0]/20' : 'bg-[#4fd1c5]/10 text-[#4fd1c5] border border-[#4fd1c5]/20'}">
								<span class="w-1.5 h-1.5 rounded-full {editPaidBy === 'A' ? 'bg-[#4a7bb0]' : 'bg-[#4fd1c5]'}"></span>
								{editPaidBy === 'A' ? namePersonA : namePersonB}
							</div>
						</div>

						<div class="flex items-center">
							<input
								name="validFrom"
								type="date"
								bind:value={editAmountDate}
								required
								class="w-[125px] px-2 py-1 rounded-xl border border-[#efeeea] bg-[#fbf9f5] text-[12px] font-bold text-[#2d3142] focus:border-[#ff7361] focus:ring-2 focus:ring-[#ff7361]/20 outline-none transition-all cursor-pointer"
							/>
						</div>
					</div>
				</div>

				<input type="hidden" name="paidBy" value={editPaidBy} />

				{#if editInterval !== 0}
					<div class="grid grid-cols-2 gap-4">
						<div class="flex flex-col">
							<span class="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">{t('nextPayment')}</span>
							<span class="text-xl font-sans font-bold text-[#2d3142] mt-1">
								{formatOneTimeDate(getNextPaymentDate(editAmountDate, editInterval), locale)}
							</span>
						</div>
						<div class="flex flex-col">
							{#if editInterval === 1 || editInterval === 3 || editInterval === 12}
								{@const parsedAmt = parseFloat(editAmountVal.replace(/\D/g, '')) || 0}
								{@const comparisonCost = editInterval === 1 ? Math.round(parsedAmt * 12) : Math.round(parsedAmt / editInterval)}
								<span class="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">
									{editInterval === 1 ? t('yearlyComparisonPrice') : t('comparisonPrice')}
								</span>
								<span class="text-xl font-sans font-bold text-[#2d3142] mt-1">
									{#each formatter.formatToParts(comparisonCost) as part}
										{#if part.type === 'currency'}
											<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
										{:else if part.type !== 'literal'}
											{part.value}
										{/if}
									{/each}
								</span>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Split Ratio -->
			<div>
				<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-3 border-b border-[#efeeea] pb-2">{t('splittingRatio')}</p>
				<div class="space-y-4">
					<div class="grid grid-cols-2 p-1 bg-[#fbf9f5] rounded-full border border-[#efeeea]">
						<button
							type="button"
							onclick={() => editSplitType = 'static'}
							class="py-1.5 rounded-full text-xs font-bold transition-all {editSplitType === 'static' ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
						>
							{t('static')}
						</button>
						<button
							type="button"
							onclick={() => editSplitType = 'dynamic'}
							class="py-1.5 rounded-full text-xs font-bold transition-all {editSplitType === 'dynamic' ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
						>
							{t('dynamic')}
						</button>
					</div>
					<input type="hidden" name="splitType" value={editSplitType} />

					{#if editSplitType === 'static'}
						{@const parsedAmt = parseFloat(editAmountVal.replace(/\D/g, '')) || 0}
						<div class="space-y-1 pt-0.5">
							<div class="flex justify-between text-sm font-bold text-[#2d3142]">
								<span>{namePersonA} <span class="text-[#4a7bb0] ml-0.5">{Math.round(editRatio * 100)}%</span></span>
								<span><span class="mr-0.5">{namePersonB}</span> <span class="text-[#4fd1c5]">{Math.round((1 - editRatio) * 100)}%</span></span>
							</div>
							<div class="h-6 flex items-center relative w-full group">
								<!-- Track -->
								<div 
									class="absolute inset-x-0 h-1.5 rounded-full overflow-hidden pointer-events-none"
									style="background: linear-gradient(to right, #4a7bb0 calc(10px + {editRatio * 100}% - {editRatio * 20}px), #4fd1c5 calc(10px + {editRatio * 100}% - {editRatio * 20}px))"
								></div>
								
								<!-- Custom Handle -->
								<div 
									class="absolute pointer-events-none w-5 h-5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),_0_0_0_1px_rgba(0,0,0,0.05)] flex items-center justify-center transition-transform duration-100 group-hover:scale-115 group-focus-within:scale-115"
									style="left: calc({editRatio * 100}% - {editRatio * 20}px);"
								>
									<svg width="20" height="20" viewBox="0 0 20 20" style="display:block;overflow:visible">
										<circle cx="10" cy="10" r="8.75" fill="white" />
										<circle cx="10" cy="10" r="8.75" fill="none" stroke="#4fd1c5" stroke-width="2.5" />
										<circle cx="10" cy="10" r="8.75" fill="none" stroke="#4a7bb0" stroke-width="2.5"
											stroke-dasharray="{editRatio * _C20} {_C20}"
											stroke-dashoffset="{-(0.5 - editRatio / 2) * _C20}" />
										<line x1="10" y1="7.5" x2="10" y2="12.5" stroke="#9ca3af" stroke-width="1.5" stroke-opacity="0.4" stroke-linecap="round" />
									</svg>
								</div>

								<!-- Native input (completely transparent, positioned absolutely to cover everything) -->
								<input
									name="staticSplitRatio"
									type="range"
									min="0"
									max="1"
									step="0.01"
									bind:value={editRatio}
									oninput={(e) => {
										editRatio = snapRatio(parseFloat(e.currentTarget.value));
										e.currentTarget.value = editRatio.toString();
									}}
									class="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10 focus:outline-none"
								/>
							</div>
							<div class="flex justify-between text-xs font-medium text-[#9ca3af]">
								<span>{formatter.format(Math.round(parsedAmt * editRatio))}</span>
								<span>{formatter.format(Math.round(parsedAmt * (1 - editRatio)))}</span>
							</div>
						</div>
					{:else}
						{@const parsedAmt = parseFloat(editAmountVal.replace(/\D/g, '')) || 0}
						<div class="space-y-1 pt-0.5">
							<div class="flex justify-between text-sm font-bold text-[#2d3142]">
								<span>{namePersonA} <span class="text-[#4a7bb0] ml-0.5">{Math.round(dynamicSplitRatioA * 100)}%</span></span>
								<span><span class="mr-0.5">{namePersonB}</span> <span class="text-[#4fd1c5]">{Math.round((1 - dynamicSplitRatioA) * 100)}%</span></span>
							</div>
							<!-- Styled share bar gradient without handle for dynamic split type -->
							<div class="h-6 flex items-center">
								{#if dynamicSplitRatioA === 0}
									<div class="w-full h-3 rounded-full" style="background: linear-gradient(to right, #76e8df, #4fd1c5)"></div>
								{:else if dynamicSplitRatioA === 1}
									<div class="w-full h-3 rounded-full" style="background: linear-gradient(to right, #4a7bb0, #6192c7)"></div>
								{:else}
									<div class="w-full h-3 rounded-full dynamic-share-bar--small" style="--pct-a: {dynamicSplitRatioA * 100}%"></div>
								{/if}
							</div>
							<div class="flex justify-between text-xs font-medium text-[#9ca3af]">
								<span>{formatter.format(Math.round(parsedAmt * dynamicSplitRatioA))}</span>
								<span>{formatter.format(Math.round(parsedAmt * (1 - dynamicSplitRatioA)))}</span>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Source Account -->
			<div>
				<div class="flex items-center justify-between mb-3 border-b border-[#efeeea] pb-2">
					<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest">{t('account')}</p>
					{#if accounts.filter(acc => acc.owner === editPaidBy).length > 0}
						<button
							type="button"
							onclick={() => isEditingAccounts = !isEditingAccounts}
							class="text-[#ff7361] hover:text-[#ff7361]/80 flex items-center gap-1 transition-colors focus:outline-none text-xs font-bold"
							title={t('editAccounts')}
						>
							{#if isEditingAccounts}
								<span class="material-symbols-outlined font-bold flex items-center justify-center" style="font-size: 20px; width: 20px; height: 20px;">check</span>
								<span>{t('done')}</span>
							{:else}
								<span class="material-symbols-outlined flex items-center justify-center" style="font-size: 20px; width: 20px; height: 20px;">edit</span>
								<span>{t('edit')}</span>
							{/if}
						</button>
					{/if}
				</div>
				<div class="flex flex-wrap gap-2 items-center">
					{#each accounts.filter(acc => acc.owner === editPaidBy) as acc}
						<div class="relative">
							<button
								type="button"
								disabled={isEditingAccounts}
								onclick={() => {
									if (editAccountId === acc.id) {
										editAccountId = null; // Unselect
									} else {
										editAccountId = acc.id;
									}
								}}
								class="px-3.5 py-1.5 rounded-lg border-2 text-xs font-bold transition-all 
								{editAccountId === acc.id ? 'border-[#ff7361] bg-[#ff7361]/5 text-[#ff7361]' : 'border-[#efeeea] bg-white text-[#2d3142]/80 hover:text-[#2d3142] hover:border-[#ff7361]/30 hover:bg-[#fbf9f5]/50'}
								{isEditingAccounts ? 'cursor-default opacity-80' : 'cursor-pointer'}"
							>
								{#if editAccountId === acc.id}<span class="mr-1.5 font-bold">✓</span>{/if}{acc.name}
							</button>
							{#if isEditingAccounts}
								<button
									type="button"
									onclick={() => deleteAccount(acc.id)}
									class="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#ff7361] text-white flex items-center justify-center shadow hover:bg-[#ff7361]/90 transition-colors focus:outline-none"
									title={t('delete')}
								>
									<span class="material-symbols-outlined text-[18px] font-bold scale-[0.45]">close</span>
								</button>
							{/if}
						</div>
					{/each}

					{#if isEditingAccounts || accounts.filter(acc => acc.owner === editPaidBy).length === 0}
						{#if isCreatingAccountInline}
							<div class="flex items-center gap-2">
								<div class="flex items-center border border-[#efeeea] bg-[#fbf9f5] rounded-lg px-2 h-[30px]">
									<input
										bind:this={inlineAccountInputEl}
										type="text"
										bind:value={inlineAccountName}
										placeholder={t('accountName')}
										class="bg-transparent border-none text-xs font-bold p-0 w-24 focus:ring-0 outline-none text-[#2d3142]"
										onkeydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												saveAccountInline();
											} else if (e.key === 'Escape') {
												cancelAccountInline();
											}
										}}
									/>
								</div>
								<button
									type="button"
									onclick={saveAccountInline}
									class="text-[#ff7361] hover:text-[#ff7361]/80 text-xs font-bold transition-colors focus:underline focus:outline-none cursor-pointer"
								>
									{t('save')}
								</button>
								<button
									type="button"
									onclick={cancelAccountInline}
									class="text-[#9ca3af] hover:text-[#2d3142] text-xs font-bold transition-colors focus:underline focus:outline-none cursor-pointer"
								>
									{t('cancel')}
								</button>
							</div>
						{:else}
							<button
								type="button"
								onclick={() => isCreatingAccountInline = true}
								class="pl-2.5 pr-3 py-1.5 rounded-lg border-2 border-dashed border-[#ff7361]/30 text-xs font-bold text-[#ff7361] hover:bg-[#ff7361]/5 transition-all flex items-center gap-1 focus:outline-none h-[32px]"
							>
								<span class="material-symbols-outlined text-[10px] font-bold">add</span>
								<span>{t('add')}</span>
							</button>
						{/if}
					{/if}
					<input type="hidden" name="accountId" value={editAccountId || ''} />
				</div>
			</div>

			<!-- Frequency -->
			<div>
				<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-3 border-b border-[#efeeea] pb-2">{t('frequency')}</p>
				<div class="grid grid-cols-4 p-1 bg-[#fbf9f5] rounded-full border border-[#efeeea]">
					<button
						type="button"
						onclick={() => editInterval = 0}
						class="py-1.5 px-1 rounded-full text-[11px] font-bold text-center transition-all {editInterval === 0 ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
					>
						{t('oneTime')}
					</button>
					<button
						type="button"
						onclick={() => editInterval = 1}
						class="py-1.5 px-1 rounded-full text-[11px] font-bold text-center transition-all {editInterval === 1 ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
					>
						{t('monthly')}
					</button>
					<button
						type="button"
						onclick={() => editInterval = 3}
						class="py-1.5 px-1 rounded-full text-[11px] font-bold text-center transition-all {editInterval === 3 ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
					>
						{t('quarterly')}
					</button>
					<button
						type="button"
						onclick={() => editInterval = 12}
						class="py-1.5 px-1 rounded-full text-[11px] font-bold text-center transition-all {editInterval === 12 ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
					>
						{t('yearly')}
					</button>
				</div>
				<input type="hidden" name="intervalMonths" value={editInterval} />

				<!-- Dynamic Calendar Grid from Stitch view -->
				<div class="mt-6 px-1">
					<div class="relative pt-2">
						<div class="grid grid-cols-7 gap-y-4 text-center items-center">
							<div class="pt-1 pb-2 text-[11px] font-black uppercase tracking-widest text-[#2d3142] flex items-center justify-center -translate-y-[1px]">{calendarMonths[0].year}</div>
							{#each calendarMonths as item}
								{@const isPaid = isPaymentMonth(item.year, item.month, editInterval, editAmountDate)}
								{@const monthName = new Date(item.year, item.month - 1, 1).toLocaleString(locale, { month: 'short' }).toUpperCase().substring(0, 3)}
								<div class="relative flex flex-col items-center justify-center pt-1 pb-2 {item.month === 1 ? 'border-l border-[#ff7361]/20' : ''}">
									{#if isPaid}
										<span class="text-[10px] font-bold text-[#ff7361]">{monthName}</span>
										<span class="w-1 h-1 rounded-full bg-[#ff7361] absolute bottom-0"></span>
									{:else}
										<span class="text-[10px] font-bold text-[#9ca3af]">{monthName}</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- Footer Buttons -->
			<div class="flex items-center justify-end gap-2 pt-4">
				<a
					href={cancelHref}
					class="px-4 py-3 text-[#9ca3af] text-xs font-bold hover:text-[#2d3142] transition-colors"
				>
					{t('cancel')}
				</a>
				<button
					type="submit"
					class="px-8 py-3 rounded-xl bg-[#ff7361] text-white text-xs font-bold hover:bg-[#ff7361]/90 shadow-sm transition-colors"
				>
					{t('createExpense')}
				</button>
			</div>
		</form>
	{:else if expense}
		<!-- VIEW/EDIT EXISTING TEMPLATE FORM -->
		<form
			method="POST"
			action="{actionRoute}?/update"
			use:enhance={({ action }) => {
				const actionName = action.search || '';
				return async ({ result, update }) => {
					if (result.type === 'success') {
						if (actionName.includes('archive')) {
							const expenseId = expense?.id;
							toasts.show(t('toastArchived'), 'success', 5000, {
								label: t('undo'),
								callback: async () => {
									const fd = new FormData();
									fd.append('id', String(expenseId));
									await fetch(`${actionRoute}?/unarchive`, { method: 'POST', body: fd });
									await invalidateAll();
								}
							});
						} else if (actionName.includes('updateAmount')) {
							isAmountEdit = false;
							const dateParts = editAmountDate.split('-');
							const y = parseInt(dateParts[0], 10);
							const m = parseInt(dateParts[1], 10);
							const dateObj = new Date(y, m - 1, 1);
							const formattedDate = dateObj.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
							const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
							toasts.show(t('toastAmountSaved', { name: editName, date: capitalizedDate }), 'success');
						} else if (actionName.includes('update')) {
							if (expense && editPaidBy !== expense.paidBy) {
								const targetPersonName = editPaidBy === 'A' ? namePersonA : namePersonB;
								toasts.show(t('toastMoved', { name: editName, person: targetPersonName }), 'success');
							}
						}
					}
					await update({ reset: false });
				};
			}}
			bind:this={editFormElement}
			class="space-y-12"
		>
			<input type="hidden" name="id" value={expense.id} />
			<input type="hidden" name="archivedDate" value={`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`} />

			<div class="space-y-6">
				<div class="flex justify-between items-start pb-2 gap-4">
					<!-- Title & Badges -->
					<div class="flex-grow min-w-0 space-y-3">
						<div class="inline-grid grid-cols-1 max-w-full min-w-[1ch]">
							<span class="col-start-1 row-start-1 invisible font-display text-2xl font-bold pb-1 whitespace-pre-wrap break-words">{editName || t('name')}</span>
							<textarea
								name="name"
								bind:value={editName}
								rows="1"
								required
								class="col-start-1 row-start-1 w-0 min-w-full h-full resize-none overflow-hidden font-display text-2xl font-bold text-[#2d3142] border-0 border-b border-[#efeeea] hover:border-[#ff7361] focus:border-[#ff7361] p-0 focus:ring-0 outline-none focus:outline-none pb-1 transition-colors duration-200 whitespace-pre-wrap break-words"
								onblur={triggerAutoSave}
								onkeydown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										e.currentTarget.form?.requestSubmit();
									}
								}}
							></textarea>
						</div>
						<div class="flex items-center gap-2">
							{#if expense.archivedDate}
								<div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-bold text-[10px] uppercase tracking-wider">
									<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
									{t('archived')}
								</div>
							{:else}
								<div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[10px] uppercase tracking-wider">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
									{t('active')}
								</div>
							{/if}
							<div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider transition-colors duration-200 {editPaidBy === 'A' ? 'bg-[#4a7bb0]/10 text-[#4a7bb0] border border-[#4a7bb0]/20' : 'bg-[#4fd1c5]/10 text-[#4fd1c5] border border-[#4fd1c5]/20'}">
								<span class="w-1.5 h-1.5 rounded-full {editPaidBy === 'A' ? 'bg-[#4a7bb0]' : 'bg-[#4fd1c5]'}"></span>
								{editPaidBy === 'A' ? namePersonA : namePersonB}
							</div>
						</div>
					</div>

					<!-- Amount and Date Box -->
					<div class="flex flex-col items-end space-y-1.5 flex-shrink-0">
						{#if !isAmountEdit}
							<button
								type="button"
								onclick={async () => {
									if (expense.archivedDate) return;
									isAmountEdit = true;
									editAmountVal = formatAmount(Math.round(latestAmount).toString());
									editAmountDate = expense.history?.[expense.history.length - 1]?.validFrom || new Date().toISOString().split('T')[0];
									await import('svelte').then(({ tick }) => tick());
									amountInputEl?.focus();
								}}
								class="group {expense.archivedDate ? 'cursor-default' : 'cursor-pointer hover:border-[#ff7361]/20 hover:bg-[#fbf9f5]'} border border-transparent p-2 -m-2 rounded-xl transition-all flex flex-col items-end relative text-[#2d3142]"
							>
								<div class="flex items-center">
									<span class="text-2xl font-bold text-[#2d3142] tracking-tight whitespace-nowrap">
										{#if currencyConfig.isPrefix}
											<span class="text-[#9ca3af] opacity-50 mr-1 inline-block" style="width: 1ch; display: inline-block; text-align: right;">{currencyConfig.symbol}</span>
										{/if}
										{new Intl.NumberFormat(locale).format(Math.round(latestAmount))}
										{#if !currencyConfig.isPrefix}
											<span class="text-[#9ca3af] opacity-50 ml-1 inline-block">{currencyConfig.symbol}</span>
										{/if}
									</span>
								</div>
								{#if expense.intervalMonths !== 0}
									<div class="mt-1 text-right flex items-center gap-1">
										<span class="text-[12px] text-[#9ca3af]">{t(isFuture ? 'from' : 'since')} <span class="font-bold text-[#2d3142]">{formatSinceDate(expense.history[expense.history.length - 1]?.validFrom || '', locale)}</span></span>
									</div>
								{:else}
									<div class="mt-1 text-right flex items-center gap-1">
										<span class="text-[12px] font-bold text-[#2d3142]">{formatOneTimeDate(expense.history[expense.history.length - 1]?.validFrom || '', locale)}</span>
									</div>
								{/if}
								{#if !expense.archivedDate}
									<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none w-8 h-8 bg-white/90 backdrop-blur shadow-sm rounded-full border border-[#ff7361]/20 flex items-center justify-center">
										<span class="material-symbols-outlined text-[#ff7361] text-[16px]">edit</span>
									</div>
								{/if}
							</button>
						{:else}
							<!-- Amount Edit Mode input block -->
							<div class="flex flex-col items-end space-y-2">
								<div class="flex items-center text-2xl font-bold text-[#2d3142] tracking-tight p-2 -m-2 border border-transparent whitespace-nowrap">
									{#if currencyConfig.isPrefix}
										<span class="text-[#9ca3af] opacity-50 mr-[9px] inline-block -translate-y-[3px]" style="width: 1ch; display: inline-block; text-align: right;">{currencyConfig.symbol}</span>
									{/if}
									<div class="inline-grid grid-cols-1 -translate-y-[1px]">
										<span class="col-start-1 row-start-1 invisible font-sans text-2xl font-bold pt-[1px] pb-[4px] whitespace-pre tracking-tight {currencyConfig.isPrefix ? '' : 'pr-[5px]'}">{editAmountVal || '0'}</span>
										<input
											bind:this={amountInputEl}
											type="text"
											inputmode="numeric"
											pattern="[0-9\s]*"
											value={editAmountVal}
											oninput={handleAmountInput}
											onkeydown={handleAmountKeyDown}
											class="col-start-1 row-start-1 w-0 min-w-full h-full font-sans text-2xl font-bold text-[#2d3142] border-0 border-b border-[#efeeea] hover:border-[#ff7361] focus:border-[#ff7361] p-0 focus:ring-0 outline-none focus:outline-none text-right pb-[4px] tracking-tight transition-colors duration-200 {currencyConfig.isPrefix ? '' : 'pr-[5px]'}"
											placeholder="0"
										/>
									</div>
									<input type="hidden" name="amount" value={editAmountVal.replace(/\D/g, '')} />
									{#if !currencyConfig.isPrefix}
										<span class="text-[#9ca3af] opacity-50 ml-1 inline-block -translate-y-[3px]">{currencyConfig.symbol}</span>
									{/if}
								</div>
								
								<div class="flex items-center mt-2.5">
									<input
										name="validFrom"
										type="date"
										bind:value={editAmountDate}
										class="px-1.5 py-0.5 rounded border border-[#efeeea] bg-[#fbf9f5] text-[12px] font-bold text-[#2d3142] focus:border-[#ff7361] focus:ring-0 outline-none cursor-pointer"
									/>
								</div>
								
								<div class="flex gap-2 pt-1">
									<button
										type="button"
										class="px-2 py-1 text-[#9ca3af] font-bold text-[12px] hover:text-[#2d3142]"
										onclick={() => isAmountEdit = false}
									>
										{t('cancel')}
									</button>
									<button
										formaction="{actionRoute}?/updateAmount"
										type="submit"
										class="px-3 py-1 bg-[#ff7361] text-white rounded text-[12px] font-bold hover:bg-[#ff7361]/90 transition-all shadow-sm"
									>
										{t('save')}
									</button>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Paid By Hidden input (updated via Move button) -->
				<input type="hidden" name="paidBy" value={editPaidBy} />

				{#if editInterval !== 0}
					<div class="grid grid-cols-2 gap-4">
						<div class="flex flex-col">
							<span class="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">{t('nextPayment')}</span>
							<span class="text-xl font-sans font-bold text-[#2d3142] mt-1">
								{formatOneTimeDate(getNextPaymentDate(editAmountDate, editInterval), locale)}
							</span>
						</div>
						<div class="flex flex-col">
							{#if editInterval === 1 || editInterval === 3 || editInterval === 12}
								{@const parsedAmt = parseFloat(editAmountVal.replace(/\D/g, '')) || 0}
								{@const comparisonCost = editInterval === 1 ? Math.round(parsedAmt * 12) : Math.round(parsedAmt / editInterval)}
								<span class="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">
									{editInterval === 1 ? t('yearlyComparisonPrice') : t('comparisonPrice')}
								</span>
								<span class="text-xl font-sans font-bold text-[#2d3142] mt-1">
									{#each formatter.formatToParts(comparisonCost) as part}
										{#if part.type === 'currency'}
											<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
										{:else if part.type !== 'literal'}
											{part.value}
										{/if}
									{/each}
								</span>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Split Ratio -->
			<div>
				<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-3 border-b border-[#efeeea] pb-2">{t('splittingRatio')}</p>
				<div class="space-y-4">
					<div class="grid grid-cols-2 p-1 bg-[#fbf9f5] rounded-full border border-[#efeeea]">
						<button
							type="button"
							onclick={() => { editSplitType = 'static'; triggerAutoSave(); }}
							class="py-1.5 rounded-full text-xs font-bold transition-all {editSplitType === 'static' ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
						>
							{t('static')}
						</button>
						<button
							type="button"
							onclick={() => { editSplitType = 'dynamic'; triggerAutoSave(); }}
							class="py-1.5 rounded-full text-xs font-bold transition-all {editSplitType === 'dynamic' ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
						>
							{t('dynamic')}
						</button>
					</div>
					<input type="hidden" name="splitType" value={editSplitType} />

					{#if editSplitType === 'static'}
						<div class="space-y-1 pt-0.5">
							<div class="flex justify-between text-sm font-bold text-[#2d3142]">
								<span>{namePersonA} <span class="text-[#4a7bb0] ml-0.5">{Math.round(editRatio * 100)}%</span></span>
								<span><span class="mr-0.5">{namePersonB}</span> <span class="text-[#4fd1c5]">{Math.round((1 - editRatio) * 100)}%</span></span>
							</div>
							<div class="h-6 flex items-center relative w-full group">
								<!-- Track -->
								<div 
									class="absolute inset-x-0 h-1.5 rounded-full overflow-hidden pointer-events-none"
									style="background: linear-gradient(to right, #4a7bb0 calc(10px + {editRatio * 100}% - {editRatio * 20}px), #4fd1c5 calc(10px + {editRatio * 100}% - {editRatio * 20}px))"
								></div>
								
								<!-- Custom Handle -->
								<div 
									class="absolute pointer-events-none w-5 h-5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),_0_0_0_1px_rgba(0,0,0,0.05)] flex items-center justify-center transition-transform duration-100 group-hover:scale-115 group-focus-within:scale-115"
									style="left: calc({editRatio * 100}% - {editRatio * 20}px);"
								>
									<svg width="20" height="20" viewBox="0 0 20 20" style="display:block;overflow:visible">
										<circle cx="10" cy="10" r="8.75" fill="white" />
										<circle cx="10" cy="10" r="8.75" fill="none" stroke="#4fd1c5" stroke-width="2.5" />
										<circle cx="10" cy="10" r="8.75" fill="none" stroke="#4a7bb0" stroke-width="2.5"
											stroke-dasharray="{editRatio * _C20} {_C20}"
											stroke-dashoffset="{-(0.5 - editRatio / 2) * _C20}" />
										<line x1="10" y1="7.5" x2="10" y2="12.5" stroke="#9ca3af" stroke-width="1.5" stroke-opacity="0.4" stroke-linecap="round" />
									</svg>
								</div>

								<!-- Native input (completely transparent, positioned absolutely to cover everything) -->
								<input
									name="staticSplitRatio"
									type="range"
									min="0"
									max="1"
									step="0.01"
									bind:value={editRatio}
									oninput={(e) => {
										editRatio = snapRatio(parseFloat(e.currentTarget.value));
										e.currentTarget.value = editRatio.toString();
									}}
									onchange={triggerAutoSave}
									class="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10 focus:outline-none"
								/>
							</div>
							<div class="flex justify-between text-xs font-medium text-[#9ca3af]">
								<span>{formatter.format(Math.round(expense.currentAmount * editRatio))}</span>
								<span>{formatter.format(Math.round(expense.currentAmount * (1 - editRatio)))}</span>
							</div>
						</div>
					{:else}
						<div class="space-y-1 pt-0.5">
							<div class="flex justify-between text-sm font-bold text-[#2d3142]">
								<span>{namePersonA} <span class="text-[#4a7bb0] ml-0.5">{Math.round(dynamicSplitRatioA * 100)}%</span></span>
								<span><span class="mr-0.5">{namePersonB}</span> <span class="text-[#4fd1c5]">{Math.round((1 - dynamicSplitRatioA) * 100)}%</span></span>
							</div>
							<!-- Styled share bar gradient without handle for dynamic split type -->
							<div class="h-6 flex items-center">
								{#if dynamicSplitRatioA === 0}
									<div class="w-full h-3 rounded-full" style="background: linear-gradient(to right, #76e8df, #4fd1c5)"></div>
								{:else if dynamicSplitRatioA === 1}
									<div class="w-full h-3 rounded-full" style="background: linear-gradient(to right, #4a7bb0, #6192c7)"></div>
								{:else}
									<div class="w-full h-3 rounded-full dynamic-share-bar--small" style="--pct-a: {dynamicSplitRatioA * 100}%"></div>
								{/if}
							</div>
							<div class="flex justify-between text-xs font-medium text-[#9ca3af]">
								<span>{formatter.format(Math.round(expense.currentAmount * dynamicSplitRatioA))}</span>
								<span>{formatter.format(Math.round(expense.currentAmount * (1 - dynamicSplitRatioA)))}</span>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Source Account -->
			<div>
				<div class="flex items-center justify-between mb-3 border-b border-[#efeeea] pb-2">
					<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest">{t('account')}</p>
					{#if accounts.filter(acc => acc.owner === editPaidBy).length > 0}
						<button
							type="button"
							onclick={() => isEditingAccounts = !isEditingAccounts}
							class="text-[#ff7361] hover:text-[#ff7361]/80 flex items-center gap-1 transition-colors focus:outline-none text-xs font-bold"
							title={t('editAccounts')}
						>
							{#if isEditingAccounts}
								<span class="material-symbols-outlined font-bold flex items-center justify-center" style="font-size: 20px; width: 20px; height: 20px;">check</span>
								<span>{t('done')}</span>
							{:else}
								<span class="material-symbols-outlined flex items-center justify-center" style="font-size: 20px; width: 20px; height: 20px;">edit</span>
								<span>{t('edit')}</span>
							{/if}
						</button>
					{/if}
				</div>
				<div class="flex flex-wrap gap-2 items-center">
					{#each accounts.filter(acc => acc.owner === editPaidBy) as acc}
						<div class="relative">
							<button
								type="button"
								disabled={isEditingAccounts}
								onclick={() => {
									if (editAccountId === acc.id) {
										editAccountId = null; // Unselect
									} else {
										editAccountId = acc.id;
									}
									triggerAutoSave();
								}}
								class="px-3.5 py-1.5 rounded-lg border-2 text-xs font-bold transition-all 
								{editAccountId === acc.id ? 'border-[#ff7361] bg-[#ff7361]/5 text-[#ff7361]' : 'border-[#efeeea] bg-white text-[#2d3142]/80 hover:text-[#2d3142] hover:border-[#ff7361]/30 hover:bg-[#fbf9f5]/50'}
								{isEditingAccounts ? 'cursor-default opacity-80' : 'cursor-pointer'}"
							>
								{#if editAccountId === acc.id}<span class="mr-1.5 font-bold">✓</span>{/if}{acc.name}
							</button>
							{#if isEditingAccounts}
								<button
									type="button"
									onclick={() => deleteAccount(acc.id)}
									class="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#ff7361] text-white flex items-center justify-center shadow hover:bg-[#ff7361]/90 transition-colors focus:outline-none"
									title={t('delete')}
								>
									<span class="material-symbols-outlined text-[18px] font-bold scale-[0.45]">close</span>
								</button>
							{/if}
						</div>
					{/each}

					{#if isEditingAccounts || accounts.filter(acc => acc.owner === editPaidBy).length === 0}
						{#if isCreatingAccountInline}
							<div class="flex items-center gap-2">
								<div class="flex items-center border border-[#efeeea] bg-[#fbf9f5] rounded-lg px-2 h-[30px]">
									<input
										bind:this={inlineAccountInputEl}
										type="text"
										bind:value={inlineAccountName}
										placeholder={t('accountName')}
										class="bg-transparent border-none text-xs font-bold p-0 w-24 focus:ring-0 outline-none text-[#2d3142]"
										onkeydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												saveAccountInline();
											} else if (e.key === 'Escape') {
												cancelAccountInline();
											}
										}}
									/>
								</div>
								<button
									type="button"
									onclick={saveAccountInline}
									class="text-[#ff7361] hover:text-[#ff7361]/80 text-xs font-bold transition-colors focus:underline focus:outline-none cursor-pointer"
								>
									{t('save')}
								</button>
								<button
									type="button"
									onclick={cancelAccountInline}
									class="text-[#9ca3af] hover:text-[#2d3142] text-xs font-bold transition-colors focus:underline focus:outline-none cursor-pointer"
								>
									{t('cancel')}
								</button>
							</div>
						{:else}
							<button
								type="button"
								onclick={() => isCreatingAccountInline = true}
								class="pl-2.5 pr-3 py-1.5 rounded-lg border-2 border-dashed border-[#ff7361]/30 text-xs font-bold text-[#ff7361] hover:bg-[#ff7361]/5 transition-all flex items-center gap-1 focus:outline-none h-[32px]"
							>
								<span class="material-symbols-outlined text-[10px] font-bold">add</span>
								<span>{t('add')}</span>
							</button>
						{/if}
					{/if}
					<input type="hidden" name="accountId" value={editAccountId || ''} />
				</div>
			</div>

			<!-- Frequency -->
			<div>
				<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-3 border-b border-[#efeeea] pb-2">{t('frequency')}</p>
				<div class="grid grid-cols-4 p-1 bg-[#fbf9f5] rounded-full border border-[#efeeea]">
					<button
						type="button"
						onclick={() => { editInterval = 0; triggerAutoSave(); }}
						class="py-1.5 px-1 rounded-full text-[11px] font-bold text-center transition-all {editInterval === 0 ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
					>
						{t('oneTime')}
					</button>
					<button
						type="button"
						onclick={() => { editInterval = 1; triggerAutoSave(); }}
						class="py-1.5 px-1 rounded-full text-[11px] font-bold text-center transition-all {editInterval === 1 ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
					>
						{t('monthly')}
					</button>
					<button
						type="button"
						onclick={() => { editInterval = 3; triggerAutoSave(); }}
						class="py-1.5 px-1 rounded-full text-[11px] font-bold text-center transition-all {editInterval === 3 ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
					>
						{t('quarterly')}
					</button>
					<button
						type="button"
						onclick={() => { editInterval = 12; triggerAutoSave(); }}
						class="py-1.5 px-1 rounded-full text-[11px] font-bold text-center transition-all {editInterval === 12 ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
					>
						{t('yearly')}
					</button>
				</div>
				<input type="hidden" name="intervalMonths" value={editInterval} />

				<!-- Dynamic Calendar Grid from Stitch view -->
				<div class="mt-6 px-1">
					<div class="relative pt-2">
						<div class="grid grid-cols-7 gap-y-4 text-center items-center">
							<div class="pt-1 pb-2 text-[11px] font-black uppercase tracking-widest text-[#2d3142] flex items-center justify-center -translate-y-[1px]">{calendarMonths[0].year}</div>
							{#each calendarMonths as item}
								{@const isPaid = isPaymentMonth(item.year, item.month, editInterval, editAmountDate)}
								{@const monthName = new Date(item.year, item.month - 1, 1).toLocaleString(locale, { month: 'short' }).toUpperCase().substring(0, 3)}
								<div class="relative flex flex-col items-center justify-center pt-1 pb-2 {item.month === 1 ? 'border-l border-[#ff7361]/20' : ''}">
									{#if isPaid}
										<span class="text-[10px] font-bold text-[#ff7361]">{monthName}</span>
										<span class="w-1 h-1 rounded-full bg-[#ff7361] absolute bottom-0"></span>
									{:else}
										<span class="text-[10px] font-bold text-[#9ca3af]">{monthName}</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- Price History Section (Only if not one-time) -->
			{#if editInterval !== 0}
				<div>
					<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-3 border-b border-[#efeeea] pb-2">{t('history')}</p>
					{#key expense?.id}
						<div class="w-full text-xs space-y-1 overflow-hidden" class:history-fade={deletedHistoryIds.length > 0}>
							{#each combinedHistoryTimeline as item (item.id || `${item.type}-${item.date}`)}
								{@const isFuturePrice = item.type === 'price' && item.date > new Date().toISOString().split('T')[0]}
								<div
									transition:horizontalThenCollapse={{ duration: 350 }}
									class="flex items-center justify-between py-1 group {isFuturePrice ? 'opacity-40' : ''}"
								>
									<div class="flex items-center gap-2">
										<span class="font-bold text-sm text-[#2d3142]">{formatHistoryDate(item.date, locale)}</span>
										<!-- Trash Icon on Hover -->
										{#if item.type === 'price' && combinedHistoryTimeline.filter(h => h.type === 'price').length > 1 && !expense.archivedDate}
											<button
												type="button"
												onclick={() => deleteHistoryItem(item)}
												class="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 p-1 text-[#9ca3af] hover:text-[#ff7361] focus:outline-none flex items-center justify-center cursor-pointer"
												title={t('delete')}
											>
												<span class="material-symbols-outlined text-[18px]">delete</span>
											</button>
										{/if}
									</div>

									<div class="flex items-center gap-2">
										<div class="text-right font-bold text-sm text-[#2d3142] font-sans">
											{#if item.type === 'archive'}
												{t('archived')}
											{:else}
												<div class="inline-flex items-center gap-1.5">
													{#if item.pctChange !== null && item.pctChange !== 0}
														<span class="text-[11px] font-medium text-[#9ca3af] bg-[#f3f4f6] px-1 py-0.5 rounded-md">
															{item.pctChange > 0 ? '+' : ''}{Math.round(item.pctChange)}%
														</span>
													{/if}
													<span>
														{#each formatter.formatToParts(Math.round(item.amount)) as part}
															{#if part.type === 'currency'}
																<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-1' : 'ml-1'}">{part.value}</span>
															{:else if part.type !== 'literal'}
																{part.value}
															{/if}
														{/each}
													</span>
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/key}

					<!-- Minimalistic visual trend diagram -->
					{#if chartPoints.length >= 2}
						<div class="mt-6">
							<div class="relative w-full h-[100px] overflow-hidden">
								<svg class="w-full h-full overflow-hidden" viewBox="0 0 400 100" preserveAspectRatio="none">
									<defs>
										<!-- Historical Gradient -->
										<linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="#ff7361" stop-opacity="0.15" />
											<stop offset="100%" stop-color="#ff7361" stop-opacity="0" />
										</linearGradient>
										<!-- Predicted Gradient -->
										<linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="#9ca3af" stop-opacity="0.1" />
											<stop offset="100%" stop-color="#9ca3af" stop-opacity="0" />
										</linearGradient>
									</defs>
									
									<!-- Year ticks and labels on X Axis -->
									{#each chartCoords.yearTicks as tick}
										<g>
											<!-- Thin vertical line showing where the year begins -->
											<line x1={tick.x} y1="82" x2={tick.x} y2="88" stroke="#9ca3af" stroke-width="1" stroke-linecap="round" />
											{#if tick.showYearLabel}
												<text
													x={tick.x}
													y={99}
													text-anchor="middle"
													fill={tick.year === currentYear ? '#ff7361' : '#4b5563'}
													class="text-[11px] font-bold select-none pointer-events-none"
												>
													{tick.year}
												</text>
											{/if}
										</g>
									{/each}

									<!-- Historical Segment Area -->
									{#if chartCoords.areaPath}
										<path d={chartCoords.areaPath} fill="url(#chartGrad)" />
									{/if}

									<!-- Predicted Segment Area -->
									{#if chartCoords.predictedAreaPath}
										<path d={chartCoords.predictedAreaPath} fill="url(#predGrad)" />
									{/if}
									
									<!-- Historical Segment Line -->
									{#if chartCoords.curvePath}
										<path d={chartCoords.curvePath} fill="none" stroke="#ff7361" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
									{/if}

									<!-- Predicted Segment Line (Thinner than before) -->
									{#if chartCoords.predictedCurvePath}
										<path d={chartCoords.predictedCurvePath} fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round" stroke-linejoin="round" />
									{/if}
								</svg>

								<!-- HTML-based Event Dots (positioned absolutely to guarantee perfect circles and no aspect ratio squishing) -->
								{#each chartCoords.coords as pt}
									<div
										class="absolute w-2 h-2 rounded-full bg-white border-2 transition-transform duration-150 hover:scale-130 cursor-pointer -translate-x-1/2 -translate-y-1/2"
										style="left: {(pt.x / 400) * 100}%; top: {pt.y}%; border-color: #ff7361;"
									>
										<title>{formatter.format(Math.round(pt.amount))}</title>
									</div>
								{/each}

								{#if chartCoords.predictedPoint}
									{@const pt = chartCoords.predictedPoint}
									<div
										class="absolute w-2 h-2 rounded-full bg-white border-2 border-[#9ca3af] border-dashed transition-transform duration-150 hover:scale-130 cursor-pointer -translate-x-1/2 -translate-y-1/2"
										style="left: {(pt.x / 400) * 100}%; top: {pt.y}%;"
									>
										<title>{t('predictedAmount', { amount: formatter.format(Math.round(pt.amount)), date: formatHistoryDate(pt.date, locale) })}</title>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Actions (Archive, Move, & Hide) -->
			<div class="pt-4 flex flex-col gap-3">
				<div class="flex items-center justify-between gap-3">
					{#if !expense.archivedDate}
						<button
							formaction="{actionRoute}?/archive"
							type="submit"
							class="h-10 flex-grow flex-1 flex items-center justify-center gap-2 px-3 rounded-xl border-2 border-[#efeeea] text-[#9ca3af] hover:text-[#ff7361] hover:border-[#ff7361]/30 transition-all group"
							title={t('archiveExpense')}
						>
							<span class="material-symbols-outlined text-[20px]">stop_circle</span>
							<span class="text-xs font-bold text-center">{t('archiveExpense')}</span>
						</button>
					{/if}

					<button
						type="button"
						onclick={() => {
							editPaidBy = editPaidBy === 'A' ? 'B' : 'A';
							triggerAutoSave();
						}}
						class="h-10 flex-grow flex-1 flex items-center justify-center gap-2 px-3 rounded-xl border-2 border-[#efeeea] text-[#9ca3af] hover:text-[#ff7361] hover:border-[#ff7361]/30 transition-all group"
					>
						<span class="material-symbols-outlined text-[20px] font-bold">arrow_forward</span>
						<span class="text-xs font-bold text-center">
							{t('moveTo', { name: editPaidBy === 'A' ? namePersonB : namePersonA })}
						</span>
					</button>
				</div>
			</div>
		</form>
	{/if}
</div>

<style>
	.floating-sidebar-card {
		/* Consistent shadow-lg (same as other dashboard cards) for all desktop viewports */
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		border: 1px solid #efeeea;
	}
	@media (max-width: 1023.98px) {
		.floating-sidebar-card {
			/* No shadow and no border on tablet/mobile full screen */
			box-shadow: none;
			border: none;
			border-top-left-radius: 1rem;
			border-top-right-radius: 1rem;
		}
	}
	.history-fade {
		mask-image: linear-gradient(to right, black 85%, transparent 100%);
		-webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
	}
</style>
