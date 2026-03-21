import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

# Sentry error tracking (only if DSN is configured)
try:
    import sentry_sdk

    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
            send_default_pii=False,
        )
        logger.info(f"Sentry initialized for {settings.ENVIRONMENT}")
except ImportError:
    pass  # sentry-sdk not installed, skip

from app.routers import (auth, location, onboarding, properties,
                         property_manager, verification)

# Rate limiting setup (optional - only if slowapi is installed)
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address)
    RATE_LIMITING_ENABLED = True
except ImportError:
    limiter = None
    RATE_LIMITING_ENABLED = False

# ------------------------------------------------------------------
# CORS – allowed origins
# ------------------------------------------------------------------
_env_origins = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
ALLOWED_ORIGINS = [
    *[o.strip() for o in _env_origins if o.strip()],
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "https://roomivo-frontend-0jyi.onrender.com",
    "https://roomivo.eu",
    "https://www.roomivo.eu",
]


def _get_cors_origin(request_origin: str | None) -> str | None:
    """Return the origin if it is in our allow-list, else None."""
    if request_origin and request_origin in ALLOWED_ORIGINS:
        return request_origin
    return None


# ------------------------------------------------------------------
# App
# ------------------------------------------------------------------
app = FastAPI(
    title="Roomivo API",
    description="Smart rental platform API — identity verification, AI matching, and digital leases for expats in France",
    version="1.0.0",
)

# Add rate limiting if available
if RATE_LIMITING_ENABLED:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ------------------------------------------------------------------
# CORS middleware
# ------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


# ------------------------------------------------------------------
# Global exception handler – ALWAYS include CORS headers so the
# browser lets the frontend read the error body instead of showing
# an opaque "Network Error".
# ------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}: {exc}",
        exc_info=True,
    )
    origin = request.headers.get("origin")
    allowed = _get_cors_origin(origin)
    headers = {}
    if allowed:
        headers["Access-Control-Allow-Origin"] = allowed
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
        headers=headers,
    )


# ------------------------------------------------------------------
# Extra safety: explicit OPTIONS handler for any path.
# Catches preflight requests that might not reach CORSMiddleware
# when an exception is thrown during middleware startup.
# ------------------------------------------------------------------
@app.options("/{full_path:path}")
async def preflight_handler(request: Request, full_path: str):
    origin = request.headers.get("origin")
    allowed = _get_cors_origin(origin)
    headers = {}
    if allowed:
        headers["Access-Control-Allow-Origin"] = allowed
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With, Accept"
        headers["Access-Control-Max-Age"] = "600"
    return JSONResponse(content={"detail": "OK"}, status_code=200, headers=headers)


# ------------------------------------------------------------------
# Include all routers
# ------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(property_manager.router)
app.include_router(onboarding.router)
app.include_router(verification.router)
app.include_router(properties.router)
app.include_router(location.router)

from app.routers import webhooks
app.include_router(webhooks.router)

from app.routers import visits
app.include_router(visits.router)

from app.routers import messages
app.include_router(messages.router)

from app.routers import team
app.include_router(team.router)

from app.routers import bulk
app.include_router(bulk.router)

from app.routers import erp_webhooks
app.include_router(erp_webhooks.router)

from app.routers import documents
app.include_router(documents.router)

from app.routers import applications
app.include_router(applications.router)

from app.routers import notifications
app.include_router(notifications.router)

from app.routers import leases
app.include_router(leases.router)

from app.routers import inventory
app.include_router(inventory.router)

from app.routers import dispute
app.include_router(dispute.router)

from app.routers import stats
app.include_router(stats.router)

from app.routers import admin
app.include_router(admin.router)

from app.routers import media
app.include_router(media.router)

from app.routers import feedback
app.include_router(feedback.router)

from app.routers import identity
app.include_router(identity.router)

from app.routers import gdpr
app.include_router(gdpr.router)


# ------------------------------------------------------------------
# Health & root
# ------------------------------------------------------------------
@app.get("/health")
async def health_check():
    """
    Netflix-style health check endpoint.
    Returns detailed system status for monitoring and load balancers.
    """
    try:
        from app.core.circuit_breaker import get_circuit_health
        circuit_status = get_circuit_health()
    except Exception:
        circuit_status = {}

    try:
        from app.core.cache import cache
        cache_status = "connected" if cache.redis_client else "disconnected"
    except Exception:
        cache_status = "not_configured"

    return {
        "status": "healthy",
        "service": "rental-platform",
        "version": "1.0.0",
        "infrastructure": {
            "cache": cache_status,
            "circuits": circuit_status,
        },
    }


# ------------------------------------------------------------------
# Static file serving for local development (uploads fallback)
# ------------------------------------------------------------------
import os as _os
if _os.path.isdir("uploads"):
    from fastapi.staticfiles import StaticFiles
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Roomivo API", "docs": "/docs", "health": "/health"}
