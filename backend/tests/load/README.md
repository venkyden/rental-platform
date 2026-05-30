# Load tests (k6)

Stress tests for Roomivo's hot paths, per the "load test key routes before going
live" guardrail in `.agent/rules/master_rules.md`.

## Prerequisites
- [k6](https://k6.io/docs/get-started/installation/) installed (`brew install k6`)
- Backend running locally: `cd backend && uvicorn app.main:app --port 8000`

## Run
```bash
# Public read paths (search/listings) — safe, no writes
k6 run backend/tests/load/hot_paths.js

# Override base URL or load shape
BASE_URL=http://127.0.0.1:8000 k6 run backend/tests/load/hot_paths.js
```

## Thresholds (fail the run if breached)
- `http_req_failed` < 1%
- `http_req_duration` p95 < 500ms (read paths)

`auth_flow.js` exercises register → login → /auth/me and records p95 for the
write-heavy auth path (rate-limited to 20 register / 50 login per minute per IP,
so it runs at low VU counts by design).
