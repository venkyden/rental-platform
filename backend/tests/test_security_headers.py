"""
Tests for the hardened security-headers middleware and auth gating.

Validates the fixes in app/main.py: Referrer-Policy / Permissions-Policy added,
COOP set to same-origin-allow-popups, and CSP no longer allows 'unsafe-eval'.
"""


def test_core_security_headers_present(client):
    # Act
    resp = client.get("/health")
    # Assert (headers are attached by middleware regardless of status code)
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "Permissions-Policy" in resp.headers


def test_coop_allows_popups_not_unsafe_none(client):
    # Act
    resp = client.get("/health")
    # Assert
    assert resp.headers.get("Cross-Origin-Opener-Policy") == "same-origin-allow-popups"


def test_csp_present_without_unsafe_eval(client):
    # Act
    resp = client.get("/health")
    csp = resp.headers.get("Content-Security-Policy", "")
    # Assert
    assert csp, "CSP header must be present"
    assert "unsafe-eval" not in csp
    assert "frame-ancestors 'none'" in csp


def test_protected_endpoint_requires_auth(client):
    # Act: no auth override on the bare `client` fixture
    resp = client.get("/auth/me")
    # Assert: must not be accessible without a token
    assert resp.status_code in (401, 403)


def test_responses_are_not_cacheable(client):
    # Policy 4.3 / CWE-524: private API responses must never be stored by a
    # browser, proxy or CDN. Every API response is marked, error ones included.
    for path in ("/health", "/auth/me"):
        resp = client.get(path)
        assert resp.headers.get("Cache-Control") == "no-store, no-cache, must-revalidate, proxy-revalidate"
        assert resp.headers.get("Pragma") == "no-cache"
        assert resp.headers.get("Expires") == "0"
