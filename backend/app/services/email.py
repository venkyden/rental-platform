"""
Email service for sending emails via SMTP or console logging.

For local development, emails are printed to console.
For production, configure SMTP settings in environment variables.
"""
import os
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib


class EmailService:
    """Email service for sending HTML emails"""
    
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@rentalplatform.com")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        
        # Use console logging if SMTP not configured
        self.use_console = not all([self.smtp_host, self.smtp_user, self.smtp_password])
        
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send an HTML email"""
        try:
            if self.use_console:
                # For local development - print to console
                print("\n" + "="*80)
                print(f"📧 EMAIL TO: {to_email}")
                print(f"📧 SUBJECT: {subject}")
                print("="*80)
                print(html_content)
                print("="*80 + "\n")
                return True
            
            # Production - send via SMTP
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.from_email
            message["To"] = to_email
            
            # Add text and HTML parts
            if text_content:
                part1 = MIMEText(text_content, "plain")
                message.attach(part1)
            
            part2 = MIMEText(html_content, "html")
            message.attach(part2)
            
            # Send via SMTP
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, message.as_string())
            
            return True
        except Exception as e:
            print(f"Failed to send email to {to_email}: {e}")
            return False
    
    async def send_verification_email(self, to_email: str, token: str, full_name: str) -> bool:
        """Send email verification email"""
        verification_url = f"{self.frontend_url}/auth/verify-email?token={token}"
        
        subject = "Verify your email address"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; }}
                .content {{ background-color: #f9fafb; padding: 30px; }}
                .button {{ 
                    display: inline-block; 
                    padding: 12px 30px; 
                    background-color: #4F46E5; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 5px;
                    margin: 20px 0;
                }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Rental Platform!</h1>
                </div>
                <div class="content">
                    <h2>Hi {full_name},</h2>
                    <p>Thank you for registering! Please verify your email address to complete your registration.</p>
                    <p>Click the button below to verify your email:</p>
                    <p style="text-align: center;">
                        <a href="{verification_url}" class="button">Verify Email Address</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #4F46E5;">{verification_url}</p>
                    <p><strong>This link will expire in 24 hours.</strong></p>
                    <p>If you didn't create an account, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>© 2026 Rental Platform. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Hi {full_name},
        
        Thank you for registering! Please verify your email address to complete your registration.
        
        Click this link to verify your email:
        {verification_url}
        
        This link will expire in 24 hours.
        
        If you didn't create an account, please ignore this email.
        
        © 2026 Rental Platform
        """
        
        return await self.send_email(to_email, subject, html_content, text_content)
    
    async def send_password_reset_email(self, to_email: str, token: str, full_name: str) -> bool:
        """Send password reset email"""
        reset_url = f"{self.frontend_url}/auth/reset-password?token={token}"
        
        subject = "Reset your password"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; }}
                .content {{ background-color: #f9fafb; padding: 30px; }}
                .button {{ 
                    display: inline-block; 
                    padding: 12px 30px; 
                    background-color: #4F46E5; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 5px;
                    margin: 20px 0;
                }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Password Reset Request</h1>
                </div>
                <div class="content">
                    <h2>Hi {full_name},</h2>
                    <p>We received a request to reset your password. Click the button below to reset it:</p>
                    <p style="text-align: center;">
                        <a href="{reset_url}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #4F46E5;">{reset_url}</p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request a password reset, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>© 2026 Rental Platform. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Hi {full_name},
        
        We received a request to reset your password. Click the link below to reset it:
        {reset_url}
        
        This link will expire in 1 hour.
        
        If you didn't request a password reset, please ignore this email.
        
        © 2026 Rental Platform
        """
        
        return await self.send_email(to_email, subject, html_content, text_content)

    async def send_verification_success_email(self, to_email: str, full_name: str, verification_type: str = "identity") -> bool:
        """Send congratulatory email after successful verification"""
        subject = "Your verification is complete! ✅"
        label = "Identity" if verification_type == "identity" else "Employment"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #3DD6D0, #22B8B8); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; }}
                .button {{ display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #3DD6D0, #22B8B8); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Verification Complete!</h1>
                </div>
                <div class="content">
                    <h2>Congratulations {full_name}! 🎉</h2>
                    <p>Your <strong>{label} verification</strong> has been successfully completed. Your trust score has been updated.</p>
                    <p>You can now enjoy full access to all platform features.</p>
                    <p style="text-align: center;">
                        <a href="{self.frontend_url}/profile" class="button">View Your Profile</a>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2026 Roomivo. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Congratulations {full_name}!

        Your {label} verification has been successfully completed.
        Your trust score has been updated.

        View your profile: {self.frontend_url}/profile

        © 2026 Roomivo
        """

        return await self.send_email(to_email, subject, html_content, text_content)

    async def send_verification_failed_email(self, to_email: str, full_name: str, reason: str = None) -> bool:
        """Send notification when verification fails"""
        subject = "Verification update — action needed"
        reason_text = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; }}
                .button {{ display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #3DD6D0, #22B8B8); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Verification Update</h1>
                </div>
                <div class="content">
                    <h2>Hi {full_name},</h2>
                    <p>Unfortunately, your verification could not be completed at this time.</p>
                    {reason_text}
                    <p>Please try again with a clear, well-lit photo of your document.</p>
                    <p style="text-align: center;">
                        <a href="{self.frontend_url}/verification" class="button">Try Again</a>
                    </p>
                </div>
                <div class="footer">
                    <p>© 2026 Roomivo. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(to_email, subject, html_content)

    async def send_team_invite_email(self, to_email: str, name: str, landlord_name: str, invite_token: str, permission_level: str) -> bool:
        """Send team invite email"""
        invite_url = f"{self.frontend_url}/invite/{invite_token}"
        subject = f"{landlord_name} invited you to join their team on Roomivo"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #3DD6D0, #22B8B8); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; }}
                .button {{ display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #3DD6D0, #22B8B8); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
                .badge {{ display: inline-block; padding: 4px 12px; background: #E0F2FE; color: #0369A1; border-radius: 12px; font-size: 13px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>You're Invited!</h1>
                </div>
                <div class="content">
                    <h2>Hi {name},</h2>
                    <p><strong>{landlord_name}</strong> has invited you to join their property management team on Roomivo.</p>
                    <p>Your role: <span class="badge">{permission_level.replace('_', ' ').title()}</span></p>
                    <p style="text-align: center;">
                        <a href="{invite_url}" class="button">Accept Invite</a>
                    </p>
                    <p style="font-size: 13px; color: #6b7280;">This invite expires in 7 days.</p>
                </div>
                <div class="footer">
                    <p>© 2026 Roomivo. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(to_email, subject, html_content)


# Singleton instance
email_service = EmailService()
