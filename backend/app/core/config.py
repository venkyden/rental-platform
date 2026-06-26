from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Redis Cache
    REDIS_URL: Optional[str] = None

    # Cloudflare R2 / S3 Storage
    STORAGE_ENDPOINT: Optional[str] = None
    STORAGE_ACCESS_KEY: Optional[str] = None
    STORAGE_SECRET_KEY: Optional[str] = None
    STORAGE_BUCKET: Optional[str] = "rental-platform-media"
    STORAGE_PUBLIC_URL: Optional[str] = None

    # External APIs
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_DAILY_LIMIT: int = 1500  # free tier cap; raise once on paid plan
    FOURTHLINE_API_KEY: Optional[str] = None
    SENDGRID_API_KEY: Optional[str] = None
    RESEND_API_KEY: Optional[str] = None
    # FROM_EMAIL: Must match a verified sender domain in Resend.
    # Default uses Resend's test domain; set FROM_EMAIL=noreply@roomivo.eu in production
    # after verifying the roomivo.eu domain in the Resend dashboard.
    FROM_EMAIL: Optional[str] = "Roomivo <onboarding@resend.dev>"

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # Monitoring
    SENTRY_DSN: Optional[str] = None
    ENVIRONMENT: str = "development"
    COOKIE_DOMAIN: Optional[str] = None

    # GDPR & Privacy
    MASTER_ENCRYPTION_KEY: Optional[str] = None

    # Trust Layer — Ed25519 credential signing key (hex-encoded 32-byte seed).
    # If absent (dev), an ephemeral key is generated. MUST be set in production.
    CREDENTIAL_SIGNING_KEY: Optional[str] = None

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    
    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        import os
        _env_origins = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
        origins: list[str] = [
            *[o.strip() for o in _env_origins if o.strip()],
            "https://roomivo-frontend-0jyi.onrender.com",
            "https://roomivo.eu",
            "https://www.roomivo.eu",
        ]
        # Only allow localhost in non-production environments.
        # Including localhost in production allows CORS from any victim's browser.
        if self.ENVIRONMENT != "production":
            origins += [
                "http://localhost:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
            ]
        return origins

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> "Settings":
        """Refuse to start in production with weak or missing secrets."""
        if self.ENVIRONMENT == "production":
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "SECRET_KEY must be set to at least 32 characters in production."
                )
            if not self.MASTER_ENCRYPTION_KEY:
                raise ValueError(
                    "MASTER_ENCRYPTION_KEY must be set in production (GDPR PII encryption)."
                )
            if not self.CREDENTIAL_SIGNING_KEY:
                raise ValueError(
                    "CREDENTIAL_SIGNING_KEY must be set in production (Trust Layer Ed25519 key). "
                    "Generate with: python -c \"import os; print(os.urandom(32).hex())\""
                )
        return self

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
