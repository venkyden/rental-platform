"""Client IP used for rate limits and audit trails (policy 3.2, CWE-307).

Render's Cloudflare edge and load balancer append to X-Forwarded-For, so its
leftmost entry is whatever the client sent; uvicorn's --forwarded-allow-ips='*'
copies that entry into request.client. The client IP must come from a header
the edge proxy overwrites instead, and every router must share one limiter so
counters are not per worker.
"""

import sys

from slowapi import Limiter
from starlette.requests import Request

from app.core import rate_limit
from app.core.rate_limit import client_ip


def _request(headers=None, peer="203.0.113.9"):
    return Request({
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
        "client": (peer, 1234) if peer else None,
    })


def test_uses_configured_edge_header_and_ignores_forwarded_for(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "CLIENT_IP_HEADER", "cf-connecting-ip")
    req = _request({"CF-Connecting-IP": "198.51.100.7", "X-Forwarded-For": "1.2.3.4"})
    assert client_ip(req) == "198.51.100.7"


def test_falls_back_to_socket_peer(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "CLIENT_IP_HEADER", None)
    assert client_ip(_request({"CF-Connecting-IP": "198.51.100.7"})) == "203.0.113.9"
    assert client_ip(_request(peer=None)) is None


def test_every_router_shares_the_one_limiter():
    import app.main  # noqa: F401 — loads every router

    limiters = {
        id(v) for name, m in list(sys.modules.items())
        if m is not None and (name == "app" or name.startswith("app."))
        for v in vars(m).values() if isinstance(v, Limiter)
    }
    assert limiters == {id(rate_limit.limiter)}


def test_rotating_forwarded_for_does_not_reset_the_limit(monkeypatch, client):
    monkeypatch.setattr(rate_limit.settings, "CLIENT_IP_HEADER", "cf-connecting-ip")
    rate_limit.limiter.reset()
    statuses = [
        client.post(
            "/auth/forgot-password",
            json={"email": "nobody@example.com"},
            headers={"CF-Connecting-IP": "198.51.100.50", "X-Forwarded-For": f"10.9.9.{i}"},
        ).status_code
        for i in range(7)
    ]
    rate_limit.limiter.reset()
    assert 429 in statuses
