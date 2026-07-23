"""
Location services utility for geocoding and nearby POI detection.
Uses OpenStreetMap Nominatim for geocoding and Overpass API for POI search.
Includes in-memory TTL caching and fast HTTP failover to ensure low latency.
"""

import asyncio
import time
from typing import Dict, List, Optional, Tuple

import httpx

# In-memory TTL caches for performance optimization
# Key format: (address_str) -> (timestamp, (lat, lon))
_GEOCODE_CACHE: Dict[str, Tuple[float, Optional[Tuple[float, float]]]] = {}
# Key format: (lat_3dp, lon_3dp) -> (timestamp, pois_dict)
_POI_CACHE: Dict[Tuple[float, float], Tuple[float, Dict[str, List[str]]]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour cache TTL


async def geocode_address(
    address: str, city: str, postal_code: str, country: str = "France"
) -> Optional[Tuple[float, float]]:
    """
    Geocode an address to GPS coordinates using Nominatim.
    Returns (latitude, longitude) or None if not found.
    Uses in-memory cache to prevent slow repeated external calls.
    """
    full_address = f"{address.strip()}, {postal_code.strip()} {city.strip()}, {country.strip()}".lower()
    now = time.time()

    # Check cache hit
    if full_address in _GEOCODE_CACHE:
        ts, cached_coords = _GEOCODE_CACHE[full_address]
        if now - ts < CACHE_TTL_SECONDS:
            return cached_coords

    async with httpx.AsyncClient(timeout=2.5) as client:
        try:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": full_address, "format": "json", "limit": 1},
                headers={"User-Agent": "Roomivo/1.0"},
            )

            if response.status_code == 200:
                results = response.json()
                if results:
                    coords = (float(results[0]["lat"]), float(results[0]["lon"]))
                    _GEOCODE_CACHE[full_address] = (now, coords)
                    return coords
        except Exception as e:
            print(f"Geocoding error: {e}")

    _GEOCODE_CACHE[full_address] = (now, None)
    return None


async def get_nearby_pois(latitude: float, longitude: float) -> Dict[str, List[str]]:
    """
    Query OpenStreetMap Overpass API for nearby points of interest.
    Returns dict with transit stops and nearby landmarks.
    Streamlined Overpass query and low timeout prevent slow response times.
    """
    now = time.time()
    grid_key = (round(latitude, 3), round(longitude, 3))

    if grid_key in _POI_CACHE:
        ts, cached_pois = _POI_CACHE[grid_key]
        if now - ts < CACHE_TTL_SECONDS:
            return cached_pois

    # Optimized Overpass query - exclude relation route regex scans which cause 20s+ latency
    overpass_query = f"""
    [out:json][timeout:5];
    (
      // Metro/Train/RER stations (800m)
      node["railway"="station"](around:800,{latitude},{longitude});
      node["railway"="subway_entrance"](around:800,{latitude},{longitude});
      node["railway"="halt"](around:800,{latitude},{longitude});

      // Tram stops (500m)
      node["railway"="tram_stop"](around:500,{latitude},{longitude});

      // Bus stops (500m)
      node["highway"="bus_stop"](around:500,{latitude},{longitude});

      // Schools & Universities (800m)
      node["amenity"="school"](around:800,{latitude},{longitude});
      node["amenity"="university"](around:1000,{latitude},{longitude});

      // Hospitals & Health (1000m)
      node["amenity"="hospital"](around:1000,{latitude},{longitude});

      // Supermarkets & Convenience (500m)
      node["shop"="supermarket"](around:500,{latitude},{longitude});
      node["shop"="convenience"](around:300,{latitude},{longitude});

      // Police (1000m)
      node["amenity"="police"](around:1000,{latitude},{longitude});

      // Pharmacies (500m)
      node["amenity"="pharmacy"](around:500,{latitude},{longitude});

      // Parks (500m)
      node["leisure"="park"](around:500,{latitude},{longitude});

      // Post offices (500m)
      node["amenity"="post_office"](around:500,{latitude},{longitude});

      // Bakeries (300m)
      node["shop"="bakery"](around:300,{latitude},{longitude});
    );
    out center tags;
    """

    overpass_endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]

    async with httpx.AsyncClient(timeout=3.0) as client:
        for endpoint in overpass_endpoints:
            try:
                response = await client.post(endpoint, data={"data": overpass_query})
                if response.status_code == 200:
                    data = response.json()
                    parsed = parse_overpass_results(data, latitude, longitude)
                    _POI_CACHE[grid_key] = (now, parsed)
                    return parsed
            except Exception as e:
                print(f"Overpass API error ({endpoint}): {e}")
                continue

    fallback = {"public_transport": [], "nearby_landmarks": []}
    _POI_CACHE[grid_key] = (now, fallback)
    return fallback


def parse_overpass_results(
    data: Dict, origin_lat: float, origin_lon: float
) -> Dict[str, List[str]]:
    """Parse Overpass API results and categorize POIs into transport and landmarks."""
    from math import asin, cos, radians, sin, sqrt

    def calculate_distance(lat1, lon1, lat2, lon2):
        """Calculate distance in meters using Haversine formula"""
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        c = 2 * asin(sqrt(a))
        return c * 6371000  # Earth radius in meters

    transport_items = []
    route_lines = set()  # Track unique route lines (e.g., "Bus 12", "Tram T1")
    landmarks = []

    for element in data.get("elements", []):
        tags = element.get("tags", {})
        elem_type = element.get("type", "")

        # --- Route Relations (bus/tram/metro lines) ---
        if elem_type == "relation" and tags.get("type") == "route":
            route_type = tags.get("route", "")
            ref = tags.get("ref", "")
            name = tags.get("name", "")
            operator = tags.get("operator", "")

            if route_type in ("bus", "tram", "subway", "light_rail"):
                emoji = {"bus": "🚌", "tram": "🚊", "subway": "🚇", "light_rail": "🚈"}.get(route_type, "🚌")
                label = route_type.replace("_", " ").title()

                if ref:
                    route_lines.add(f"{emoji} {label} {ref}")
                elif name:
                    # Truncate long route names
                    short_name = name[:50] + "..." if len(name) > 50 else name
                    route_lines.add(f"{emoji} {short_name}")
            continue

        # Get coordinates (handle both nodes and ways with center)
        if "lat" in element and "lon" in element:
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        distance = int(calculate_distance(origin_lat, origin_lon, lat, lon))
        name = tags.get("name", "")
        brand = tags.get("brand", "")

        # --- Transit stops ---
        if "railway" in tags:
            rail_type = tags["railway"]
            if rail_type in ("station", "subway_entrance", "halt"):
                line_info = tags.get("line", tags.get("ref", tags.get("operator", "")))
                network = tags.get("network", "")
                station_name = name if name else "Metro/Train Station"

                # Try to identify RER / Transilien / Metro
                if network and "RER" in network.upper():
                    transport_name = f"🚆 RER {station_name}"
                elif network and "METRO" in network.upper():
                    transport_name = f"🚇 Metro {station_name}"
                else:
                    transport_name = f"🚉 {station_name}"

                if line_info:
                    transport_name += f" (Line {line_info})"

                transport_items.append(
                    {"label": transport_name, "distance": distance}
                )

            elif rail_type == "tram_stop":
                tram_name = name if name else "Tram Stop"
                ref = tags.get("ref", "")
                transport_items.append(
                    {"label": f"🚊 {tram_name}" + (f" (Line {ref})" if ref else ""), "distance": distance}
                )

        elif "highway" in tags and tags["highway"] == "bus_stop":
            bus_name = name if name else "Bus Stop"
            route_ref = tags.get("route_ref", tags.get("ref", ""))
            if route_ref:
                bus_name += f" — Lines {route_ref}"
            transport_items.append(
                {"label": f"🚌 {bus_name}", "distance": distance}
            )

        # --- Landmarks ---
        elif "amenity" in tags:
            amenity_type = tags["amenity"]
            display_name = name or brand

            if amenity_type == "school":
                landmarks.append({"label": f"🏫 {display_name or 'School'}", "distance": distance})
            elif amenity_type == "university":
                landmarks.append({"label": f"🎓 {display_name or 'University'}", "distance": distance})
            elif amenity_type == "hospital":
                landmarks.append({"label": f"🏥 {display_name or 'Hospital'}", "distance": distance})
            elif amenity_type == "police":
                landmarks.append({"label": f"👮 {display_name or 'Police Station'}", "distance": distance})
            elif amenity_type == "pharmacy":
                landmarks.append({"label": f"💊 {display_name or 'Pharmacy'}", "distance": distance})
            elif amenity_type == "post_office":
                landmarks.append({"label": f"📮 {display_name or 'Post Office'}", "distance": distance})

        elif "shop" in tags:
            shop_type = tags["shop"]
            display_name = brand or name

            if shop_type == "supermarket":
                landmarks.append({"label": f"🛒 {display_name or 'Supermarket'}", "distance": distance})
            elif shop_type == "convenience":
                landmarks.append({"label": f"🏪 {display_name or 'Convenience Store'}", "distance": distance})
            elif shop_type == "bakery":
                landmarks.append({"label": f"🥖 {display_name or 'Bakery'}", "distance": distance})

        elif "leisure" in tags and tags["leisure"] == "park":
            landmarks.append(
                {"label": f"🌳 {name or 'Park'}", "distance": distance}
            )

    # Sort stops by distance, deduplicate
    transport_items.sort(key=lambda x: x["distance"])
    landmarks.sort(key=lambda x: x["distance"])

    # Build final lists with distance
    transport_list = [
        f"{item['label']} — {item['distance']}m"
        for item in transport_items[:8]
    ]

    # Prepend route lines summary (these don't have distances)
    sorted_routes = sorted(route_lines)
    if sorted_routes:
        transport_list = [f"📋 Routes: {', '.join(sorted_routes)}"] + transport_list

    landmark_list = [
        f"{item['label']} — {item['distance']}m"
        for item in landmarks[:10]
    ]

    # Deduplicate by removing items with identical labels (keep closest)
    seen_labels = set()
    deduped_transport = []
    for item in transport_list:
        label_key = item.split(" — ")[0] if " — " in item else item
        if label_key not in seen_labels:
            seen_labels.add(label_key)
            deduped_transport.append(item)

    seen_labels = set()
    deduped_landmarks = []
    for item in landmark_list:
        label_key = item.split(" — ")[0] if " — " in item else item
        if label_key not in seen_labels:
            seen_labels.add(label_key)
            deduped_landmarks.append(item)

    return {"public_transport": deduped_transport, "nearby_landmarks": deduped_landmarks}


async def enrich_property_location(
    address: str, city: str, postal_code: str, country: str = "France"
) -> Dict:
    """
    Main function to geocode address and get nearby POIs.
    Returns dict with coordinates and nearby transit/landmarks.
    """
    # Geocode address
    coords = await geocode_address(address, city, postal_code, country)

    if not coords:
        return {
            "success": False,
            "error": "Could not geocode address",
            "latitude": None,
            "longitude": None,
            "public_transport": [],
            "nearby_landmarks": [],
        }

    latitude, longitude = coords

    # Get nearby POIs
    pois = await get_nearby_pois(latitude, longitude)

    return {
        "success": True,
        "latitude": latitude,
        "longitude": longitude,
        "public_transport": pois["public_transport"],
        "nearby_landmarks": pois["nearby_landmarks"],
    }
