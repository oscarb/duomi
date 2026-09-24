import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	testMatch: '**/record_demo.demo.ts',
	timeout: 90000,
	use: {
		baseURL: 'http://localhost:3002',
		timezoneId: 'UTC',
		video: {
			mode: 'on',
			size: { width: 1280, height: 720 },
		},
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1280, height: 720 },
			},
		},
	],
	webServer: {
		command: 'rm -f ./data/test.db && DATABASE_URL=./data/test.db drizzle-kit migrate && TZ=UTC TEST_SYSTEM_DATE=2026-06-22T23:00:00Z DATABASE_URL=./data/test.db SECRET_APP_PASSPHRASE=development_secret PUBLIC_PERSON_A_NAME=Alice PUBLIC_PERSON_B_NAME=Bob LOCALE=en-US CURRENCY=EUR DEMO_MODE=true npm run dev -- --port 3002',
		url: 'http://localhost:3002',
		reuseExistingServer: false,
		timeout: 15000,
	},
});
