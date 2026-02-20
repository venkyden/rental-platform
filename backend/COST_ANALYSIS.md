# Platform Cost Analysis (Estimates)

This document outlines the projected operational costs for the Rental Platform based on the services used.

> **Note**: Prices are estimates based on standard market rates (as of 2024/2025). Actual costs may vary by region and volume.

## 1. Variable Costs (Per Usage)
These costs scale with the number of applications and verifications.

| Service | Feature | Est. Cost | Unit | Notes |
|---------|---------|-----------|------|-------|
| **Anthropic (Claude 3 Haiku)** | Document OCR (Payslips) | **~$0.005** | Per Document | Input + Output tokens. Very cheap. |
| **Stripe Identity** | Identity Verification | **~$1.50** | Per User | Optional but recommended for high security. |
| **Twilio (SMS)** | Notifications (France) | **~$0.08** | Per SMS | SMS in Europe/France is expensive. Use Email/WhatsApp where possible. |
| **Twilio (WhatsApp)** | Notifications | **~$0.05 - $0.09** | Per Conversation | 24h window pricing. |
| **Cloudflare R2** | Image Storage | **Free** | First 10GB | Then $0.015/GB. Negligible for <1000 properties. |

### Example: Cost Per Lease Application
*   **Scenario**: 1 Tenant applies, uploads 3 documents (ID, Payslip x2), receives 2 SMS alerts.
*   **Breakdown**:
    *   OCR (3 docs): $0.015
    *   SMS (2 alerts): $0.16
    *   Database/Hosting (Amortized): $0.05
*   **Total Marginal Cost**: **~$0.22 - $0.30 per applicant** (excluding Stripe Identity).
*   *With Stripe Identity*: **~$1.80 per applicant**.

## 2. Fixed Costs (Monthly Infrastructure)
Minimum costs to keep the lights on.

| Service | Recommended Tier | Est. Cost/Month | Notes |
|---------|------------------|-----------------|-------|
| **Backend Hosting** | Render / Railway (Standard) | **$5 - $10** | For Python/FastAPI service. |
| **Database** | Supabase / Neon (Postgres) | **Free - $25** | Free tiers often sufficient for start. |
| **Email (SendGrid/Resend)** | Essentials | **Free - $20** | Free for ~3000 emails/mo. |
| **Frontend Vercel** | Pro | **$20** | Optional. Free tier works for hobby/test. |

**Total Estimated Fixed Cost**: **$10 - $50 / month**.

## 3. Cost Optimization Strategies
1.  **Cache OCR Results**: The system currently caches extracted text logic (see `employment.py`) to avoid re-calling Anthropic for the same file.
2.  **Use Email First**: Default to Email notifications (Free/Cheap) and only use SMS for urgent alerts or verification codes.
3.  **Local Storage**: Use `./uploads` (Local) instead of S3/R2 during development to save setup time (though R2 is free tier friendly).
