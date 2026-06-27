import base from './playwright.config';

// CI e2e: production build served by `next start`, against a real backend on
// :8000. The CSP allows the localhost http backend (see next.config.ts httpApi),
// so the browser reaches it while Playwright still intercepts mocked endpoints.
//
// Prod (not dev) avoids two dev-only problems: per-route compile contention
// (flaky timeouts under parallel workers) and dev-only console warnings (which
// break the "no unhandled console errors" assertions). The build must be run
// with NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 before this config starts.
export default {
    ...base,
    webServer: {
        command: 'NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npx next start -p 3001 -H 127.0.0.1',
        url: 'http://127.0.0.1:3001',
        reuseExistingServer: false,
        timeout: 120_000,
    },
};
