
import stripe
import os
from typing import Optional, Dict, Any

class StripeIdentityService:
    def __init__(self):
        self.api_key = os.getenv("STRIPE_SECRET_KEY")
        stripe.api_key = self.api_key
        self.webhook_secret = os.getenv("STRIPE_IDENTITY_WEBHOOK_SECRET")

    def create_verification_session(self, user_id: str, email: str) -> Dict[str, Any]:
        """
        Create a Stripe Identity Verification Session.
        If NO API Key is present (Free/Mock mode), returns a simulated session.
        """
        if not self.api_key:
            # Zero Cost / Mock Mode
            return {
                "id": "vs_mock_" + user_id,
                "url": "https://identity.stripe.com/mock-verification?user=" + user_id,
                "client_secret": "mock_secret",
                "status": "requires_input"
            }

        try:
            # Create the session
            # We require 'document' (ID/Passport) and 'selfie' matching for high security.
            session = stripe.identity.VerificationSession.create(
                type='document',
                metadata={
                    'user_id': user_id,
                },
                options={
                    'document': {
                        'require_matching_selfie': True,
                    },
                },
                return_url= os.getenv("FRONTEND_URL", "http://localhost:3000") + "/profile?verified=true",
            )
            return session
        except Exception as e:
            print(f"Stripe Session Create Error: {e}")
            raise e

    def construct_event(self, payload: bytes, sig_header: str):
        """
        Verify webhook signature to ensure request comes from Stripe.
        """
        if not self.webhook_secret:
            raise ValueError("Stripe Webhook Secret not configured")
            
        return stripe.Webhook.construct_event(
            payload, sig_header, self.webhook_secret
        )

stripe_identity_service = StripeIdentityService()
