import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    retries: 1,
    fullyParallel: true,
    reporter: [['html', { open: 'never' }]],
    use: {
        baseURL: 'http://127.0.0.1:3000',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],
    webServer: {
        command: 'npm run dev -- -p 3000 -H 0.0.0.0',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
