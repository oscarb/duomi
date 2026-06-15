import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: './tests',
	/* Maximum time one test can run for. */
	timeout: 30000,
	expect: {
		/**
		 * Maximum time expect() should wait for the condition to be met.
		 * For visual regression matching, we allow a small pixel difference tolerance if needed,
		 * but Playwright defaults are usually good.
		 */
		timeout: 5000,
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.02, // Allow up to 2% pixel differences for antialiasing/micro-rendering discrepancies
		}
	},
	/* Run tests in files in parallel */
	fullyParallel: false,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on local dev for deterministic visual comparisons. */
	workers: 1,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: 'list',
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: 'http://localhost:3002',

		/* Collect trace when retrying a failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
	},

	/* Configure projects for Chromium only to keep tests lightweight and consistent. */
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: 'rm -f ./data/test.db && DATABASE_URL=./data/test.db drizzle-kit migrate && DATABASE_URL=./data/test.db SECRET_APP_PASSPHRASE=development_secret PUBLIC_PERSON_A_NAME=Alice PUBLIC_PERSON_B_NAME=Bob DEMO_MODE=true npm run dev -- --port 3002',
		url: 'http://localhost:3002',
		reuseExistingServer: false,
		timeout: 15000,
	},
});
