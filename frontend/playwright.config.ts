import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    retries: 1,
    fullyParallel: true,
    reporter: [['html', { open: 'never' }]],
        use: {
        baseURL: 'http://127.0.0.1:3001',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { 
                ...devices['Desktop Chrome']
            },
        },
        {
            name: 'webkit',
            use: { 
                ...devices['Desktop Safari']
            },
        },
    ],
    webServer: {
        command: 'npm run build && npm run start -- -p 3001 -H 127.0.0.1',
        url: 'http://127.0.0.1:3001',
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
