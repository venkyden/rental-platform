"""
Tests for stats router.
"""

def test_landlord_overview_unauthenticated(client):
    """GET /stats/landlord/overview without authentication should fail."""
    resp = client.get("/stats/landlord/overview")
    assert resp.status_code in (401, 403)


def test_landlord_overview_as_tenant(tenant_client):
    """GET /stats/landlord/overview as a tenant should return 403 Forbidden."""
    resp = tenant_client.get("/stats/landlord/overview")
    assert resp.status_code == 403


def test_landlord_overview_as_landlord(landlord_client):
    """GET /stats/landlord/overview as landlord should succeed."""
    resp = landlord_client.get("/stats/landlord/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "active_properties" in data
    assert "pending_applications" in data
    assert "total_views" in data
    assert "revenue" in data


def test_landlord_alerts_as_landlord(landlord_client):
    """GET /stats/landlord/alerts as landlord should succeed."""
    resp = landlord_client.get("/stats/landlord/alerts")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_alerts" in data
    assert "alerts" in data


def test_landlord_alerts_bilingual_en(landlord_client):
    """GET /stats/landlord/alerts with Accept-Language: en should return English strings."""
    resp = landlord_client.get("/stats/landlord/alerts", headers={"Accept-Language": "en"})
    assert resp.status_code == 200


def test_agency_overview_unauthenticated(client):
    """GET /stats/agency/overview without authentication should fail."""
    resp = client.get("/stats/agency/overview")
    assert resp.status_code in (401, 403)


def test_agency_overview_as_landlord_forbidden(landlord_client):
    """GET /stats/agency/overview as a standard landlord should return 403 Forbidden."""
    resp = landlord_client.get("/stats/agency/overview")
    assert resp.status_code == 403


def test_agency_overview_as_pm(pm_client):
    """GET /stats/agency/overview as property manager should succeed."""
    resp = pm_client.get("/stats/agency/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "active_mandates" in data
    assert "leased" in data
    assert "webhook_count" in data
    assert "managed_revenue" in data


def test_revenue_chart_as_landlord(landlord_client):
    """GET /stats/landlord/revenue-chart should succeed."""
    resp = landlord_client.get("/stats/landlord/revenue-chart?period=30D")
    assert resp.status_code == 200
    data = resp.json()
    assert "points" in data
    assert len(data["points"]) > 0
    assert "views" in data["points"][0]
    assert "revenue" in data["points"][0]


def test_visits_as_landlord(landlord_client):
    """GET /stats/landlord/visits should succeed."""
    resp = landlord_client.get("/stats/landlord/visits")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_visits" in data
    assert "upcoming_visits" in data
    assert "pending_requests" in data
