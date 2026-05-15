import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings

logger = logging.getLogger(__name__)
import app.models

# ------------------------------------------------------------------
# Stripe initialization
# ------------------------------------------------------------------
import stripe
if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY
    logger.info("Stripe initialized")

# ------------------------------------------------------------------
# Sentry (optional)
# ------------------------------------------------------------------
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
    pass

# ------------------------------------------------------------------
# Rate limiting (optional — only if slowapi is installed)
# ------------------------------------------------------------------
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
# Encryption & Privacy
# ------------------------------------------------------------------
from app.utils.encryption import encryption_service
if encryption_service.mode == "secure":
    logger.info("🔐 Encryption Service: SECURE (MASTER_ENCRYPTION_KEY set)")
elif encryption_service.mode == "fallback":
    logger.warning("⚠️ Encryption Service: FALLBACK (Deriving from SECRET_KEY). Set MASTER_ENCRYPTION_KEY for production.")
else:
    logger.critical("🚨 Encryption Service: EPHEMERAL (Keys will change on restart). DATA LOSS IMMINENT.")

# ------------------------------------------------------------------
# FastAPI app & Starlette 1.0.0 Compatibility Patch
# ------------------------------------------------------------------
import starlette.routing
from typing import Any

# FastAPI 0.109.0 expects on_startup/on_shutdown in Router, but Starlette 1.0.0 removed them.
import fastapi.routing
_original_router_init = starlette.routing.Router.__init__
def _patched_router_init(self: Any, *args: Any, **kwargs: Any) -> None:
    kwargs.pop("on_startup", None)
    kwargs.pop("on_shutdown", None)
    _original_router_init(self, *args, **kwargs)
starlette.routing.Router.__init__ = _patched_router_init

# Also ensure APIRouter has these attributes as empty lists for compatibility
if not hasattr(fastapi.routing.APIRouter, "on_startup"):
    setattr(fastapi.routing.APIRouter, "on_startup", [])
if not hasattr(fastapi.routing.APIRouter, "on_shutdown"):
    setattr(fastapi.routing.APIRouter, "on_shutdown", [])

fastapi_app = FastAPI(
    title="Roomivo API",
    description="Smart rental platform API",
    version="1.0.0",
)

if RATE_LIMITING_ENABLED:
    fastapi_app.state.limiter = limiter
    fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ------------------------------------------------------------------
# CORS middleware (standard layer)
# ------------------------------------------------------------------
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


from fastapi.exceptions import RequestValidationError
from datetime import datetime

@fastapi_app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_msg = f"Validation error on {request.method} {request.url.path}: {exc.errors()}\n"
    error_msg += f"Request body: {exc.body}\n"
    logger.error(error_msg)
    
    # Also write to a file we can read
    try:
        with open("validation_errors.log", "a") as f:
            f.write(f"--- {datetime.now()} ---\n")
            f.write(error_msg)
            f.write("\n")
    except Exception:
        pass

    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)},
    )


# ------------------------------------------------------------------
# Security Headers Middleware
# ------------------------------------------------------------------
@fastapi_app.middleware("http")
async def add_security_headers(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception as e:
        # If an exception happens here, the exception handler will catch it.
        # We don't want to double-handle, but we need to ensure the final response
        # eventually gets these headers.
        raise e
        
    # Allow Google Auth popups to communicate back to the window.
    # 'unsafe-none' is critical for window.postMessage with Google Identity Services.
    response.headers["Cross-Origin-Opener-Policy"] = "unsafe-none"
    response.headers["Cross-Origin-Embedder-Policy"] = "unsafe-none"
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    
    # Additional security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    
    # Optimized CSP for Google Identity Services (GSI)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://*.google.com https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://accounts.google.com https://*.google.com; "
        "frame-src https://accounts.google.com https://*.google.com;"
    )
    return response



# ------------------------------------------------------------------
# Global exception handler
# ------------------------------------------------------------------
from starlette.exceptions import HTTPException as StarletteHTTPException

@fastapi_app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    from app.core.config import settings
    origin = request.headers.get("origin")
    allow_origin = "*"
    if origin and origin in settings.ALLOWED_ORIGINS:
        allow_origin = origin
    elif settings.ENVIRONMENT == "production":
        allow_origin = "https://roomivo.eu"
    else:
        allow_origin = "http://localhost:3000"

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": allow_origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Language",
            "Access-Control-Allow-Credentials": "true",
            "Cross-Origin-Opener-Policy": "unsafe-none",
            "Cross-Origin-Embedder-Policy": "unsafe-none",
            "Cross-Origin-Resource-Policy": "cross-origin",
        }
    )


@fastapi_app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}: {exc}",
        exc_info=True,
    )
    
    # Manually add CORS headers to the error response to prevent "Network Error" in browser
    # when the standard CORSMiddleware is bypassed or fails.
    from app.core.config import settings
    origin = request.headers.get("origin")
    allow_origin = "*"
    if origin and origin in settings.ALLOWED_ORIGINS:
        allow_origin = origin
    elif settings.ENVIRONMENT == "production":
        allow_origin = "https://roomivo.eu"
    else:
        allow_origin = "http://localhost:3000"

    content = {"detail": f"Server error: {type(exc).__name__}"}
    if settings.ENVIRONMENT != "production":
        content["message"] = str(exc)

    return JSONResponse(
        status_code=500,
        content=content,
        headers={
            "Access-Control-Allow-Origin": allow_origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Language",
            "Access-Control-Allow-Credentials": "true",
            "Cross-Origin-Opener-Policy": "unsafe-none",
            "Cross-Origin-Embedder-Policy": "unsafe-none",
            "Cross-Origin-Resource-Policy": "cross-origin",
        }
    )


@fastapi_app.get("/diagnostic-check")
async def diagnostic_check():
    return {"status": "ok"}

# ------------------------------------------------------------------
# Include all routers
# ------------------------------------------------------------------
from app.routers import (auth, location, onboarding, properties,
                         property_manager, verification)

fastapi_app.include_router(properties.router)
fastapi_app.include_router(auth.router)
fastapi_app.include_router(property_manager.router)
fastapi_app.include_router(onboarding.router)
fastapi_app.include_router(verification.router)
fastapi_app.include_router(location.router)

from app.routers import webhooks
fastapi_app.include_router(webhooks.router)

from app.routers import visits
fastapi_app.include_router(visits.router)

from app.routers import messages
fastapi_app.include_router(messages.router)

from app.routers import team
fastapi_app.include_router(team.router)

from app.routers import bulk, stats
fastapi_app.include_router(bulk.router)
fastapi_app.include_router(stats.router)

from app.routers import erp_webhooks
fastapi_app.include_router(erp_webhooks.router)

from app.routers import documents
fastapi_app.include_router(documents.router)

from app.routers import applications
fastapi_app.include_router(applications.router)

from app.routers import notifications
fastapi_app.include_router(notifications.router)

from app.routers import leases
fastapi_app.include_router(leases.router)

from app.routers import inventory
fastapi_app.include_router(inventory.router)

from app.routers import dispute
fastapi_app.include_router(dispute.router)

from app.routers import stats
fastapi_app.include_router(stats.router)

from app.routers import admin
fastapi_app.include_router(admin.router)

from app.routers import media
fastapi_app.include_router(media.router)

from app.routers import feedback
fastapi_app.include_router(feedback.router)

from app.routers import identity
fastapi_app.include_router(identity.router)

from app.routers import gdpr
fastapi_app.include_router(gdpr.router)


# ------------------------------------------------------------------
# Compatibility routes
# ------------------------------------------------------------------
@fastapi_app.api_route("/users/me", methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"])
async def users_me_compatibility(request: Request):
    """Compatibility route for legacy /users/me endpoint"""
    from fastapi.responses import RedirectResponse
    # Redirect to /auth/me with 307 (Temporary Redirect) to preserve method
    return RedirectResponse(url="/auth/me", status_code=307)



# ------------------------------------------------------------------
# Health & root
# ------------------------------------------------------------------
@fastapi_app.get("/health")
async def health_check():
    """Enhanced health check for Render with timing and partial failure detection"""
    import time
    from sqlalchemy import text
    from app.core.cache import cache
    from app.core.circuit_breaker import get_circuit_health
    from app.core.database import AsyncSessionLocal

    status = {"status": "ok", "timestamp": time.time(), "checks": {}}
    start_total = time.time()

    # 1. DB Check
    try:
        t0 = time.time()
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        status["checks"]["database"] = {"status": "up", "latency": time.time() - t0}
    except Exception as e:
        status["status"] = "degraded"
        status["checks"]["database"] = {"status": "down", "error": str(e)}

    # 2. Redis Check
    try:
        t0 = time.time()
        redis_ok = False
        if cache.redis_client:
            redis_ok = cache.redis_client.ping()
        status["checks"]["cache"] = {
            "status": "up" if redis_ok else "down",
            "latency": time.time() - t0,
        }
    except Exception:
        status["checks"]["cache"] = {"status": "error"}

    # 3. Circuits
    status["checks"]["circuits"] = get_circuit_health()
    status["total_latency"] = time.time() - start_total

    return status


@fastapi_app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Roomivo API", "docs": "/docs", "health": "/health"}


# Static file serving for local development
import os as _os
if _os.path.isdir("uploads"):
    from fastapi.staticfiles import StaticFiles
    fastapi_app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ------------------------------------------------------------------
# CORS safety-net — outermost ASGI wrapper.
# If something crashes so hard that FastAPI's exception handler is
# never reached (DB connection refused, import error, middleware
# crash), this guarantees the browser still gets CORS headers so
# the frontend sees a readable error instead of "Network Error".
# ------------------------------------------------------------------
class CORSSafetyNet:
    """
    Final safety net to catch ANY unhandled exception and return 503
    with correct CORS headers to prevent 'Network Error' in browser.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        try:
            await self.app(scope, receive, send)
        except Exception as e:
            try:
                import traceback
                logger.error(f"❌ CRITICAL ERROR CAUGHT BY SAFETY NET: {str(e)}", exc_info=True)

                # Use settings directly to avoid circular imports
                try:
                    from app.core.config import settings
                    allowed_origins = settings.ALLOWED_ORIGINS
                except Exception:
                    allowed_origins = ["https://roomivo.eu", "https://www.roomivo.eu", "http://localhost:3000"]
                
                # Default to the first allowed production origin if not found or untrusted
                # fallback index 0 is typically https://roomivo.eu in production
                origin = b"*"
                if allowed_origins:
                    origin = allowed_origins[0].encode()
                
                for header_name, header_value in scope.get("headers", []):
                    if header_name.lower() == b"origin":
                        try:
                            decoded_origin = header_value.decode()
                            if decoded_origin in allowed_origins:
                                origin = header_value
                        except Exception:
                            pass
                        break

                resp_headers = [
                    (b"content-type", b"application/json"),
                    (b"access-control-allow-origin", origin),
                    (b"access-control-allow-methods", b"GET, POST, PUT, DELETE, OPTIONS, PATCH"),
                    (b"access-control-allow-headers", b"Content-Type, Authorization, X-Requested-With, Accept, Language"),
                    (b"access-control-allow-credentials", b"true"),
                    (b"cross-origin-opener-policy", b"unsafe-none"),
                    (b"cross-origin-embedder-policy", b"unsafe-none"),
                    (b"cross-origin-resource-policy", b"cross-origin"),
                ]
                
                # Sanitize error message for JSON
                safe_error = str(e).replace('"', '\\"')
                body = f'{{"detail":"Service temporarily unavailable: {safe_error}"}}'.encode()
                
                await send(
                    {"type": "http.response.start", "status": 503, "headers": resp_headers}
                )
                await send({"type": "http.response.body", "body": body})
            except Exception as nested_e:
                # Absolute last resort if the safety net ITSELF crashes
                logger.error(f"🔥🔥🔥 SAFETY NET CRASHED: {str(nested_e)}")
                # We can't do much here except let it bubble or send a bare-bones response if possible
                raise nested_e


# This is what uvicorn imports: app = CORSSafetyNet(fastapi_app)
# The safety net wraps the entire FastAPI stack.
app = CORSSafetyNet(fastapi_app)
