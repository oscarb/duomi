<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	// Derive month and year reactively to preserve query params during header navigation
	let currentYear = $derived(page.data.period?.year || page.url.searchParams.get('year'));
	let currentMonth = $derived(page.data.period?.month || page.url.searchParams.get('month'));

	let dashboardHref = $derived(currentYear && currentMonth ? `/?year=${currentYear}&month=${currentMonth}` : '/');
	let expensesHref = $derived(currentYear && currentMonth ? `/expenses?year=${currentYear}&month=${currentMonth}` : '/expenses');
</script>

<div class="min-h-screen bg-[#ff7361] font-sans text-[#2d3142] flex flex-col">
	<header class="w-full py-6 flex justify-center items-center relative bg-transparent text-white">
		<nav class="flex space-x-8 font-medium">
			<a
				class="pb-1 transition-opacity border-b-2 hover:opacity-100 {page.url.pathname === '/' ? 'border-white opacity-100' : 'border-transparent opacity-60'}"
				href={dashboardHref}
			>
				Dashboard
			</a>
			<a
				class="pb-1 transition-opacity border-b-2 hover:opacity-100 {page.url.pathname.startsWith('/expenses') ? 'border-white opacity-100' : 'border-transparent opacity-60'}"
				href={expensesHref}
			>
				Expenses
			</a>
		</nav>
	</header>

	<!-- Main Content Wrapper -->
	<div class="flex-grow w-full max-w-6xl mx-auto px-4 md:px-8">
		{@render children()}
	</div>
</div>
