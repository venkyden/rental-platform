# Journal — Search & AI Matching

## Purpose
Property search/filtering and AI-assisted tenant↔property recommendations by segment
(D1–D3 / S1–S3), income, guarantor and risk tier.

## Surface
- `app/routers/properties.py` (`GET /properties`, `/properties/recommendations`,
  `/properties/wishlist`), `app/services/matching_service.py`, `app/core/segment_routing.py`.
- Frontend: `/search`, `components/{SearchMap,LocationPicker,RadiusLocationPicker,AddressAutocomplete}.tsx`.

## Audit findings
- 🟢 `GET /properties` is rate-limited (60/min) and is the primary load-test target
  (`tests/load/hot_paths.js`).
- 🟡 **N+1 risk:** recommendation/list endpoints should use `selectinload` for landlord +
  media to avoid per-row queries (the DB audit already added some `selectinload`; re-verify
  for the recommendations path).
- 🟡 Matching calls an external LLM (Gemini) — must stay off the request hot path / cached;
  confirm it is not blocking `GET /properties`.

## Backlog
- `EXPLAIN ANALYZE` the search query under the k6 baseline; ensure composite indexes match
  the common filter set (city, price, furnished, dpe_rating).
- Cache recommendations per user in Redis with a short TTL.
