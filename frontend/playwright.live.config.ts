import base from './playwright.config';

// Live-infra run: no local server is booted — specs run against an already
// deployed site (default: production). One worker keeps the request rate
// polite to a shared deployment. Override the target with QA_TARGET_URL.
export default {
    ...base,
    workers: 1,
    use: {
        ...base.use,
        baseURL: process.env.QA_TARGET_URL ?? 'https://roomivo.eu',
    },
    webServer: undefined,
};
