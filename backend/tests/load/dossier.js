// k6 load test — CPU-intensive Dossier compilation flow.
// This tests the endpoint for generating watermarked, stitched PDFs
// and creating share links. Keep VUs low because PDF generation is heavy.
//
//   k6 run backend/tests/load/dossier.js
//
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8000';
// If your router was mounted at /api/v1/dossiers, this is the prefix:
const API_PREFIX = '/api/v1/dossiers';

export const options = {
  vus: 3,
  duration: '30s',
  thresholds: {
    'checks{type:server_error}': ['rate<0.01'],
    // PDF generation is heavy, allow up to 3s for compilation.
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const email = `dossier_test_${__VU}_${__ITER}_${Date.now()}@example.com`;
  const regBody = JSON.stringify({
    email,
    password: 'StrongPassw0rd!23',
    full_name: 'Dossier Load Test',
    role: 'tenant',
    marketing_consent: false,
  });
  const headers = { 'Content-Type': 'application/json' };

  const reg = http.post(`${BASE_URL}/auth/register`, regBody, { headers });
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
      const authHeaders = { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // 1) Compile Dossier (Heavy Endpoint)
      const compile = http.post(`${BASE_URL}${API_PREFIX}/compile`, JSON.stringify({ role: 'tenant' }), {
        headers: authHeaders,
        timeout: '30s'
      });
      check(compile, { 'compile 201': (r) => r.status === 201 || r.status === 400 }, { type: 'server_error' });
      
      let dossierId = null;
      if (compile.status === 201) {
        dossierId = compile.json('id');
      }

      // 2) Generate Share Link
      if (dossierId) {
        const share = http.post(`${BASE_URL}${API_PREFIX}/share`, JSON.stringify({
          dossier_id: dossierId,
          expires_in_days: 7
        }), { headers: authHeaders });
        
        check(share, { 'share 201': (r) => r.status === 201 }, { type: 'server_error' });
        
        const shareUrl = share.json('url');
        const shareToken = shareUrl ? shareUrl.split('/').pop() : null;

        // 3) View Shared Link (Public Read)
        if (shareToken) {
          const viewShare = http.get(`${BASE_URL}${API_PREFIX}/share/${shareToken}`);
          check(viewShare, { 'view share 200': (r) => r.status === 200 }, { type: 'server_error' });
        }
      }
    }
  }
  sleep(1);
}
