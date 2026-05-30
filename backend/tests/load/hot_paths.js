// k6 load test — public read hot paths (search / listings / property detail).
// These are unauthenticated GETs, safe to hammer. Run against a local backend.
//
//   k6 run backend/tests/load/hot_paths.js
//
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8000';

const listLatency = new Trend('list_latency', true);

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 25 },
        { duration: '40s', target: 50 },
        { duration: '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],          // < 1% errors
    http_req_duration: ['p(95)<500'],        // p95 under 500ms
    list_latency: ['p(95)<500'],
  },
};

export default function () {
  // 1) Listings/search — the busiest read path
  const list = http.get(`${BASE_URL}/properties?limit=20`);
  listLatency.add(list.timings.duration);
  check(list, { 'listings 200': (r) => r.status === 200 });

  // 2) Filtered search (price + furnished) — exercises query filters/indexes
  const filtered = http.get(`${BASE_URL}/properties?limit=20&furnished=true&max_price=2000`);
  check(filtered, { 'filtered 200/4xx': (r) => r.status === 200 || r.status === 422 });

  // 3) Health — cheap liveness signal under load
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health ok': (r) => r.status === 200 });

  sleep(1);
}
