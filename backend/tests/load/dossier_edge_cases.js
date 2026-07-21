// k6 load test — Dossier API Edge Cases.
// Tests error handling, duplicate calls, and invalid states.
//
//   k6 run backend/tests/load/dossier_edge_cases.js
//
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8000';
const API_PREFIX = '/api/v1/dossiers';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    'checks{type:edge_case_handled}': ['rate>0.99'],
  },
};

export function setup() {
  const email = `dossier_edge_setup_${Date.now()}@example.com`;
  const headers = { 'Content-Type': 'application/json' };
  
  const reg = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
    email, password: 'StrongPassw0rd!23', full_name: 'Edge Case Test', role: 'tenant', marketing_consent: false
  }), { headers });
  
  const login = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, password: 'StrongPassw0rd!23' }), { headers });
  return { token: login.json('access_token') };
}

export default function (data) {
  if (!data.token) return;
  const authHeaders = { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' };

  // Edge Case A: Try to fetch share link with invalid token format
      const invalidShare = http.get(`${BASE_URL}${API_PREFIX}/share/invalid_token_123`);
      check(invalidShare, { 'A - Invalid share link returns 404/400': (r) => r.status === 404 || r.status === 400 }, { type: 'edge_case_handled' });

      // Edge Case B: Try to compile dossier without any valid verified documents (Assuming this user has none right now)
      const emptyCompile = http.post(`${BASE_URL}${API_PREFIX}/compile`, JSON.stringify({ role: 'tenant' }), { headers: authHeaders });
      check(emptyCompile, { 'B - Empty compile returns 400 or 201 (graceful)': (r) => r.status === 400 || r.status === 201 }, { type: 'edge_case_handled' });

      // Edge Case C: Try to share a non-existent dossier ID
      const invalidShareCreate = http.post(`${BASE_URL}${API_PREFIX}/share`, JSON.stringify({
        dossier_id: "00000000-0000-0000-0000-000000000000",
        expires_in_days: 7
      }), { headers: authHeaders });
      check(invalidShareCreate, { 'C - Share invalid dossier returns 404': (r) => r.status === 404 }, { type: 'edge_case_handled' });
      
      // Edge Case D: Fetch my dossiers (should be empty array or successfully return list)
      const myDossiers = http.get(`${BASE_URL}${API_PREFIX}/me`, { headers: authHeaders });
      check(myDossiers, { 'D - Get my dossiers handles empty state': (r) => r.status === 200 }, { type: 'edge_case_handled' });
      
  // Edge Case E: Concurrent requests. Let's fire two simultaneous compile requests.
  const responses = http.batch([
    ['POST', `${BASE_URL}${API_PREFIX}/compile`, JSON.stringify({ role: 'tenant' }), { headers: authHeaders }],
    ['POST', `${BASE_URL}${API_PREFIX}/compile`, JSON.stringify({ role: 'tenant' }), { headers: authHeaders }]
  ]);
  check(responses, { 'E - Concurrent compiles handled without 500s': (res) => res.every(r => r.status !== 500) }, { type: 'edge_case_handled' });
  sleep(1);
}
