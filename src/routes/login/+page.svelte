<script lang="ts">
	import { getContext } from 'svelte';

	let { form } = $props();

	const { t } = getContext<{
		t: (key: string, params?: Record<string, string>) => string;
	}>('i18n');

	let showPassword = $state(false);
</script>

<svelte:head>
	<title>{t('loginTitle')} - Duomi</title>
	<meta name="description" content="Access the Duomi expense tracker application." />
</svelte:head>

<div class="min-h-[calc(100vh-100px)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8 bg-white rounded-2xl p-8 sm:p-10 border border-[#efeeea] shadow-xl transition-all duration-300 animate-slide-in" style="box-shadow: 0 20px 40px -15px rgba(45, 49, 66, 0.15);">
		<div class="text-center">
			<div class="mx-auto h-16 w-16 bg-[#ff7361]/10 rounded-full flex items-center justify-center mb-4">
				<span class="material-symbols-outlined text-[#ff7361] text-4xl" style="font-weight: 300;">lock</span>
			</div>
			<h1 class="sr-only">
				{t('loginTitle')}
			</h1>
		</div>

		<form class="mt-8 space-y-6 animate-slide-in" method="POST">
			<div class="rounded-md space-y-4">
				<div>
					<label for="current-password" class="block text-[#9ca3af] text-xs uppercase tracking-widest font-bold mb-2">
						{t('passphraseLabel')}
					</label>
					<div class="relative">
						<input
							id="current-password"
							name="passphrase"
							type={showPassword ? 'text' : 'password'}
							autocomplete="current-password"
							required
							class="w-full px-4 py-3.5 rounded-xl border border-[#efeeea] focus:border-[#ff7361] focus:ring-2 focus:ring-[#ff7361]/25 outline-none transition-all pr-12 text-[#2d3142] bg-white font-sans text-base shadow-sm"
						/>
						<button
							type="button"
							onclick={() => showPassword = !showPassword}
							class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#ff7361] transition-colors flex items-center justify-center p-1.5 rounded-lg focus:outline-none"
							aria-label={showPassword ? t('hidePassphrase') : t('showPassphrase')}
						>
							<span class="material-symbols-outlined text-xl">
								{showPassword ? 'visibility_off' : 'visibility'}
							</span>
						</button>
					</div>
				</div>
			</div>

			{#if form?.incorrect}
				<p class="text-[#ff7361] text-sm font-semibold flex items-center gap-1.5 mt-2 animate-slide-in">
					<span class="material-symbols-outlined text-base">error_outline</span>
					{t('invalidPassphrase')}
				</p>
			{/if}

			<div class="flex justify-center pt-2">
				<button
					type="submit"
					class="w-full py-3.5 bg-[#ff7361] hover:bg-[#ff7361]/90 active:scale-[0.95] text-white font-bold rounded-xl shadow-lg shadow-[#ff7361]/25 hover:shadow-xl hover:shadow-[#ff7361]/30 transition-all flex items-center justify-center cursor-pointer"
				>
					{t('loginButton')}
				</button>
			</div>
		</form>
	</div>
</div>
