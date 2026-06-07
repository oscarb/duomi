<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getContext } from 'svelte';

	const { locale, t, currencyConfig, formatter } = getContext<{
		locale: string;
		t: (key: string, params?: Record<string, string>) => string;
		currencyConfig: import('$lib/translations').CurrencyConfig;
		formatter: Intl.NumberFormat;
	}>('i18n');

	let { data } = $props();

	// Read selected expense ID from query parameter or default to first active expense
	let selectedId = $derived(parseInt(page.url.searchParams.get('id') || '', 10) || null);
	
	// Create mode
	let isCreateMode = $derived(page.url.searchParams.get('new') === 'true');
	let initialPaidBy = $derived((page.url.searchParams.get('paidBy') as 'A' | 'B') || 'A');

	// Active and archived templates lists
	let activeExpenses = $derived(data.expenses.filter(e => e.archivedDate === null));
	let expensesA = $derived(activeExpenses.filter(e => e.paidBy === 'A'));
	let expensesB = $derived(activeExpenses.filter(e => e.paidBy === 'B'));

	// Currently selected expense
	let selectedExpense = $derived(data.expenses.find(e => e.id === selectedId) || null);

	// Reactive edit states for details sidebar
	let editName = $state('');
	let editPaidBy = $state<'A' | 'B'>('A');
	let editInterval = $state(1);
	let editSplitType = $state<'dynamic' | 'static'>('dynamic');
	let editRatio = $state(0.5);
	let editAccountId = $state<number | null>(null);

	// Sync edit states when selection changes
	$effect(() => {
		if (selectedExpense) {
			editName = selectedExpense.name;
			editPaidBy = selectedExpense.paidBy;
			editInterval = selectedExpense.intervalMonths;
			editSplitType = selectedExpense.splitType;
			editRatio = selectedExpense.staticSplitRatio ?? 0.5;
			editAccountId = selectedExpense.accountId;
		}
	});

	// Price edit state
	let isPriceEdit = $state(false);
	let editPriceVal = $state('');
	let editPriceDate = $state('');

	$effect(() => {
		if (selectedExpense) {
			editPriceVal = Math.round(selectedExpense.currentAmount).toString();
			editPriceDate = new Date().toISOString().split('T')[0];
		}
	});

	// Check if the form is dirty
	let isDirty = $derived.by(() => {
		if (!selectedExpense) return false;
		return (
			editName !== selectedExpense.name ||
			editPaidBy !== selectedExpense.paidBy ||
			editInterval !== selectedExpense.intervalMonths ||
			editSplitType !== selectedExpense.splitType ||
			editRatio !== (selectedExpense.staticSplitRatio ?? 0.5) ||
			editAccountId !== selectedExpense.accountId
		);
	});

	// Account creation dialog
	let showAddAccount = $state(false);
	let newAccountName = $state('');
	let newAccountOwner = $state<'A' | 'B'>('A');

	// Period parameters preservation
	let currentYear = $derived(page.url.searchParams.get('year'));
	let currentMonth = $derived(page.url.searchParams.get('month'));
	let periodParams = $derived(currentYear && currentMonth ? `&year=${currentYear}&month=${currentMonth}` : '');
	let cancelHref = $derived(currentYear && currentMonth ? `/expenses?year=${currentYear}&month=${currentMonth}` : '/expenses');
</script>

<div class="py-8">
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
		<!-- Left Column: Recurring Expenses List -->
		<div class="lg:col-span-7 flex flex-col space-y-6">
			<!-- Payer A's templates -->
			<div class="flex flex-col space-y-3">
				<h2 class="text-white text-2xl font-bold uppercase tracking-widest flex items-center gap-3 ml-1 mt-2">
					<span class="w-3.5 h-3.5 rounded-full bg-[#ff7361] shadow-[0_0_8px_rgba(255,115,97,0.5)]"></span>
					{data.personAName}
				</h2>
				<div class="bg-white rounded-2xl shadow-[0_8px_30px_rgb(45,49,66,0.04)] border border-[#efeeea] overflow-hidden">
					{#if expensesA.length > 0}
						<div class="divide-y divide-[#efeeea]">
							{#each expensesA as item}
								<a
									href="?id={item.id}{periodParams}"
									class="px-4 py-3 flex items-center justify-between hover:bg-[#fbf9f5] transition-colors border-l-4 {selectedId === item.id ? 'border-[#ff7361] bg-[#ff7361]/5' : 'border-transparent'}"
								>
									<div class="flex flex-col flex-grow">
										<span class="font-bold text-sm text-[#2d3142] hover:text-[#ff7361] transition-colors underline decoration-[#efeeea] hover:decoration-[#ff7361]/30 underline-offset-4">{item.name}</span>
										<div class="mt-1.5 w-24 h-1.5 bg-[#4fd1c5] rounded-full overflow-hidden flex">
											{#if item.splitType === 'static'}
												<div class="bg-[#ff7361] h-full" style="width: {(item.staticSplitRatio ?? 0.5) * 100}%"></div>
											{:else}
												<div class="bg-[#ff7361] h-full" style="width: {data.dynamicSplitRatioA * 100}%"></div>
											{/if}
										</div>
									</div>
									<div class="text-right">
										<p class="font-bold text-sm text-[#2d3142]">{formatter.format(Math.round(item.currentAmount))}</p>
										<p class="text-[10px] font-bold uppercase tracking-tighter {selectedId === item.id ? 'text-[#ff7361]' : 'text-[#9ca3af]'}">
											{item.intervalMonths === 0 ? t('oneTime') : item.intervalMonths === 1 ? t('monthly') : item.intervalMonths === 3 ? t('quarterly') : item.intervalMonths === 12 ? t('yearly') : ''}
										</p>
									</div>
								</a>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-[#9ca3af] italic p-6">{t('noActiveTemplates', { name: data.personAName })}</p>
					{/if}
					<div class="px-4 py-3.5 bg-[#fbf9f5]/50 border-t border-[#efeeea]">
						<a
							href="?new=true&paidBy=A{periodParams}"
							class="w-full flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[#ff7361]/20 rounded-lg hover:text-[#ff7361] hover:bg-[#ff7361]/5 transition-all text-[#ff7361] justify-center text-xs font-bold"
						>
							<span class="material-symbols-outlined text-sm">add</span>
							<span>{t('addTemplate')}</span>
						</a>
					</div>
				</div>
			</div>
 
			<!-- Payer B's templates -->
			<div class="flex flex-col space-y-3 pt-4">
				<h2 class="text-white text-2xl font-bold uppercase tracking-widest flex items-center gap-3 ml-1 mt-12">
					<span class="w-3.5 h-3.5 rounded-full bg-[#4fd1c5] shadow-[0_0_8px_rgba(79,209,197,0.5)]"></span>
					{data.personBName}
				</h2>
				<div class="bg-white rounded-2xl shadow-[0_8px_30px_rgb(45,49,66,0.04)] border border-[#efeeea] overflow-hidden">
					{#if expensesB.length > 0}
						<div class="divide-y divide-[#efeeea]">
							{#each expensesB as item}
								<a
									href="?id={item.id}{periodParams}"
									class="px-4 py-3 flex items-center justify-between hover:bg-[#fbf9f5] transition-colors border-l-4 {selectedId === item.id ? 'border-[#4fd1c5] bg-[#4fd1c5]/5' : 'border-transparent'}"
								>
									<div class="flex flex-col flex-grow">
										<span class="font-bold text-sm text-[#2d3142] hover:text-[#ff7361] transition-colors underline decoration-[#efeeea] hover:decoration-[#ff7361]/30 underline-offset-4">{item.name}</span>
										<div class="mt-1.5 w-24 h-1.5 bg-[#ff7361] rounded-full overflow-hidden flex">
											{#if item.splitType === 'static'}
												<div class="bg-[#4fd1c5] h-full" style="width: {(1 - (item.staticSplitRatio ?? 0.5)) * 100}%"></div>
											{:else}
												<div class="bg-[#4fd1c5] h-full" style="width: {(1 - data.dynamicSplitRatioA) * 100}%"></div>
											{/if}
										</div>
									</div>
									<div class="text-right">
										<p class="font-bold text-sm text-[#2d3142]">{formatter.format(Math.round(item.currentAmount))}</p>
										<p class="text-[10px] font-bold uppercase tracking-tighter {selectedId === item.id ? 'text-[#4fd1c5]' : 'text-[#9ca3af]'}">
											{item.intervalMonths === 0 ? t('oneTime') : item.intervalMonths === 1 ? t('monthly') : item.intervalMonths === 3 ? t('quarterly') : item.intervalMonths === 12 ? t('yearly') : ''}
										</p>
									</div>
								</a>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-[#9ca3af] italic p-6">{t('noActiveTemplates', { name: data.personBName })}</p>
					{/if}
					<div class="px-4 py-3.5 bg-[#fbf9f5]/50 border-t border-[#efeeea]">
						<a
							href="?new=true&paidBy=B{periodParams}"
							class="w-full flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[#ff7361]/20 rounded-lg hover:text-[#ff7361] hover:bg-[#ff7361]/5 transition-all text-[#ff7361] justify-center text-xs font-bold"
						>
							<span class="material-symbols-outlined text-sm">add</span>
							<span>{t('addTemplate')}</span>
						</a>
					</div>
				</div>
			</div>
		</div>

		<!-- Right Column: Details Sidebar -->
		<div class="lg:col-span-5">
			{#if isCreateMode}
				<!-- Create New Template Panel -->
				<div class="bg-white rounded-2xl shadow-[0_8px_30px_rgb(45,49,66,0.04)] p-8 border border-[#efeeea] sticky top-8">
					<h3 class="text-lg font-black text-[#2d3142] font-display mb-6">{t('createNewTemplate')}</h3>
					
					<form method="POST" action="?/create" use:enhance class="space-y-6">
						<div class="space-y-1.5">
							<label class="text-[10px] font-black text-[#9ca3af] uppercase tracking-wider" for="new-name">{t('expenseName')}</label>
							<input
								id="new-name"
								name="name"
								type="text"
								required
								class="w-full px-4 py-2.5 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-0 text-sm"
								placeholder={t('placeholderExpenseName')}
							/>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-1.5">
								<label class="text-[10px] font-black text-[#9ca3af] uppercase tracking-wider" for="new-paidBy">{t('detailPaidBy')}</label>
								<select
									id="new-paidBy"
									name="paidBy"
									value={initialPaidBy}
									class="w-full px-4 py-2.5 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-0 text-sm"
								>
									<option value="A">{data.personAName}</option>
									<option value="B">{data.personBName}</option>
								</select>
							</div>

							<div class="space-y-1.5">
								<label class="text-[10px] font-black text-[#9ca3af] uppercase tracking-wider" for="new-interval">{t('frequency')}</label>
								<select
									id="new-interval"
									name="intervalMonths"
									class="w-full px-4 py-2.5 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-0 text-sm"
								>
									<option value="1">{t('monthly')}</option>
									<option value="0">{t('oneTime')}</option>
									<option value="3">{t('quarterly')}</option>
									<option value="12">{t('yearly')}</option>
								</select>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-1.5">
								<label class="text-[10px] font-black text-[#9ca3af] uppercase tracking-wider" for="new-amount">{t('amountLabel', { symbol: currencyConfig.symbol })}</label>
								<div class="relative flex items-center">
									{#if currencyConfig.isPrefix}
										<span class="absolute left-4 text-xs font-bold text-[#9ca3af]">{currencyConfig.symbol}</span>
									{/if}
									<input
										id="new-amount"
										name="amount"
										type="number"
										step="1"
										required
										class="w-full py-2.5 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-0 text-sm {currencyConfig.isPrefix ? 'pl-8 pr-4' : 'pl-4 pr-12'}"
										placeholder="0"
									/>
									{#if !currencyConfig.isPrefix}
										<span class="absolute right-4 text-xs font-bold text-[#9ca3af]">{currencyConfig.symbol}</span>
									{/if}
								</div>
							</div>

							<div class="space-y-1.5">
								<label class="text-[10px] font-black text-[#9ca3af] uppercase tracking-wider" for="new-validFrom">{t('startMonth')}</label>
								<input
									id="new-validFrom"
									name="validFrom"
									type="date"
									required
									value={new Date().toISOString().split('T')[0]}
									class="w-full px-4 py-2.5 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-0 text-sm"
								/>
							</div>
						</div>

						<div class="space-y-3">
							<label class="text-[10px] font-black text-[#9ca3af] uppercase tracking-wider block" for="new-splitType">{t('splitType')}</label>
							<div class="grid grid-cols-2 p-1 bg-[#fbf9f5] rounded-full border border-[#efeeea]">
								<button
									type="button"
									onclick={() => editSplitType = 'dynamic'}
									class="py-2 rounded-full text-xs font-bold transition-all {editSplitType === 'dynamic' ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
								>
									{t('dynamic')}
								</button>
								<button
									type="button"
									onclick={() => editSplitType = 'static'}
									class="py-2 rounded-full text-xs font-bold transition-all {editSplitType === 'static' ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142] hover:bg-[#efeeea]'}"
								>
									{t('static')}
								</button>
							</div>
							<input type="hidden" name="splitType" value={editSplitType} />
						</div>

						{#if editSplitType === 'static'}
							<div class="space-y-2 pt-2">
								<div class="flex justify-between text-xs font-bold text-[#2d3142]">
									<span>{data.personAName}: {Math.round(editRatio * 100)}%</span>
									<span>{data.personBName}: {Math.round((1 - editRatio) * 100)}%</span>
								</div>
								<input
									name="staticSplitRatio"
									type="range"
									min="0"
									max="1"
									step="0.01"
									bind:value={editRatio}
									class="w-full h-1.5 bg-[#efeeea] rounded-lg appearance-none cursor-pointer accent-[#ff7361]"
								/>
							</div>
						{/if}

						<div class="space-y-1.5">
							<label class="text-[10px] font-black text-[#9ca3af] uppercase tracking-wider" for="new-account">{t('paidFrom')}</label>
							<select
								id="new-account"
								name="accountId"
								class="w-full px-4 py-2.5 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-0 text-sm"
							>
								<option value="">{t('noAccount')}</option>
								{#each data.accounts as acc}
									<option value={acc.id}>{acc.name} ({acc.owner === 'A' ? data.personAName : data.personBName})</option>
								{/each}
							</select>
						</div>

						<div class="flex gap-4 pt-4 border-t border-[#efeeea]">
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
				</div>
			{:else}
				<!-- View/Edit selected template details -->
				<div class="bg-white rounded-2xl shadow-[0_8px_30px_rgb(45,49,66,0.04)] p-8 md:p-10 border border-[#efeeea] sticky top-8">
					{#if selectedExpense}
						<form method="POST" action="?/update" use:enhance class="space-y-6">
							<input type="hidden" name="id" value={selectedExpense.id} />

							<!-- Header: Title & Status -->
							<div class="flex justify-between items-start border-b border-[#efeeea] pb-6">
								<div class="flex-grow space-y-1.5">
									<input
										name="name"
										type="text"
										bind:value={editName}
										class="w-full font-display text-2xl font-bold text-[#2d3142] border-0 border-b border-transparent hover:border-[#efeeea] focus:border-[#ff7361] p-0 focus:ring-0 pb-1"
									/>
									<div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[10px] uppercase tracking-wider">
										<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
										{t('active')}
									</div>
								</div>

								<!-- Price Display with edit trigger -->
								<div class="flex flex-col items-end">
									{#if !isPriceEdit}
										<button
											type="button"
											onclick={() => {
												isPriceEdit = true;
												editPriceVal = Math.round(selectedExpense.currentAmount).toString();
												editPriceDate = new Date().toISOString().split('T')[0];
											}}
											class="group cursor-pointer border border-transparent hover:border-[#ff7361]/20 hover:bg-[#fbf9f5] p-2 -m-2 rounded-xl transition-all flex flex-col items-end relative"
										>
											<div class="flex items-center">
												<span class="text-2xl font-bold text-[#2d3142] tracking-tight">
													{#if currencyConfig.isPrefix}
														<span class="text-[#9ca3af] mr-1 inline-block" style="width: 1ch; display: inline-block; text-align: right;">{currencyConfig.symbol}</span>
													{/if}
													{Math.round(selectedExpense.currentAmount)}
													{#if !currencyConfig.isPrefix}
														<span class="text-[#9ca3af] ml-1 inline-block">{currencyConfig.symbol}</span>
													{/if}
												</span>
											</div>
											<div class="mt-1 text-right flex items-center gap-1">
												<span class="text-[12px] text-[#9ca3af]">{t('since')} <span class="font-bold text-[#2d3142]">{selectedExpense.history[selectedExpense.history.length - 1]?.validFrom || ''}</span></span>
												<span class="material-symbols-outlined text-[14px] text-[#9ca3af]">calendar_month</span>
											</div>
											<div class="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none w-8 h-8 bg-white/90 backdrop-blur shadow-sm rounded-full border border-[#ff7361]/20 flex items-center justify-center">
												<span class="material-symbols-outlined text-[#ff7361] text-[16px]">edit</span>
											</div>
										</button>
									{:else}
										<!-- Edit Mode: Inline transformation -->
										<div class="flex flex-col items-end space-y-2">
											<div class="flex items-center">
												{#if currencyConfig.isPrefix}
													<span class="text-2xl font-bold text-[#9ca3af] mr-1" style="width: 1ch; display: inline-block; text-align: right;">{currencyConfig.symbol}</span>
												{/if}
												<input
													type="number"
													step="1"
													bind:value={editPriceVal}
													class="w-32 p-0 bg-transparent border-0 border-b-2 border-[#ff7361]/30 focus:border-[#ff7361] font-bold text-2xl text-[#2d3142] focus:ring-0 outline-none text-right pb-0.5"
												/>
												{#if !currencyConfig.isPrefix}
													<span class="text-2xl font-bold text-[#9ca3af] ml-1">{currencyConfig.symbol}</span>
												{/if}
											</div>
											<div class="flex items-center gap-1.5">
												<span class="text-[12px] text-[#9ca3af]">{t('since')}</span>
												<input
													type="date"
													bind:value={editPriceDate}
													class="px-1.5 py-0.5 rounded border border-[#efeeea] bg-[#fbf9f5] text-[12px] font-bold text-[#2d3142] focus:border-[#ff7361] focus:ring-0 outline-none"
												/>
											</div>
											<div class="flex gap-2 pt-1">
												<button
													type="button"
													class="px-2 py-1 text-[#9ca3af] font-bold text-[12px] hover:text-[#2d3142]"
													onclick={() => isPriceEdit = false}
												>
													{t('cancel')}
												</button>
												<button
													formaction="?/updatePrice"
													type="submit"
													class="px-3 py-1 bg-[#ff7361] text-white rounded text-[12px] font-bold hover:bg-[#ff7361]/90 transition-all shadow-sm"
													onclick={() => isPriceEdit = false}
												>
													{t('save')}
												</button>
											</div>
										</div>
									{/if}
								</div>
							</div>

							<!-- Paid By select -->
							<div class="space-y-1.5">
								<label class="text-[10px] font-black text-[#9ca3af] uppercase tracking-wider" for="detail-paidBy">{t('detailPaidBy')}</label>
								<select
									id="detail-paidBy"
									name="paidBy"
									bind:value={editPaidBy}
									class="w-full px-4 py-2.5 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-0 text-sm font-bold text-[#2d3142] bg-[#fbf9f5]/50"
								>
									<option value="A">{data.personAName}</option>
									<option value="B">{data.personBName}</option>
								</select>
							</div>

							<!-- Splitting Ratio Section -->
							<div class="pt-2">
								<p class="text-[10px] font-black text-[#9ca3af] uppercase tracking-widest mb-3">{t('splittingRatio')}</p>
								<div class="space-y-4">
									<div class="grid grid-cols-2 p-1 bg-[#fbf9f5] rounded-full border border-[#efeeea]">
										<button
											type="button"
											onclick={() => editSplitType = 'dynamic'}
											class="py-1.5 rounded-full text-xs font-bold transition-all {editSplitType === 'dynamic' ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142]'}"
										>
											{t('dynamic')}
										</button>
										<button
											type="button"
											onclick={() => editSplitType = 'static'}
											class="py-1.5 rounded-full text-xs font-bold transition-all {editSplitType === 'static' ? 'bg-[#ff7361] text-white shadow-sm' : 'text-[#2d3142]'}"
										>
											{t('static')}
										</button>
									</div>
									<input type="hidden" name="splitType" value={editSplitType} />

									{#if editSplitType === 'static'}
										<div class="space-y-3 pt-1">
											<div class="flex justify-between text-xs font-bold text-[#2d3142]">
												<span>{data.personAName} <span class="text-[#ff7361] ml-0.5">{Math.round(editRatio * 100)}%</span></span>
												<span><span class="mr-0.5">{data.personBName}</span> <span class="text-[#4fd1c5]">{Math.round((1 - editRatio) * 100)}%</span></span>
											</div>
											<input
												name="staticSplitRatio"
												type="range"
												min="0"
												max="1"
												step="0.01"
												bind:value={editRatio}
												class="w-full h-1.5 bg-[#efeeea] rounded-lg appearance-none cursor-pointer accent-[#ff7361]"
											/>
											<div class="flex justify-between text-[10px] font-bold text-[#9ca3af]">
												<span>{formatter.format(Math.round(selectedExpense.currentAmount * editRatio))}</span>
												<span>{formatter.format(Math.round(selectedExpense.currentAmount * (1 - editRatio)))}</span>
											</div>
											<p class="text-[10px] text-[#9ca3af] font-medium italic text-center mt-1.5">{t('overrideSliderDesc')}</p>
										</div>
									{:else}
										<div class="flex justify-between text-xs font-bold text-[#2d3142]">
											<span>{data.personAName} <span class="text-[#ff7361] ml-0.5">{Math.round(data.dynamicSplitRatioA * 100)}%</span></span>
											<span><span class="mr-0.5">{data.personBName}</span> <span class="text-[#4fd1c5]">{Math.round((1 - data.dynamicSplitRatioA) * 100)}%</span></span>
										</div>
										<div class="flex justify-between text-[10px] font-bold text-[#9ca3af] pt-1">
											<span>{formatter.format(Math.round(selectedExpense.currentAmount * data.dynamicSplitRatioA))}</span>
											<span>{formatter.format(Math.round(selectedExpense.currentAmount * (1 - data.dynamicSplitRatioA)))}</span>
										</div>
									{/if}
								</div>
							</div>

							<!-- Source Account -->
							<div class="pt-6 border-t border-[#efeeea]">
								<p class="text-[10px] font-black text-[#9ca3af] uppercase tracking-widest mb-3">{t('source')}</p>
								<div class="flex flex-wrap gap-2">
									{#each data.accounts as acc}
										<button
											type="button"
											onclick={() => editAccountId = acc.id}
											class="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all {editAccountId === acc.id ? 'border-[#ff7361] bg-[#ff7361]/5 text-[#2d3142]' : 'border-[#efeeea] bg-[#fbf9f5]/50 text-[#9ca3af] hover:text-[#2d3142]'}"
										>
											<span class="material-symbols-outlined text-[18px] {editAccountId === acc.id ? 'text-[#ff7361]' : ''}">
												{acc.owner === 'A' ? 'account_balance' : 'credit_card'}
											</span>
											{acc.name}
										</button>
									{/each}
									<input type="hidden" name="accountId" value={editAccountId || ''} />

									<button
										type="button"
										onclick={() => showAddAccount = true}
										class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed border-[#ff7361]/20 text-[#ff7361] hover:bg-[#ff7361]/5 text-xs font-bold transition-all"
									>
										<span class="material-symbols-outlined text-[18px]">add</span>
										<span>{t('addSource')}</span>
									</button>
								</div>
							</div>

							<!-- Frequency Section -->
							<div class="pt-6 border-t border-[#efeeea]">
								<p class="text-[10px] font-black text-[#9ca3af] uppercase tracking-widest mb-3">{t('frequency')}</p>
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

								{#if selectedExpense.nextPaymentDate}
									<div class="flex items-center gap-2 mt-4 px-1">
										<span class="material-symbols-outlined text-[18px] text-[#ff7361]">calendar_month</span>
										<p class="text-[11px] font-bold text-[#9ca3af]">{t('nextPaymentDate', { date: selectedExpense.nextPaymentDate })}</p>
									</div>
								{/if}
							</div>

							<!-- Price History Section -->
							<div class="pt-6 border-t border-[#efeeea]">
								<p class="text-[10px] font-black text-[#9ca3af] uppercase tracking-widest mb-3">{t('priceHistory')}</p>
								<table class="w-full text-xs">
									<tbody class="divide-y divide-[#efeeea] text-[#2d3142]">
										{#each [...selectedExpense.history].sort((a,b) => b.validFrom.localeCompare(a.validFrom)) as hist}
											<tr>
												<td class="py-2 font-bold text-sm text-[#2d3142]">{hist.validFrom}</td>
												<td class="py-2 text-right font-bold text-sm text-[#2d3142] font-sans">
													{formatter.format(Math.round(hist.amount))}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							<!-- Sidebar Footer: Save Changes & Archive -->
							<div class="pt-8 border-t border-[#efeeea] flex items-center justify-between">
								<button
									formaction="?/archive"
									type="submit"
									class="flex items-center gap-2 px-4 py-2.5 border-2 rounded-xl text-[#ff7361] transition-all font-bold group border-[#ff7361] hover:bg-[#ff7361] hover:text-white"
								>
									<span class="material-symbols-outlined text-[20px]">archive</span>
									<span class="text-xs font-bold">{t('archiveExpense')}</span>
								</button>

								{#if isDirty}
									<button
										type="submit"
										class="px-5 py-2.5 bg-[#ff7361] text-white hover:bg-[#ff7361]/90 rounded-xl text-xs font-bold shadow-sm transition-all"
									>
										{t('saveChanges')}
									</button>
								{/if}
							</div>
						</form>
					{:else}
						<div class="py-20 text-center">
							<span class="material-symbols-outlined text-6xl text-[#9ca3af]/40 mb-3">receipt_long</span>
							<h3 class="text-lg font-bold text-[#2d3142]">{t('selectTemplate')}</h3>
							<p class="text-xs text-[#9ca3af] max-w-xs mx-auto mt-1">
								{t('selectTemplateDesc')}
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Modal: Add Source Account -->
{#if showAddAccount}
	<div class="fixed inset-0 z-50 bg-[#2d3142]/40 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-white rounded-2xl border border-[#efeeea] shadow-2xl p-6 w-full max-w-sm space-y-4">
			<h4 class="text-lg font-black text-[#2d3142] font-display">{t('addSourceAccount')}</h4>
			
			<div class="space-y-4">
				<div class="space-y-1">
					<label class="text-[10px] font-black text-[#9ca3af] uppercase tracking-wider" for="new-acc-name">{t('accountName')}</label>
					<input
						id="new-acc-name"
						type="text"
						bind:value={newAccountName}
						class="w-full px-3.5 py-2 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-0 text-sm"
						placeholder="e.g. Main Bank, Revolut"
					/>
				</div>

				<div class="space-y-1">
					<label class="text-[10px] font-black text-[#9ca3af] uppercase tracking-wider" for="new-acc-owner">{t('owner')}</label>
					<select
						id="new-acc-owner"
						bind:value={newAccountOwner}
						class="w-full px-3.5 py-2 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-0 text-sm"
					>
						<option value="A">{data.personAName}</option>
						<option value="B">{data.personBName}</option>
					</select>
				</div>
			</div>

			<!-- Wait, let's write a hidden form or use page actions to POST new account. SvelteKit action isn't strictly needed for this simple test if we mock or create another API, but we can do it via a form submitting to a dedicated page action or a POST API!
			Wait, layout has no page actions, but we can POST to `/api/expenses` or a page action to add account. Wait, does `/api/expenses` or page actions support creating accounts? No, let's see. In `queries.ts`, we have `addAccount`. We can add a page action `createAccount` inside `expenses/+page.server.ts`! That is extremely clean! -->
			<form method="POST" action="?/createAccount" use:enhance class="flex gap-3 justify-end pt-2 border-t border-[#efeeea]">
				<input type="hidden" name="name" value={newAccountName} />
				<input type="hidden" name="owner" value={newAccountOwner} />

				<button
					type="button"
					onclick={() => { showAddAccount = false; newAccountName = ''; }}
					class="px-4 py-2 border border-[#efeeea] bg-[#fbf9f5] rounded-xl text-xs font-bold text-[#9ca3af] hover:text-[#2d3142]"
				>
					{t('cancel')}
				</button>
				<button
					type="submit"
					onclick={() => { showAddAccount = false; }}
					class="px-5 py-2 bg-[#ff7361] text-white hover:bg-[#ff7361]/90 rounded-xl text-xs font-bold shadow-sm"
				>
					{t('addAccount')}
				</button>
			</form>
		</div>
	</div>
{/if}
