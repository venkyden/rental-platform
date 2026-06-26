# Platform Environment Variables

This document lists all API keys and configuration settings required to run Roomivo.

## 🚨 Critical Infrastructure
**Required for Application Startup.**
The backend will fail to start if these are missing.

| Variable | Description | Required? |
|----------|-------------|-----------|
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgresql+asyncpg://user:pass@localhost/db`) | **YES** |
| `SECRET_KEY` | 32+ character random string for security/crypto. | **YES** |
| `CREDENTIAL_SIGNING_KEY` | Ed25519 signing key — hex-encoded 32-byte seed (64 hex chars). **Required in production** (startup fails without it). In dev, an ephemeral key is used (credentials don't survive restart). Generate: `python -c "import os; print(os.urandom(32).hex())"` | **YES (prod)** |
| `MASTER_ENCRYPTION_KEY` | AES encryption key for GDPR PII at rest. **Required in production**. Generate: `python -c "import os; print(os.urandom(32).hex())"` | **YES (prod)** |
| `FRONTEND_URL` | URL of the frontend app (for CORS and Deep Links). Default: `http://localhost:3000`. | **YES** |

## ⚠️ Functional Dependencies
**Required for specific features.**
The application will start without these, but related features (Messaging, Storage) will fail silently or log errors.

### AI / Document OCR
| Variable | Description | Feature Impact |
|----------|-------------|----------------|
| `GOOGLE_API_KEY` | Google Gemini API Key (free tier: 1500 req/day). | Document OCR, payslip verification. |

### Monitoring
| Variable | Description | Feature Impact |
|----------|-------------|----------------|
| `SENTRY_DSN` | Sentry Data Source Name. | Error tracking + performance monitoring. |

### Notification Channels (Email)
| `RESEND_API_KEY` | Resend API Key (primary email provider). | Email delivery (verification, reset, invites). |
| `FROM_EMAIL` | Sender address — must match verified Resend domain. Default: `Roomivo <onboarding@resend.dev>` (test). Production: `noreply@roomivo.eu`. | Email deliverability. |
| `SENDGRID_API_KEY` | *Alternative* to Resend. | Email delivery. |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID. | SMS & WhatsApp notifications. |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token. | SMS & WhatsApp notifications. |
| `TWILIO_PHONE_NUMBER` | Sender Phone Number (E.164 format). | SMS delivery. |
| `TWILIO_WHATSAPP_NUMBER`| Sender WhatsApp Number (e.g. `whatsapp:+1415...`). | WhatsApp delivery. |

### Cloud Storage (Production)
If not provided, the system defaults to local storage in `./uploads`.

| Variable | Description |
|----------|-------------|
| `STORAGE_ENDPOINT` | S3/R2 Endpoint URL (e.g., `https://<id>.r2.cloudflarestorage.com`). |
| `STORAGE_ACCESS_KEY` | S3/R2 Access Key ID. |
| `STORAGE_SECRET_KEY` | S3/R2 Secret Access Key. |
| `STORAGE_BUCKET` | Bucket name (Default: `rental-platform-media`). |
| `STORAGE_PUBLIC_URL` | Optional public domain for serving files (CDN). |

## ℹ️ Third-Party Integrations
**Optional** features.

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Key for Payment processing. |
| `STRIPE_IDENTITY_WEBHOOK_SECRET` | Secret for verifying Stripe Identity webhooks. |
| `FOURTHLINE_API_KEY` | Key for Fourthline KYC/Identity verification. |

## Quick Setup
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
nano .env
```
*Note: `.env.example` might need updates to include the Twilio and Storage keys listed above.*
