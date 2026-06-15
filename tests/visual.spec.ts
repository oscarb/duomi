import { test, expect } from '@playwright/test';

test.describe('ExpenseFormCard Visual Regressions', () => {
	test.beforeEach(async ({ context }) => {
		// Set the auth cookie so we bypass login redirect
		await context.addCookies([
			{
				name: 'duomi_auth',
				value: 'development_secret',
				domain: 'localhost',
				path: '/',
			},
		]);
	});

	// Helper to wait for fonts and ready state
	async function preparePageForScreenshot(page: any) {
		await page.waitForLoadState('networkidle');
		await page.evaluate(() => document.fonts.ready);
		// Wait an extra brief moment for rendering lifecycle to fully settle
		await page.waitForTimeout(500);
	}

	test('USD - Static Mode rendering', async ({ page }) => {
		// Visit the expenses page with ID 1 (Rent) in USD/en-US
		await page.goto('/expenses?id=1&test_locale=en-US&test_currency=USD&test_person_a=Alice&test_person_b=Bob');
		await preparePageForScreenshot(page);

		const card = page.locator('.floating-sidebar-card');
		await expect(card).toBeVisible();

		// Verify screenshot matches baseline
		await expect(card).toHaveScreenshot('usd-static-mode.png', {
			animations: 'disabled',
		});
	});

	test('USD - Edit Mode rendering', async ({ page }) => {
		// Visit the expenses page with ID 1 (Rent) in USD/en-US
		await page.goto('/expenses?id=1&test_locale=en-US&test_currency=USD&test_person_a=Alice&test_person_b=Bob');
		await preparePageForScreenshot(page);

		const card = page.locator('.floating-sidebar-card');
		await expect(card).toBeVisible();

		// Click on the amount/price button to trigger edit mode
		const amountBtn = card.locator('button:has(span.text-2xl)');
		await amountBtn.click();

		// Wait for input field to appear and be focused
		const amountInput = card.locator('input[inputmode="numeric"]');
		await expect(amountInput).toBeVisible();
		
		// Hide the cursor text insertion to avoid flaky screenshot diffs
		await amountInput.evaluate((el: HTMLInputElement) => {
			el.style.caretColor = 'transparent';
		});

		await page.waitForTimeout(100);

		// Verify screenshot matches baseline
		await expect(card).toHaveScreenshot('usd-edit-mode.png', {
			animations: 'disabled',
		});
	});

	test('SEK - Static Mode rendering', async ({ page }) => {
		// Visit the expenses page with ID 1 (Rent) in SEK/sv-SE
		await page.goto('/expenses?id=1&test_locale=sv-SE&test_currency=SEK&test_person_a=Alice&test_person_b=Bob');
		await preparePageForScreenshot(page);

		const card = page.locator('.floating-sidebar-card');
		await expect(card).toBeVisible();

		// Verify screenshot matches baseline
		await expect(card).toHaveScreenshot('sek-static-mode.png', {
			animations: 'disabled',
		});
	});

	test('SEK - Edit Mode rendering', async ({ page }) => {
		// Visit the expenses page with ID 1 (Rent) in SEK/sv-SE
		await page.goto('/expenses?id=1&test_locale=sv-SE&test_currency=SEK&test_person_a=Alice&test_person_b=Bob');
		await preparePageForScreenshot(page);

		const card = page.locator('.floating-sidebar-card');
		await expect(card).toBeVisible();

		// Click on the amount/price button to trigger edit mode
		const amountBtn = card.locator('button:has(span.text-2xl)');
		await amountBtn.click();

		// Wait for input field to appear and be focused
		const amountInput = card.locator('input[inputmode="numeric"]');
		await expect(amountInput).toBeVisible();

		// Hide the cursor text insertion to avoid flaky screenshot diffs
		await amountInput.evaluate((el: HTMLInputElement) => {
			el.style.caretColor = 'transparent';
		});

		await page.waitForTimeout(100);

		// Verify screenshot matches baseline
		await expect(card).toHaveScreenshot('sek-edit-mode.png', {
			animations: 'disabled',
		});
	});
});
