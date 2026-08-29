# Neighborhood Map + Directions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static property-location pin on the listing page into an interactive map where a visitor can search an address and see the walk/bike/car distance and duration to the property, matching the Studapart reference screenshot.

**Architecture:** A new pure `ors_directions.py` service (httpx client, mirrors the existing `ademe_dpe.py` pattern) wraps the openrouteservice Directions API. A new `POST /location/directions` endpoint (same router as the existing `/location/enrich`) takes origin + destination coordinates directly — no server-side geocoding needed, since the frontend's existing `AddressAutocomplete` component already resolves a typed address to lat/lng via Photon before this endpoint is ever called. A new `NeighborhoodMap.tsx` component (fully interactive Leaflet map, unlike the frozen `StaticMapView.tsx`) replaces `StaticMapView` in the listing page's location section.

**Tech Stack:** FastAPI + httpx (backend), Next.js/React + Leaflet/react-leaflet (already a dependency) + openrouteservice free-tier API.

**Design doc:** `docs/superpowers/specs/2026-07-30-listing-criteria-and-neighborhood-map-design.md`

---

### Task 1: Backend — `ors_directions` service, failing tests first

**Files:**
- Create: `backend/tests_integration/test_ors_directions.py`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && python -m pytest tests_integration/test_ors_directions.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.ors_directions'`

- [ ] **Step 3: Commit the failing test**

```bash
cd backend && git add tests_integration/test_ors_directions.py
git commit -m "test: add failing tests for ors_directions service"
```

---

### Task 2: Backend — implement `ors_directions.py`

**Files:**
- Create: `backend/app/services/ors_directions.py`

- [ ] **Step 1: Write the service**

```python
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests_integration/test_ors_directions.py -v`
Expected: PASS (7 passed)

- [ ] **Step 3: Commit**

```bash
cd backend && git add app/services/ors_directions.py
git commit -m "feat(location): add ors_directions service (openrouteservice client)"
```

---

### Task 3: Backend — `ORS_API_KEY` setting

**Files:**
- Modify: `backend/app/core/config.py:35-37`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add the setting**

In `backend/app/core/config.py`, replace:

```python
    RESEND_API_KEY: Optional[str] = None
```

with:

```python
    RESEND_API_KEY: Optional[str] = None
    # openrouteservice — free tier (2000 req/day). https://openrouteservice.org/dev/#/signup
    ORS_API_KEY: Optional[str] = None
```

- [ ] **Step 2: Document it in `.env.example`**

Add a line to `backend/.env.example` (near the other external API keys):

```
ORS_API_KEY=
```

- [ ] **Step 3: Verify the app still boots**

Run: `cd backend && python -c "from app.core.config import Settings; print('ok')"`
Expected: `ok` (no `ValidationError` — `ORS_API_KEY` is `Optional`, so it's fine unset).

- [ ] **Step 4: Commit**

```bash
cd backend && git add app/core/config.py .env.example
git commit -m "feat(config): add ORS_API_KEY setting for openrouteservice"
```

---

### Task 4: Backend — `POST /location/directions` endpoint

**Files:**
- Modify: `backend/app/routers/location.py`
- Modify: `backend/tests/route_manifest.json`

- [ ] **Step 1: Write the endpoint**

Replace the full contents of `backend/app/routers/location.py` with:

```python
"""
Property location enrichment + directions endpoints.
"""

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.utils.location import enrich_property_location

router = APIRouter(prefix="/location", tags=["Location"])
limiter = Limiter(key_func=get_remote_address)


class AddressEnrichRequest(BaseModel):
    address: str
    city: str
    postal_code: str
    country: str = "France"


@router.post("/enrich")
async def enrich_address(request: AddressEnrichRequest):
    """
    Geocode address and get nearby public transport and landmarks.
    Returns GPS coordinates, transit options, and nearby POIs.
    """
    result = await enrich_property_location(
        request.address, request.city, request.postal_code, request.country
    )

    return result


class DirectionsRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90, le=90)
    origin_lng: float = Field(..., ge=-180, le=180)
    dest_lat: float = Field(..., ge=-90, le=90)
    dest_lng: float = Field(..., ge=-180, le=180)
    mode: str  # "walking" | "cycling" | "driving"


@router.post("/directions")
@limiter.limit("20/minute")
async def get_directions_route(request: Request, body: DirectionsRequest):
    """
    Walk/bike/car route + distance/duration between an origin (already
    geocoded client-side via AddressAutocomplete/Photon) and a destination
    (a property's stored coordinates). No server-side geocoding here.
    """
    from app.core.config import settings
    from app.services import ors_directions

    if not settings.ORS_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Directions service not configured",
        )

    try:
        result = await ors_directions.get_directions(
            body.origin_lat, body.origin_lng, body.dest_lat, body.dest_lng, body.mode,
            api_key=settings.ORS_API_KEY,
        )
    except ors_directions.InvalidMode:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid mode")
    except ors_directions.DirectionsUnavailable:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Directions temporarily unavailable",
        )

    return {
        "distance_m": result.distance_m,
        "duration_s": result.duration_s,
        "geometry": result.geometry,
    }
```

- [ ] **Step 2: Register the new route in the doctrine-guard manifest**

`backend/tests/test_doctrine_guard.py` fails CI if the mounted route surface doesn't
exactly match `backend/tests/route_manifest.json` (new endpoints must be added to the
manifest in the same PR — DOSSIER/product-surface policy). In
`backend/tests/route_manifest.json`, replace:

```json
  "POST /api/v1/location/enrich",
```

with:

```json
  "POST /api/v1/location/directions",
  "POST /api/v1/location/enrich",
```

(alphabetical order: "directions" sorts before "enrich" — check the surrounding entries
to confirm the file's existing ordering convention before inserting.)

- [ ] **Step 3: Run the doctrine guard test**

Run: `cd backend && python -m pytest tests/test_doctrine_guard.py -v`
Expected: PASS

- [ ] **Step 4: Write an endpoint-level test**

Create `backend/tests/test_location_directions.py`:

```python
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
```

- [ ] **Step 5: Run the new tests**

Run: `cd backend && python -m pytest tests/test_location_directions.py tests/test_doctrine_guard.py tests_integration/test_ors_directions.py -v`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
cd backend && git add app/routers/location.py tests/route_manifest.json tests/test_location_directions.py
git commit -m "feat(location): add POST /location/directions endpoint"
```

---

### Task 5: Frontend — `NeighborhoodMap.tsx` component

**Files:**
- Create: `frontend/components/NeighborhoodMap.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import AddressAutocomplete, { AddressResult } from './AddressAutocomplete';
import { Footprints, Bike, Car, TrainFront } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), { ssr: false });
const ZoomControl = dynamic(() => import('react-leaflet').then((mod) => mod.ZoomControl), { ssr: false });

interface NeighborhoodMapProps {
    lat: number;
    lng: number;
    address: string;
    /**
     * The property's already-computed nearby-transit list (Overpass POI data,
     * fetched once at listing-creation time — see app/utils/location.py
     * get_nearby_pois). Same array PropertyDetailClient already renders under
     * "Neighborhood Connectivity". Formatted strings like
     * "🚉 Gare Austerlitz (Line C) — 350m"; a "📋 Routes: …" summary line (no
     * distance suffix) may be prepended. Used for the "Public transport" mode
     * — no live routing call, just the nearest stop already on hand.
     */
    publicTransport?: string[];
}

type Mode = 'walking' | 'cycling' | 'driving' | 'transit';

interface RouteState {
    distance_m: number;
    duration_s: number;
    // GeoJSON LineString coordinates are [lng, lat] — converted to Leaflet's
    // [lat, lng] pairs before rendering.
    positions: [number, number][];
}

interface NearestStop {
    label: string;
    distanceM: number;
}

const MODES: { key: Mode; icon: typeof Footprints; labelKey: string }[] = [
    { key: 'walking', icon: Footprints, labelKey: 'property.neighborhoodMap.walking' },
    { key: 'cycling', icon: Bike, labelKey: 'property.neighborhoodMap.cycling' },
    { key: 'driving', icon: Car, labelKey: 'property.neighborhoodMap.driving' },
    { key: 'transit', icon: TrainFront, labelKey: 'property.neighborhoodMap.transit' },
];

function formatDistance(m: number): string {
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatDuration(s: number): string {
    const minutes = Math.round(s / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
}

/**
 * Parses the nearest stop out of the property's public_transport list. Items
 * are formatted "<emoji + label> — <N>m"; the list is pre-sorted by distance
 * before an optional "📋 Routes: …" summary line (no distance suffix) is
 * prepended — so the first item that actually matches the distance suffix is
 * the nearest one.
 */
function parseNearestStop(publicTransport: string[] | undefined): NearestStop | null {
    if (!publicTransport) return null;
    for (const entry of publicTransport) {
        const match = entry.match(/^(.*)\s—\s(\d+)m$/);
        if (match) {
            return { label: match[1].trim(), distanceM: parseInt(match[2], 10) };
        }
    }
    return null;
}

export default function NeighborhoodMap({ lat, lng, address, publicTransport }: NeighborhoodMapProps) {
    const { t } = useLanguage();
    const [isMounted, setIsMounted] = useState(false);
    const [mode, setMode] = useState<Mode>('walking');
    const [origin, setOrigin] = useState<{ lat: number; lng: number; label: string } | null>(null);
    const [route, setRoute] = useState<RouteState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nearestStop = parseNearestStop(publicTransport);

    useEffect(() => {
        setIsMounted(true);
        const L = require('leaflet');
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png').default.src,
            iconUrl: require('leaflet/dist/images/marker-icon.png').default.src,
            shadowUrl: require('leaflet/dist/images/marker-shadow.png').default.src,
        });
    }, []);

    const fetchRoute = useCallback(
        async (originLat: number, originLng: number, selectedMode: Mode) => {
            setLoading(true);
            setError(null);
            try {
                const res = await apiClient.client.post('/location/directions', {
                    origin_lat: originLat,
                    origin_lng: originLng,
                    dest_lat: lat,
                    dest_lng: lng,
                    mode: selectedMode,
                });
                const coords: [number, number][] = res.data.geometry.coordinates.map(
                    ([lngC, latC]: [number, number]) => [latC, lngC]
                );
                setRoute({
                    distance_m: res.data.distance_m,
                    duration_s: res.data.duration_s,
                    positions: coords,
                });
            } catch (e) {
                console.error('Directions error:', e);
                setError(t('property.neighborhoodMap.searchError', undefined, 'Could not compute a route to this address.'));
                setRoute(null);
            } finally {
                setLoading(false);
            }
        },
        [lat, lng, t]
    );

    const handleAddressSelect = (result: AddressResult) => {
        if (result.lat === undefined || result.lng === undefined) {
            setError(t('property.neighborhoodMap.searchError', undefined, 'Could not compute a route to this address.'));
            return;
        }
        setOrigin({ lat: result.lat, lng: result.lng, label: result.display });
        fetchRoute(result.lat, result.lng, mode);
    };

    const handleModeChange = (newMode: Mode) => {
        setMode(newMode);
        // "transit" has no routing call (see parseNearestStop) — only the three
        // ORS-backed modes re-fetch a route.
        if (newMode !== 'transit' && origin) fetchRoute(origin.lat, origin.lng, newMode);
    };

    if (!isMounted) {
        return (
            <div className="w-full h-[400px] bg-zinc-50 rounded-[3rem] flex items-center justify-center animate-pulse border border-zinc-100">
                <p className="text-zinc-400 text-xs font-black uppercase tracking-[0.2em]">
                    {t('property.neighborhoodMap.loading', undefined, 'Loading map…')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="relative w-full h-[400px] rounded-[3rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] border border-white z-0">
                <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom zoomControl={false} className="w-full h-full">
                    <ZoomControl position="topright" />
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[lat, lng]}>
                        <Popup>{address}</Popup>
                    </Marker>
                    {origin && (
                        <Marker position={[origin.lat, origin.lng]}>
                            <Popup>{origin.label}</Popup>
                        </Marker>
                    )}
                    {route && <Polyline positions={route.positions} pathOptions={{ color: '#18181b', weight: 4 }} />}
                </MapContainer>
            </div>

            <div className="space-y-4">
                {mode !== 'transit' && (
                    <AddressAutocomplete
                        onSelectAction={handleAddressSelect}
                        countryCode="fr"
                        allowManualEntry={false}
                        placeholder={t('property.neighborhoodMap.searchPlaceholder', undefined, 'Search an address to calculate…')}
                        variant="form"
                    />
                )}
                <div className="flex flex-wrap gap-3">
                    {MODES.map(({ key, icon: Icon, labelKey }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => handleModeChange(key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                mode === key ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
                            }`}
                            aria-pressed={mode === key}
                        >
                            <Icon className="w-4 h-4" />
                            {t(labelKey, undefined, key)}
                        </button>
                    ))}
                </div>
                {mode === 'transit' ? (
                    nearestStop ? (
                        <p className="text-sm font-black text-zinc-900">
                            {t('property.neighborhoodMap.nearestStop', { stop: nearestStop.label })} · {formatDistance(nearestStop.distanceM)}
                        </p>
                    ) : (
                        <p className="text-xs text-zinc-400 font-bold">
                            {t('property.neighborhoodMap.noStopsFound', undefined, 'No nearby stops on file for this property.')}
                        </p>
                    )
                ) : (
                    <>
                        {loading && (
                            <p className="text-xs text-zinc-400 font-bold">{t('property.neighborhoodMap.calculating', undefined, 'Calculating…')}</p>
                        )}
                        {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
                        {route && !loading && (
                            <p className="text-sm font-black text-zinc-900">
                                {formatDistance(route.distance_m)} · {formatDuration(route.duration_s)}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/NeighborhoodMap.tsx
git commit -m "feat(properties): add interactive NeighborhoodMap component with directions"
```

---

### Task 6: Frontend — i18n keys for the neighborhood map

**Files:**
- Modify: `frontend/lib/i18n.ts`

- [ ] **Step 1: Add English keys**

In the `en.property` object, next to the `criteria` block added in the criteria-panel
plan (or next to `locationTitle` if that plan hasn't landed yet), add:

```typescript
            neighborhoodMap: {
                loading: "Loading map…",
                searchPlaceholder: "Search an address to calculate…",
                walking: "Walking",
                cycling: "Cycling",
                driving: "Driving",
                transit: "Public transport",
                calculating: "Calculating…",
                searchError: "Could not compute a route to this address.",
                nearestStop: "Nearest stop: {{stop}}",
                noStopsFound: "No nearby stops on file for this property.",
            },
```

- [ ] **Step 2: Add French keys**

In the `fr.property` object, add:

```typescript
            neighborhoodMap: {
                loading: "Chargement de la carte…",
                searchPlaceholder: "Chercher une adresse pour calculer…",
                walking: "À pied",
                cycling: "À vélo",
                driving: "En voiture",
                transit: "Transports en commun",
                calculating: "Calcul en cours…",
                searchError: "Impossible de calculer un itinéraire vers cette adresse.",
                nearestStop: "Arrêt le plus proche : {{stop}}",
                noStopsFound: "Aucun arrêt à proximité enregistré pour ce bien.",
            },
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/i18n.ts
git commit -m "feat(i18n): add neighborhood-map translation keys"
```

---

### Task 7: Frontend — swap `StaticMapView` for `NeighborhoodMap` on the listing page

**Files:**
- Modify: `frontend/app/properties/[id]/PropertyDetailClient.tsx:17` (import)
- Modify: `frontend/app/properties/[id]/PropertyDetailClient.tsx:81` (`Property.public_transport` type)
- Modify: `frontend/app/properties/[id]/PropertyDetailClient.tsx` (the "Verified Location" block)

- [ ] **Step 1: Correct the `public_transport` field type**

The `Property` interface declares `public_transport?: Array<{ name?: string; distance?: string; type?: string }>;`,
but the backend (`app/utils/location.py` `parse_overpass_results`) always returns
plain formatted strings (`"🚉 Gare Austerlitz (Line C) — 350m"`), never objects — the
existing "Neighborhood Connectivity" rendering already works around this by casting
the `.map` callback param to `any` (line ~862), so no code actually depends on the
object shape. `NeighborhoodMap`'s new `publicTransport?: string[]` prop needs the
honest type. Replace:

```typescript
    public_transport?: Array<{ name?: string; distance?: string; type?: string }>;
```

with:

```typescript
    public_transport?: string[];
```

- [ ] **Step 2: Swap the import**

Replace:

```tsx
import StaticMapView from '@/components/StaticMapView';
```

with:

```tsx
import NeighborhoodMap from '@/components/NeighborhoodMap';
```

(`StaticMapView.tsx` itself is left unchanged — it's a separate, simpler component used elsewhere for a plain read-only pin, per the design doc's decision to not change its contract.)

- [ ] **Step 3: Swap the usage**

`PropertyDetailClient.tsx` already derives `const publicTransport = Array.isArray(property.public_transport) ? property.public_transport : [];` at line 264 (used by the existing "Neighborhood Connectivity" section) — pass that same local straight through rather than re-deriving it. Replace:

```tsx
                                    <StaticMapView 
                                        lat={property.latitude} 
                                        lng={property.longitude} 
                                        address={fullAddress} 
                                    />
```

with:

```tsx
                                    <NeighborhoodMap
                                        lat={property.latitude}
                                        lng={property.longitude}
                                        address={fullAddress}
                                        publicTransport={publicTransport}
                                    />
```

- [ ] **Step 4: Confirm no other callers of `StaticMapView` in this file**

Run: `grep -n "StaticMapView" "frontend/app/properties/[id]/PropertyDetailClient.tsx"`
Expected: no matches (the import and single usage were both replaced in Steps 2-3).

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors from `PropertyDetailClient.tsx` or `NeighborhoodMap.tsx`.

- [ ] **Step 6: Manual verification**

Run: `cd frontend && npm run dev` (backend must also be running with a valid `ORS_API_KEY`
in `backend/.env` — sign up for the free tier at openrouteservice.org if not already set).
Open an existing active listing at `/properties/{id}`. Confirm:
- The map renders at the property's location with visible zoom +/− controls (not frozen).
- Typing an address into the search box and selecting a suggestion draws a route line
  and shows a distance/duration line below the map, for walking/cycling/driving.
- Selecting the "Public transport" mode hides the address search and shows the nearest
  stop + distance parsed from the property's existing transit data (or the "no stops on
  file" message if the property has none) — with no network call for this mode.
- Selecting an address with no Photon match (if reachable) shows the "could not compute
  a route" error rather than crashing, since `allowManualEntry={false}` should prevent
  this case entirely — confirm the prop is actually suppressing the manual-entry option
  in the dropdown.

- [ ] **Step 7: Commit**

```bash
git add "frontend/app/properties/[id]/PropertyDetailClient.tsx"
git commit -m "feat(properties): use interactive NeighborhoodMap on the listing page"
```

---

## Self-review

**Spec coverage:**
- GPS-prefilled pin — unchanged from what already worked (`property.latitude`/`longitude` → `NeighborhoodMap`'s `lat`/`lng` props), per the design doc's explicit "not being rebuilt" note ✅
- Address search + walk/bike/car directions — Tasks 1-2 (backend service), Task 4 (endpoint), Task 5 (frontend component) ✅
- API key server-side only — Task 3 (`ORS_API_KEY` in backend `Settings`, never sent to the client; `NeighborhoodMap` calls `/location/directions`, not ORS directly) ✅
- Fully interactive map, not frozen (per the user's explicit correction to the design doc) — Task 5's `MapContainer` sets `scrollWheelZoom` (truthy) and renders a real `ZoomControl`, unlike `StaticMapView`'s `scrollWheelZoom={false}`/`zoomControl={false}` ✅
- New component, not a `StaticMapView` rewrite — Task 5 creates `NeighborhoodMap.tsx`; Task 7 confirms `StaticMapView.tsx` itself is untouched ✅
- Route-manifest / doctrine-guard compliance for the new endpoint — Task 4, Step 2 ✅ (would otherwise break `test_doctrine_guard.py` on the next CI run)
- Public transport mode (added mid-plan per user request) — Task 5's `parseNearestStop` reuses the property's already-fetched `public_transport` list, no new backend call, no new provider/API key, matching the user's explicit "nearest-stop distance only" choice over full transit routing ✅

**Placeholder scan:** no TBD/TODO; every step has literal code.

**Type consistency:** `mode` is the string literal union `"walking" | "cycling" | "driving" | "transit"` end-to-end in the frontend `Mode` type (Task 5); only the first three are ever sent to the backend, whose `DirectionsRequest.mode` field and `_PROFILE_BY_MODE` dict keys (Tasks 2, 4) don't need to know about `"transit"` at all since `handleModeChange` never calls `fetchRoute` for it. `DirectionsResult.distance_m`/`duration_s` (backend dataclass) match the JSON keys `distance_m`/`duration_s` the frontend reads off `res.data` in `fetchRoute` — consistent. GeoJSON `[lng, lat]` → Leaflet `[lat, lng]` coordinate order is swapped exactly once, in `NeighborhoodMap.tsx`'s `fetchRoute` — not duplicated or re-swapped anywhere else. The `public_transport` field type correction (`Task 7`, Step 1: object-array → `string[]`) is applied once at the interface declaration and flows through to both the pre-existing "Neighborhood Connectivity" section (unaffected — it already treated items as `any`) and the new `NeighborhoodMap` prop.
