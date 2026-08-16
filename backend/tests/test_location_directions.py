"""
POST /location/directions — request validation + config-gating.
Uses the `client` fixture (mocked DB, no auth needed — this endpoint requires
neither) from conftest.py.
"""


def test_directions_missing_fields_422(client):
    resp = client.post("/location/directions", json={"origin_lat": 48.85})
    assert resp.status_code == 422


def test_directions_invalid_lat_422(client):
    resp = client.post(
        "/location/directions",
        json={
            "origin_lat": 999,
            "origin_lng": 2.35,
            "dest_lat": 48.86,
            "dest_lng": 2.36,
            "mode": "walking",
        },
    )
    assert resp.status_code == 422


def test_directions_without_api_key_returns_503(client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "ORS_API_KEY", None)
    resp = client.post(
        "/location/directions",
        json={
            "origin_lat": 48.85,
            "origin_lng": 2.35,
            "dest_lat": 48.86,
            "dest_lng": 2.36,
            "mode": "walking",
        },
    )
    assert resp.status_code == 503


def test_directions_invalid_mode_422(client, monkeypatch):
    """mode is now a Literal["walking", "cycling", "driving"] — an unknown
    value is rejected by Pydantic (422) before the endpoint body ever runs,
    so ors_directions.InvalidMode is unreachable via this HTTP path."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "ORS_API_KEY", "fake-key")
    resp = client.post(
        "/location/directions",
        json={
            "origin_lat": 48.85,
            "origin_lng": 2.35,
            "dest_lat": 48.86,
            "dest_lng": 2.36,
            "mode": "teleport",
        },
    )
    assert resp.status_code == 422


def test_directions_success_returns_route(client, monkeypatch):
    from app.core.config import settings
    from app.services import ors_directions

    monkeypatch.setattr(settings, "ORS_API_KEY", "fake-key")

    async def fake_get_directions(*args, **kwargs):
        return ors_directions.DirectionsResult(
            distance_m=800.0,
            duration_s=600.0,
            geometry={"type": "LineString", "coordinates": [[2.35, 48.85], [2.36, 48.86]]},
        )

    monkeypatch.setattr(ors_directions, "get_directions", fake_get_directions)

    resp = client.post(
        "/location/directions",
        json={
            "origin_lat": 48.85,
            "origin_lng": 2.35,
            "dest_lat": 48.86,
            "dest_lng": 2.36,
            "mode": "walking",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["distance_m"] == 800.0
    assert data["duration_s"] == 600.0
    assert data["geometry"]["type"] == "LineString"


def test_directions_unavailable_returns_502(client, monkeypatch):
    from app.core.config import settings
    from app.services import ors_directions

    monkeypatch.setattr(settings, "ORS_API_KEY", "fake-key")

    async def fake_get_directions(*args, **kwargs):
        raise ors_directions.DirectionsUnavailable("openrouteservice timeout")

    monkeypatch.setattr(ors_directions, "get_directions", fake_get_directions)

    resp = client.post(
        "/location/directions",
        json={
            "origin_lat": 48.85,
            "origin_lng": 2.35,
            "dest_lat": 48.86,
            "dest_lng": 2.36,
            "mode": "walking",
        },
    )
    assert resp.status_code == 502
