<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { getContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import ExpenseFormCard from '$lib/components/ExpenseFormCard.svelte';

	const { locale, t, currencyConfig, formatter } = getContext<{
		locale: string;
		t: (key: string, params?: Record<string, string>) => string;
		currencyConfig: import('$lib/translations').CurrencyConfig;
		formatter: Intl.NumberFormat;
	}>('i18n');

	let { data } = $props();

	// Read selected expense ID from query parameter
	let selectedId = $derived(parseInt(page.url.searchParams.get('id') || '', 10) || null);
	
	// Create mode
	let isCreateMode = $derived(page.url.searchParams.get('new') === 'true');
	let initialPaidBy = $derived((page.url.searchParams.get('paidBy') as 'A' | 'B') || 'A');

	// Currently selected expense
	let selectedExpense = $derived(data.expenses.find(e => e.id === selectedId) || null);

	// Account creation dialog
	let showAddAccount = $state(false);
	let newAccountName = $state('');
	let newAccountOwner = $state<'A' | 'B'>('A');

	let cancelHref = '/expenses';

	// --- Toolbar state ---
	let activePerson = $state<'A' | 'B'>(((browser && localStorage.getItem('expenses_activePerson')) as 'A' | 'B') || 'A');
	let showRecurring = $state(browser ? localStorage.getItem('expenses_showRecurring') !== 'false' : true);
	let showOneTime = $state(browser ? localStorage.getItem('expenses_showOneTime') !== 'false' : true);
	let showArchived = $state(browser ? localStorage.getItem('expenses_showArchived') === 'true' : false);
	let sortBy = $state<'cost' | 'title'>(((browser && localStorage.getItem('expenses_sortBy')) as 'cost' | 'title') || 'cost');
	let sortAsc = $state(browser ? localStorage.getItem('expenses_sortAsc') === 'true' : false);
	let showTypeDropdown = $state(false);
	let showSortDropdown = $state(false);
	let checkedAccountIds = $state<number[]>([]);
	let showAccountDropdown = $state(false);

	$effect(() => {
		if (browser) {
			localStorage.setItem('expenses_activePerson', activePerson);
			localStorage.setItem('expenses_showRecurring', String(showRecurring));
			localStorage.setItem('expenses_showOneTime', String(showOneTime));
			localStorage.setItem('expenses_showArchived', String(showArchived));
			localStorage.setItem('expenses_sortBy', sortBy);
			localStorage.setItem('expenses_sortAsc', String(sortAsc));
		}
	});

	$effect(() => {
		// Reset checked accounts when switching active person
		const _ = activePerson;
		checkedAccountIds = [];
	});

	let personAccounts = $derived(data.accounts.filter(acc => acc.owner === activePerson));
	let hasAccounts = $derived(personAccounts.length > 0);

	let accountsLabel = $derived.by(() => {
		if (checkedAccountIds.length === 0) return t('allAccounts');
		const names = checkedAccountIds
			.map(id => data.accounts.find(a => a.id === id)?.name)
			.filter(Boolean);
		return names.join(', ');
	});

	function togglePerson() {
		activePerson = activePerson === 'A' ? 'B' : 'A';
	}

	function applyFiltersAndSort(expenses: typeof data.expenses) {
		let result = expenses.filter(e => {
			if (checkedAccountIds.length > 0) {
				if (e.accountId === null || !checkedAccountIds.includes(e.accountId)) {
					return false;
				}
			}

			const isArchived = e.archivedDate !== null;
			const isOneTime = e.intervalMonths === 0;
			const isRecurring = !isOneTime;

			if (showArchived) {
				if (!isArchived) return false;
				if (showRecurring === showOneTime) {
					return true;
				}
				if (isRecurring && !showRecurring) return false;
				if (isOneTime && !showOneTime) return false;
				return true;
			} else {
				if (isArchived) return false;
				if (isRecurring && !showRecurring) return false;
				if (isOneTime && !showOneTime) return false;
				return true;
			}
		});
		result = [...result].sort((a, b) => {
			// Expenses with no account come first
			const noAccA = a.accountId === null ? 0 : 1;
			const noAccB = b.accountId === null ? 0 : 1;
			if (noAccA !== noAccB) return noAccA - noAccB;
			// Then apply the user-selected sort
			let cmp = 0;
			if (sortBy === 'cost') cmp = a.latestAmount - b.latestAmount;
			else cmp = a.name.localeCompare(b.name);
			return sortAsc ? cmp : -cmp;
		});
		return result;
	}

	let filteredExpensesA = $derived.by(() => {
		return applyFiltersAndSort(data.expenses.filter(e => e.paidBy === 'A'));
	});
	let filteredExpensesB = $derived.by(() => {
		return applyFiltersAndSort(data.expenses.filter(e => e.paidBy === 'B'));
	});

	let typeLabel = $derived.by(() => {
		const active = [showRecurring && 'Recurring', showOneTime && 'One-time', showArchived && 'Archived'].filter(Boolean);
		if (active.length === 3) return 'All types';
		if (active.length === 0) return 'No types';
		return active.join(', ');
	});

	let sortLabel = $derived(`${sortBy === 'cost' ? t('sortAmount') : t('sortTitle')} ${sortAsc ? '↑' : '↓'}`);

	// Click-outside action to close dropdowns
	function clickOutside(node: HTMLElement, cb: () => void) {
		function handle(e: MouseEvent) {
			if (!node.contains(e.target as Node)) cb();
		}
		document.addEventListener('mousedown', handle, true);
		return { destroy() { document.removeEventListener('mousedown', handle, true); } };
	}
</script>

<div class="py-8">
	<div class="expenses-layout">
		<!-- Left Column: Recurring Expenses List -->
		<div class="expenses-list">

			<!-- Toolbar -->
			<div class="toolbar">
				<!-- Person switcher -->
				<button class="toolbar-btn" onclick={togglePerson} type="button">
					<span class="person-dot" style="background:{activePerson === 'B' ? '#4fd1c5' : '#4a7bb0'}"></span>
					<span>{activePerson === 'A' ? data.personAName : data.personBName}</span>
					<span class="material-symbols-outlined toolbar-btn-icon">swap_horiz</span>
				</button>

				<!-- Type filter -->
				<div class="toolbar-dropdown-wrap" use:clickOutside={() => { showTypeDropdown = false; }}>
					<button
						class="toolbar-btn {showTypeDropdown ? 'toolbar-btn--active' : ''}"
						type="button"
						onclick={() => { showTypeDropdown = !showTypeDropdown; showSortDropdown = false; showAccountDropdown = false; }}
					>
						<span class="material-symbols-outlined toolbar-btn-icon">repeat</span>
						<span>{typeLabel}</span>
					</button>
					{#if showTypeDropdown}
						<div class="toolbar-menu" transition:fade={{ duration: 120 }}>
							<label class="toolbar-menu-item">
								<input type="checkbox" bind:checked={showRecurring} />
								<span>Recurring</span>
							</label>
							<label class="toolbar-menu-item">
								<input type="checkbox" bind:checked={showOneTime} />
								<span>One-time</span>
							</label>
							<div class="toolbar-menu-divider"></div>
							<label class="toolbar-menu-item">
								<input type="checkbox" bind:checked={showArchived} />
								<span>Archived</span>
							</label>
						</div>
					{/if}
				</div>

				<!-- Account filter (only shows if user has accounts) -->
				{#if hasAccounts}
					<div class="toolbar-dropdown-wrap" use:clickOutside={() => { showAccountDropdown = false; }}>
						<button
							class="toolbar-btn {showAccountDropdown ? 'toolbar-btn--active' : ''}"
							type="button"
							onclick={() => { showAccountDropdown = !showAccountDropdown; showTypeDropdown = false; showSortDropdown = false; }}
						>
							<span class="material-symbols-outlined toolbar-btn-icon">account_balance</span>
							<span>{accountsLabel}</span>
						</button>
						{#if showAccountDropdown}
							<div class="toolbar-menu" transition:fade={{ duration: 120 }}>
								{#each personAccounts as acc}
									<label class="toolbar-menu-item">
										<input
											type="checkbox"
											value={acc.id}
											checked={checkedAccountIds.includes(acc.id)}
											style="--accent-color: {activePerson === 'B' ? '#4fd1c5' : '#4a7bb0'};"
											onchange={(e) => {
												const checked = (e.target as HTMLInputElement).checked;
												if (checked) {
													checkedAccountIds = [...checkedAccountIds, acc.id];
												} else {
													checkedAccountIds = checkedAccountIds.filter(id => id !== acc.id);
												}
											}}
										/>
										<span>{acc.name}</span>
									</label>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Sort (right-aligned) -->
				<div class="toolbar-dropdown-wrap toolbar-sort" use:clickOutside={() => { showSortDropdown = false; }}>
					<button
						class="toolbar-btn {showSortDropdown ? 'toolbar-btn--active' : ''}"
						type="button"
						onclick={() => { showSortDropdown = !showSortDropdown; showTypeDropdown = false; showAccountDropdown = false; }}
					>
						<span class="material-symbols-outlined toolbar-btn-icon">sort</span>
						<span>{sortLabel}</span>
					</button>
					{#if showSortDropdown}
						<div class="toolbar-menu toolbar-menu--right" transition:fade={{ duration: 120 }}>
							<button
								class="toolbar-menu-item {sortBy === 'cost' ? 'toolbar-menu-item--selected' : ''}"
								type="button"
								onclick={() => { sortBy = 'cost'; }}
							>{t('sortAmount')}</button>
							<button
								class="toolbar-menu-item {sortBy === 'title' ? 'toolbar-menu-item--selected' : ''}"
								type="button"
								onclick={() => { sortBy = 'title'; }}
							>{t('sortTitle')}</button>
							<div class="toolbar-menu-divider"></div>
							<button
								class="toolbar-menu-item toolbar-menu-item--direction"
								type="button"
								onclick={() => { sortAsc = !sortAsc; }}
							>
								<span class="material-symbols-outlined" style="font-size:15px;">{sortAsc ? 'arrow_upward' : 'arrow_downward'}</span>
								{sortAsc ? 'Ascending' : 'Descending'}
							</button>
						</div>
					{/if}
				</div>
			</div>
			<!-- Payer A's templates -->
			{#if activePerson !== 'B'}
			<div class="flex flex-col space-y-3">
				<div class="bg-white rounded-2xl shadow-[0_8px_30px_rgb(45,49,66,0.04)] border border-[#efeeea] overflow-hidden">
					{#if filteredExpensesA.length > 0}
						<div class="flex flex-col">
							{#each filteredExpensesA as item, idx}
								<a
									href={selectedId === item.id ? cancelHref : `?id=${item.id}`}
									class="px-4 py-3 flex items-center justify-between hover:bg-[#4a7bb0]/5 transition-colors border-l-4 border-b border-[#efeeea] 
									{selectedId === item.id ? 'border-l-[#4a7bb0] bg-[#4a7bb0]/5 border-b-transparent' : 'border-l-transparent'}
									{idx === filteredExpensesA.length - 1 ? 'border-b-0' : ''}
									{filteredExpensesA[idx + 1]?.id === selectedId ? 'border-b-transparent' : ''}"
								>
									<div class="flex flex-col flex-grow">
										<span class="font-bold text-sm text-[#2d3142] hover:text-[#4a7bb0] transition-colors decoration-[#efeeea] hover:decoration-[#4a7bb0]/30 underline-offset-4 whitespace-pre-wrap break-words">{item.name}</span>
										{#if item.splitType === 'dynamic'}
											<div class="mt-1.5 w-24 h-[6px] rounded-full overflow-hidden flex">
												{#if data.dynamicSplitRatioA === 0}
													<div class="w-full h-full" style="background: linear-gradient(to right, #76e8df, #4fd1c5)"></div>
												{:else if data.dynamicSplitRatioA === 1}
													<div class="w-full h-full" style="background: linear-gradient(to right, #4a7bb0, #6192c7)"></div>
												{:else}
													<div class="w-full h-full dynamic-share-bar--small" style="--pct-a: {data.dynamicSplitRatioA * 100}%"></div>
												{/if}
											</div>
										{:else}
											{#if (item.staticSplitRatio ?? 0.5) === 0}
												<div class="mt-1.5 w-24 h-[4px] rounded-full overflow-hidden" style="background: linear-gradient(to right, #76e8df, #4fd1c5)"></div>
											{:else if (item.staticSplitRatio ?? 0.5) === 1}
												<div class="mt-1.5 w-24 h-[4px] rounded-full overflow-hidden" style="background: linear-gradient(to right, #4a7bb0, #6192c7)"></div>
											{:else}
												{@const rA = item.staticSplitRatio ?? 0.5}
												<div class="relative w-24 flex items-center h-[8px] mt-1.5">
													<div class="flex rounded-full overflow-hidden h-[4px] w-full bg-[#4fd1c5]">
														<div class="bg-[#4a7bb0] h-full" style="width: {rA * 100}%"></div>
													</div>
													<div class="absolute w-2 h-2 rounded-full bg-white border border-gray-300 shadow-sm" style="left: calc({rA * 100}% - 4px)"></div>
												</div>
											{/if}
										{/if}
									</div>
									<div class="text-right">
										<p class="font-bold text-sm text-[#2d3142]">{formatter.format(Math.round(item.latestAmount))}</p>
										<p class="text-[10px] font-bold uppercase tracking-wider {selectedId === item.id ? 'text-[#4a7bb0]' : 'text-[#9ca3af]'}">
											{item.intervalMonths === 0 ? t('frequencyListOneTime') : item.intervalMonths === 1 ? t('frequencyListMonthly') : item.intervalMonths === 3 ? t('frequencyListQuarterly') : item.intervalMonths === 12 ? t('frequencyListYearly') : ''}
										</p>
									</div>
								</a>
							{/each}
						</div>
						<div class="px-4 py-3.5 bg-[#fbf9f5]/50 border-t border-[#efeeea]">
							<a
								href="?new=true&paidBy=A"
								class="w-full flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[#ff7361]/20 rounded-lg hover:text-[#ff7361] hover:bg-[#ff7361]/5 transition-all text-[#ff7361] justify-center text-xs font-bold"
							>
								<span class="material-symbols-outlined text-sm">add</span>
								<span>{t('addTemplate')}</span>
							</a>
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center text-center p-8 space-y-4">
							<span class="material-symbols-outlined text-4xl text-[#ff7361] opacity-70">receipt_long</span>
							<p class="text-xs text-[#9ca3af] font-bold max-w-[200px] leading-relaxed">{t('noActiveTemplates', { name: data.personAName })}</p>
							<a
								href="?new=true&paidBy=A"
								class="inline-flex items-center gap-2 px-6 py-2.5 bg-[#ff7361]/10 border border-[#ff7361]/30 hover:bg-[#ff7361] hover:text-white rounded-xl text-[#ff7361] transition-all text-xs font-bold shadow-sm"
							>
								<span class="material-symbols-outlined text-sm">add</span>
								<span>{t('addTemplate')}</span>
							</a>
						</div>
					{/if}
				</div>
			</div>
			{/if}

			<!-- Payer B's templates -->
			{#if activePerson !== 'A'}
			<div class="flex flex-col space-y-3">
				<div class="bg-white rounded-2xl shadow-[0_8px_30px_rgb(45,49,66,0.04)] border border-[#efeeea] overflow-hidden">
					{#if filteredExpensesB.length > 0}
						<div class="flex flex-col">
							{#each filteredExpensesB as item, idx}
								<a
									href={selectedId === item.id ? cancelHref : `?id=${item.id}`}
									class="px-4 py-3 flex items-center justify-between hover:bg-[#4fd1c5]/5 transition-colors border-l-4 border-b border-[#efeeea]
									{selectedId === item.id ? 'border-l-[#4fd1c5] bg-[#4fd1c5]/5 border-b-transparent' : 'border-l-transparent'}
									{idx === filteredExpensesB.length - 1 ? 'border-b-0' : ''}
									{filteredExpensesB[idx + 1]?.id === selectedId ? 'border-b-transparent' : ''}"
								>
									<div class="flex flex-col flex-grow">
										<span class="font-bold text-sm text-[#2d3142] hover:text-[#4fd1c5] transition-colors decoration-[#efeeea] hover:decoration-[#4fd1c5]/30 underline-offset-4 whitespace-pre-wrap break-words">{item.name}</span>
										{#if item.splitType === 'dynamic'}
											<div class="mt-1.5 w-24 h-[6px] rounded-full overflow-hidden flex">
												{#if data.dynamicSplitRatioA === 0}
													<div class="w-full h-full" style="background: linear-gradient(to right, #76e8df, #4fd1c5)"></div>
												{:else if data.dynamicSplitRatioA === 1}
													<div class="w-full h-full" style="background: linear-gradient(to right, #4a7bb0, #6192c7)"></div>
												{:else}
													<div class="w-full h-full dynamic-share-bar--small" style="--pct-a: {data.dynamicSplitRatioA * 100}%"></div>
												{/if}
											</div>
										{:else}
											{#if (item.staticSplitRatio ?? 0.5) === 0}
												<div class="mt-1.5 w-24 h-[4px] rounded-full overflow-hidden" style="background: linear-gradient(to right, #76e8df, #4fd1c5)"></div>
											{:else if (item.staticSplitRatio ?? 0.5) === 1}
												<div class="mt-1.5 w-24 h-[4px] rounded-full overflow-hidden" style="background: linear-gradient(to right, #4a7bb0, #6192c7)"></div>
											{:else}
												{@const rA = item.staticSplitRatio ?? 0.5}
												<div class="relative w-24 flex items-center h-[8px] mt-1.5">
													<div class="flex rounded-full overflow-hidden h-[4px] w-full bg-[#4fd1c5]">
														<div class="bg-[#4a7bb0] h-full" style="width: {rA * 100}%"></div>
													</div>
													<div class="absolute w-2 h-2 rounded-full bg-white border border-gray-300 shadow-sm" style="left: calc({rA * 100}% - 4px)"></div>
												</div>
											{/if}
										{/if}
									</div>
									<div class="text-right">
										<p class="font-bold text-sm text-[#2d3142]">{formatter.format(Math.round(item.latestAmount))}</p>
										<p class="text-[10px] font-bold uppercase tracking-wider {selectedId === item.id ? 'text-[#4fd1c5]' : 'text-[#9ca3af]'}">
											{item.intervalMonths === 0 ? t('frequencyListOneTime') : item.intervalMonths === 1 ? t('frequencyListMonthly') : item.intervalMonths === 3 ? t('frequencyListQuarterly') : item.intervalMonths === 12 ? t('frequencyListYearly') : ''}
										</p>
									</div>
								</a>
							{/each}
						</div>
						<div class="px-4 py-3.5 bg-[#fbf9f5]/50 border-t border-[#efeeea]">
							<a
								href="?new=true&paidBy=B"
								class="w-full flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[#ff7361]/20 rounded-lg hover:text-[#ff7361] hover:bg-[#ff7361]/5 transition-all text-[#ff7361] justify-center text-xs font-bold"
							>
								<span class="material-symbols-outlined text-sm">add</span>
								<span>{t('addTemplate')}</span>
							</a>
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center text-center p-8 space-y-4">
							<span class="material-symbols-outlined text-4xl text-[#ff7361] opacity-70">receipt_long</span>
							<p class="text-xs text-[#9ca3af] font-bold max-w-[200px] leading-relaxed">{t('noActiveTemplates', { name: data.personBName })}</p>
							<a
								href="?new=true&paidBy=B"
								class="inline-flex items-center gap-2 px-6 py-2.5 bg-[#ff7361]/10 border border-[#ff7361]/30 hover:bg-[#ff7361] hover:text-white rounded-xl text-[#ff7361] transition-all text-xs font-bold shadow-sm"
							>
								<span class="material-symbols-outlined text-sm">add</span>
								<span>{t('addTemplate')}</span>
							</a>
						</div>
					{/if}
				</div>
			</div>
			{/if}
		</div>

		<!-- Right Column: Details Card (desktop inline, mobile full-screen overlay) -->
		<div class="detail-panel {isCreateMode || selectedExpense ? 'detail-panel--open' : ''}">
			{#if isCreateMode || selectedExpense}
				<div class="mobile-overlay-container animate-slide-in-fade" out:fade={{ duration: 180 }}>
					<a
						href={cancelHref}
						class="close-btn-floater"
						aria-label={t('cancel')}
					>
						<span class="material-symbols-outlined" style="font-weight: 200;">arrow_back</span>
					</a>
					<ExpenseFormCard
						expense={selectedExpense}
						isCreateMode={isCreateMode}
						initialPaidBy={initialPaidBy}
						accounts={data.accounts}
						namePersonA={data.personAName}
						namePersonB={data.personBName}
						dynamicSplitRatioA={data.dynamicSplitRatioA}
						cancelHref={cancelHref}
						actionRoute=""
						currentYear={data.period.year}
						currentMonth={data.period.month}
					/>
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
					<label class="text-xs font-black text-[#9ca3af] uppercase tracking-wider" for="new-acc-name">{t('accountName')}</label>
					<input
						id="new-acc-name"
						type="text"
						bind:value={newAccountName}
						class="w-full px-3.5 py-2 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-0 text-sm"
						placeholder="e.g. Main Bank, Revolut"
					/>
				</div>

				<div class="space-y-1">
					<label class="text-xs font-black text-[#9ca3af] uppercase tracking-wider" for="new-acc-owner">{t('owner')}</label>
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

<style>
	@keyframes slideUpOnly {
		from {
			transform: translateY(100px);
		}
		to {
			transform: translateY(0);
		}
	}
	.animate-slide-in-fade {
		animation: 
			slideUpOnly 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards,
			fadeInOnly 0.45s cubic-bezier(0.25, 1, 0.5, 1) forwards;
	}

	@keyframes fadeInOnly {
		from { opacity: 0.4; }
		to   { opacity: 1; }
	}

	@keyframes slideFromRightOnly {
		from {
			transform: translateX(8px);
		}
		to {
			transform: translateX(0);
		}
	}

	/* Desktop: flex layout so detail panel pushes the list */
	.expenses-layout {
		display: flex;
		gap: 2rem;
		align-items: flex-start;
	}

	.expenses-list {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Detail panel: collapsed by default, expands when open */
	.detail-panel {
		width: 0;
		overflow: visible;
		flex-shrink: 0;
		transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.detail-panel--open {
		width: 420px;
	}

	.mobile-overlay-container {
		display: block;
		width: 420px;
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

	.close-btn-floater .material-symbols-outlined {
		font-size: 22px;
	}

	@media (max-width: 1023.98px) {
		.expenses-layout {
			display: block;
		}

		.detail-panel {
			width: auto;
			overflow: visible;
		}

		.detail-panel--open {
			width: auto;
		}

		.mobile-overlay-container {
			position: fixed;
			z-index: 50;
			inset: 0;
			width: 100%;
			height: 100%;
			background-color: #ff7361;
			overflow-y: auto;
			padding-top: 60px;
			padding-left: 12px;
			padding-right: 12px;
			padding-bottom: 12px;
		}
	}

	@media (min-width: 1024px) {
		.close-btn-floater {
			display: none !important;
		}

		.animate-slide-in-fade {
			animation: 
				slideFromRightOnly 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards,
				fadeInOnly 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards;
		}
	}

	/* ---- Toolbar ---- */
	.toolbar {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 4px;
	}

	.toolbar-dropdown-wrap {
		position: relative;
	}

	.toolbar-sort {
		margin-left: auto;
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

	.toolbar-btn--active {
		background: white;
		border-color: rgba(255,255,255,0.5);
		box-shadow: 0 2px 8px rgba(45,49,66,0.14);
	}

	.toolbar-btn-icon {
		font-size: 15px;
		opacity: 0.5;
		color: #2d3142;
	}

	.person-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		transition: background 0.2s;
	}

	/* Dropdown menu */
	.toolbar-menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 100;
		background: white;
		border: 1px solid #efeeea;
		border-radius: 14px;
		box-shadow: 0 8px 24px rgba(45,49,66,0.13), 0 2px 6px rgba(45,49,66,0.07);
		min-width: 150px;
		padding: 6px;
		display: flex;
		flex-direction: column;
	}

	.toolbar-menu--right {
		left: auto;
		right: 0;
	}

	.toolbar-menu-item {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 8px 10px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		color: #2d3142;
		cursor: pointer;
		transition: background 0.12s;
		text-align: left;
		border: none;
		background: none;
		width: 100%;
	}

	.toolbar-menu-item:hover {
		background: #f5f4f0;
	}

	.toolbar-menu-item--selected {
		color: #ff7361;
		font-weight: 700;
	}

	.toolbar-menu-item--direction {
		color: #6b7280;
		font-size: 12px;
		gap: 6px;
	}

	.toolbar-menu-divider {
		height: 1px;
		background: #efeeea;
		margin: 4px 6px;
	}

	/* Custom checkbox style */
	.toolbar-menu-item input[type="checkbox"] {
		appearance: none;
		-webkit-appearance: none;
		width: 15px;
		height: 15px;
		border: 1.5px solid #d1d5db;
		border-radius: 4px;
		flex-shrink: 0;
		position: relative;
		cursor: pointer;
		transition: all 0.15s;
	}

	.toolbar-menu-item input[type="checkbox"]:checked {
		background: var(--accent-color, #ff7361);
		border-color: var(--accent-color, #ff7361);
	}

	.toolbar-menu-item input[type="checkbox"]:checked::after {
		content: '';
		position: absolute;
		left: 3px;
		top: 1px;
		width: 5px;
		height: 8px;
		border: 2px solid white;
		border-top: none;
		border-left: none;
		transform: rotate(45deg);
	}
</style>
