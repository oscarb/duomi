<script lang="ts">
	import { page } from '$app/state';
	import { getContext } from 'svelte';

	let { data } = $props();

	const { locale, t, currencyConfig, formatter } = getContext<{
		locale: string;
		t: (key: string, params?: Record<string, string>) => string;
		currencyConfig: import('$lib/translations').CurrencyConfig;
		formatter: Intl.NumberFormat;
	}>('i18n');

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

	// Dynamically format month names based on locale
	let monthName = $derived.by(() => {
		const date = new Date(data.period.year, data.period.month - 1, 1);
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
	let incomeAVal = $state(formatIncome(data.income.person_a.toString()));
	let incomeBVal = $state(formatIncome(data.income.person_b.toString()));

	let currentIncomeANum = $derived(parseFloat(incomeAVal.replace(/\s/g, '')) || 0);
	let currentIncomeBNum = $derived(parseFloat(incomeBVal.replace(/\s/g, '')) || 0);
	let currentTotalIncome = $derived(currentIncomeANum + currentIncomeBNum);

	let currentPctA = $derived(currentTotalIncome > 0 ? currentIncomeANum / currentTotalIncome : 0.5);
	let currentPctB = $derived(currentTotalIncome > 0 ? currentIncomeBNum / currentTotalIncome : 0.5);

	let currentSettlement = $derived(calculateSettlement(currentIncomeANum, currentIncomeBNum, data.expenses.items));

	// Keep input in sync with server data when month changes
	$effect(() => {
		incomeAVal = formatIncome(data.income.person_a.toString());
		incomeBVal = formatIncome(data.income.person_b.toString());
	});

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
		const incomeA = Math.round(parseFloat(incomeAVal.replace(/\s/g, '')) || 0);
		const incomeB = Math.round(parseFloat(incomeBVal.replace(/\s/g, '')) || 0);
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

	// Helper to separate expenses by payer
	let expensesPaidByA = $derived(data.expenses.items.filter(e => e.paidBy === 'A'));
	let expensesPaidByB = $derived(data.expenses.items.filter(e => e.paidBy === 'B'));

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
</script>

<div class="py-8">
	<!-- Page Title & Month Selector -->
	<div class="flex items-center justify-between mb-10 w-full text-white">
		<h1 class="text-4xl md:text-5xl font-bold">
			{monthName} {data.period.year}
		</h1>
		<div class="flex items-center gap-3">
			<a
				href="?year={prevMonth.year}&month={prevMonth.month}"
				class="w-12 h-12 rounded-full border border-white/15 bg-white/5 hover:bg-white/20 hover:border-white/30 active:scale-95 active:bg-white/30 transition-all flex items-center justify-center opacity-70 hover:opacity-100 text-white"
			>
				<span class="material-symbols-outlined text-3xl" style="font-weight: 200;">arrow_back</span>
			</a>
			<a
				href="?year={nextMonth.year}&month={nextMonth.month}"
				class="w-12 h-12 rounded-full border border-white/15 bg-white/5 hover:bg-white/20 hover:border-white/30 active:scale-95 active:bg-white/30 transition-all flex items-center justify-center opacity-70 hover:opacity-100 text-white"
			>
				<span class="material-symbols-outlined text-3xl" style="font-weight: 200;">arrow_forward</span>
			</a>
		</div>
	</div>

	<!-- Main Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
		<!-- Left Column (Settlement & Incomes) -->
		<div class="space-y-8">
			<!-- Settlement Card -->
			<section class="bg-white rounded-2xl p-10 shadow-lg text-center" data-purpose="current-settlement-card">
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
					<div class="text-[#ff7361] font-bold text-5xl flex items-center justify-center gap-2 mb-6">
						{#each formatter.formatToParts(Math.round(currentSettlement.amount)) as part}
							{#if part.type === 'currency'}
								<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
							{:else}
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
						<span class="material-symbols-outlined text-5xl text-[#4fd1c5] mb-2">done_all</span>
						<h3 class="text-xl font-bold text-[#2d3142]">{data.expenses.items.length === 0 ? t('nothingToSeeHere') : t('allSettled')}</h3>
						<p class="text-xs text-[#9ca3af] mt-1">{t('noOutstandingExpenses')}</p>
					</div>
				{/if}
			</section>

			<!-- Incomes Card -->
			<section class="bg-white rounded-2xl p-10 shadow-lg" data-purpose="income-settings-card">
				<h3 class="text-2xl font-bold text-[#2d3142] font-display mb-8 flex items-center gap-2">
					<span class="material-symbols-outlined text-2xl font-light text-[#2d3142]/70">account_balance_wallet</span>
					{t('income')}
					<span class="text-xl font-bold text-[#2d3142] font-sans ml-auto">
						{#each formatter.formatToParts(Math.round(currentTotalIncome)) as part}
							{#if part.type === 'currency'}
								<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
							{:else}
								{part.value}
							{/if}
						{/each}
					</span>
				</h3>

				<div class="grid grid-cols-2 gap-0">
					<div class="space-y-2">
						<label for="incomeA" class="block text-[#9ca3af] text-xs uppercase tracking-widest font-medium">{data.personAName}</label>
						<div class="text-4xl font-bold text-[#2d3142] flex items-baseline">
							{#if currencyConfig.isPrefix}
								<span class="text-[#9ca3af] opacity-50 mr-0.5">{currencyConfig.symbol}</span>
							{/if}
							<div class="tactile-input" style="display: inline-flex; position: relative; align-items: baseline;">
								<span class="invisible font-bold text-4xl p-0 whitespace-pre">
									{incomeAVal || '0'}
								</span>
								<input
									id="incomeA"
									name="incomeA"
									type="text"
									inputmode="numeric"
									pattern="[0-9\s]*"
									value={incomeAVal}
									onfocus={() => {
										if (incomeAVal === '0') incomeAVal = '';
									}}
									oninput={(e) => handleIncomeInput(e, 'A')}
									onblur={() => {
										if (incomeAVal === '') incomeAVal = '0';
										saveIncomes();
									}}
									class="absolute left-0 top-0 w-full h-full font-bold text-4xl p-0 focus:ring-0 bg-transparent border-0 outline-none focus:outline-none"
									placeholder="0"
								/>
							</div>
							{#if !currencyConfig.isPrefix}
								<span class="text-[#9ca3af] opacity-50 ml-0.5">{currencyConfig.symbol}</span>
							{/if}
						</div>
					</div>

					<div class="space-y-2">
						<label for="incomeB" class="block text-[#9ca3af] text-xs uppercase tracking-widest font-medium">{data.personBName}</label>
						<div class="text-4xl font-bold text-[#2d3142] flex items-baseline">
							{#if currencyConfig.isPrefix}
								<span class="text-[#9ca3af] opacity-50 mr-0.5">{currencyConfig.symbol}</span>
							{/if}
							<div class="tactile-input" style="display: inline-flex; position: relative; align-items: baseline;">
								<span class="invisible font-bold text-4xl p-0 whitespace-pre">
									{incomeBVal || '0'}
								</span>
								<input
									id="incomeB"
									name="incomeB"
									type="text"
									inputmode="numeric"
									pattern="[0-9\s]*"
									value={incomeBVal}
									onfocus={() => {
										if (incomeBVal === '0') incomeBVal = '';
									}}
									oninput={(e) => handleIncomeInput(e, 'B')}
									onblur={() => {
										if (incomeBVal === '') incomeBVal = '0';
										saveIncomes();
									}}
									class="absolute left-0 top-0 w-full h-full font-bold text-4xl p-0 focus:ring-0 bg-transparent border-0 outline-none focus:outline-none"
									placeholder="0"
								/>
							</div>
							{#if !currencyConfig.isPrefix}
								<span class="text-[#9ca3af] opacity-50 ml-0.5">{currencyConfig.symbol}</span>
							{/if}
						</div>
					</div>
				</div>

				<!-- Share percentage bar -->
				<div class="relative w-full mt-10">
					<div class="w-full flex rounded-full overflow-hidden shadow-inner h-10 bg-[#fbf9f5]">
						{#if currentTotalIncome > 0}
							{#if Math.round(currentPctA * 100) === 100}
								<div
									class="h-full flex items-center px-4 justify-start text-white text-xs font-medium transition-all duration-500"
									style="width: 100%; background-color: #ff7361;"
								>
									100%
								</div>
							{:else if Math.round(currentPctB * 100) === 100}
								<div
									class="h-full flex items-center px-4 justify-end text-white text-xs font-medium transition-all duration-500"
									style="width: 100%; background-color: #4fd1c5;"
								>
									100%
								</div>
							{:else}
								<div
									class="h-full flex items-center px-4 justify-start text-white text-xs font-medium border-r-8 border-white transition-all duration-500"
									style="width: {currentPctA * 100}%; min-width: 48px; background-color: #ff7361;"
								>
									{Math.round(currentPctA * 100)}%
								</div>
								<div
									class="h-full flex items-center px-4 justify-end text-white text-xs font-medium transition-all duration-500"
									style="width: {currentPctB * 100}%; min-width: 48px; background-color: #4fd1c5;"
								>
									{Math.round(currentPctB * 100)}%
								</div>
							{/if}
						{:else}
							<div
								class="h-full border-r-8 border-white"
								style="width: 50%; background-color: #e5e7eb;"
							></div>
							<div
								class="h-full"
								style="width: 50%; background-color: #e5e7eb;"
							></div>
						{/if}
					</div>
				</div>
			</section>
		</div>

		<!-- Right Column (Expenses) -->
		<div class="space-y-8">
			<section class="bg-white rounded-2xl p-10 shadow-lg" data-purpose="expenses-detailed-ledger">
				<div class="flex justify-between items-center mb-8">
					<h3 class="text-2xl font-bold text-[#2d3142] font-display flex items-center gap-2">
						<span class="material-symbols-outlined text-2xl font-light text-[#2d3142]/70">receipt_long</span>
						{t('expenses')}
					</h3>
					<span class="text-xl font-bold text-[#2d3142]">
						{#each formatter.formatToParts(Math.round(data.expenses.total)) as part}
							{#if part.type === 'currency'}
								<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
							{:else}
								{part.value}
							{/if}
						{/each}
					</span>
				</div>

				<!-- Paid by Person A -->
				<div class="mb-10">
					<div class="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
						<span class="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">{t('paidBy')} {data.personAName}</span>
						<span class="text-sm font-bold text-[#2d3142]">
							{#each formatter.formatToParts(Math.round(totalPaidByA)) as part}
								{#if part.type === 'currency'}
									<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
								{:else}
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
									<div class="flex justify-between items-center mb-3 px-1">
										<h4 class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">{accountName === 'No Account' ? t('noAccount') : accountName}</h4>
										<span class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">
											{#each formatter.formatToParts(Math.round(groupTotal)) as part}
												{#if part.type === 'currency'}
													<span class="opacity-50 {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
												{:else}
													{part.value}
												{/if}
											{/each}
										</span>
									</div>
									<ul class="space-y-3">
										{#each group.items as item}
											<li class="flex justify-between items-center px-1 pl-4">
												<div class="w-full flex items-center justify-between">
													<div class="flex items-center gap-3">
														<a
															href="/expenses?id={item.id}&year={data.period.year}&month={data.period.month}"
															class="text-base font-normal text-[#2d3142] opacity-80 hover:text-[#ff7361] hover:opacity-100 transition-all decoration-dashed hover:underline underline-offset-4"
														>
															{item.name}
														</a>
														<!-- Ratio mini-bar -->
														<div class="flex rounded-full overflow-hidden h-[6px] w-[40px] bg-gray-100">
															{#if item.splitType === 'static'}
																<div class="h-full bg-[#ff7361]" style="width: {(item.staticSplitRatio ?? 0.5) * 100}%"></div>
																<div class="h-full bg-[#4fd1c5]" style="width: {(1 - (item.staticSplitRatio ?? 0.5)) * 100}%"></div>
															{:else}
																<div class="h-full bg-[#ff7361]" style="width: {currentPctA * 100}%"></div>
																<div class="h-full bg-[#4fd1c5]" style="width: {currentPctB * 100}%"></div>
															{/if}
														</div>
													</div>
													<div class="flex items-center gap-3">
														<span class="text-base font-semibold text-[#2d3142] flex items-center">
															{#each formatter.formatToParts(Math.round(item.amount)) as part}
																{#if part.type === 'currency'}
																	<span class="text-[#9ca3af] opacity-40 font-normal {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
																{:else}
																	<span class="tactile-input leading-none">{part.value}</span>
																{/if}
															{/each}
														</span>
													</div>
												</div>
											</li>
										{/each}
									</ul>
									<a
										href="/expenses?new=true&paidBy=A{group.accountId ? `&accountId=${group.accountId}` : ''}&year={data.period.year}&month={data.period.month}"
										class="flex items-center text-sm mt-2 font-semibold ml-4 text-[#ff7361] hover:opacity-80 transition-opacity"
									>
										<span class="mr-1 text-base font-bold">+</span> {t('addExpense')}
									</a>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-[#9ca3af] italic py-4 pl-4 border border-dashed border-[#efeeea] rounded-xl mb-4">{t('noExpensesPaidBy', { name: data.personAName })}</p>
					{/if}
				</div>

				<!-- Paid by Person B -->
				<div>
					<div class="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
						<span class="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">{t('paidBy')} {data.personBName}</span>
						<span class="text-sm font-bold text-[#2d3142]">
							{#each formatter.formatToParts(Math.round(totalPaidByB)) as part}
								{#if part.type === 'currency'}
									<span class="text-[#9ca3af] opacity-50 {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
								{:else}
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
									<div class="flex justify-between items-center mb-3 px-1">
										<h4 class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">{accountName === 'No Account' ? t('noAccount') : accountName}</h4>
										<span class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">
											{#each formatter.formatToParts(Math.round(groupTotal)) as part}
												{#if part.type === 'currency'}
													<span class="opacity-50 {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
												{:else}
													{part.value}
												{/if}
											{/each}
										</span>
									</div>
									<ul class="space-y-3">
										{#each group.items as item}
											<li class="flex justify-between items-center px-1 pl-4">
												<div class="w-full flex items-center justify-between">
													<div class="flex items-center gap-3">
														<a
															href="/expenses?id={item.id}&year={data.period.year}&month={data.period.month}"
															class="text-base font-normal text-[#2d3142] opacity-80 hover:text-[#ff7361] hover:opacity-100 transition-all decoration-dashed hover:underline underline-offset-4"
														>
															{item.name}
														</a>
														<!-- Ratio mini-bar -->
														<div class="flex rounded-full overflow-hidden h-[6px] w-[40px] bg-gray-100">
															{#if item.splitType === 'static'}
																<div class="h-full bg-[#ff7361]" style="width: {(item.staticSplitRatio ?? 0.5) * 100}%"></div>
																<div class="h-full bg-[#4fd1c5]" style="width: {(1 - (item.staticSplitRatio ?? 0.5)) * 100}%"></div>
															{:else}
																<div class="h-full bg-[#ff7361]" style="width: {currentPctA * 100}%"></div>
																<div class="h-full bg-[#4fd1c5]" style="width: {currentPctB * 100}%"></div>
															{/if}
														</div>
													</div>
													<div class="flex items-center gap-3">
														<span class="text-base font-semibold text-[#2d3142] flex items-center">
															{#each formatter.formatToParts(Math.round(item.amount)) as part}
																{#if part.type === 'currency'}
																	<span class="text-[#9ca3af] opacity-40 font-normal {currencyConfig.isPrefix ? 'mr-0.5' : 'ml-0.5'}">{part.value}</span>
																{:else}
																	<span class="tactile-input leading-none">{part.value}</span>
																{/if}
															{/each}
														</span>
													</div>
												</div>
											</li>
										{/each}
									</ul>
									<a
										href="/expenses?new=true&paidBy=B{group.accountId ? `&accountId=${group.accountId}` : ''}&year={data.period.year}&month={data.period.month}"
										class="flex items-center text-sm mt-2 font-semibold ml-4 text-[#ff7361] hover:opacity-80 transition-opacity"
									>
										<span class="mr-1 text-base font-bold">+</span> {t('addExpense')}
									</a>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-[#9ca3af] italic py-4 pl-4 border border-dashed border-[#efeeea] rounded-xl mb-4">{t('noExpensesPaidBy', { name: data.personBName })}</p>
					{/if}
				</div>
			</section>
		</div>
	</div>
</div>
