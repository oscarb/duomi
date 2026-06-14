<script lang="ts">
	import { getContext } from 'svelte';
	import { enhance, deserialize } from '$app/forms';
	import { page } from '$app/state';
	import { invalidateAll, goto } from '$app/navigation';
	import { toasts } from '$lib/toasts.svelte';

	// Retrieve localized translations and formatting
	const { locale, t, currencyConfig, formatter } = getContext<{
		locale: string;
		t: (key: string, params?: Record<string, string>) => string;
		currencyConfig: import('$lib/translations').CurrencyConfig;
		formatter: Intl.NumberFormat;
	}>('i18n');

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
		return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
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
		const formatted = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

		const digitsBeforeCursor = originalValue.slice(0, cursorPosition).replace(/\D/g, '').length;

		editAmountVal = formatted;
		input.value = formatted;

		let newCursorPosition = 0;
		let digitsFound = 0;
		for (let i = 0; i < formatted.length; i++) {
			if (formatted[i] !== ' ') {
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

	// Filter sequential unique changes and combine with archive date for a chronological timeline
	let combinedHistoryTimeline = $derived.by(() => {
		if (!expense) return [];
		const sortedChrono = expense.history ? [...expense.history].sort((a, b) => a.validFrom.localeCompare(b.validFrom)) : [];
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

		// 1. Predict next price point based on previous intervals and deltas
		const times = chartPoints.map(p => parseDateToTime(p.date));
		const intervals = [];
		for (let i = 1; i < times.length; i++) {
			intervals.push(times[i] - times[i - 1]);
		}
		const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 365 * 24 * 60 * 60 * 1000;
		const predictedTime = times[times.length - 1] + avgInterval;
		const predictedDateObj = new Date(predictedTime);
		const predictedDateStr = `${predictedDateObj.getFullYear()}-${String(predictedDateObj.getMonth() + 1).padStart(2, '0')}-${String(predictedDateObj.getDate()).padStart(2, '0')}`;

		const deltas = [];
		for (let i = 1; i < chartPoints.length; i++) {
			deltas.push(chartPoints[i].amount - chartPoints[i - 1].amount);
		}
		const avgDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
		const predictedAmount = Math.max(0, chartPoints[chartPoints.length - 1].amount + avgDelta);

		// 2. Set ranges
		const minAmt = Math.min(...chartPoints.map(p => p.amount), predictedAmount);
		const maxAmt = Math.max(...chartPoints.map(p => p.amount), predictedAmount);
		const amtRange = maxAmt - minAmt;

		const minTime = times[0];
		const maxTime = parseDateToTime(predictedDateStr);
		const timeRange = maxTime - minTime;

		const getX = (dStr: string) => {
			const t = parseDateToTime(dStr);
			return timeRange === 0 ? 200 : ((t - minTime) / timeRange) * 360 + 20;
		};

		const getY = (amt: number) => {
			return amtRange === 0 ? 50 : 85 - ((amt - minAmt) / amtRange) * 70;
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

		const predictedPoint = {
			x: getX(predictedDateStr),
			y: getY(predictedAmount),
			amount: predictedAmount,
			date: predictedDateStr
		};

		const fullCoords = [...coords, predictedPoint];

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

		let historicalCurvePath = '';
		let predictedCurvePath = '';

		for (let i = 1; i < fullCoords.length; i++) {
			const prev = fullCoords[i - 1];
			const pt = fullCoords[i];
			const cp1 = controlPoint(prev, fullCoords[i - 2], pt, false);
			const cp2 = controlPoint(pt, prev, fullCoords[i + 1], true);
			
			const segment = `C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${pt.x} ${pt.y}`;
			
			if (i === 1) {
				historicalCurvePath = `M ${prev.x} ${prev.y} ${segment}`;
			} else if (i < fullCoords.length - 1) {
				historicalCurvePath += ` ${segment}`;
			} else {
				predictedCurvePath = `M ${prev.x} ${prev.y} ${segment}`;
			}
		}

		const historicalAreaPath = historicalCurvePath
			? `${historicalCurvePath} L ${coords[coords.length - 1].x} 88 L ${coords[0].x} 88 Z`
			: '';
			
		const predictedAreaPath = predictedCurvePath
			? `${predictedCurvePath} L ${predictedPoint.x} 88 L ${coords[coords.length - 1].x} 88 Z`
			: '';

		// 5. Generate year ticks along the x axis
		const startYear = new Date(minTime).getFullYear();
		const endYear = new Date(maxTime).getFullYear();
		const yearTicks = [];

		for (let yr = startYear; yr <= endYear; yr++) {
			const yrStartStr = `${yr}-01-01`;
			const yrTime = parseDateToTime(yrStartStr);
			
			let x = 20;
			let drawTick = true;
			if (yrTime < minTime) {
				x = 20;
				drawTick = false;
			} else {
				x = getX(yrStartStr);
			}
			
			if (x >= 20 && x <= 380) {
				yearTicks.push({
					year: yr,
					x,
					drawTick
				});
			}
		}

		return { coords, curvePath: historicalCurvePath, areaPath: historicalAreaPath, predictedPoint, predictedCurvePath, predictedAreaPath, yearTicks };
	});

	function handleAmountKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			const step = e.shiftKey ? 10 : 1;
			const currentVal = parseFloat(editAmountVal.replace(/\s/g, '')) || 0;
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

	// Account creation states
	let showAddAccount = $state(false);
	let newAccountName = $state('');
	let newAccountOwner = $state<'A' | 'B'>('A');
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
								<span class="col-start-1 row-start-1 invisible font-sans text-2xl font-bold pt-[1px] pr-[6px] pb-[4px] whitespace-pre tracking-tight">{editAmountVal || '0'}</span>
								<input
									type="text"
									inputmode="numeric"
									pattern="[0-9\s]*"
									value={editAmountVal}
									oninput={handleAmountInput}
									onkeydown={handleAmountKeyDown}
									required
									class="col-start-1 row-start-1 w-0 min-w-full h-full font-sans text-2xl font-bold text-[#2d3142] border-0 border-b border-[#efeeea] hover:border-[#ff7361] focus:border-[#ff7361] p-0 focus:ring-0 outline-none focus:outline-none text-right pr-[6px] pb-[4px] tracking-tight transition-colors duration-200"
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

			<!-- Split Ratio -->
			<div>
				<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-3">{t('splittingRatio')}</p>
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
						{@const parsedAmt = parseFloat(editAmountVal.replace(/\s/g, '')) || 0}
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
						{@const parsedAmt = parseFloat(editAmountVal.replace(/\s/g, '')) || 0}
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
				<div class="flex items-center justify-between mb-3">
					<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest">{t('source')}</p>
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
				<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-3">{t('frequency')}</p>
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
			<div class="flex gap-4 pt-4">
				<a
					href={cancelHref}
					class="flex-1 py-3 text-center rounded-xl bg-[#fbf9f5] border border-[#efeeea] text-xs font-bold text-[#9ca3af] hover:text-[#2d3142] transition-colors"
				>
					{t('cancel')}
				</a>
				<button
					type="submit"
					class="flex-1 py-3 rounded-xl bg-[#ff7361] text-white text-xs font-bold hover:bg-[#ff7361]/90 shadow-sm transition-colors"
				>
					{t('createTemplate')}
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
							toasts.show(t('toastArchived'), 'success');
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
				<div class="flex flex-col items-end space-y-1.5">
					{#if !isAmountEdit}
						<button
							type="button"
							onclick={async () => {
								isAmountEdit = true;
								editAmountVal = formatAmount(Math.round(latestAmount).toString());
								editAmountDate = expense.history?.[expense.history.length - 1]?.validFrom || new Date().toISOString().split('T')[0];
								await import('svelte').then(({ tick }) => tick());
								amountInputEl?.focus();
							}}
							class="group cursor-pointer border border-transparent hover:border-[#ff7361]/20 hover:bg-[#fbf9f5] p-2 -m-2 rounded-xl transition-all flex flex-col items-end relative text-[#2d3142]"
						>
							<div class="flex items-center">
								<span class="text-2xl font-bold text-[#2d3142] tracking-tight">
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
							<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none w-8 h-8 bg-white/90 backdrop-blur shadow-sm rounded-full border border-[#ff7361]/20 flex items-center justify-center">
								<span class="material-symbols-outlined text-[#ff7361] text-[16px]">edit</span>
							</div>
						</button>
					{:else}
						<!-- Amount Edit Mode input block -->
						<div class="flex flex-col items-end space-y-2">
							<div class="flex items-center text-2xl font-bold text-[#2d3142] tracking-tight p-2 -m-2">
								{#if currencyConfig.isPrefix}
									<span class="text-[#9ca3af] opacity-50 mr-1 inline-block -translate-y-[2px]" style="width: 1ch; display: inline-block; text-align: right;">{currencyConfig.symbol}</span>
								{/if}
								<div class="inline-grid grid-cols-1">
									<span class="col-start-1 row-start-1 invisible font-sans text-2xl font-bold pt-[1px] pr-[6px] pb-[4px] whitespace-pre tracking-tight">{editAmountVal || '0'}</span>
									<input
										bind:this={amountInputEl}
										type="text"
										inputmode="numeric"
										pattern="[0-9\s]*"
										value={editAmountVal}
										oninput={handleAmountInput}
										onkeydown={handleAmountKeyDown}
										class="col-start-1 row-start-1 w-0 min-w-full h-full font-sans text-2xl font-bold text-[#2d3142] border-0 border-b border-[#efeeea] hover:border-[#ff7361] focus:border-[#ff7361] p-0 focus:ring-0 outline-none focus:outline-none text-right pr-[6px] pb-[4px] tracking-tight transition-colors duration-200"
										placeholder="0"
									/>
								</div>
								<input type="hidden" name="amount" value={editAmountVal.replace(/\D/g, '')} />
								{#if !currencyConfig.isPrefix}
									<span class="text-[#9ca3af] opacity-50 ml-1 inline-block -translate-x-[1px] -translate-y-[2px]">{currencyConfig.symbol}</span>
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

			<!-- Split Ratio -->
			<div>
				<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-3">{t('splittingRatio')}</p>
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
				<div class="flex items-center justify-between mb-3">
					<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest">{t('source')}</p>
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
				<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-3">{t('frequency')}</p>
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
					<p class="text-xs font-black text-[#9ca3af] uppercase tracking-widest mb-3">{t('history')}</p>
					<table class="w-full text-xs">
						<tbody class="text-[#2d3142]">
							{#each combinedHistoryTimeline as item}
								{@const isFuturePrice = item.type === 'price' && item.date > new Date().toISOString().split('T')[0]}
								<tr class={isFuturePrice ? 'opacity-40' : ''}>
									<td class="py-2 font-bold text-sm text-[#2d3142]">{formatHistoryDate(item.date, locale)}</td>
									<td class="py-2 text-right font-bold text-sm text-[#2d3142] font-sans">
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
									</td>
								</tr>
							{/each}
						</tbody>
					</table>

					<!-- Minimalistic visual trend diagram -->
					{#if chartPoints.length >= 2}
						<div class="mt-6 pt-4 border-t border-[#efeeea]">
							<p class="text-[10px] font-black text-[#9ca3af] uppercase tracking-widest mb-3">{t('priceTrend')}</p>
							<div class="relative w-full h-[100px] overflow-visible">
								<svg class="w-full h-full overflow-visible" viewBox="0 0 400 100" preserveAspectRatio="none">
									<defs>
										<!-- Historical Gradient -->
										<linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color={expense.paidBy === 'A' ? '#ff7361' : '#4fd1c5'} stop-opacity="0.15" />
											<stop offset="100%" stop-color={expense.paidBy === 'A' ? '#ff7361' : '#4fd1c5'} stop-opacity="0" />
										</linearGradient>
										<!-- Predicted Gradient -->
										<linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="#9ca3af" stop-opacity="0.1" />
											<stop offset="100%" stop-color="#9ca3af" stop-opacity="0" />
										</linearGradient>
									</defs>
									<!-- Baseline -->
									<line x1="15" y1="88" x2="385" y2="88" stroke="#efeeea" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round" />
									
									<!-- Year ticks and labels on X Axis -->
									{#each chartCoords.yearTicks as tick}
										<g>
											{#if tick.drawTick}
												<line x1={tick.x} y1="88" x2={tick.x} y2="92" stroke="#efeeea" stroke-width="1.5" stroke-linecap="round" />
												<text x={tick.x} y={99} text-anchor="middle" fill="#9ca3af" class="text-[9px] font-bold select-none pointer-events-none">
													{tick.year}
												</text>
											{:else}
												<text x={tick.x} y={99} text-anchor="start" fill="#9ca3af" class="text-[9px] font-bold select-none pointer-events-none">
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
										<path d={chartCoords.curvePath} fill="none" stroke={expense.paidBy === 'A' ? '#ff7361' : '#4fd1c5'} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
									{/if}

									<!-- Predicted Segment Line -->
									{#if chartCoords.predictedCurvePath}
										<path d={chartCoords.predictedCurvePath} fill="none" stroke="#9ca3af" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round" stroke-linejoin="round" />
									{/if}
									
									<!-- Historical Event Dots -->
									{#each chartCoords.coords as pt}
										<g>
											<circle
												cx={pt.x}
												cy={pt.y}
												r="3.5"
												fill="white"
												stroke={expense.paidBy === 'A' ? '#ff7361' : '#4fd1c5'}
												stroke-width="2"
												class="hover:scale-130 transition-transform duration-150 cursor-pointer"
												style="transform-origin: {pt.x}px {pt.y}px;"
											>
												<title>{formatter.format(Math.round(pt.amount))}</title>
											</circle>
										</g>
									{/each}

									<!-- Predicted Event Dot -->
									{#if chartCoords.predictedPoint}
										{@const pt = chartCoords.predictedPoint}
										<g>
											<circle
												cx={pt.x}
												cy={pt.y}
												r="3.5"
												fill="white"
												stroke="#9ca3af"
												stroke-dasharray="2 1"
												stroke-width="1.5"
												class="hover:scale-130 transition-transform duration-150 cursor-pointer"
												style="transform-origin: {pt.x}px {pt.y}px;"
											>
												<title>Predicted: {formatter.format(Math.round(pt.amount))} (approx. {formatHistoryDate(pt.date, locale)})</title>
											</circle>
										</g>
									{/if}
								</svg>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Actions (Archive, Move, & Hide) -->
			<div class="pt-4 flex flex-col gap-3">
				<div class="flex items-center justify-between gap-3">
					<button
						formaction="{actionRoute}?/archive"
						type="submit"
						class="flex-grow flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 rounded-xl text-[#ff7361] transition-all font-bold group border-[#ff7361] hover:bg-[#ff7361] hover:text-white"
					>
						<span class="material-symbols-outlined text-[20px]">archive</span>
						<span class="text-xs font-bold text-center">{t('archiveExpense')}</span>
					</button>

					<button
						type="button"
						onclick={() => {
							editPaidBy = editPaidBy === 'A' ? 'B' : 'A';
							triggerAutoSave();
						}}
						class="flex-grow flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 rounded-xl text-[#ff7361] transition-all font-bold group border-[#ff7361] hover:bg-[#ff7361] hover:text-white"
					>
						<span class="text-xs font-bold text-center">
							{t('moveTo', { name: editPaidBy === 'A' ? namePersonB : namePersonA })}
						</span>
						<span class="material-symbols-outlined text-[20px] font-bold">arrow_forward</span>
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
</style>
