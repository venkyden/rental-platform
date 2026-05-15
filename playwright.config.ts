import { defineConfig, devices } from '@playwright/test';

/**
 * Root Playwright configuration for the Roomivo platform.
 * This configuration allows running tests from the repository root
 * while maintaining consistency with the frontend-specific settings.
 */
export default defineConfig({
    testDir: './frontend/e2e',
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
    ],
    webServer: {
        command: 'cd frontend && npm run dev -- -p 3000 -H 127.0.0.1',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
