<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { dev } from '$app/environment';
	import { toasts } from '$lib/toasts.svelte';

	import { setContext } from 'svelte';
	import { translate, getCurrencyConfig } from '$lib/translations';

	let { children, data } = $props();

	// Set translation and formatting context reactively
	let locale = $derived(data.locale || 'en-US');
	let currency = $derived(data.currency || 'USD');
	
	let t = $derived((key: string, params?: Record<string, string>) => translate(locale, key, params));
	let currencyConfig = $derived(getCurrencyConfig(locale, currency));
	let formatter = $derived(new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }));

	setContext('i18n', {
		get locale() { return locale; },
		get currency() { return currency; },
		get t() { return t; },
		get currencyConfig() { return currencyConfig; },
		get formatter() { return formatter; }
	});

	// Derive month and year reactively to preserve query params during header navigation
	let currentYear = $derived(page.data.period?.year || page.url.searchParams.get('year'));
	let currentMonth = $derived(page.data.period?.month || page.url.searchParams.get('month'));

	let dashboardHref = $derived(currentYear && currentMonth ? `/?year=${currentYear}&month=${currentMonth}` : '/');
	let expensesHref = '/expenses';

	// Check if overlay card is open on the dashboard page
	let selectedId = $derived(parseInt(page.url.searchParams.get('id') || '', 10) || null);
	let isCreateMode = $derived(page.url.searchParams.get('new') === 'true');
	let isOverlayOpen = $derived(selectedId !== null || isCreateMode);

	// Automatic service worker unregistration in development mode to prevent stale page cache issues
	$effect(() => {
		if (dev && typeof navigator !== 'undefined' && navigator.serviceWorker) {
			navigator.serviceWorker.getRegistrations().then((registrations) => {
				for (const registration of registrations) {
					registration.unregister().then((success) => {
						if (success) {
							console.log('Successfully unregistered active service worker in dev mode.');
							window.location.reload();
						}
					});
				}
			});
		} else if (!dev && typeof navigator !== 'undefined' && navigator.serviceWorker) {
			navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch((err) => {
				console.error('Service worker registration failed:', err);
			});
		}
	});
</script>

<div class="min-h-screen bg-[#ff7361] font-sans text-[#2d3142] flex flex-col">
	<header class="w-full py-6 flex justify-center items-center relative bg-transparent text-white">
		<nav class="flex space-x-8 font-medium">
			<a
				class="pb-1 transition-opacity border-b-2 hover:opacity-100 {page.url.pathname === '/' ? 'border-white opacity-100' : 'border-transparent opacity-60'}"
				href={dashboardHref}
			>
				{t('dashboard')}
			</a>
			<a
				class="pb-1 transition-opacity border-b-2 hover:opacity-100 {page.url.pathname.startsWith('/expenses') ? 'border-white opacity-100' : 'border-transparent opacity-60'}"
				href={expensesHref}
			>
				{t('expenses')}
			</a>
		</nav>
	</header>

	<!-- Main Content Wrapper -->
	<div class="flex-grow w-full max-w-6xl mx-auto px-4 md:px-8">
		{@render children()}
	</div>
</div>

<!-- Toast Container -->
<div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
	{#each toasts.list as toast (toast.id)}
		<div
			class="pointer-events-auto flex items-center justify-between p-4 bg-white/95 backdrop-blur border border-[#efeeea] rounded-xl shadow-xl transition-all duration-300 animate-slide-in"
			style="box-shadow: 0 10px 30px -5px rgba(45, 49, 66, 0.08);"
		>
			<div class="flex items-center gap-2.5">
				{#if toast.type === 'success'}
					<span class="material-symbols-outlined text-[#4fd1c5] text-xl">check_circle</span>
				{:else}
					<span class="material-symbols-outlined text-[#ff7361] text-xl">error</span>
				{/if}
				<span class="text-sm font-semibold text-[#2d3142]">{toast.message}</span>
			</div>
			<div class="flex items-center gap-2 ml-4">
				{#if toast.action}
					<button
						type="button"
						onclick={() => {
							toast.action?.callback();
							toasts.dismiss(toast.id);
						}}
						class="text-xs font-bold text-[#ff7361] hover:text-[#ff7361]/80 hover:underline whitespace-nowrap pointer-events-auto"
					>
						{toast.action.label}
					</button>
				{/if}
				<button
					type="button"
					onclick={() => toasts.dismiss(toast.id)}
					class="text-[#9ca3af] hover:text-[#2d3142] transition-colors pointer-events-auto flex items-center justify-center"
				>
					<span class="material-symbols-outlined text-base">close</span>
				</button>
			</div>
		</div>
	{/each}
</div>
