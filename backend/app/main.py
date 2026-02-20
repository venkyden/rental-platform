from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.routers import auth, property_manager, onboarding, verification, properties, location

# Rate limiting setup (optional - only if slowapi is installed)
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    
    limiter = Limiter(key_func=get_remote_address)
    RATE_LIMITING_ENABLED = True
except ImportError:
    limiter = None
    RATE_LIMITING_ENABLED = False

app = FastAPI(
    title="Rental Platform API",
    description="API for rental property management platform with rate limiting and security features",
    version="1.0.0"
)

# Add rate limiting if available
if RATE_LIMITING_ENABLED:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS - production ready
# Use ALLOWED_ORIGINS env var in production, fallback to localhost for dev
import os
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
allowed_origins.extend(["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"])
allowed_origins = [o.strip() for o in allowed_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# Include routers
app.include_router(auth.router)
app.include_router(property_manager.router)
app.include_router(onboarding.router)
app.include_router(verification.router)
app.include_router(properties.router)
app.include_router(location.router)

# Import and include webhooks router
from app.routers import webhooks
app.include_router(webhooks.router)

# Import and include visits router
from app.routers import visits
app.include_router(visits.router)

# Import and include messages router (Unified Inbox)
from app.routers import messages
app.include_router(messages.router)

# Import and include team router (Multi-User Access)
from app.routers import team
app.include_router(team.router)

# Import and include bulk router (Bulk Import/Export)
from app.routers import bulk
app.include_router(bulk.router)

# Import and include ERP webhooks router
from app.routers import erp_webhooks
app.include_router(erp_webhooks.router)


# Import and include documents router
from app.routers import documents
app.include_router(documents.router)

# Import and include applications router
from app.routers import applications
app.include_router(applications.router)

@app.get("/health")
async def health_check():
    """
    Netflix-style health check endpoint.
    Returns detailed system status for monitoring and load balancers.
    """
    # Import here to avoid circular imports
    try:
        from app.core.circuit_breaker import get_circuit_health
        circuit_status = get_circuit_health()
    except:
        circuit_status = {}
    
    try:
        from app.core.cache import cache
        cache_status = "connected" if cache.redis_client else "disconnected"
    except:
        cache_status = "not_configured"
    
    return {
        "status": "healthy",
        "service": "rental-platform",
        "version": "1.0.0",
        "infrastructure": {
            "cache": cache_status,
            "circuits": circuit_status,
        }
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Rental Platform API",
        "docs": "/docs",
        "health": "/health"
    }
