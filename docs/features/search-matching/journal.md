# Journal — Search & AI Matching

## Purpose
Property search/filtering and AI-assisted tenant↔property recommendations by segment
(D1–D3 / S1–S3), income, guarantor and risk tier.

## Surface
- `app/routers/properties.py` (`GET /properties`, `/properties/recommendations`,
  `/properties/wishlist`), `app/services/matching_service.py`, `app/core/segment_routing.py`.
- Frontend: `/search`, `components/{SearchMap,LocationPicker,RadiusLocationPicker,AddressAutocomplete}.tsx`.

## Audit findings (verified by code review 2026-05)
- 🟢 `GET /properties` is rate-limited (60/min) and is the primary load-test target
  (`tests/load/hot_paths.js`).
- 🟢 **No N+1:** `PropertyResponse` serializes only scalar/JSON columns (`photos` is a
  JSONB column, not the `media` relationship), so list/recommendations don't lazy-load
  relationships per row — and async SQLAlchemy would raise rather than silently N+1.
- 🟡 Matching calls an external LLM (Gemini) — keep off the request hot path / cached;
  confirm it never blocks `GET /properties`.

## Backlog
- `EXPLAIN ANALYZE` the search query under the k6 baseline; ensure composite indexes match
  the common filter set (city, price, furnished, dpe_rating).
- Cache recommendations per user in Redis with a short TTL.
