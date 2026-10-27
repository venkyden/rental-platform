"""One shared rate limiter, keyed on a client IP the client cannot forge.

Every router used to build its own in-memory Limiter, so with several uvicorn
workers each limit was enforced per process (effectively multiplied) and reset
on every deploy. Counters now live in Redis when REDIS_URL is set, falling back
to memory if Redis is unreachable rather than failing the request.
"""

import logging
from typing import Optional

from slowapi import Limiter
from starlette.requests import Request

from app.core.config import settings

logger = logging.getLogger(__name__)
_warned_missing_header = False


def client_ip(request: Request) -> Optional[str]:
    """The caller's IP for rate limits and audit trails.

    On Render, Cloudflare and the load balancer *append* to X-Forwarded-For, so
    its leftmost entry is whatever the client sent — and uvicorn's
    --forwarded-allow-ips='*' copies that entry into request.client. When
    CLIENT_IP_HEADER names a header the edge proxy overwrites (cf-connecting-ip
    on Render, x-real-ip behind our nginx), use it; otherwise the socket peer.
    """
    global _warned_missing_header
    if settings.CLIENT_IP_HEADER:
        value = request.headers.get(settings.CLIENT_IP_HEADER)
        if value:
            return value.strip()
        if not _warned_missing_header:
            _warned_missing_header = True
            logger.warning(
                "CLIENT_IP_HEADER %r absent on a request; falling back to the socket "
                "peer, which X-Forwarded-For can forge. Check the edge proxy.",
                settings.CLIENT_IP_HEADER,
            )
    return request.client.host if request.client else None


limiter = Limiter(
    key_func=lambda request: client_ip(request) or "unknown",
    storage_uri=settings.REDIS_URL or None,
    # The limits package uses a synchronous Redis client called inside the
    # event loop: without timeouts a stalled Upstash connection would freeze
    # the whole worker, login included. Fail over to memory fast instead.
    storage_options={"socket_connect_timeout": 0.5, "socket_timeout": 0.5},
    in_memory_fallback_enabled=True,
)

# slowapi gives its logger only a no-op handler, so its "falling back to
# in-memory limits" warning (limits silently per-worker again) would vanish.
_slowapi_log = logging.getLogger("slowapi")
_slowapi_log.addHandler(logging.StreamHandler())
_slowapi_log.setLevel(logging.WARNING)
