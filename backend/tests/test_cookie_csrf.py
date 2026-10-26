"""CSRF on the cookie-authenticated endpoints (policy 5.2, CWE-352).

Every other route authenticates with a Bearer header a third-party page cannot
attach. /auth/refresh and /auth/logout read the SameSite=None refresh cookie,
which the browser does attach cross-site, so they refuse unknown Origins.
"""

import pytest

from app.core.config import settings

EVIL = {"Origin": "https://evil.example"}


@pytest.mark.parametrize("path", ["/auth/refresh", "/auth/logout"])
def test_cross_site_origin_is_refused(client, path):
    client.cookies.set("refresh_token", "anything")
    resp = client.post(path, headers=EVIL)
    assert resp.status_code == 403
    assert "refresh_token" not in resp.headers.get("set-cookie", "")


def test_own_origin_passes_the_guard(client):
    resp = client.post("/auth/refresh", headers={"Origin": settings.ALLOWED_ORIGINS[0]})
    assert resp.status_code == 401  # reached the handler: no cookie sent


def test_no_origin_passes_the_guard(client):
    # Non-browser callers send no Origin and cannot ride a victim's cookie.
    assert client.post("/auth/logout").status_code == 200


def test_production_never_allows_localhost_origins(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://roomivo.eu,http://localhost:3000,http://127.0.0.1:3001")
    prod = settings.model_copy(update={"ENVIRONMENT": "production"})
    assert "https://roomivo.eu" in prod.ALLOWED_ORIGINS
    assert not [o for o in prod.ALLOWED_ORIGINS if "localhost" in o or "127.0.0.1" in o]
