import * as Sentry from "@sentry/nextjs";

// CNIL/GDPR: Session Replay records user interactions and is non-essential
// tracking, so it must only run after the user opts in to analytics cookies.
// Error reporting itself (no replay) is retained as a security/debugging
// legitimate interest. The consent shape is written by CookieConsentBanner.
function analyticsConsentGranted(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const raw = window.localStorage.getItem("roomivo_cookie_consent");
        if (!raw) return false;
        return JSON.parse(raw)?.analytics === true;
    } catch {
        return false;
    }
}

const replayEnabled = analyticsConsentGranted();

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    integrations: replayEnabled ? [Sentry.replayIntegration()] : [],
    // Replay only when analytics consent is present; 0 otherwise.
    replaysSessionSampleRate: replayEnabled ? 0.1 : 0,
    replaysOnErrorSampleRate: replayEnabled ? 1.0 : 0,
});
