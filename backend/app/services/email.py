"""
Email service — sends branded HTML emails via Resend.

Every outbound email:
  • Uses the shared _render() template with the Roomivo logo
  • Sets reply_to = contact@roomivo.eu so user replies land in the inbox
  • Is sent from the FROM_EMAIL env var (contact@roomivo.eu in production)
"""

import asyncio
import logging
import os
from typing import Optional

import resend

logger = logging.getLogger(__name__)

# ─── Public logo URL (served from the Next.js frontend) ────────────────────────
_LOGO_URL = "https://roomivo.eu/images/roomivo-logo.png"
_REPLY_TO = "contact@roomivo.eu"


# ─── Shared branded template ───────────────────────────────────────────────────
def _render(body_html: str, preview_text: str = "") -> str:
    """Wrap body_html in the Roomivo branded email shell."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Roomivo</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body,html{{margin:0;padding:0;background:#f4f4f4;font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:#111;-webkit-font-smoothing:antialiased}}
    .wrapper{{background:#f4f4f4;padding:40px 16px}}
    .card{background:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,.06)}
    .header{background-color:#000000;background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');background-repeat:repeat;padding:28px 40px;text-align:left}
    .header img{height:32px;width:auto;display:block}
    .body{{padding:40px 40px 32px}}
    h1{{font-size:22px;font-weight:700;margin:0 0 16px;letter-spacing:-.4px;color:#111}}
    p{{font-size:15px;line-height:1.65;color:#444;margin:0 0 16px}}
    .cta{{display:block;width:fit-content;margin:24px auto;padding:14px 32px;background:#000;color:#fff!important;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.3px}}
    .code-box{{background:#f4f4f4;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:14px;color:#333;line-height:1.6}}
    .divider{{border:none;border-top:1px solid #f0f0f0;margin:28px 0}}
    .footer{{padding:24px 40px;text-align:center;font-size:11px;color:#aaa;line-height:1.7}}
    .footer a{{color:#888;text-decoration:none}}
    @media(max-width:600px){{
      .body{{padding:28px 24px 24px}}
      .footer{{padding:20px 24px}}
      .header{{padding:24px}}
    }}
  </style>
</head>
<body>
  {"<!-- preview --><span style='display:none;max-height:0;overflow:hidden'>" + preview_text + "</span>" if preview_text else ""}
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <img src="{_LOGO_URL}" alt="Roomivo" />
      </div>
      <div class="body">
        {body_html}
      </div>
      <hr class="divider" />
      <div class="footer">
        <p style="margin:0 0 6px">© {__import__('datetime').date.today().year} Roomivo Platform · <a href="https://roomivo.eu">roomivo.eu</a></p>
        <p style="margin:0">Questions? Reply to this email or write to <a href="mailto:contact@roomivo.eu">contact@roomivo.eu</a></p>
      </div>
    </div>
  </div>
</body>
</html>"""


# ─── Low-level Resend dispatch (blocking, run in executor) ─────────────────────
def _send_via_resend(
    from_email: str,
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> bool:
    params: dict = {
        "from": from_email,
        "to": [to_email],
        "reply_to": _REPLY_TO,
        "subject": subject,
        "html": html_content,
    }
    if text_content:
        params["text"] = text_content
    try:
        response = resend.Emails.send(params)
        logger.info("Resend dispatched → %s | id=%s", to_email, response)
        return True
    except Exception as exc:
        logger.error("Resend send failed → %s: %s", to_email, exc)
        return False


# ─── EmailService ──────────────────────────────────────────────────────────────
class EmailService:
    """Branded transactional email service (Resend)."""

    def __init__(self) -> None:
        self.resend_api_key = os.getenv("RESEND_API_KEY")
        if self.resend_api_key:
            resend.api_key = self.resend_api_key
        self.from_email = os.getenv("FROM_EMAIL", "onboarding@resend.dev")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        self.use_console = not bool(self.resend_api_key)

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        if self.use_console:
            logger.info("📧 [console email] TO=%s SUBJECT=%s", to_email, subject)
            return True
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,
            _send_via_resend,
            self.from_email,
            to_email,
            subject,
            html_content,
            text_content,
        )

    # ── Email verification ────────────────────────────────────────────────────
    async def send_verification_email(
        self, to_email: str, token: str, full_name: str
    ) -> bool:
        verification_url = f"{self.frontend_url}/auth/verify-email?token={token}"
        subject = "Verify your Roomivo email address"
        body = f"""
          <h1>One step away, {full_name.split()[0]}!</h1>
          <p>Thanks for joining Roomivo. Click the button below to verify your email address and activate your account.</p>
          <a href="{verification_url}" class="cta">Verify Email Address</a>
          <div class="code-box">
            <strong>Or paste this link in your browser:</strong><br/>
            <a href="{verification_url}" style="color:#000;word-break:break-all">{verification_url}</a>
          </div>
          <p style="font-size:13px;color:#888">This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
        """
        text = (
            f"Hi {full_name},\n\nVerify your email: {verification_url}\n\n"
            "Expires in 24 hours.\n\n© Roomivo"
        )
        return await self.send_email(
            to_email, subject, _render(body, "Activate your Roomivo account"), text
        )

    # ── Password reset ────────────────────────────────────────────────────────
    async def send_password_reset_email(
        self, to_email: str, token: str, full_name: str
    ) -> bool:
        reset_url = f"{self.frontend_url}/auth/reset-password?token={token}"
        subject = "Reset your Roomivo password"
        body = f"""
          <h1>Password reset request</h1>
          <p>Hi {full_name.split()[0]}, we received a request to reset the password for your Roomivo account.</p>
          <a href="{reset_url}" class="cta">Reset Password</a>
          <div class="code-box">
            <strong>Or paste this link in your browser:</strong><br/>
            <a href="{reset_url}" style="color:#000;word-break:break-all">{reset_url}</a>
          </div>
          <p style="font-size:13px;color:#888">This link expires in <strong>1 hour</strong>. If you didn't request a reset, no action is needed — your password remains unchanged.</p>
        """
        text = (
            f"Hi {full_name},\n\nReset your password: {reset_url}\n\n"
            "Expires in 1 hour.\n\n© Roomivo"
        )
        return await self.send_email(
            to_email, subject, _render(body, "Reset your Roomivo password"), text
        )

    # ── Forgot email reminder ─────────────────────────────────────────────────
    async def send_forgot_email_reminder(
        self, to_email: str, full_name: str
    ) -> bool:
        subject = "Your Roomivo account email"
        body = f"""
          <h1>Account email reminder</h1>
          <p>Hi {full_name.split()[0]}, you requested a reminder for the email address linked to your Roomivo account.</p>
          <div class="code-box" style="text-align:center;font-size:18px;font-weight:700;letter-spacing:-.3px">
            {to_email}
          </div>
          <a href="{self.frontend_url}/auth/login" class="cta">Log in to Roomivo</a>
          <p style="font-size:13px;color:#888">If you didn't request this, you can safely ignore this email.</p>
        """
        text = (
            f"Hi {full_name},\n\nYour Roomivo account email is: {to_email}\n\n"
            f"Login: {self.frontend_url}/auth/login\n\n© Roomivo"
        )
        return await self.send_email(
            to_email, subject, _render(body, "Your registered email address"), text
        )

    # ── Email change verification ─────────────────────────────────────────────
    async def send_email_change_verification(
        self, to_email: str, token: str, full_name: str
    ) -> bool:
        verify_url = f"{self.frontend_url}/auth/verify-email-change?token={token}"
        subject = "Confirm your new Roomivo email address"
        body = f"""
          <h1>Confirm email change</h1>
          <p>Hi {full_name.split()[0]}, we received a request to update the email address on your Roomivo account to this address.</p>
          <a href="{verify_url}" class="cta">Confirm New Email</a>
          <div class="code-box">
            <strong>Or paste this link in your browser:</strong><br/>
            <a href="{verify_url}" style="color:#000;word-break:break-all">{verify_url}</a>
          </div>
          <p style="font-size:13px;color:#888">This link expires in <strong>1 hour</strong>. If you didn't request this change, your account remains secure.</p>
        """
        text = (
            f"Hi {full_name},\n\nConfirm email change: {verify_url}\n\n"
            "Expires in 1 hour.\n\n© Roomivo"
        )
        return await self.send_email(
            to_email, subject, _render(body, "Confirm your new email address"), text
        )

    # ── Verification success ──────────────────────────────────────────────────
    async def send_verification_success_email(
        self, to_email: str, full_name: str, verification_type: str = "identity"
    ) -> bool:
        label = "Identity" if verification_type == "identity" else "Employment"
        subject = f"{label} verification complete ✅"
        body = f"""
          <h1>You're verified!</h1>
          <p>Congratulations {full_name.split()[0]}! Your <strong>{label} verification</strong> has been approved. Your trust score has been updated and you now have full access to all platform features.</p>
          <a href="{self.frontend_url}/profile" class="cta">View Your Profile</a>
        """
        text = (
            f"Congratulations {full_name}! Your {label} verification is complete.\n\n"
            f"View profile: {self.frontend_url}/profile\n\n© Roomivo"
        )
        return await self.send_email(
            to_email, subject, _render(body, f"{label} verification approved"), text
        )

    # ── Verification failed ───────────────────────────────────────────────────
    async def send_verification_failed_email(
        self, to_email: str, full_name: str, reason: Optional[str] = None
    ) -> bool:
        subject = "Verification update — action needed"
        reason_block = (
            f'<div class="code-box"><strong>Reason:</strong> {reason}</div>'
            if reason
            else ""
        )
        body = f"""
          <h1>Verification needs attention</h1>
          <p>Hi {full_name.split()[0]}, unfortunately we couldn't complete your verification at this time.</p>
          {reason_block}
          <p>Please try again with a clear, well-lit photo of your document.</p>
          <a href="{self.frontend_url}/verification" class="cta">Try Again</a>
        """
        return await self.send_email(
            to_email, subject, _render(body, "Verification needs your attention")
        )

    # ── Team invite ───────────────────────────────────────────────────────────
    async def send_team_invite_email(
        self,
        to_email: str,
        name: str,
        landlord_name: str,
        invite_token: str,
        permission_level: str,
    ) -> bool:
        invite_url = f"{self.frontend_url}/invite/{invite_token}"
        role_label = permission_level.replace("_", " ").title()
        subject = f"{landlord_name} invited you to their team on Roomivo"
        body = f"""
          <h1>You've been invited!</h1>
          <p>Hi {name.split()[0]}, <strong>{landlord_name}</strong> has invited you to join their property management team on Roomivo.</p>
          <div class="code-box">
            <strong>Your role:</strong> {role_label}
          </div>
          <a href="{invite_url}" class="cta">Accept Invitation</a>
          <p style="font-size:13px;color:#888">This invite expires in <strong>7 days</strong>.</p>
        """
        text = (
            f"Hi {name},\n\n{landlord_name} invited you to join their team on Roomivo.\n\n"
            f"Role: {role_label}\nAccept: {invite_url}\n\nExpires in 7 days.\n\n© Roomivo"
        )
        return await self.send_email(
            to_email, subject, _render(body, f"You're invited to {landlord_name}'s team"), text
        )


# Singleton
email_service = EmailService()
