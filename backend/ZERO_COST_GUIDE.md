# Zero Cost Operations Guide 💸

This guide outlines how to operate the Rental Platform with **$0 monthly operational costs** using free tiers and open-source alternatives.

## 1. AI & OCR (Implemented)
*   **Paid**: Anthropic Claude 3 (`$0.01` / doc).
*   **Free**: **Google Gemini 1.5 Flash**.
    *   **Status**: ✅ Enabled in your codebase.
    *   **Action**: Ensure `GOOGLE_API_KEY` is set and `ANTHROPIC_API_KEY` is empty.

## 2. Notifications (SMS Replacement)
SMS is the highest "variable cost". Here are free alternatives:

### A. Web Push Notifications (Recommended)
*   **Technology**: Standard Web API + Service Worker (VAPID).
*   **Cost**: **$0**. Infinite notifications.
*   **Pros**: Native mobile experience, works offline.
*   **Cons**: Requires user permission prompt.
*   **Implementation**: Requires adding `pywebpush` to backend and subscribing in frontend.

### B. Telegram Bot
*   **Technology**: Telegram Bot API.
*   **Cost**: **$0**.
*   **Pros**: Instant, reliable, very popular in crypto/tech.
*   **Cons**: User must "start" the bot conversation.

### C. Email (Optimized)
*   **Service**: **Resend** or **SendGrid**.
*   **Free Tier**:
    *   Resend: 3,000 emails/mo (Free).
    *   SendGrid: 100 emails/day (Free).
*   **Strategy**: Use Email for *everything* and disable SMS options.

## 3. Hosting & Infrastructure
*   **Frontend**: **Vercel** (Hobby Tier) - Free forever for personal/non-commercial usage limits.
*   **Backend**: **Render.com** (Free Tier) - Spins down after inactivity. Good for testing.
    *   *Alternative*: **Oracle Cloud Always Free** (VM instance).
*   **Database**: **Supabase** or **Neon**.
    *   Both offer generous Free Tiers (500MB storage).

## 4. Storage (Images/Docs)
*   **Paid**: AWS S3.
*   **Free**: **Cloudflare R2**.
    *   **Free Tier**: 10GB storage + 10 Million requests/month.
    *   *Setup*: Set `STORAGE_ENDPOINT` to your R2 bucket URL.

## 5. Identity Verification
*   **Paid**: Stripe Identity (`$1.50`/user).
*   **Free**: **Manual Review**.
    *   **Workflow**:
        1. Tenant uploads ID (stored in R2/Local).
        2. Landlord/Admin views document in Dashboard.
        3. Admin clicks "Verify" manually.
    *   **Status**: ✅ Supported natively by platform workflow.

---
**Recommendation for immediate $0 Operations:**
1.  Use **Gemini** (Done).
2.  Use **Resend** (Free Email).
3.  Disable SMS, rely on **Email + In-App** alerts.
4.  Use **Manual Verification** for IDs.
5.  Host on **Vercel + Supabase**.
