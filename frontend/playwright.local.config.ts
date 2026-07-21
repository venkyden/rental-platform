import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
    testDir: './e2e', timeout: 60_000, retries: 1, fullyParallel: true, workers: 2,
    reporter: [['line']],
    use: { baseURL: 'http://127.0.0.1:3114', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: { command: 'npx next start -p 3114 -H 127.0.0.1', url: 'http://127.0.0.1:3114', reuseExistingServer: false, timeout: 120_000 },
});
