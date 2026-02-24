"""
Location services utility for geocoding and nearby POI detection.
Uses OpenStreetMap Nominatim for geocoding and Overpass API for POI search.
"""

import asyncio
from typing import Dict, List, Optional, Tuple

import httpx


async def geocode_address(
    address: str, city: str, postal_code: str, country: str = "France"
) -> Optional[Tuple[float, float]]:
    """
    Geocode an address to GPS coordinates using Nominatim.
    Returns (latitude, longitude) or None if not found.
    """
    full_address = f"{address}, {postal_code} {city}, {country}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": full_address, "format": "json", "limit": 1},
                headers={"User-Agent": "RentalPlatform/1.0"},
            )

            if response.status_code == 200:
                results = response.json()
                if results:
                    return (float(results[0]["lat"]), float(results[0]["lon"]))
        except Exception as e:
            print(f"Geocoding error: {e}")

    return None


async def get_nearby_pois(latitude: float, longitude: float) -> Dict[str, List[Dict]]:
    """
    Query OpenStreetMap Overpass API for nearby points of interest.
    Returns dict with transit, schools, hospitals, supermarkets, etc.
    """

    # Overpass query for multiple POI types
    overpass_query = f"""
    [out:json][timeout:25];
    (
      // Metro/Train stations (500m)
      node["railway"="station"](around:500,{latitude},{longitude});
      node["railway"="subway_entrance"](around:500,{latitude},{longitude});
      
      // Bus stops (300m)
      node["highway"="bus_stop"](around:300,{latitude},{longitude});
      
      // Schools (1000m)
      node["amenity"="school"](around:1000,{latitude},{longitude});
      way["amenity"="school"](around:1000,{latitude},{longitude});
      
      // Hospitals (2000m)
      node["amenity"="hospital"](around:2000,{latitude},{longitude});
      way["amenity"="hospital"](around:2000,{latitude},{longitude});
      
      // Supermarkets (500m)
      node["shop"="supermarket"](around:500,{latitude},{longitude});
      way["shop"="supermarket"](around:500,{latitude},{longitude});
      
      // Police (2000m)
      node["amenity"="police"](around:2000,{latitude},{longitude});
      way["amenity"="police"](around:2000,{latitude},{longitude});
      
      // Pharmacies (500m)
      node["amenity"="pharmacy"](around:500,{latitude},{longitude});
      
      // Parks (800m)
      node["leisure"="park"](around:800,{latitude},{longitude});
      way["leisure"="park"](around:800,{latitude},{longitude});
    );
    out center;
    """

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                "https://overpass-api.de/api/interpreter", data={"data": overpass_query}
            )

            if response.status_code == 200:
                data = response.json()
                return parse_overpass_results(data, latitude, longitude)
        except Exception as e:
            print(f"Overpass API error: {e}")

    return {"public_transport": [], "nearby_landmarks": []}


def parse_overpass_results(
    data: Dict, origin_lat: float, origin_lon: float
) -> Dict[str, List[Dict]]:
    """Parse Overpass API results and categorize POIs"""
    from math import asin, cos, radians, sin, sqrt

    def calculate_distance(lat1, lon1, lat2, lon2):
        """Calculate distance in meters using Haversine formula"""
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        c = 2 * asin(sqrt(a))
        return c * 6371000  # Earth radius in meters

    public_transport = []
    landmarks = []

    for element in data.get("elements", []):
        tags = element.get("tags", {})

        # Get coordinates (handle both nodes and ways with center)
        if "lat" in element and "lon" in element:
            lat, lon = element["lat"], element["lon"]
        elif "center" in element:
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        else:
            continue

        distance = int(calculate_distance(origin_lat, origin_lon, lat, lon))
        name = tags.get("name", "")

        # Categorize transit
        if "railway" in tags:
            if tags["railway"] in ["station", "subway_entrance"]:
                line_info = tags.get("line", tags.get("operator", ""))
                transport_name = f"{name}" if name else "Metro/Train Station"
                if line_info:
                    transport_name += f" ({line_info})"
                public_transport.append(
                    {"name": transport_name, "type": "metro", "distance": distance}
                )

        elif "highway" in tags and tags["highway"] == "bus_stop":
            bus_lines = tags.get("route_ref", tags.get("ref", ""))
            bus_name = name if name else "Bus Stop"
            if bus_lines:
                bus_name += f" - Line {bus_lines}"
            public_transport.append(
                {"name": bus_name, "type": "bus", "distance": distance}
            )

        # Categorize landmarks
        elif "amenity" in tags:
            amenity_type = tags["amenity"]

            if amenity_type == "school":
                landmarks.append(
                    {
                        "name": name if name else "School",
                        "type": "school",
                        "distance": distance,
                    }
                )
            elif amenity_type == "hospital":
                landmarks.append(
                    {
                        "name": name if name else "Hospital",
                        "type": "hospital",
                        "distance": distance,
                    }
                )
            elif amenity_type == "police":
                landmarks.append(
                    {
                        "name": name if name else "Police Station",
                        "type": "police",
                        "distance": distance,
                    }
                )
            elif amenity_type == "pharmacy":
                landmarks.append(
                    {
                        "name": name if name else "Pharmacy",
                        "type": "pharmacy",
                        "distance": distance,
                    }
                )

        elif "shop" in tags and tags["shop"] == "supermarket":
            landmarks.append(
                {
                    "name": name if name else "Supermarket",
                    "type": "supermarket",
                    "distance": distance,
                }
            )

        elif "leisure" in tags and tags["leisure"] == "park":
            landmarks.append(
                {"name": name if name else "Park", "type": "park", "distance": distance}
            )

    # Sort by distance and limit results
    public_transport.sort(key=lambda x: x["distance"])
    landmarks.sort(key=lambda x: x["distance"])

    # Format for frontend
    transport_list = [
        f"{item['name']} - {item['distance']}m"
        for item in public_transport[:5]  # Top 5 closest
    ]

    landmark_list = [
        f"{item['name']} - {item['distance']}m"
        for item in landmarks[:8]  # Top 8 closest
    ]

    return {"public_transport": transport_list, "nearby_landmarks": landmark_list}


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
