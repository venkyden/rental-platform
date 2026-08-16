"""
openrouteservice Directions client (2026-07-30 neighborhood-map design).
Pure httpx-mock unit tests, following the _MockClient/_MockResponse pattern
in test_property_verification.py (ademe_dpe).
"""
import pytest

from app.services import ors_directions


class _MockResponse:
    def __init__(self, status_code, json_data):
        self.status_code = status_code
        self._json = json_data

    def json(self):
        return self._json


class _MockClient:
    def __init__(self, status_code=200, json_data=None, raise_timeout=False, raise_request_error=False):
        self._resp = _MockResponse(status_code, json_data or {})
        self._raise_timeout = raise_timeout
        self._raise_request_error = raise_request_error

    async def post(self, url, json=None, headers=None):
        if self._raise_timeout:
            import httpx
            raise httpx.TimeoutException("timeout")
        if self._raise_request_error:
            import httpx
            raise httpx.ConnectError("connection refused")
        return self._resp

    async def aclose(self):
        pass


def _geojson_response(distance_m=1200.5, duration_s=900.0):
    return {
        "features": [
            {
                "properties": {"summary": {"distance": distance_m, "duration": duration_s}},
                "geometry": {"type": "LineString", "coordinates": [[2.35, 48.85], [2.36, 48.86]]},
            }
        ]
    }


@pytest.mark.asyncio
async def test_get_directions_invalid_mode():
    with pytest.raises(ors_directions.InvalidMode):
        await ors_directions.get_directions(
            48.85, 2.35, 48.86, 2.36, "teleport", api_key="fake-key"
        )


@pytest.mark.asyncio
async def test_get_directions_success_walking():
    client = _MockClient(200, _geojson_response(distance_m=800.0, duration_s=600.0))
    result = await ors_directions.get_directions(
        48.85, 2.35, 48.86, 2.36, "walking", api_key="fake-key", http_client=client
    )
    assert result.distance_m == 800.0
    assert result.duration_s == 600.0
    assert result.geometry["type"] == "LineString"


@pytest.mark.asyncio
async def test_get_directions_success_cycling():
    client = _MockClient(200, _geojson_response())
    result = await ors_directions.get_directions(
        48.85, 2.35, 48.86, 2.36, "cycling", api_key="fake-key", http_client=client
    )
    assert result.distance_m == 1200.5


@pytest.mark.asyncio
async def test_get_directions_success_driving():
    client = _MockClient(200, _geojson_response())
    result = await ors_directions.get_directions(
        48.85, 2.35, 48.86, 2.36, "driving", api_key="fake-key", http_client=client
    )
    assert result.duration_s == 900.0


@pytest.mark.asyncio
async def test_get_directions_no_route_found():
    client = _MockClient(200, {"features": []})
    with pytest.raises(ors_directions.DirectionsUnavailable):
        await ors_directions.get_directions(
            48.85, 2.35, 48.86, 2.36, "walking", api_key="fake-key", http_client=client
        )


@pytest.mark.asyncio
async def test_get_directions_5xx_raises_unavailable():
    client = _MockClient(503, {})
    with pytest.raises(ors_directions.DirectionsUnavailable):
        await ors_directions.get_directions(
            48.85, 2.35, 48.86, 2.36, "walking", api_key="fake-key", http_client=client
        )


@pytest.mark.asyncio
async def test_get_directions_timeout_raises_unavailable():
    client = _MockClient(raise_timeout=True)
    with pytest.raises(ors_directions.DirectionsUnavailable):
        await ors_directions.get_directions(
            48.85, 2.35, 48.86, 2.36, "walking", api_key="fake-key", http_client=client
        )
