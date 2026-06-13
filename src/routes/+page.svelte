<script lang="ts">
	import { page } from '$app/state';
	import { getContext } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { toasts } from '$lib/toasts.svelte';
	import ExpenseFormCard from '$lib/components/ExpenseFormCard.svelte';
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';

	let { data } = $props();

	const { locale, t, currencyConfig, formatter } = getContext<{
		locale: string;
		t: (key: string, params?: Record<string, string>) => string;
		currencyConfig: import('$lib/translations').CurrencyConfig;
		formatter: Intl.NumberFormat;
	}>('i18n');

	const nowObj = new Date();
	const realYear = nowObj.getFullYear();
	const realMonth = nowObj.getMonth() + 1;
	let isCurrentPeriod = $derived(data.period.year === realYear && data.period.month === realMonth);
	let isPastPeriod = $derived(data.period.year < realYear || (data.period.year === realYear && data.period.month < realMonth));

	// Read selected expense ID from query parameters to determine if overlay is open
	let selectedId = $derived(parseInt(page.url.searchParams.get('id') || '', 10) || null);
	let isCreateMode = $derived(page.url.searchParams.get('new') === 'true');
	let initialPaidBy = $derived((page.url.searchParams.get('paidBy') as 'A' | 'B') || 'A');

	let selectedExpense = $derived(data.templates?.find(e => e.id === selectedId) || null);
	let isOverlayOpen = $derived(selectedId !== null || isCreateMode);

	let overlayCancelHref = $derived.by(() => {
		const year = page.url.searchParams.get('year');
		const month = page.url.searchParams.get('month');
		if (year && month) {
			return `/?year=${year}&month=${month}`;
		}
		return '/';
	});

	// Calculate prev/next months
	let prevMonth = $derived.by(() => {
		let m = data.period.month - 1;
		let y = data.period.year;
		if (m === 0) {
			m = 12;
			y -= 1;
		}
		return { year: y, month: m };
	});

	let nextMonth = $derived.by(() => {
		let m = data.period.month + 1;
		let y = data.period.year;
		if (m === 13) {
			m = 1;
			y += 1;
		}
		return { year: y, month: m };
	});

	// Derived navigation links that preserve existing query parameters (like 'new', 'id', 'paidBy')
	let prevMonthHref = $derived.by(() => {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('year', prevMonth.year.toString());
		params.set('month', prevMonth.month.toString());
		return `?${params.toString()}`;
	});

	let nextMonthHref = $derived.by(() => {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('year', nextMonth.year.toString());
		params.set('month', nextMonth.month.toString());
		return `?${params.toString()}`;
	});

	let todayHref = $derived.by(() => {
		const params = new URLSearchParams(page.url.searchParams);
		params.delete('year');
		params.delete('month');
		const str = params.toString();
		return str ? `/?${str}` : '/';
	});

	// Dynamically format month names based on locale
	let monthName = $derived.by(() => {
		const date = new Date(data.period.year, data.period.month - 1, 1);
		const formatted = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
		return formatted.charAt(0).toUpperCase() + formatted.slice(1);
	});

	// Format the real current month name for the "go to current month" button title
	let realMonthName = $derived.by(() => {
		const date = new Date(realYear, realMonth - 1, 1);
		const formatted = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
		return formatted.charAt(0).toUpperCase() + formatted.slice(1);
	});

	import { calculateSettlement } from '$lib/calculations';

	function formatIncome(val: string): string {
		const clean = val.replace(/\D/g, '');
		if (!clean) return '';
		return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
	}

	function handleIncomeInput(e: Event, key: 'A' | 'B') {
		const input = e.target as HTMLInputElement;
		const cursorPosition = input.selectionStart || 0;
		const originalValue = input.value;

		let clean = originalValue.replace(/\D/g, '');
		if (clean.startsWith('0')) {
			clean = '0';
		}
		clean = clean.slice(0, 7); // Max 7 digits
		const formatted = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

		const digitsBeforeCursor = originalValue.slice(0, cursorPosition).replace(/\D/g, '').length;

		if (key === 'A') {
			incomeAVal = formatted;
		} else {
			incomeBVal = formatted;
		}

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

	// Temporary dynamic edit states
	let incomeAVal = $state('');
	let incomeBVal = $state('');

	let currentIncomeANum = $derived.by(() => {
		const val = incomeAVal.replace(/\s/g, '');
		if (val === '') {
			return data.income.isFallback ? data.income.person_a : 0;
		}
		return parseFloat(val) || 0;
	});

	let currentIncomeBNum = $derived.by(() => {
		const val = incomeBVal.replace(/\s/g, '');
		if (val === '') {
			return data.income.isFallback ? data.income.person_b : 0;
		}
		return parseFloat(val) || 0;
	});

	let currentTotalIncome = $derived(currentIncomeANum + currentIncomeBNum);

	let currentPctA = $derived(currentTotalIncome > 0 ? currentIncomeANum / currentTotalIncome : 0.5);
	let currentPctB = $derived(currentTotalIncome > 0 ? currentIncomeBNum / currentTotalIncome : 0.5);

	let currentSettlement = $derived(calculateSettlement(currentIncomeANum, currentIncomeBNum, data.expenses.items));

	let currentPeriodKey = $state('');

	// Keep input in sync with server data when month changes
	$effect(() => {
		const periodKey = `${data.period.year}-${data.period.month}`;
		if (currentPeriodKey !== periodKey) {
			currentPeriodKey = periodKey;
			incomeAVal = data.income.isFallback || data.income.person_a === 0 ? '' : formatIncome(data.income.person_a.toString());
			incomeBVal = data.income.isFallback || data.income.person_b === 0 ? '' : formatIncome(data.income.person_b.toString());
		}
	});

	let expenseAmounts = $state<Record<number, string>>({});

	$effect(() => {
		const newAmounts: Record<number, string> = {};
		for (const item of data.expenses.items) {
			newAmounts[item.id] = formatIncome(Math.round(item.amount).toString());
		}
		expenseAmounts = newAmounts;
	});

	function handleExpenseAmountInput(e: Event, id: number) {
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

		expenseAmounts[id] = formatted;
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

	async function saveExpenseAmount(expenseId: number, amountStr: string) {
		const amount = Math.round(parseFloat(amountStr.replace(/\s/g, '')) || 0);
		const year = data.period.year;
		const month = data.period.month;
		const validFrom = `${year}-${String(month).padStart(2, '0')}-01`;

		try {
			const response = await fetch('/api/expenses', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: expenseId,
					amount,
					validFrom
				})
			});
			if (!response.ok) {
				console.error('Failed to save expense amount:', await response.text());
			} else {
				const expenseName = data.expenses.items.find(e => e.id === expenseId)?.name || '';
				const dateObj = new Date(year, month - 1, 1);
				const formattedDate = dateObj.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
				const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
				toasts.show(t('toastAmountSaved', { name: expenseName, date: capitalizedDate }), 'success');
				await invalidateAll();
			}
		} catch (err) {
			console.error('Error saving expense amount:', err);
		}
	}

	let copyStatus = $state('copy');

	function copySettlementText() {
		const payerName = currentSettlement.payer === 'A' ? data.personAName : data.personBName;
		const receiverName = currentSettlement.payer === 'A' ? data.personBName : data.personAName;
		const text = t('owes', {
			payer: payerName,
			receiver: receiverName,
			amount: formatter.format(Math.round(currentSettlement.amount))
		});
		navigator.clipboard.writeText(text).then(() => {
			copyStatus = 'copied';
			setTimeout(() => {
				copyStatus = 'copy';
			}, 2000);
		});
	}

	function shareSettlement() {
		const amountText = formatter.format(Math.round(currentSettlement.amount));
		if (navigator.share) {
			navigator.share({
				text: amountText
			}).catch(err => {
				console.error('Error sharing:', err);
			});
		} else {
			navigator.clipboard.writeText(amountText);
		}
	}

	async function saveIncomes() {
		const valA = incomeAVal.replace(/\s/g, '');
		const valB = incomeBVal.replace(/\s/g, '');
		if (valA === '' && valB === '' && data.income.isFallback) {
			return;
		}
		const incomeA = Math.round(parseFloat(valA) || 0);
		const incomeB = Math.round(parseFloat(valB) || 0);
		try {
			const response = await fetch('/api/overview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					year: data.period.year,
					month: data.period.month,
					incomeA,
					incomeB
				})
			});
			if (!response.ok) {
				console.error('Failed to save incomes:', await response.text());
			}
		} catch (err) {
			console.error('Error saving incomes:', err);
		}
	}

	let filterPartA = $state(browser ? localStorage.getItem('dashboard_filterPartA') === 'true' : false);
	let filterPartB = $state(browser ? localStorage.getItem('dashboard_filterPartB') === 'true' : false);

	$effect(() => {
		if (browser) {
			localStorage.setItem('dashboard_filterPartA', String(filterPartA));
			localStorage.setItem('dashboard_filterPartB', String(filterPartB));
		}
	});

	function isPartA(item: typeof data.expenses.items[0]) {
		if (item.splitType === 'static') {
			return (item.staticSplitRatio ?? 0.5) > 0;
		}
		return true;
	}

	function isPartB(item: typeof data.expenses.items[0]) {
		if (item.splitType === 'static') {
			return (item.staticSplitRatio ?? 0.5) < 1;
		}
		return true;
	}

	// Helper to separate expenses by payer with quick filter applied
	let expensesPaidByA = $derived.by(() => {
		const base = data.expenses.items.filter(e => e.paidBy === 'A');
		if (!filterPartA && !filterPartB) return base;
		if (filterPartA && filterPartB) return base.filter(e => isPartA(e) && isPartB(e));
		if (filterPartA) return base.filter(e => isPartA(e));
		if (filterPartB) return base.filter(e => isPartB(e));
		return base;
	});

	let expensesPaidByB = $derived.by(() => {
		const base = data.expenses.items.filter(e => e.paidBy === 'B');
		if (!filterPartA && !filterPartB) return base;
		if (filterPartA && filterPartB) return base.filter(e => isPartA(e) && isPartB(e));
		if (filterPartA) return base.filter(e => isPartA(e));
		if (filterPartB) return base.filter(e => isPartB(e));
		return base;
	});

	let totalPaidByA = $derived(expensesPaidByA.reduce((sum, e) => sum + e.amount, 0));
	let totalPaidByB = $derived(expensesPaidByB.reduce((sum, e) => sum + e.amount, 0));

	// Group expenses paid by A/B by their account name reactively
	let groupedExpensesA = $derived.by(() => {
		const groups: Record<string, { accountId: number | null, items: typeof expensesPaidByA }> = {};
		for (const exp of expensesPaidByA) {
			const accName = exp.accountName || 'No Account';
			if (!groups[accName]) {
				groups[accName] = { accountId: exp.accountId, items: [] };
			}
			groups[accName].items.push(exp);
		}
		return groups;
	});

	let groupedExpensesB = $derived.by(() => {
		const groups: Record<string, { accountId: number | null, items: typeof expensesPaidByB }> = {};
		for (const exp of expensesPaidByB) {
			const accName = exp.accountName || 'No Account';
			if (!groups[accName]) {
				groups[accName] = { accountId: exp.accountId, items: [] };
			}
			groups[accName].items.push(exp);
		}
		return groups;
	});

	function handleIncomeKeyDown(e: KeyboardEvent, key: 'A' | 'B') {
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			const step = e.shiftKey ? 1000 : 100;
			let currentStr = key === 'A' ? incomeAVal : incomeBVal;
			if (currentStr === '') {
				currentStr = key === 'A' ? data.income.person_a.toString() : data.income.person_b.toString();
			}
			const currentVal = parseFloat(currentStr.replace(/\s/g, '')) || 0;
			const newVal = Math.max(0, currentVal + (e.key === 'ArrowUp' ? step : -step));
			const formatted = formatIncome(Math.round(newVal).toString());
			if (key === 'A') {
				incomeAVal = formatted;
			} else {
				incomeBVal = formatted;
			}
			saveIncomes();
		}
	}

	function handleExpenseKeyDown(e: KeyboardEvent, itemId: number) {
		if (e.key === 'Enter') {
			(e.target as HTMLInputElement).blur();
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			const step = e.shiftKey ? 100 : 10;
			const currentStr = expenseAmounts[itemId] || '';
			const currentVal = parseFloat(currentStr.replace(/\s/g, '')) || 0;
			const newVal = Math.max(0, currentVal + (e.key === 'ArrowUp' ? step : -step));
			const formatted = formatIncome(Math.round(newVal).toString());
			expenseAmounts[itemId] = formatted;
			// Only update state; saving is handled by onblur event listener
		}
	}

	// Month/Year transition tracking
	let prevPeriod = $state({ year: 0, month: 0 });
	let direction = $state(1); // 1 for forward (right-to-left), -1 for backward (left-to-right)

	$effect.pre(() => {
		const newTime = data.period.year * 12 + data.period.month;
		const oldTime = prevPeriod.year * 12 + prevPeriod.month;
		if (oldTime !== 0) {
			if (newTime !== oldTime) {
				direction = newTime >= oldTime ? 1 : -1;
				prevPeriod = { year: data.period.year, month: data.period.month };
			}
		} else {
			prevPeriod = { year: data.period.year, month: data.period.month };
		}
	});
</script>

<div class="py-8">
	<!-- Page Title & Month Selector -->
	<div class="flex flex-col gap-1 mb-10 w-full text-white">
		<div class="grid grid-cols-1 grid-rows-1">
			{#key data.period.year}
				<span
					class="col-start-1 row-start-1 text-xs md:text-sm font-semibold tracking-widest text-white/60 uppercase"
					in:fly={{ x: 30 * direction, duration: 300 }}
					out:fly={{ x: -30 * direction, duration: 300 }}
				>
					{data.period.year}
				</span>
			{/key}
		</div>
		<div class="flex items-center justify-between w-full">
			<div class="grid grid-cols-1 grid-rows-1 pr-4">
				{#key data.period.month}
					<h1
						class="col-start-1 row-start-1 text-4xl md:text-5xl font-bold"
						in:fly={{ x: 40 * direction, duration: 300 }}
						out:fly={{ x: -40 * direction, duration: 300 }}
					>
						{monthName}
					</h1>
				{/key}
			</div>
			<div class="flex items-center gap-3">
				{#if !isCurrentPeriod}
					<a
						href={todayHref}
						class="w-12 h-12 rounded-full border border-white/15 bg-white/5 hover:bg-white/20 hover:border-white/30 active:scale-95 active:bg-white/30 transition-all flex items-center justify-center opacity-70 hover:opacity-100 text-white"
						title="{locale.startsWith('sv') ? 'Gå till' : 'Go to'} {realMonthName} {realYear}"
					>
						<span class="material-symbols-outlined text-2xl" style="font-weight: 300;">today</span>
					</a>
				{/if}
				<a
					href={prevMonthHref}
					class="w-12 h-12 rounded-full border border-white/15 bg-white/5 hover:bg-white/20 hover:border-white/30 active:scale-95 active:bg-white/30 transition-all flex items-center justify-center opacity-70 hover:opacity-100 text-white"
				>
					<span class="material-symbols-outlined text-3xl" style="font-weight: 200;">arrow_back</span>
				</a>
				<a
					href={nextMonthHref}
					class="w-12 h-12 rounded-full border border-white/15 bg-white/5 hover:bg-white/20 hover:border-white/30 active:scale-95 active:bg-white/30 transition-all flex items-center justify-center opacity-70 hover:opacity-100 text-white"
				>
					<span class="material-symbols-outlined text-3xl" style="font-weight: 200;">arrow_forward</span>
				</a>
			</div>
		</div>
	</div>

	<!-- Main Grid with relative container wrapper for absolute sidebar alignment -->
	<div class="relative">
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
		<!-- Left Column (Settlement & Incomes) -->
		<div class="space-y-8">
			<!-- Settlement Card -->
			<section class="bg-white rounded-2xl p-6 sm:p-10 shadow-lg text-center" data-purpose="current-settlement-card">
				<p class="text-[#9ca3af] tracking-widest text-sm font-semibold mb-4 uppercase">{t('currentSettlement')}</p>
				
				{#if currentSettlement.amount > 0 && currentSettlement.payer}
					<div class="flex justify-center items-center space-x-4 mb-2">
						<h2 class="text-3xl font-bold text-[#2d3142]">
							{currentSettlement.payer === 'A' ? data.personAName : data.personBName}
						</h2>
						<span class="text-[#ff7361] text-3xl font-normal" style="font-family: 'Inter', sans-serif;">→</span>
						<h2 class="text-3xl font-bold text-[#2d3142]">
							{currentSettlement.payer === 'A' ? data.personBName : data.personAName}
						</h2>
					</div>
					<div class="text-[#ff7361] font-bold text-5xl flex items-center justify-center mb-6">
						{#each formatter.formatToParts(Math.round(currentSettlement.amount)) as part}
							{#if part.type === 'currency'}
								<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-2' : 'ml-2'}">{part.value}</span>
							{:else if part.type !== 'literal'}
								{part.value}
							{/if}
						{/each}
					</div>
					<div class="flex justify-center">
						<button
							onclick={copySettlementText}
							class="hidden md:flex items-center gap-2 px-6 py-2 rounded-full border border-gray-100 bg-gray-50 text-[#9ca3af] text-sm font-semibold hover:bg-gray-100 hover:text-[#2d3142] transition-all focus:outline-none"
						>
							<span class="material-symbols-outlined text-lg">content_copy</span>
							<span>{t(copyStatus)}</span>
						</button>
						<button
							onclick={shareSettlement}
							class="flex md:hidden items-center gap-2 px-6 py-2 rounded-full border border-gray-100 bg-gray-50 text-[#9ca3af] text-sm font-semibold hover:bg-gray-100 hover:text-[#2d3142] transition-all focus:outline-none"
						>
							<span class="material-symbols-outlined text-lg">share</span>
							<span>{t('share')}</span>
						</button>
					</div>
				{:else}
					<div class="py-8">
						<span class="material-symbols-outlined text-5xl text-[#4fd1c5] mb-2">celebration</span>
						<h3 class="text-xl font-bold text-[#2d3142]">{data.expenses.items.length === 0 ? t('nothingToSeeHere') : t('allSettled')}</h3>
						<p class="text-xs text-[#9ca3af] mt-1">{t('noOutstandingExpenses')}</p>
					</div>
				{/if}
			</section>

			<!-- Incomes Card -->
			<section class="bg-white rounded-2xl p-6 sm:p-10 shadow-lg" data-purpose="income-settings-card">
				<h3 class="text-xl sm:text-2xl font-bold text-[#2d3142] font-display mb-8 flex items-center gap-2">
					<span class="material-symbols-outlined text-xl sm:text-2xl font-light text-[#2d3142]/70">account_balance_wallet</span>
					{t('income')}
					<span class="text-lg sm:text-xl font-bold text-[#2d3142] font-sans ml-auto">
						{#each formatter.formatToParts(Math.round(currentTotalIncome)) as part}
							{#if part.type === 'currency'}
								<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-1' : 'ml-1'}">{part.value}</span>
							{:else if part.type !== 'literal'}
								{part.value}
							{/if}
						{/each}
					</span>
				</h3>

				<div class="grid grid-cols-2 gap-4 sm:gap-6">
					<div class="space-y-2">
						<label for="incomeA" class="block text-[#9ca3af] text-xs uppercase tracking-widest font-medium">{data.personAName}</label>
						<div class="income-input-text font-bold text-[#2d3142] flex items-baseline">
							{#if currencyConfig.isPrefix}
								<span class="text-[#9ca3af] opacity-50 mr-1.5 sm:mr-2">{currencyConfig.symbol}</span>
							{/if}
							<div class="tactile-input" style="display: inline-flex; position: relative; align-items: baseline;">
								<span class="invisible font-bold income-input-text p-0 whitespace-pre">
									{incomeAVal || (data.income.person_a > 0 ? formatIncome(data.income.person_a.toString()) : '0')}
								</span>
								<input
									id="incomeA"
									name="incomeA"
									type="text"
									inputmode="numeric"
									pattern="[0-9\s]*"
									autocomplete="off"
									value={incomeAVal}
									onfocus={() => {
										if (incomeAVal === '0') incomeAVal = '';
									}}
									oninput={(e) => handleIncomeInput(e, 'A')}
									onkeydown={(e) => handleIncomeKeyDown(e, 'A')}
									onblur={() => {
										saveIncomes();
									}}
									class="absolute left-0 top-0 w-full h-full font-bold income-input-text p-0 focus:ring-0 bg-transparent border-0 outline-none focus:outline-none {incomeAVal === '' ? 'opacity-40' : ''}"
									placeholder={data.income.person_a > 0 ? formatIncome(data.income.person_a.toString()) : '0'}
								/>
							</div>
							{#if !currencyConfig.isPrefix}
								<span class="text-[#9ca3af] opacity-50 ml-1.5 sm:ml-2">{currencyConfig.symbol}</span>
							{/if}
						</div>
					</div>

					<div class="space-y-2">
						<label for="incomeB" class="block text-[#9ca3af] text-xs uppercase tracking-widest font-medium">{data.personBName}</label>
						<div class="income-input-text font-bold text-[#2d3142] flex items-baseline">
							{#if currencyConfig.isPrefix}
								<span class="text-[#9ca3af] opacity-50 mr-1.5 sm:mr-2">{currencyConfig.symbol}</span>
							{/if}
							<div class="tactile-input" style="display: inline-flex; position: relative; align-items: baseline;">
								<span class="invisible font-bold income-input-text p-0 whitespace-pre">
									{incomeBVal || (data.income.person_b > 0 ? formatIncome(data.income.person_b.toString()) : '0')}
								</span>
								<input
									id="incomeB"
									name="incomeB"
									type="text"
									inputmode="numeric"
									pattern="[0-9\s]*"
									autocomplete="off"
									value={incomeBVal}
									onfocus={() => {
										if (incomeBVal === '0') incomeBVal = '';
									}}
									oninput={(e) => handleIncomeInput(e, 'B')}
									onkeydown={(e) => handleIncomeKeyDown(e, 'B')}
									onblur={() => {
										saveIncomes();
									}}
									class="absolute left-0 top-0 w-full h-full font-bold income-input-text p-0 focus:ring-0 bg-transparent border-0 outline-none focus:outline-none {incomeBVal === '' ? 'opacity-40' : ''}"
									placeholder={data.income.person_b > 0 ? formatIncome(data.income.person_b.toString()) : '0'}
								/>
							</div>
							{#if !currencyConfig.isPrefix}
								<span class="text-[#9ca3af] opacity-50 ml-1.5 sm:ml-2">{currencyConfig.symbol}</span>
							{/if}
						</div>
					</div>
				</div>

				<!-- Share percentage bar -->
				<div class="relative w-full mt-10">
					{#if currentTotalIncome > 0}
						{@const pctA = Math.round(currentPctA * 100)}
						{@const pctB = Math.round(currentPctB * 100)}
						<div 
							class="w-full flex rounded-full overflow-hidden shadow-inner h-10 relative bg-[#fbf9f5] {pctA > 0 && pctA < 100 ? 'dynamic-share-bar--large' : ''}"
							style="{pctA === 100 ? 'background: linear-gradient(to right, #4a7bb0, #6192c7);' : pctB === 100 ? 'background: linear-gradient(to right, #76e8df, #4fd1c5);' : `--pct-a: ${pctA}%;`}"
						>
							{#if pctA > 0}
								<div class="absolute left-0 top-0 h-full flex items-center px-4 justify-start text-white text-xs font-semibold" style="width: {pctA}%;">
									{pctA}%
								</div>
							{/if}
							{#if pctB > 0}
								<div class="absolute right-0 top-0 h-full flex items-center px-4 justify-end text-white text-xs font-semibold" style="width: {pctB}%;">
									{pctB}%
								</div>
							{/if}
						</div>
					{:else}
						<div class="w-full flex rounded-full overflow-hidden shadow-inner h-10 bg-[#e5e7eb]" style="background: linear-gradient(100deg, #d1d5db 0%, #e5e7eb calc(50% - 2px), #ffffff calc(50% - 2px), #ffffff calc(50% + 2px), #e5e7eb calc(50% + 2px), #d1d5db 100%);"></div>
					{/if}
				</div>
			</section>
		</div>

		<!-- Right Column (Expenses) -->
		<div class="space-y-8">
			<section class="bg-white rounded-2xl p-6 sm:p-10 shadow-lg" data-purpose="expenses-detailed-ledger">
				<div class="flex justify-between items-center mb-8">
					<h3 class="text-2xl font-bold text-[#2d3142] font-display flex items-center gap-2">
						<span class="material-symbols-outlined text-2xl font-light text-[#2d3142]/70">receipt_long</span>
						{t('expenses')}
					</h3>
					<span class="text-xl font-bold text-[#2d3142]">
						{#each formatter.formatToParts(Math.round(data.expenses.total)) as part}
							{#if part.type === 'currency'}
								<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-1' : 'ml-1'}">{part.value}</span>
							{:else if part.type !== 'literal'}
								{part.value}
							{/if}
						{/each}
					</span>
				</div>

				<!-- Toolbar with quick filters -->
				<div class="toolbar mb-6" data-purpose="quick-filters">
					<button
						type="button"
						class="toolbar-btn {filterPartA ? 'toolbar-btn--active-A' : ''}"
						onclick={() => {
							filterPartA = !filterPartA;
						}}
					>
						<span class="person-dot" style="background: #4a7bb0"></span>
						<span>{data.personAName}</span>
					</button>

					<button
						type="button"
						class="toolbar-btn {filterPartB ? 'toolbar-btn--active-B' : ''}"
						onclick={() => {
							filterPartB = !filterPartB;
						}}
					>
						<span class="person-dot" style="background: #4fd1c5"></span>
						<span>{data.personBName}</span>
					</button>
				</div>

				<!-- Paid by Person A -->
				<div class="mb-10">
					<div class="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
						<span class="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">{t(isPastPeriod ? 'paidByPerson' : 'toBePaidByPerson', { name: data.personAName })}</span>
						<span class="text-sm font-bold text-[#2d3142]">
							{#each formatter.formatToParts(Math.round(totalPaidByA)) as part}
								{#if part.type === 'currency'}
									<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-1' : 'ml-1'}">{part.value}</span>
								{:else if part.type !== 'literal'}
									{part.value}
								{/if}
							{/each}
						</span>
					</div>

					{#if expensesPaidByA.length > 0}
						<div class="space-y-6">
							{#each Object.entries(groupedExpensesA) as [accountName, group]}
								{@const groupTotal = group.items.reduce((sum, e) => sum + e.amount, 0)}
								<div class="mb-6">
									{#if accountName !== 'No Account'}
										<div class="flex justify-between items-center mb-3 px-1">
											<h4 class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">{accountName}</h4>
											<span class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">
												{#each formatter.formatToParts(Math.round(groupTotal)) as part}
													{#if part.type === 'currency'}
														<span class="opacity-50 {currencyConfig.isPrefix ? 'mr-1' : 'ml-1'}">{part.value}</span>
													{:else if part.type !== 'literal'}
														{part.value}
													{/if}
												{/each}
											</span>
										</div>
									{/if}
									<ul class="space-y-3">
										{#each group.items as item}
											<li class="flex justify-between items-center px-1 {accountName === 'No Account' ? 'pl-1' : 'pl-4'}">
												<div class="w-full flex items-center justify-between">
													<div class="flex items-center gap-3">
														<a
															href="?id={item.id}&year={data.period.year}&month={data.period.month}"
															class="text-base font-semibold text-[#2d3142] opacity-80 hover:text-[#ff7361] hover:opacity-100 transition-all decoration-dashed hover:underline underline-offset-4 whitespace-pre-wrap break-words"
														>
															{item.name}
														</a>
														<!-- Ratio mini-bar -->
														{#if item.splitType === 'static'}
															{#if (item.staticSplitRatio ?? 0.5) === 0}
																<div class="flex rounded-full overflow-hidden h-[4px] w-[40px]" style="background: linear-gradient(to right, #76e8df, #4fd1c5)"></div>
															{:else if (item.staticSplitRatio ?? 0.5) === 1}
																<div class="flex rounded-full overflow-hidden h-[4px] w-[40px]" style="background: linear-gradient(to right, #4a7bb0, #6192c7)"></div>
															{:else}
																{@const rA = item.staticSplitRatio ?? 0.5}
																<div class="relative w-[40px] flex items-center h-[6px]">
																	<div class="flex rounded-full overflow-hidden h-[4px] w-full bg-gray-100">
																		<div class="h-full bg-[#4a7bb0]" style="width: {rA * 100}%"></div>
																		<div class="h-full bg-[#4fd1c5]" style="width: {(1 - rA) * 100}%"></div>
																	</div>
																	<div class="absolute w-[6px] h-[6px] rounded-full bg-white border border-gray-300 shadow-sm" style="left: calc({rA * 100}% - 3px)"></div>
																</div>
															{/if}
														{:else}
															<div class="flex rounded-full overflow-hidden h-[6px] w-[40px]">
																{#if currentPctA === 0}
																	<div class="w-full h-full" style="background: linear-gradient(to right, #76e8df, #4fd1c5)"></div>
																{:else if currentPctA === 1}
																	<div class="w-full h-full" style="background: linear-gradient(to right, #4a7bb0, #6192c7)"></div>
																{:else}
																	<div class="w-full h-full dynamic-share-bar--small" style="--pct-a: {currentPctA * 100}%"></div>
																{/if}
															</div>
														{/if}
													</div>
													<div class="flex items-center gap-3">
														<span class="text-base font-semibold text-[#2d3142] flex items-baseline">
															{#if currencyConfig.isPrefix}
																{#each formatter.formatToParts(Math.round(item.amount)) as part}
																	{#if part.type === 'currency'}
																		<span class="text-[#9ca3af] opacity-40 font-normal mr-1">{part.value}</span>
																	{/if}
																{/each}
															{/if}
															<div class="tactile-input leading-none" style="display: inline-flex; position: relative; align-items: baseline;">
																<span class="invisible font-semibold text-base p-0 whitespace-pre">
																	{expenseAmounts[item.id] || '0'}
																</span>
																<input
																	type="text"
																	inputmode="numeric"
																	pattern="[0-9\s]*"
																	value={expenseAmounts[item.id] || ''}
																	onfocus={() => {
																		if (expenseAmounts[item.id] === '0') {
																			expenseAmounts[item.id] = '';
																		}
																	}}
																	oninput={(e) => handleExpenseAmountInput(e, item.id)}
																	onblur={() => {
																		const prev = formatIncome(Math.round(item.amount).toString());
																		if (expenseAmounts[item.id] === '') {
																			expenseAmounts[item.id] = prev;
																		}
																		if (expenseAmounts[item.id] !== prev) {
																			saveExpenseAmount(item.id, expenseAmounts[item.id]);
																		}
																	}}
																	onkeydown={(e) => handleExpenseKeyDown(e, item.id)}
																	class="absolute left-0 top-0 w-full h-full font-semibold text-base text-[#2d3142] p-0 focus:ring-0 bg-transparent border-0 outline-none focus:outline-none text-right"
																	placeholder="0"
																/>
															</div>
															{#if !currencyConfig.isPrefix}
																{#each formatter.formatToParts(Math.round(item.amount)) as part}
																	{#if part.type === 'currency'}
																		<span class="text-[#9ca3af] opacity-40 font-normal ml-1">{part.value}</span>
																	{/if}
																{/each}
															{/if}
														</span>
													</div>
												</div>
											</li>
										{/each}
									</ul>
								</div>
							{/each}
						</div>
						<div class="mt-4 pt-2 border-t border-gray-100/50 flex">
							<a
								href="?new=true&paidBy=A&year={data.period.year}&month={data.period.month}"
								class="inline-flex items-center text-xs font-bold text-[#ff7361] hover:opacity-85 transition-opacity"
							>
								+ {t('addExpense')}
							</a>
						</div>
					{:else}
						<div class="text-center py-3 px-4 border border-dashed border-[#efeeea] rounded-xl mb-3 bg-[#fbf9f5]/20 flex flex-col items-center justify-center">
							<a
								href="?new=true&paidBy=A&year={data.period.year}&month={data.period.month}"
								class="inline-flex items-center text-xs font-bold text-[#ff7361] hover:opacity-85 transition-opacity"
							>
								+ {t('addExpense')}
							</a>
						</div>
					{/if}
				</div>

				<!-- Paid by Person B -->
				<div>
					<div class="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
						<span class="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">{t(isPastPeriod ? 'paidByPerson' : 'toBePaidByPerson', { name: data.personBName })}</span>
						<span class="text-sm font-bold text-[#2d3142]">
							{#each formatter.formatToParts(Math.round(totalPaidByB)) as part}
								{#if part.type === 'currency'}
									<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-1' : 'ml-1'}">{part.value}</span>
								{:else if part.type !== 'literal'}
									{part.value}
								{/if}
							{/each}
						</span>
					</div>

					{#if expensesPaidByB.length > 0}
						<div class="space-y-6">
							{#each Object.entries(groupedExpensesB) as [accountName, group]}
								{@const groupTotal = group.items.reduce((sum, e) => sum + e.amount, 0)}
								<div class="mb-6">
									{#if accountName !== 'No Account'}
										<div class="flex justify-between items-center mb-3 px-1">
											<h4 class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">{accountName}</h4>
											<span class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">
												{#each formatter.formatToParts(Math.round(groupTotal)) as part}
													{#if part.type === 'currency'}
														<span class="opacity-50 {currencyConfig.isPrefix ? 'mr-1' : 'ml-1'}">{part.value}</span>
													{:else if part.type !== 'literal'}
														{part.value}
													{/if}
												{/each}
											</span>
										</div>
									{/if}
									<ul class="space-y-3">
										{#each group.items as item}
											<li class="flex justify-between items-center px-1 {accountName === 'No Account' ? 'pl-1' : 'pl-4'}">
												<div class="w-full flex items-center justify-between">
													<div class="flex items-center gap-3">
														<a
															href="?id={item.id}&year={data.period.year}&month={data.period.month}"
															class="text-base font-semibold text-[#2d3142] opacity-80 hover:text-[#ff7361] hover:opacity-100 transition-all decoration-dashed hover:underline underline-offset-4 whitespace-pre-wrap break-words"
														>
															{item.name}
														</a>
														<!-- Ratio mini-bar -->
														{#if item.splitType === 'static'}
															{#if (item.staticSplitRatio ?? 0.5) === 0}
																<div class="flex rounded-full overflow-hidden h-[4px] w-[40px]" style="background: linear-gradient(to right, #76e8df, #4fd1c5)"></div>
															{:else if (item.staticSplitRatio ?? 0.5) === 1}
																<div class="flex rounded-full overflow-hidden h-[4px] w-[40px]" style="background: linear-gradient(to right, #4a7bb0, #6192c7)"></div>
															{:else}
																{@const rA = item.staticSplitRatio ?? 0.5}
																<div class="relative w-[40px] flex items-center h-[6px]">
																	<div class="flex rounded-full overflow-hidden h-[4px] w-full bg-gray-100">
																		<div class="h-full bg-[#4a7bb0]" style="width: {rA * 100}%"></div>
																		<div class="h-full bg-[#4fd1c5]" style="width: {(1 - rA) * 100}%"></div>
																	</div>
																	<div class="absolute w-[6px] h-[6px] rounded-full bg-white border border-gray-300 shadow-sm" style="left: calc({rA * 100}% - 3px)"></div>
																</div>
															{/if}
														{:else}
															<div class="flex rounded-full overflow-hidden h-[6px] w-[40px]">
																{#if currentPctA === 0}
																	<div class="w-full h-full" style="background: linear-gradient(to right, #76e8df, #4fd1c5)"></div>
																{:else if currentPctA === 1}
																	<div class="w-full h-full" style="background: linear-gradient(to right, #4a7bb0, #6192c7)"></div>
																{:else}
																	<div class="w-full h-full dynamic-share-bar--small" style="--pct-a: {currentPctA * 100}%"></div>
																{/if}
															</div>
														{/if}
													</div>
													<div class="flex items-center gap-3">
														<span class="text-base font-semibold text-[#2d3142] flex items-baseline">
															{#if currencyConfig.isPrefix}
																{#each formatter.formatToParts(Math.round(item.amount)) as part}
																	{#if part.type === 'currency'}
																		<span class="text-[#9ca3af] opacity-40 font-normal mr-1">{part.value}</span>
																	{/if}
																{/each}
															{/if}
															<div class="tactile-input leading-none" style="display: inline-flex; position: relative; align-items: baseline;">
																<span class="invisible font-semibold text-base p-0 whitespace-pre">
																	{expenseAmounts[item.id] || '0'}
																</span>
																<input
																	type="text"
																	inputmode="numeric"
																	pattern="[0-9\s]*"
																	value={expenseAmounts[item.id] || ''}
																	onfocus={() => {
																		if (expenseAmounts[item.id] === '0') {
																			expenseAmounts[item.id] = '';
																		}
																	}}
																	oninput={(e) => handleExpenseAmountInput(e, item.id)}
																	onblur={() => {
																		const prev = formatIncome(Math.round(item.amount).toString());
																		if (expenseAmounts[item.id] === '') {
																			expenseAmounts[item.id] = prev;
																		}
																		if (expenseAmounts[item.id] !== prev) {
																			saveExpenseAmount(item.id, expenseAmounts[item.id]);
																		}
																	}}
																	onkeydown={(e) => handleExpenseKeyDown(e, item.id)}
																	class="absolute left-0 top-0 w-full h-full font-semibold text-base text-[#2d3142] p-0 focus:ring-0 bg-transparent border-0 outline-none focus:outline-none text-right"
																	placeholder="0"
																/>
															</div>
															{#if !currencyConfig.isPrefix}
																{#each formatter.formatToParts(Math.round(item.amount)) as part}
																	{#if part.type === 'currency'}
																		<span class="text-[#9ca3af] opacity-40 font-normal ml-1">{part.value}</span>
																	{/if}
																{/each}
															{/if}
														</span>
													</div>
												</div>
											</li>
										{/each}
									</ul>
								</div>
							{/each}
						</div>
						<div class="mt-4 pt-2 border-t border-gray-100/50 flex">
							<a
								href="?new=true&paidBy=B&year={data.period.year}&month={data.period.month}"
								class="inline-flex items-center text-xs font-bold text-[#ff7361] hover:opacity-85 transition-opacity"
							>
								+ {t('addExpense')}
							</a>
						</div>
					{:else}
						<div class="text-center py-3 px-4 border border-dashed border-[#efeeea] rounded-xl mb-3 bg-[#fbf9f5]/20 flex flex-col items-center justify-center">
							<a
								href="?new=true&paidBy=B&year={data.period.year}&month={data.period.month}"
								class="inline-flex items-center text-xs font-bold text-[#ff7361] hover:opacity-85 transition-opacity"
							>
								+ {t('addExpense')}
							</a>
						</div>
					{/if}
				</div>
			</section>
		</div>
	</div>

	<!-- CREATE/EDIT CARD DRAWER (fixed to right side of viewport on desktop/tablet, full screen on mobile, absolute top-aligned on wide screens) -->
	<!-- CREATE/EDIT CARD DRAWER (fixed to right side of viewport on desktop/tablet, full screen on mobile, absolute top-aligned on wide screens) -->
	{#if isOverlayOpen}
		<div class="floating-sidebar-container animate-slide-in-fade">
			<a
				href={overlayCancelHref}
				class="close-btn-floater"
				aria-label={t('cancel')}
			>
				<span class="close-icon-mobile material-symbols-outlined" style="font-weight: 200;">arrow_back</span>
				<span class="close-icon-desktop material-symbols-outlined" style="font-weight: 300;">close</span>
			</a>
			<ExpenseFormCard
				expense={selectedExpense}
				isCreateMode={isCreateMode}
				initialPaidBy={initialPaidBy}
				accounts={data.accounts}
				namePersonA={data.personAName}
				namePersonB={data.personBName}
				dynamicSplitRatioA={data.dynamicSplitRatioA}
				cancelHref={overlayCancelHref}
				actionRoute="/expenses"
				currentYear={data.period.year}
				currentMonth={data.period.month}
			/>
		</div>
	{/if}
	</div>
</div>

<style>
	@keyframes slideInFade {
		from {
			opacity: 0;
			transform: translateX(30px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
	@keyframes slideUpFadeMobile {
		from {
			opacity: 0;
			transform: translateY(100px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-slide-in-fade {
		animation: slideInFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@media (max-width: 1023.98px) {
		.animate-slide-in-fade {
			animation: slideUpFadeMobile 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
		}
	}

	.floating-sidebar-container {
		/* Full-screen on tablet/mobile by default (< 1024px) */
		position: fixed;
		z-index: 50;
		inset: 0;
		width: 100%;
		height: 100%;
		background-color: #ff7361; /* Coral background shows all around */
		overflow-y: auto;
		padding-top: 60px; /* Spacing for the background at the top + margin below close button */
		padding-left: 12px;
		padding-right: 12px;
		padding-bottom: 12px;
	}

	.close-btn-floater {
		position: fixed;
		top: 10px;
		left: 16px;
		z-index: 60;
		color: rgba(255, 255, 255, 0.7);
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 9999px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background-color: rgba(255, 255, 255, 0.08);
		opacity: 0.9;
	}

	.close-btn-floater:hover {
		background-color: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.3);
		opacity: 1;
	}

	.close-btn-floater:active {
		background-color: rgba(255, 255, 255, 0.3);
		scale: 0.95;
	}

	.close-btn-floater .close-icon-desktop {
		display: none;
	}

	.close-btn-floater .close-icon-mobile {
		display: inline-block;
		font-size: 22px;
	}

	/* Absolute overlay mode when screen is desktop/tablet side-by-side (>= 1024px) */
	@media (min-width: 1024px) {
		.floating-sidebar-container {
			position: absolute;
			left: min(calc(100% + 32px), calc(100vw - (100vw - 100%) / 2 - 480px - 20px));
			right: auto;
			top: 0; /* Aligned card top again with other cards */
			bottom: auto;
			width: 480px;
			height: auto;
			background-color: transparent;
			padding: 0;
			z-index: 10;
			overflow: visible;
		}

		.close-btn-floater {
			position: absolute;
			top: -50px;
			right: 0;
			left: auto;
			bottom: auto;
			width: 40px;
			height: 40px;
			border-radius: 9999px;
			border: 1px solid rgba(255, 255, 255, 0.15);
			background-color: rgba(255, 255, 255, 0.08);
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s ease;
			opacity: 0.9;
		}

		.close-btn-floater .close-icon-mobile {
			display: none;
		}

		.close-btn-floater .close-icon-desktop {
			display: inline-block;
			font-size: 20px;
		}

		.close-btn-floater:hover {
			background-color: rgba(255, 255, 255, 0.2);
			border-color: rgba(255, 255, 255, 0.3);
			opacity: 1;
		}

		.close-btn-floater:active {
			background-color: rgba(255, 255, 255, 0.3);
			scale: 0.95;
		}
	}

	/* ---- Toolbar ---- */
	.toolbar {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.toolbar-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px 5px 8px;
		border-radius: 8px;
		border: 1px solid rgba(255,255,255,0.22);
		background: rgba(255,255,255,0.92);
		color: #2d3142;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
		white-space: nowrap;
		letter-spacing: 0.01em;
		box-shadow: 0 1px 3px rgba(45,49,66,0.08);
	}

	.toolbar-btn:hover {
		background: white;
		box-shadow: 0 2px 6px rgba(45,49,66,0.12);
	}

	.toolbar-btn:active {
		scale: 0.97;
	}

	.toolbar-btn--active-A {
		background: rgba(74, 123, 176, 0.08) !important;
		border-color: #4a7bb0 !important;
		box-shadow: 0 2px 8px rgba(74, 123, 176, 0.15) !important;
	}

	.toolbar-btn--active-B {
		background: rgba(79, 209, 197, 0.08) !important;
		border-color: #4fd1c5 !important;
		box-shadow: 0 2px 8px rgba(79, 209, 197, 0.15) !important;
	}

	.person-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		transition: background 0.2s;
	}
</style>
