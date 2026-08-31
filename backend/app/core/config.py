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
    # gemini-2.0-flash was retired by Google (404 NOT_FOUND as of 2026-08-26);
    # its own error response named gemini-3.6-flash as the replacement — then
    # gemini-2.5-flash was ALSO retired (404 NOT_FOUND as of 2026-08-31), two
    # model retirements in the same week. GEMINI_MODEL/GEMINI_FALLBACK_MODEL
    # are ordered oldest-known-good first; GEMINI_MODEL_CANDIDATES (below) is
    # what every call site should actually iterate over, so the next
    # retirement is a one-line env var change (GEMINI_EXTRA_FALLBACK_MODELS)
    # instead of a repo-wide hunt for a hardcoded string.
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.5-flash"
    # Comma-separated extra models to try, in order, after GEMINI_MODEL and
    # GEMINI_FALLBACK_MODEL both fail — set this in the environment (no
    # deploy needed) the moment Google announces the next retirement.
    GEMINI_EXTRA_FALLBACK_MODELS: Optional[str] = None
    GEMINI_DAILY_LIMIT: int = 1500  # free tier cap; raise once on paid plan
    # Free-tier gemini-2.5-flash caps requests-per-minute far below the daily
    # limit; a burst of concurrent KYC uploads can blow through it even on a
    # single day of normal traffic. Paced client-side so bursts queue instead
    # of every request in the burst failing together. Raise once on paid plan.
    GEMINI_RPM_LIMIT: int = 10
    RESEND_API_KEY: Optional[str] = None
    # openrouteservice — free tier (2000 req/day). https://openrouteservice.org/dev/#/signup
    ORS_API_KEY: Optional[str] = None
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

    # Trust Layer — retired verify-only public keys (comma-separated hex-encoded
    # 32-byte raw Ed25519 public keys). Kept until every credential signed by
    # retired key expires. Runbook: docs/features/trust-layer/KEY-LIFECYCLE.md
    CREDENTIAL_RETIRED_VERIFY_KEYS: Optional[str] = None

    # Agency tooling FREEZE (feature-audit verdict 2026-07-04): property_manager,
    # team, bulk, erp_webhooks routers unmounted + segment nav hidden while False.
    # Revisit at B2B demand — code retained, not deleted.
    ENABLE_AGENCY_TOOLING: bool = False

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

    @property
    def GEMINI_MODEL_CANDIDATES(self) -> list:
        """Ordered list of Gemini models to try. Every call site should loop
        over this instead of hardcoding a model name or building its own
        [GEMINI_MODEL, GEMINI_FALLBACK_MODEL] pair, so a future retirement is
        fixed by setting GEMINI_EXTRA_FALLBACK_MODELS once, everywhere."""
        candidates = [self.GEMINI_MODEL, self.GEMINI_FALLBACK_MODEL]
        if self.GEMINI_EXTRA_FALLBACK_MODELS:
            candidates += [
                m.strip() for m in self.GEMINI_EXTRA_FALLBACK_MODELS.split(",") if m.strip()
            ]
        seen = set()
        deduped = []
        for model in candidates:
            if model not in seen:
                seen.add(model)
                deduped.append(model)
        return deduped

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
