# Platform Environment Variables

This document lists all API keys and configuration settings required to run the Rental Platform.

## 🚨 Critical Infrastructure
**Required for Application Startup.**
The backend will fail to start if these are missing.

| Variable | Description | Required? |
|----------|-------------|-----------|
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgresql+asyncpg://user:pass@localhost/db`) | **YES** |
| `SECRET_KEY` | 32+ character random string for security/crypto. | **YES** |
| `ANTHROPIC_API_KEY` | API Key for Claude AI (Used for Document/Payslip Verification). | **YES** |
| `FRONTEND_URL` | URL of the frontend app (for CORS and Deep Links). Default: `http://localhost:3000`. | **YES** |

## ⚠️ Functional Dependencies
**Required for specific features.**
The application will start without these, but related features (Messaging, Storage) will fail silently or log errors.

### Notification Channels (Email & SMS)
| Variable | Description | Feature Impact |
|----------|-------------|----------------|
| `SENDGRID_API_KEY` | SendGrid API Key. | Email delivery (Invites, Alerts). |
| `RESEND_API_KEY` | *Alternative* to SendGrid. | Email delivery. |
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
