# Email Verification Implementation Plan

## Overview
Implement email verification to ensure users own the email addresses they register with.

## Components

### 1. Email Service (Backend)
- Create email utility module for sending emails
- Use simple SMTP or print-to-console for local development
- Support HTML email templates

### 2. Verification Flow
1. User registers → Generate verification token
2. Send email with verification link
3. User clicks link → Verify token → Mark email as verified
4. Show verification status on dashboard

### 3. Backend Changes

**New endpoint:** `GET /auth/verify-email?token={token}`
- Verify the JWT token
- Check token type is "email_verification"
- Update `email_verified` to `True`
- Return success/failure

**Update registration:** `POST /auth/register`
- After creating user, generate verification token
- Send verification email
- Return user data

**New endpoint:** `POST /auth/resend-verification`
- Send new verification email to logged-in user
- Requires authentication

### 4. Frontend Changes

**New page:** `/auth/verify-email`
- Extract token from URL query parameters
- Call verification endpoint
- Show success/error message
- Redirect to dashboard or login

**Update dashboard:**
- Show email verification status
- Add "Resend verification email" button if not verified

## Security Considerations
- Verification tokens expire after 24 hours
- Tokens can only be used once
- Rate limit resend verification endpoint

## Testing Plan
1. Register new user → Check email sent (console log for local)
2. Click verification link → Email marked as verified
3. Try expired token → Error message shown
4. Try invalid token → Error message shown
5. Resend verification → New token sent
6. Already verified user → Can't resend

## Implementation Order
1. Create email service module
2. Add verification endpoint
3. Update registration to send email
4. Create frontend verification page
5. Update dashboard to show status
6. Add resend functionality
7. Test all scenarios
