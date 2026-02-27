from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

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

    # Monitoring
    SENTRY_DSN: Optional[str] = None
    ENVIRONMENT: str = "development"

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
