import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Set to zero for now to save quota, adjust in prod
    tracesSampleRate: 1.0,
});
