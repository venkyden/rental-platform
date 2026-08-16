"""
openrouteservice Directions API client (2026-07-30 neighborhood-map design).

Server-side only — the API key never reaches the browser. Free tier: 2000
requests/day, fits the project's OSS/free-API/low-OPEX constraint. Mirrors the
ademe_dpe.py pattern: pure, injectable http_client, typed exceptions.
"""
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

ORS_BASE_URL = "https://api.openrouteservice.org/v2/directions"
_TIMEOUT_SECONDS = 8.0

_PROFILE_BY_MODE = {
    "walking": "foot-walking",
    "cycling": "cycling-regular",
    "driving": "driving-car",
}


class DirectionsError(Exception):
    """Base directions error."""


class InvalidMode(DirectionsError):
    """mode is not one of walking/cycling/driving."""


class DirectionsUnavailable(DirectionsError):
    """4xx/5xx / timeout / no route found — caller should show a friendly message."""


@dataclass
class DirectionsResult:
    distance_m: float
    duration_s: float
    geometry: dict  # GeoJSON LineString


async def get_directions(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    mode: str,
    *,
    api_key: str,
    http_client: Optional[httpx.AsyncClient] = None,
) -> DirectionsResult:
    """
    Look up a walking/cycling/driving route between two points.

    http_client is injectable for testing without real HTTP calls.

    Raises:
        InvalidMode           — mode not in {"walking", "cycling", "driving"}
        DirectionsUnavailable — 4xx/5xx, timeout, or no route found
    """
    profile = _PROFILE_BY_MODE.get(mode)
    if profile is None:
        raise InvalidMode(f"Unknown mode: {mode!r}")

    own_client = http_client is None
    client = http_client or httpx.AsyncClient(timeout=_TIMEOUT_SECONDS)
    try:
        try:
            resp = await client.post(
                f"{ORS_BASE_URL}/{profile}/geojson",
                json={"coordinates": [[origin_lng, origin_lat], [dest_lng, dest_lat]]},
                headers={"Authorization": api_key, "Content-Type": "application/json"},
            )
        except httpx.TimeoutException as exc:
            raise DirectionsUnavailable("openrouteservice timeout") from exc
        except httpx.RequestError as exc:
            raise DirectionsUnavailable(f"openrouteservice request error: {exc}") from exc

        if resp.status_code >= 400:
            raise DirectionsUnavailable(f"openrouteservice HTTP {resp.status_code}")
        data = resp.json()
    finally:
        if own_client:
            await client.aclose()

    features = data.get("features", [])
    if not features:
        raise DirectionsUnavailable("No route found")

    feature = features[0]
    summary = feature.get("properties", {}).get("summary", {})
    distance_m = summary.get("distance")
    duration_s = summary.get("duration")
    geometry = feature.get("geometry")
    if distance_m is None or duration_s is None or geometry is None:
        raise DirectionsUnavailable("Malformed openrouteservice response")

    return DirectionsResult(distance_m=distance_m, duration_s=duration_s, geometry=geometry)
