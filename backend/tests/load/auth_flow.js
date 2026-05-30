// k6 load test — write-heavy auth flow (register -> login -> /auth/me).
// Rate limits apply (20 register / 50 login per min per IP), so keep VUs low.
//
//   k6 run backend/tests/load/auth_flow.js
//
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8000';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    // 429s are expected under the rate limiter — only count 5xx as failures.
    'checks{type:server_error}': ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function () {
  const email = `load_${__VU}_${__ITER}_${Date.now()}@example.com`;
  const body = JSON.stringify({
    email,
    password: 'StrongPassw0rd!23',
    full_name: 'Load Test',
    role: 'tenant',
    marketing_consent: false,
  });
  const headers = { 'Content-Type': 'application/json' };

  const reg = http.post(`${BASE_URL}/auth/register`, body, { headers });
  check(reg, { 'register not 5xx': (r) => r.status < 500 }, { type: 'server_error' });

  if (reg.status === 201) {
    const login = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email, password: 'StrongPassw0rd!23' }),
      { headers },
    );
    check(login, { 'login not 5xx': (r) => r.status < 500 }, { type: 'server_error' });

    const token = login.json('access_token');
    if (token) {
      const me = http.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      check(me, { 'me 200': (r) => r.status === 200 }, { type: 'server_error' });
    }
  }
  sleep(1);
}
