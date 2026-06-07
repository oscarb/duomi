<script lang="ts">
	import { page } from '$app/state';

	let { data } = $props();

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

	const MONTH_NAMES = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];

	import { calculateSettlement } from '$lib/calculations';

	// Temporary dynamic edit states
	let incomeAVal = $state(data.income.person_a.toString());
	let incomeBVal = $state(data.income.person_b.toString());

	let currentIncomeANum = $derived(parseFloat(incomeAVal) || 0);
	let currentIncomeBNum = $derived(parseFloat(incomeBVal) || 0);
	let currentTotalIncome = $derived(currentIncomeANum + currentIncomeBNum);

	let currentPctA = $derived(currentTotalIncome > 0 ? currentIncomeANum / currentTotalIncome : 0.5);
	let currentPctB = $derived(currentTotalIncome > 0 ? currentIncomeBNum / currentTotalIncome : 0.5);

	let currentSettlement = $derived(calculateSettlement(currentIncomeANum, currentIncomeBNum, data.expenses.items));

	// Keep input in sync with server data when month changes
	$effect(() => {
		incomeAVal = data.income.person_a.toString();
		incomeBVal = data.income.person_b.toString();
	});

	let copyStatus = $state('Copy');

	function copySettlementText() {
		const payerName = currentSettlement.payer === 'A' ? data.personAName : data.personBName;
		const receiverName = currentSettlement.payer === 'A' ? data.personBName : data.personAName;
		const text = `${payerName} owes ${receiverName} $${Math.round(currentSettlement.amount)}`;
		navigator.clipboard.writeText(text).then(() => {
			copyStatus = 'Copied!';
			setTimeout(() => {
				copyStatus = 'Copy';
			}, 2000);
		});
	}

	async function saveIncomes() {
		const incomeA = Math.round(parseFloat(incomeAVal) || 0);
		const incomeB = Math.round(parseFloat(incomeBVal) || 0);
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
			{MONTH_NAMES[data.period.month - 1]} {data.period.year}
		</h1>
		<div class="flex items-center gap-4">
			<a
				href="?year={prevMonth.year}&month={prevMonth.month}"
				class="hover:opacity-100 transition-opacity flex items-center opacity-60 text-white"
			>
				<span class="material-symbols-outlined text-4xl" style="font-weight: 200;">arrow_back</span>
			</a>
			<a
				href="?year={nextMonth.year}&month={nextMonth.month}"
				class="hover:opacity-100 transition-opacity flex items-center opacity-60 text-white"
			>
				<span class="material-symbols-outlined text-4xl" style="font-weight: 200;">arrow_forward</span>
			</a>
		</div>
	</div>

	<!-- Main Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
		<!-- Left Column (Settlement & Incomes) -->
		<div class="space-y-8">
			<!-- Settlement Card -->
			<section class="bg-white rounded-2xl p-10 shadow-lg text-center" data-purpose="current-settlement-card">
				<p class="text-[#9ca3af] tracking-widest text-sm font-semibold mb-4 uppercase">Current Settlement</p>
				
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
						<span class="text-[#9ca3af] opacity-50 mr-1">$</span>{Math.round(currentSettlement.amount)}
					</div>
					<div class="flex justify-center">
						<button
							onclick={copySettlementText}
							class="flex items-center gap-2 px-6 py-2 rounded-full border border-gray-100 bg-gray-50 text-[#9ca3af] text-sm font-semibold hover:bg-gray-100 hover:text-[#2d3142] transition-all focus:outline-none"
						>
							<span class="material-symbols-outlined text-lg">content_copy</span>
							<span>{copyStatus}</span>
						</button>
					</div>
				{:else}
					<div class="py-8">
						<span class="material-symbols-outlined text-5xl text-[#4fd1c5] mb-2">done_all</span>
						<h3 class="text-xl font-bold text-[#2d3142]">All Settled</h3>
						<p class="text-xs text-[#9ca3af] mt-1">No outstanding expenses to split for this month.</p>
					</div>
				{/if}
			</section>

			<!-- Incomes Card -->
			<section class="bg-white rounded-2xl p-10 shadow-lg" data-purpose="income-settings-card">
				<h3 class="text-2xl font-bold text-[#2d3142] font-display mb-8 flex items-center gap-2">
					<span class="material-symbols-outlined text-2xl font-light text-[#2d3142]/70">account_balance_wallet</span>
					Income
					<span class="text-xl font-bold text-[#2d3142] font-sans ml-auto">
						<span class="text-[#9ca3af] opacity-50 mr-0.5">$</span>{Math.round(currentTotalIncome).toLocaleString()}
					</span>
				</h3>

				<div class="grid grid-cols-2 gap-0">
					<div class="space-y-2">
						<label for="incomeA" class="block text-[#9ca3af] text-xs uppercase tracking-widest font-medium">{data.personAName}</label>
						<div class="text-4xl font-bold text-[#2d3142] flex items-baseline">
							<span class="text-[#9ca3af] opacity-50 mr-1">$</span>
							<input
								id="incomeA"
								name="incomeA"
								type="text"
								inputmode="numeric"
								pattern="[0-9]*"
								value={incomeAVal}
								onfocus={() => {
									if (incomeAVal === '0') incomeAVal = '';
								}}
								oninput={(e) => {
									let clean = (e.target as HTMLInputElement).value.replace(/\D/g, '');
									if (clean !== '') {
										const num = parseInt(clean, 10);
										clean = num.toString();
									}
									clean = clean.slice(0, 7);
									(e.target as HTMLInputElement).value = clean;
									incomeAVal = clean;
								}}
								onblur={() => {
									if (incomeAVal === '') incomeAVal = '0';
									saveIncomes();
								}}
								class="tactile-input font-bold text-4xl p-0 focus:ring-0"
								style="width: {Math.max(1, incomeAVal.length)}ch;"
								placeholder="0"
							/>
						</div>
					</div>

					<div class="space-y-2">
						<label for="incomeB" class="block text-[#9ca3af] text-xs uppercase tracking-widest font-medium">{data.personBName}</label>
						<div class="text-4xl font-bold text-[#2d3142] flex items-baseline">
							<span class="text-[#9ca3af] opacity-50 mr-1">$</span>
							<input
								id="incomeB"
								name="incomeB"
								type="text"
								inputmode="numeric"
								pattern="[0-9]*"
								value={incomeBVal}
								onfocus={() => {
									if (incomeBVal === '0') incomeBVal = '';
								}}
								oninput={(e) => {
									let clean = (e.target as HTMLInputElement).value.replace(/\D/g, '');
									if (clean !== '') {
										const num = parseInt(clean, 10);
										clean = num.toString();
									}
									clean = clean.slice(0, 7);
									(e.target as HTMLInputElement).value = clean;
									incomeBVal = clean;
								}}
								onblur={() => {
									if (incomeBVal === '') incomeBVal = '0';
									saveIncomes();
								}}
								class="tactile-input font-bold text-4xl p-0 focus:ring-0"
								style="width: {Math.max(1, incomeBVal.length)}ch;"
								placeholder="0"
							/>
						</div>
					</div>
				</div>

				<!-- Share percentage bar -->
				<div class="relative w-full mt-10">
					<div class="w-full flex rounded-full overflow-hidden shadow-inner h-10 bg-[#fbf9f5]">
						{#if currentTotalIncome > 0}
							<div
								class="h-full flex items-center px-4 justify-start text-white text-xs font-light border-r-8 border-white transition-all duration-500"
								style="width: {currentPctA * 100}%; background-color: #ff7361;"
							>
								{Math.round(currentPctA * 100)}%
							</div>
							<div
								class="h-full flex items-center px-4 justify-end text-white text-xs font-light transition-all duration-500"
								style="width: {currentPctB * 100}%; background-color: #4fd1c5;"
							>
								{Math.round(currentPctB * 100)}%
							</div>
						{:else}
							<div class="w-full h-full flex items-center justify-center text-[#9ca3af] text-xs font-light">
								No income set (50% / 50% split)
							</div>
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
						Expenses
					</h3>
					<span class="text-xl font-bold text-[#2d3142]">
						<span class="text-[#9ca3af] opacity-50 mr-1">$</span>{Math.round(data.expenses.total)}
					</span>
				</div>

				<!-- Paid by Person A -->
				<div class="mb-10">
					<div class="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
						<span class="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">PAID BY {data.personAName}</span>
						<span class="text-sm font-bold text-[#2d3142]">
							<span class="text-[#9ca3af] opacity-50 mr-1">$</span>{Math.round(totalPaidByA)}
						</span>
					</div>

					{#if expensesPaidByA.length > 0}
						<div class="space-y-6">
							{#each Object.entries(groupedExpensesA) as [accountName, group]}
								{@const groupTotal = group.items.reduce((sum, e) => sum + e.amount, 0)}
								<div class="mb-6">
									<div class="flex justify-between items-center mb-3 px-1">
										<h4 class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">{accountName}</h4>
										<span class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">
											<span class="opacity-50 mr-1">$</span>{Math.round(groupTotal)}
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
															<span class="text-[#9ca3af] opacity-40 font-normal mr-1">$</span>
															<span class="tactile-input leading-none">{Math.round(item.amount)}</span>
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
										<span class="mr-1 text-base font-bold">+</span> Add expense
									</a>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-[#9ca3af] italic py-4 pl-4 border border-dashed border-[#efeeea] rounded-xl mb-4">No expenses paid by {data.personAName} this month.</p>
					{/if}
				</div>

				<!-- Paid by Person B -->
				<div>
					<div class="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
						<span class="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">PAID BY {data.personBName}</span>
						<span class="text-sm font-bold text-[#2d3142]">
							<span class="text-[#9ca3af] opacity-50 mr-1">$</span>{Math.round(totalPaidByB)}
						</span>
					</div>

					{#if expensesPaidByB.length > 0}
						<div class="space-y-6">
							{#each Object.entries(groupedExpensesB) as [accountName, group]}
								{@const groupTotal = group.items.reduce((sum, e) => sum + e.amount, 0)}
								<div class="mb-6">
									<div class="flex justify-between items-center mb-3 px-1">
										<h4 class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">{accountName}</h4>
										<span class="text-[11px] font-bold text-[#9ca3af]/60 uppercase tracking-wider">
											<span class="opacity-50 mr-1">$</span>{Math.round(groupTotal)}
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
															<span class="text-[#9ca3af] opacity-40 font-normal mr-1">$</span>
															<span class="tactile-input leading-none">{Math.round(item.amount)}</span>
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
										<span class="mr-1 text-base font-bold">+</span> Add expense
									</a>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-[#9ca3af] italic py-4 pl-4 border border-dashed border-[#efeeea] rounded-xl mb-4">No expenses paid by {data.personBName} this month.</p>
					{/if}
				</div>
			</section>
		</div>
	</div>
</div>
