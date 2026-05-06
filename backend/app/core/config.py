from typing import Optional

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
    FOURTHLINE_API_KEY: Optional[str] = None
    SENDGRID_API_KEY: Optional[str] = None
    RESEND_API_KEY: Optional[str] = None

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # Stripe (Identity verification)
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_IDENTITY_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # Monitoring
    SENTRY_DSN: Optional[str] = None
    ENVIRONMENT: str = "development"
    COOKIE_DOMAIN: Optional[str] = None

    # GDPR & Privacy
    MASTER_ENCRYPTION_KEY: Optional[str] = None

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    
    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        import os
        _env_origins = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
        return [
            *[o.strip() for o in _env_origins if o.strip()],
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "https://roomivo-frontend-0jyi.onrender.com",
            "https://roomivo.eu",
            "https://www.roomivo.eu",
        ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
