import { test, expect } from '@playwright/test';
import { join } from 'path';

test('Generate Demo Video', async ({ page, context }) => {
	// 1. Inject custom cursor to follow Playwright's virtual mouse movements
	await page.addInitScript(() => {
		window.addEventListener('DOMContentLoaded', () => {
			const cursor = document.createElement('div');
			cursor.id = 'demo-cursor';
			cursor.style.position = 'fixed';
			cursor.style.width = '20px';
			cursor.style.height = '20px';
			cursor.style.borderRadius = '50%';
			cursor.style.backgroundColor = 'rgba(255, 115, 97, 0.4)';
			cursor.style.border = '2px solid rgb(255, 115, 97)';
			cursor.style.pointerEvents = 'none';
			cursor.style.zIndex = '999999';
			cursor.style.transform = 'translate(-50%, -50%)';
			cursor.style.left = '-100px';
			cursor.style.top = '-100px';
			cursor.style.transition = 'transform 0.08s ease';
			
			// Hide cursor on warmup, intro, and outro slides
			if (window.location.href.includes('warmup.html') || window.location.href.includes('intro.html') || window.location.href.includes('outro.html')) {
				cursor.style.display = 'none';
			}
			
			document.body.appendChild(cursor);

			document.addEventListener('mousemove', (e) => {
				if (window.location.href.includes('warmup.html') || window.location.href.includes('intro.html') || window.location.href.includes('outro.html')) {
					cursor.style.display = 'none';
					return;
				}
				cursor.style.display = 'block';
				cursor.style.left = `${e.clientX}px`;
				cursor.style.top = `${e.clientY}px`;
			});

			document.addEventListener('mousedown', () => {
				cursor.style.transform = 'translate(-50%, -50%) scale(0.75)';
				cursor.style.backgroundColor = 'rgba(255, 115, 97, 0.8)';
			});
			document.addEventListener('mouseup', () => {
				cursor.style.transform = 'translate(-50%, -50%) scale(1)';
				cursor.style.backgroundColor = 'rgba(255, 115, 97, 0.4)';
			});
		});
	});

	// Helper for smooth mouse movements and clicks
	async function smoothMoveTo(selector: string) {
		const element = page.locator(selector).first();
		await element.waitFor({ state: 'visible' });
		const box = await element.boundingBox();
		if (box) {
			const x = box.x + box.width / 2;
			const y = box.y + box.height / 2;
			await page.mouse.move(x, y, { steps: 25 }); // 25 steps creates a very smooth glide
			await page.waitForTimeout(250);
		}
	}

	async function smoothClick(selector: string) {
		await smoothMoveTo(selector);
		await page.mouse.down();
		await page.waitForTimeout(120);
		await page.mouse.up();
		await page.waitForTimeout(600);
	}

	async function smoothType(selector: string, text: string) {
		await smoothClick(selector);
		const element = page.locator(selector).first();
		await element.fill('');
		await page.waitForTimeout(200);
		for (const char of text) {
			await page.keyboard.press(char);
			await page.waitForTimeout(90); // human typing speed
		}
		await page.waitForTimeout(400);
	}

	// Bypassing login by setting the authentication cookie
	await context.addCookies([
		{
			name: 'duomi_auth',
			value: 'development_secret',
			domain: 'localhost',
			path: '/',
		},
	]);

	// --- Font and Asset Warm-up ---
	// Go to warmup page silently first (it's a blank dark page), wait for resources to download and cache
	const warmupPath = `file://${join(process.cwd(), 'tests/warmup.html')}`;
	await page.goto(warmupPath);
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(1500); // give the browser ample time to cache the fonts

	// --- Begin Demo Flow ---
	
	// Step 0: Display the animated INTRO page
	const introPath = `file://${join(process.cwd(), 'tests/intro.html')}`;
	await page.goto(introPath);
	await page.waitForTimeout(4500); // wait for logo slide in & text fade animations

	// Step 1: Go directly to the Dashboard Page (will load instantly now with cached fonts!)
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(2000);

	// Step 2: Hover over dashboard widgets to present them
	// Hover Settlement Card
	await smoothMoveTo('[data-purpose="current-settlement-card"]');
	await page.waitForTimeout(2500);

	// Step 3: Go to Expenses Page
	await smoothClick('a[href="/expenses"]');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(1500);

	// Step 4: Click Rent Expense
	await smoothClick('a:has-text("Rent")');
	await page.waitForTimeout(1500);

	// Step 5: Edit Rent Price
	// Click the button containing the price (which shows a span with text-2xl class)
	await smoothClick('.floating-sidebar-card button:has(span.text-2xl)');
	await page.waitForTimeout(800);

	// Type new amount (3200 instead of 2400)
	await smoothType('.floating-sidebar-card input[inputmode="numeric"]', '3200');
	
	// Press Enter to save
	await page.keyboard.press('Enter');
	
	// Wait to see the toast notification
	await page.waitForTimeout(2500);

	// Step 6: Close details sidebar card by clicking Rent in the list again
	await smoothClick('a:has-text("Rent")');
	await page.waitForTimeout(1500);

	// Step 7: Go back to Dashboard (first nav link)
	await smoothClick('nav a >> nth=0');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(1500);

	// Step 8: Edit Incomes
	// Scroll down to the income card
	const incomeCard = page.locator('[data-purpose="income-settings-card"]');
	await incomeCard.scrollIntoViewIfNeeded();
	await page.waitForTimeout(1000);

	// Type new income for Person A (Alice)
	await smoothType('#incomeA', '6000');
	// Click on Person B's income field to blur and save
	await smoothType('#incomeB', '4000');
	// Click outside to blur and save Person B's income (click top-left corner of the page)
	await page.mouse.move(10, 10, { steps: 15 });
	await page.mouse.down();
	await page.mouse.up();
	await page.waitForTimeout(2000);

	// Step 9: Scroll up to show the recalculated settlement card
	const settlementCard = page.locator('[data-purpose="current-settlement-card"]');
	await settlementCard.scrollIntoViewIfNeeded();
	await smoothMoveTo('[data-purpose="current-settlement-card"]');
	await page.waitForTimeout(3000);
	
	// Step 10: Display the animated OUTRO page
	const outroPath = `file://${join(process.cwd(), 'tests/outro.html')}`;
	await page.goto(outroPath);
	await page.waitForTimeout(5000); // wait for docker code display and brand logo
});
