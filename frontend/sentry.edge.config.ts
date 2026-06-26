import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // 20% edge trace sampling in production to save quota
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
});
