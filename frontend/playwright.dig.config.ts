import base from './playwright.config';
export default {
    ...base,
    use: { ...base.use, baseURL: 'http://127.0.0.1:3220' },
    webServer: {
        command: 'NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npx next dev -p 3220 -H 127.0.0.1',
        url: 'http://127.0.0.1:3220',
        reuseExistingServer: false,
        timeout: 180_000,
    },
};
