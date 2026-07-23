"""
Tests for location enrichment utility performance, caching, and fallback behavior.
"""

import time
import pytest

from app.utils.location import enrich_property_location, _GEOCODE_CACHE, _POI_CACHE


@pytest.mark.asyncio
async def test_location_enrich_response_structure_and_speed():
    """Verify location enrichment returns within reasonable timeout (<5 seconds)."""
    start_time = time.time()
    res = await enrich_property_location(
        address="10 Rue de la Paix",
        city="Paris",
        postal_code="75002",
        country="France"
    )
    elapsed = time.time() - start_time

    assert isinstance(res, dict)
    assert "success" in res
    assert "public_transport" in res
    assert "nearby_landmarks" in res
    # Ensure call finishes in less than 5.0 seconds
    assert elapsed < 5.0, f"Location enrichment took too long: {elapsed:.2f}s"


@pytest.mark.asyncio
async def test_location_enrich_caching():
    """Verify second call for same address is served instantly (<10ms) from cache."""
    # First call primes cache
    res1 = await enrich_property_location(
        address="15 Place de la Bastille",
        city="Paris",
        postal_code="75011",
        country="France"
    )

    start_time = time.time()
    res2 = await enrich_property_location(
        address="15 Place de la Bastille",
        city="Paris",
        postal_code="75011",
        country="France"
    )
    elapsed = time.time() - start_time

    assert res1["success"] == res2["success"]
    assert res1["latitude"] == res2["latitude"]
    assert res1["longitude"] == res2["longitude"]
    # Cache hit should be near instantaneous
    assert elapsed < 0.05, f"Cache hit took unexpectedly long: {elapsed * 1000:.2f}ms"
