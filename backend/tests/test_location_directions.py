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
