"""
Multi-channel notification delivery service.
Supports: Email, SMS, WhatsApp via Twilio or direct APIs.

Usage:
    delivery = NotificationDelivery()
    await delivery.send_email(to="user@example.com", subject="...", body="...")
    await delivery.send_whatsapp(to="+33612345678", message="...")
"""
import os
import httpx
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class NotificationDelivery:
    """
    Handles actual delivery of notifications via different channels.
    
    Environment variables needed:
    - SENDGRID_API_KEY or RESEND_API_KEY for email
    - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN for SMS/WhatsApp
    - TWILIO_PHONE_NUMBER for SMS
    - TWILIO_WHATSAPP_NUMBER for WhatsApp (e.g., "whatsapp:+14155238886")
    """
    
    def __init__(self):
        # Email config
        self.sendgrid_key = os.getenv("SENDGRID_API_KEY")
        self.resend_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@roomivo.com")
        
        # Twilio config (SMS + WhatsApp)
        self.twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_phone = os.getenv("TWILIO_PHONE_NUMBER")
        self.twilio_whatsapp = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
    
    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        html: Optional[str] = None
    ) -> bool:
        """
        Send email notification.
        Uses Resend if available, falls back to SendGrid.
        """
        if self.resend_key:
            return await self._send_via_resend(to, subject, body, html)
        elif self.sendgrid_key:
            return await self._send_via_sendgrid(to, subject, body, html)
        else:
            logger.warning(f"No email provider configured. Would send to {to}: {subject}")
            return False
    
    async def _send_via_resend(self, to: str, subject: str, body: str, html: Optional[str]) -> bool:
        """Send via Resend API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {self.resend_key}"},
                    json={
                        "from": self.from_email,
                        "to": [to],
                        "subject": subject,
                        "text": body,
                        "html": html or body.replace("\n", "<br>")
                    }
                )
                if response.status_code == 200:
                    logger.info(f"Email sent to {to}")
                    return True
                else:
                    logger.error(f"Resend error: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return False
    
    async def _send_via_sendgrid(self, to: str, subject: str, body: str, html: Optional[str]) -> bool:
        """Send via SendGrid API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={
                        "Authorization": f"Bearer {self.sendgrid_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "personalizations": [{"to": [{"email": to}]}],
                        "from": {"email": self.from_email},
                        "subject": subject,
                        "content": [
                            {"type": "text/plain", "value": body},
                            {"type": "text/html", "value": html or body.replace("\n", "<br>")}
                        ]
                    }
                )
                if response.status_code in [200, 202]:
                    logger.info(f"Email sent to {to}")
                    return True
                else:
                    logger.error(f"SendGrid error: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return False
    
    async def send_sms(self, to: str, message: str) -> bool:
        """
        Send SMS via Twilio.
        Phone number should be in E.164 format: +33612345678
        """
        if not self.twilio_sid or not self.twilio_token:
            logger.warning(f"Twilio not configured. Would SMS to {to}: {message[:50]}...")
            return False
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{self.twilio_sid}/Messages.json",
                    auth=(self.twilio_sid, self.twilio_token),
                    data={
                        "From": self.twilio_phone,
                        "To": to,
                        "Body": message
                    }
                )
                if response.status_code == 201:
                    logger.info(f"SMS sent to {to}")
                    return True
                else:
                    logger.error(f"Twilio SMS error: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"SMS send failed: {e}")
            return False
    
    async def send_whatsapp(self, to: str, message: str) -> bool:
        """
        Send WhatsApp message via Twilio.
        Phone number should be in E.164 format: +33612345678
        
        Note: Twilio WhatsApp requires pre-approved templates for business-initiated messages.
        For user-initiated conversations (within 24h window), free-form messages work.
        """
        if not self.twilio_sid or not self.twilio_token:
            logger.warning(f"Twilio not configured. Would WhatsApp to {to}: {message[:50]}...")
            return False
        
        # Format for WhatsApp
        to_whatsapp = f"whatsapp:{to}" if not to.startswith("whatsapp:") else to
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{self.twilio_sid}/Messages.json",
                    auth=(self.twilio_sid, self.twilio_token),
                    data={
                        "From": self.twilio_whatsapp,
                        "To": to_whatsapp,
                        "Body": message
                    }
                )
                if response.status_code == 201:
                    logger.info(f"WhatsApp sent to {to}")
                    return True
                else:
                    logger.error(f"Twilio WhatsApp error: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"WhatsApp send failed: {e}")
            return False


# Email templates
def get_application_email_template(tenant_name: str, property_title: str, action_url: str) -> tuple[str, str]:
    """Returns (subject, html_body) for new application notification"""
    subject = f"📋 New application from {tenant_name}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Application Received</h2>
        <p><strong>{tenant_name}</strong> has applied for <strong>{property_title}</strong></p>
        <p>
            <a href="{action_url}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">
                View Application
            </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">— The Roomivo Team</p>
    </div>
    """
    return subject, html


def get_status_change_email_template(property_title: str, status: str, action_url: str) -> tuple[str, str]:
    """Returns (subject, html_body) for application status change"""
    emoji = "✅" if status == "approved" else "❌" if status == "rejected" else "📋"
    status_text = "approved" if status == "approved" else "declined" if status == "rejected" else status
    
    subject = f"{emoji} Your application has been {status_text}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: {'#16a34a' if status == 'approved' else '#dc2626'};">
            Application {status_text.title()}
        </h2>
        <p>Your application for <strong>{property_title}</strong> has been {status_text}.</p>
        <p>
            <a href="{action_url}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">
                View Details
            </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">— The Roomivo Team</p>
    </div>
    """
    return subject, html
