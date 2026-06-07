<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getContext } from 'svelte';
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

	// Active and archived templates lists
	let activeExpenses = $derived(data.expenses.filter(e => e.archivedDate === null));
	let expensesA = $derived(activeExpenses.filter(e => e.paidBy === 'A'));
	let expensesB = $derived(activeExpenses.filter(e => e.paidBy === 'B'));

	// Currently selected expense
	let selectedExpense = $derived(data.expenses.find(e => e.id === selectedId) || null);

	// Account creation dialog
	let showAddAccount = $state(false);
	let newAccountName = $state('');
	let newAccountOwner = $state<'A' | 'B'>('A');

	let cancelHref = '/expenses';
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
						<div class="flex flex-col">
							{#each expensesA as item, idx}
								<a
									href={selectedId === item.id ? cancelHref : `?id=${item.id}`}
									class="px-4 py-3 flex items-center justify-between hover:bg-[#ff7361]/5 transition-colors border-l-4 border-b border-[#efeeea] 
									{selectedId === item.id ? 'border-l-[#ff7361] bg-[#ff7361]/5 border-b-transparent' : 'border-l-transparent'}
									{idx === expensesA.length - 1 ? 'border-b-0' : ''}
									{expensesA[idx + 1]?.id === selectedId ? 'border-b-transparent' : ''}"
								>
									<div class="flex flex-col flex-grow">
										<span class="font-bold text-sm text-[#2d3142] hover:text-[#ff7361] transition-colors decoration-[#efeeea] hover:decoration-[#ff7361]/30 underline-offset-4 whitespace-pre-wrap break-words">{item.name}</span>
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
										<p class="text-[10px] font-bold uppercase tracking-wider {selectedId === item.id ? 'text-[#ff7361]' : 'text-[#9ca3af]'}">
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
							href="?new=true&paidBy=A"
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
						<div class="flex flex-col">
							{#each expensesB as item, idx}
								<a
									href={selectedId === item.id ? cancelHref : `?id=${item.id}`}
									class="px-4 py-3 flex items-center justify-between hover:bg-[#4fd1c5]/5 transition-colors border-l-4 border-b border-[#efeeea]
									{selectedId === item.id ? 'border-l-[#4fd1c5] bg-[#4fd1c5]/5 border-b-transparent' : 'border-l-transparent'}
									{idx === expensesB.length - 1 ? 'border-b-0' : ''}
									{expensesB[idx + 1]?.id === selectedId ? 'border-b-transparent' : ''}"
								>
									<div class="flex flex-col flex-grow">
										<span class="font-bold text-sm text-[#2d3142] hover:text-[#ff7361] transition-colors decoration-[#efeeea] hover:decoration-[#ff7361]/30 underline-offset-4 whitespace-pre-wrap break-words">{item.name}</span>
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
										<p class="text-[10px] font-bold uppercase tracking-wider {selectedId === item.id ? 'text-[#4fd1c5]' : 'text-[#9ca3af]'}">
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
							href="?new=true&paidBy=B"
							class="w-full flex items-center gap-2 px-4 py-2 border-2 border-dashed border-[#ff7361]/20 rounded-lg hover:text-[#ff7361] hover:bg-[#ff7361]/5 transition-all text-[#ff7361] justify-center text-xs font-bold"
						>
							<span class="material-symbols-outlined text-sm">add</span>
							<span>{t('addTemplate')}</span>
						</a>
					</div>
				</div>
			</div>
		</div>

		<!-- Right Column: Details Card -->
		<div class="lg:col-span-5">
			{#if isCreateMode || selectedExpense}
				<div class="mobile-overlay-container animate-slide-in-fade">
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
			{:else}
				<div class="bg-white rounded-2xl shadow-[0_8px_30px_rgb(45,49,66,0.04)] p-8 md:p-10 border border-[#efeeea] sticky top-8 text-center py-20">
					<span class="material-symbols-outlined text-6xl text-[#9ca3af]/40 mb-3">receipt_long</span>
					<h3 class="text-lg font-bold text-[#2d3142]">{t('selectTemplate')}</h3>
					<p class="text-xs text-[#9ca3af] max-w-xs mx-auto mt-1">
						{t('selectTemplateDesc')}
					</p>
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
		animation: slideUpFadeMobile 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.mobile-overlay-container {
		display: block;
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
		.mobile-overlay-container {
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


	}

	@media (min-width: 1024px) {
		.mobile-overlay-container {
			margin-top: 0; /* Aligned card top again with other cards */
			position: relative;
		}

		.close-btn-floater {
			display: none !important;
		}

		.close-btn-floater:hover {
			background-color: rgba(255, 255, 255, 0.25);
			opacity: 1;
		}

		.close-btn-floater:active {
			background-color: rgba(255, 255, 255, 0.35);
			opacity: 1;
		}

		.close-btn-floater .close-icon-content {
			display: inline-block;
		}

		.close-btn-floater .close-text-content {
			display: none;
		}
	}
</style>
