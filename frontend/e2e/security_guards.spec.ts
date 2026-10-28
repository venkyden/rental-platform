/**
 * Security guards for the accepted CSP risk (docs/security/csp-unsafe-inline.md).
 *
 * script-src keeps 'unsafe-inline' (Next.js nonces would make every page dynamic).
 * That is only acceptable while nothing renders raw HTML and the rest of the CSP
 * stays strict, so both are pinned here and a change has to be deliberate.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FRONTEND = join(__dirname, '..');

// Every raw-HTML sink must be JSON-LD with '<' escaped. Adding one is a review decision.
const RAW_HTML_ALLOWED = ['app/layout.tsx', 'app/page.tsx', 'app/properties/[id]/page.tsx'];

test('raw HTML is only used for escaped JSON-LD', () => {
    let out = '';
    try {
        out = execFileSync('grep', ['-rl', 'dangerouslySetInnerHTML', 'app', 'components', 'lib'], { cwd: FRONTEND }).toString();
    } catch (err: any) {
        if (err.status !== 1) throw err; // grep exits 1 when nothing matches
    }
    const hits = out.split('\n').filter(Boolean).sort();
    expect(hits).toEqual([...RAW_HTML_ALLOWED].sort());
    for (const file of hits) {
        expect(readFileSync(join(FRONTEND, file), 'utf8')).toContain('.replace(/</g');
    }
});

test('the CSP keeps its strict directives', async ({ request }) => {
    for (const path of ['/', '/auth/login']) {
        const csp = (await request.get(path)).headers()['content-security-policy'] ?? '';
        expect(csp, path).toContain("default-src 'self'");
        expect(csp, path).toContain("frame-ancestors 'none'");
        expect(csp, path).toContain("object-src 'none'");
        expect(csp, path).toContain("base-uri 'self'");
        expect(csp, path).toContain("form-action 'self'");
        expect(csp, path).not.toContain("'unsafe-eval'");
        expect(csp, path).not.toMatch(/script-src[^;]*(\*|https:(?!\/\/))/);
    }
});
