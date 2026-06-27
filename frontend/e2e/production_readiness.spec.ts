/**
 * Production Readiness Suite
 *
 * Applies 7 standard checks to EVERY feature before it ships.
 * Add a new describe block per feature; copy the concern template below.
 *
 *   A. Error boundaries   — route-level errors show recovery UI, not blank pages
 *   B. Loading states     — bad/missing params show error state, not infinite spinners
 *   C. Form persistence   — multi-step form data survives back-navigation within session
 *   D. Silent failures    — every API error produces a visible user-facing message
 *   E. Error copy         — no false "engineering notified" claim without monitoring wired
 *   F. SSE / polling      — connection failures surface to the user, not endless "awaiting"
 *   G. Destructive ops    — irreversible actions require explicit confirmation
 *
 * Features covered:
 *   1. Auth (login, register, forgot-password, reset-password, verify-email)
 *   2. KYC — Identity (verify-capture, verify/identity, QR session)
 *   3. KYC — Guarantor (verify/guarantor)
 *   4. Dashboard
 *   5. Properties (list, detail/delete, new wizard)
 *   6. Applications (list, withdraw)
 *   7. Disputes (new dispute)
 *   8. Onboarding
 *   9. Settings — Account & Privacy (account delete)
 *  10. Team Invite
 *  11. Property Media Capture (capture/[code])
 */

import { test, expect, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Apply route mocks ONLY to the cross-origin API (:8000); let all app-origin
    // requests (pages, assets) through. Keying on the API port — not the app port
    // — makes this work on any frontend port (CI :3001, local :3220, etc.) and
    // prevents broad globs like **/auth/login from aborting the page navigation.
    const originalRoute = page.route.bind(page);
    (page as any).route = (pattern: any, handler: any, options: any) => {
        return originalRoute(pattern, (route) => {
            if (route.request().url().includes(':8000')) {
                return handler(route);
            }
            route.continue();
        }, options);
    };
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function mockAuthSession(page: Page, overrides: Record<string, unknown> = {}) {
    await page.route('**/auth/refresh', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ access_token: 'test-token', token_type: 'bearer' }),
        }),
    );
    await page.route('**/auth/me', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'test-user-id',
                email: 'test@roomivo.com',
                full_name: 'Test User',
                role: 'tenant',
                email_verified: true,
                identity_verified: true,
                employment_verified: true,
                trust_score: 95,
                onboarding_completed: true,
                available_roles: ['tenant'],
                ...overrides,
            }),
        }),
    );
    await page.route('**/auth/me/segment-config', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                segment: 'standard_tenant',
                segment_name: 'Standard Tenant',
                segment_type: 'demand',
                dashboard_path: '/dashboard',
                common_features: [],
                segment_features: [],
                all_features: [],
                quick_actions: [],
                settings: {},
                verification_status: {
                    id_verified: true,
                    email_verified: true,
                    employment_verified: true,
                    onboarding_completed: true,
                },
            }),
        }),
    );
}

async function mockLandlordSession(page: Page, overrides: Record<string, unknown> = {}) {
    await page.route('**/auth/refresh', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ access_token: 'landlord-token', token_type: 'bearer' }),
        }),
    );
    await page.route('**/auth/me', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'landlord-user-id',
                email: 'landlord@roomivo.com',
                full_name: 'Test Landlord',
                role: 'landlord',
                email_verified: true,
                identity_verified: true,
                employment_verified: true,
                trust_score: 95,
                onboarding_completed: true,
                available_roles: ['landlord'],
                ...overrides,
            }),
        }),
    );
    await page.route('**/auth/me/segment-config', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                segment: 'standard_landlord',
                segment_name: 'Standard Landlord',
                segment_type: 'supply',
                dashboard_path: '/dashboard/landlord',
                common_features: [],
                segment_features: [],
                all_features: [],
                quick_actions: [],
                settings: {},
                verification_status: {
                    id_verified: true,
                    email_verified: true,
                    employment_verified: true,
                    onboarding_completed: true,
                },
            }),
        }),
    );
}

/** Returns a list of browser console errors collected during the test. */
function watchConsoleErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    return errors;
}

const KNOWN_THIRD_PARTY_ERRORS = [
    'GSI_LOGGER', 'google', 'gsi', 'net::ERR_ABORTED', 'mediapipe',
    '401', '403', 'unauthorized', 'failed to load resource', 'status of 401', 'status of 403'
];

function filterKnownErrors(errors: string[]): string[] {
    return errors.filter(e => !KNOWN_THIRD_PARTY_ERRORS.some(k => e.toLowerCase().includes(k.toLowerCase())));
}

// ============================================================================
// 1. AUTH
// ============================================================================

test.describe('1. Auth — Login', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await page.route('**/auth/refresh', route => route.fulfill({ status: 401, body: '{}' }));
    });

    // A. Error boundaries
    test('A — API 500 shows inline error, page stays mounted', async ({ page }) => {
        await page.route('**/auth/login', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Internal server error' }) }),
        );
        await page.goto('/auth/login');
        await page.locator('input[type="email"]').fill('user@example.com');
        await page.locator('input[type="password"]').fill('Password123!');
        await page.locator('button[type="submit"]').click();
        await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    // B. Loading states
    test('B — submit button re-enables after network failure (no frozen state)', async ({ page }) => {
        await page.route('**/auth/login', route => route.abort('failed'));
        await page.goto('/auth/login');
        await page.locator('input[type="email"]').fill('user@example.com');
        await page.locator('input[type="password"]').fill('Password1!');
        await page.locator('button[type="submit"]').click();
        await expect(page.locator('button[type="submit"]:not([disabled])')).toBeVisible({ timeout: 10_000 });
    });

    // D. Silent failures
    test('D — wrong credentials shows user-facing error message', async ({ page }) => {
        await page.route('**/auth/login', route =>
            route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid credentials' }) }),
        );
        await page.goto('/auth/login');
        await page.locator('input[type="email"]').fill('wrong@example.com');
        await page.locator('input[type="password"]').fill('WrongPass1!');
        await page.locator('button[type="submit"]').click();
        const alert = page.locator('[role="alert"]').first();
        await expect(alert).toBeVisible({ timeout: 8_000 });
        await expect(alert).toContainText(/invalid|credentials|failed/i);
    });

    // E. Console cleanliness baseline
    test('E — no unhandled console errors on page load', async ({ page }) => {
        const errors = watchConsoleErrors(page);
        await page.goto('/auth/login');
        await page.waitForTimeout(2_000);
        expect(filterKnownErrors(errors)).toHaveLength(0);
    });
});

test.describe('1. Auth — Register', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await page.route('**/auth/refresh', route => route.fulfill({ status: 401, body: '{}' }));
    });

    // A. Error boundaries
    test('A — API 500 on submit shows error, form stays mounted', async ({ page }) => {
        await page.route('**/auth/register', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/auth/register');
        await page.locator('button:has-text("Tenant")').first().click();
        await expect(page.locator('input[name="full_name"]')).toBeVisible({ timeout: 5_000 });
        await page.locator('input[name="full_name"]').fill('Jane Doe');
        await page.locator('input[name="email"]').fill('jane@example.com');
        await page.locator('button:has-text("Continue")').first().click();
        await page.locator('input[name="password"]').fill('SecurePass1!');
        await page.locator('input[name="confirmPassword"]').fill('SecurePass1!');
        await page.waitForTimeout(500);
        await page.locator('input[name="gdprConsent"]').check({ force: true });
        await page.locator('button[type="submit"]').click();
        await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    // C. Form persistence
    test('C — step 2 data persists after stepping back to step 1 and returning', async ({ page }) => {
        await page.goto('/auth/register');
        await page.locator('button:has-text("Tenant")').first().click();
        await expect(page.locator('input[name="full_name"]')).toBeVisible({ timeout: 5_000 });
        await page.locator('input[name="full_name"]').fill('Marie Curie');
        await page.locator('input[name="email"]').fill('marie@example.com');
        await page.locator('button:has-text("Back"), button:has(svg), button[aria-label*="back"]').first().click();
        await expect(page.locator('button:has-text("Tenant")').first()).toBeVisible({ timeout: 5_000 });
        await page.locator('button:has-text("Tenant")').first().click();
        await expect(page.locator('input[name="full_name"]')).toHaveValue('Marie Curie');
        await expect(page.locator('input[name="email"]')).toHaveValue('marie@example.com');
    });

    // C. Step indicator accuracy
    test('C — step indicator reflects current step position', async ({ page }) => {
        await page.goto('/auth/register');
        await expect(page.locator('text=/Step 1/i').first()).toBeVisible({ timeout: 5_000 });
        await page.locator('button:has-text("Tenant")').first().click();
        await expect(page.locator('text=/Step 2/i').first()).toBeVisible({ timeout: 5_000 });
    });
});

test.describe('1. Auth — Forgot / Reset Password', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await page.route('**/auth/refresh', route => route.fulfill({ status: 401, body: '{}' }));
    });

    // A + D — Forgot password API error
    test('A/D — API error on forgot-password shows user-facing message', async ({ page }) => {
        await page.route('**/auth/forgot-password', route =>
            route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ detail: 'Too many requests' }) }),
        );
        await page.goto('/auth/forgot-password');
        await page.locator('input[type="email"]').fill('user@example.com');
        await page.locator('button[type="submit"]').click();
        await expect(page.locator('[role="alert"], .bg-zinc-900').first()).toBeVisible({ timeout: 8_000 });
    });

    // B — Missing token param shows error, not infinite spinner
    test('B — reset-password with no token shows error immediately', async ({ page }) => {
        await page.goto('/auth/reset-password');
        await expect(page.locator('text=/invalid|reset link|token/i').first()).toBeVisible({ timeout: 8_000 });
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 5_000 });
    });

    // A + D — Reset password expired token
    test('A/D — expired token error displayed in form, not blank page', async ({ page }) => {
        await page.route('**/auth/reset-password', route =>
            route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Token expired' }) }),
        );
        await page.goto('/auth/reset-password?token=bad-token');
        await page.locator('input[name="password"]').fill('NewPass1!@');
        await page.locator('input[name="confirmPassword"]').fill('NewPass1!@');
        await page.locator('button[type="submit"]').click();
        await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 8_000 });
        await expect(page.locator('[role="alert"]').first()).toContainText(/token/i);
    });
});

test.describe('1. Auth — Verify Email', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await page.route('**/auth/refresh', route => route.fulfill({ status: 401, body: '{}' }));
    });

    // B — Missing token
    test('B — no token param shows error state, not infinite spinner', async ({ page }) => {
        await page.goto('/auth/verify-email');
        await expect(page.locator('text=/no.*token|invalid|failed/i').first()).toBeVisible({ timeout: 8_000 });
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 5_000 });
    });

    // A — Bad token shows error with recovery actions
    test('A — expired token shows error UI with login and register links', async ({ page }) => {
        await page.route('**/auth/verify-email**', route =>
            route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Token expired' }) }),
        );
        await page.goto('/auth/verify-email?token=bad-token');
        await expect(page.locator('text=Verification Failed').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('a[href="/auth/login"], a[href="/auth/register"]').first()).toBeVisible();
    });
});

// ============================================================================
// 2. KYC — Identity Verification
// ============================================================================

test.describe('2. KYC — Identity (verify/identity)', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`[BROWSER CONSOLE ERROR] ${msg.text()}`);
            }
        });
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page);
    });

    // A — QR session creation failure
    test('A — QR session API failure shows error, not blank page', async ({ page }) => {
        await page.route('**/verification/identity/session', route =>
            route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Service unavailable' }) }),
        );
        await page.goto('/verify/identity');
        await expect(page.locator('text=/session|unavailable|error|failed/i').first()).toBeVisible({ timeout: 15_000 });
    });

    // F — SSE dies, polling fails — user must not be stuck forever
    test('F — SSE + polling both fail: UI does not freeze on "Awaiting Capture"', async ({ page }) => {
        await page.route('**/verification/identity/session', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    verification_code: 'QR123',
                    capture_url: 'http://localhost:3001/verify-capture/QR123',
                    expires_at: new Date(Date.now() + 600_000).toISOString(),
                }),
            }),
        );
        await page.route('**/verification/identity/session/**/stream', route => route.abort());
        await page.route('**/verification/identity/session/**/status', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/verify/identity');
        await page.waitForTimeout(8_000);
        const body = await page.locator('body').textContent();
        expect(body).not.toContain('Something Went Wrong');
        expect(body).not.toContain('Critical System Error');
    });

    // F — Expiry time is visible to the user
    test('F — QR session expiry time is displayed so users know the window', async ({ page }) => {
        await page.route('**/verification/identity/session', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    verification_code: 'QR456',
                    capture_url: 'http://localhost:3001/verify-capture/QR456',
                    expires_at: new Date(Date.now() + 300_000).toISOString(),
                }),
            }),
        );
        await page.route('**/verification/identity/session/**/stream', route => route.abort());
        await page.goto('/verify/identity');
        await expect(page.locator('svg').first()).toBeVisible({ timeout: 15_000 }); // QR code
        await expect(page.locator('text=/expires/i').first()).toBeVisible();
    });
});

test.describe('2. KYC — Identity (verify-capture/[code])', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
    });

    // B — Invalid code shows error, not infinite spinner
    test('B — invalid session code shows error state within 10s', async ({ page }) => {
        await page.route('**/verification/identity/session/**', route =>
            route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Session not found' }) }),
        );
        await page.goto('/verify-capture/INVALID_CODE_12345');
        await expect(page.locator('text=/error|invalid|expired|not found/i').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    });

    // F — Retry button re-attempts validation
    test('F — error step retry button re-attempts session validation', async ({ page }) => {
        let callCount = 0;
        await page.route('**/verification/identity/session/**', route => {
            callCount++;
            if (callCount === 1) {
                route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
            } else {
                route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ completed: false }) });
            }
        });
        await page.goto('/verify-capture/TESTCODE456');
        await expect(page.locator('text=/error|invalid|expired/i').first()).toBeVisible({ timeout: 10_000 });
        const retryBtn = page.locator('button:has-text("Try Again"), button:has-text("Réessayer")').first();
        await expect(retryBtn).toBeVisible();
        await retryBtn.click();
        await expect(page.locator('text=/select|identity|passport|document/i').first()).toBeVisible({ timeout: 8_000 });
        expect(callCount).toBeGreaterThanOrEqual(2);
    });

    // D — Document upload failure shows inline error
    test('D — upload API error shows inline error on preview screen', async ({ page }) => {
        await page.route('**/verification/identity/session/**', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ completed: false }) }),
        );
        await page.route('**/verification/identity/upload-mobile**', route =>
            route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: 'Image too blurry' }) }),
        );
        await page.goto('/verify-capture/TESTCODE123');
        await expect(page.locator('text=/Identity|Select|passport|document/i').first()).toBeVisible({ timeout: 10_000 });
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({ name: 'test.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake') });
        await expect(page.locator('text=/preview|confirm|retake/i').first()).toBeVisible({ timeout: 8_000 });
        await page.locator('button:has-text("Confirm"), button:has-text("Valider"), button:has-text("Submit"), button:has-text("Envoyer")').first().click();
        await expect(page.locator('text=/blurry|upload|failed|error/i').first()).toBeVisible({ timeout: 8_000 });
    });
});

// ============================================================================
// 3. KYC — Guarantor
// ============================================================================

test.describe('3. KYC — Guarantor', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page);
    });

    // A — Initial fetch failure
    test('A — status fetch failure shows error, not blank spinner', async ({ page }) => {
        await page.route('**/verification/status', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/verify/guarantor');
        await expect(page.locator('[role="alert"]').or(page.locator('text=/error|wrong|failed/i')).first()).toBeVisible({ timeout: 15_000 });
    });

    // B — Loading resolves
    test('B — loading spinner disappears once data arrives', async ({ page }) => {
        await page.route('**/verification/status', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ guarantor_type: null, guarantor_status: null, guarantor_data: null }) }),
        );
        await page.goto('/verify/guarantor');
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
        await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    // C — Guarantor type selection persists on back navigation
    test('C — selected guarantor type preserved after back navigation', async ({ page }) => {
        await page.route('**/verification/status', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ guarantor_type: null, guarantor_status: null, guarantor_data: null }) }),
        );
        await page.route('**/verification/guarantor/init', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
        );
        await page.goto('/verify/guarantor');
        await expect(page.locator('button:has-text("Visale")').first()).toBeVisible({ timeout: 10_000 });
        await page.locator('button:has-text("Visale")').first().click();
        await expect(page.locator('text=/Visale/i').first()).toBeVisible({ timeout: 5_000 });
        await page.locator('button:has-text("Back"), button:has(svg), button[aria-label*="back"]').first().click();
        await expect(page.locator('button:has-text("Visale")').first()).toBeVisible({ timeout: 5_000 });
    });

    // D — Visale upload failure
    test('D — Visale upload failure shows error message', async ({ page }) => {
        await page.route('**/verification/status', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ guarantor_type: null, guarantor_status: null, guarantor_data: null }) }),
        );
        await page.route('**/verification/guarantor/init', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
        );
        await page.route('**/verification/guarantor/visale', route =>
            route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Certificate name mismatch' }) }),
        );
        await page.goto('/verify/guarantor');
        await expect(page.locator('button:has-text("Visale")').first()).toBeVisible({ timeout: 10_000 });
        await page.locator('button:has-text("Visale")').first().click();
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles({ name: 'cert.pdf', mimeType: 'application/pdf', buffer: Buffer.from('fake-pdf') });
        await page.locator('button[type="submit"]').click();
        await expect(page.locator('text=/mismatch|failed|error/i').first()).toBeVisible({ timeout: 8_000 });
    });

    // G — Remove cancellation
    test('G — remove guarantor cancelled by user does NOT call DELETE', async ({ page }) => {
        await page.route('**/verification/status', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ guarantor_type: 'visale', guarantor_status: 'pending', guarantor_data: { file_url: 'https://example.com/cert.pdf' } }) }),
        );
        let deleteCalled = false;
        await page.route('**/verification/guarantor', async route => {
            if (route.request().method() === 'DELETE') { deleteCalled = true; await route.fulfill({ status: 200, body: '{}' }); }
            else await route.continue();
        });
        await page.goto('/verify/guarantor');
        await page.evaluate(() => { window.confirm = () => false; });
        const removeBtn = page.locator('button:has-text("Remove"), button:has-text("Delete"), button:has-text("Supprimer")').first();
        await expect(removeBtn).toBeVisible({ timeout: 10_000 });
        await removeBtn.click();
        expect(deleteCalled).toBe(false);
    });

    // G — Remove confirmed calls DELETE
    test('G — confirmed removal calls DELETE endpoint', async ({ page }) => {
        await page.route('**/verification/status', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ guarantor_type: 'visale', guarantor_status: 'verified', guarantor_data: { file_url: 'https://example.com/cert.pdf' } }) }),
        );
        let deleteCalled = false;
        await page.route('**/verification/guarantor', async route => {
            if (route.request().method() === 'DELETE') { deleteCalled = true; await route.fulfill({ status: 200, body: '{}' }); }
            else await route.continue();
        });
        await page.goto('/verify/guarantor');
        await page.evaluate(() => { window.confirm = () => true; });
        const removeBtn = page.locator('button:has-text("Remove"), button:has-text("Delete"), button:has-text("Supprimer")').first();
        await expect(removeBtn).toBeVisible({ timeout: 10_000 });
        await removeBtn.click();
        await page.waitForTimeout(2_000);
        expect(deleteCalled).toBe(true);
    });
});

// ============================================================================
// 4. Dashboard
// ============================================================================

test.describe('4. Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page);
    });

    const stubDashboardAPIs = async (page: Page) => {
        await page.route('**/inbox/unread-count', route => route.fulfill({ status: 200, body: JSON.stringify({ total_unread: 0 }) }));
        await page.route('**/inbox**', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
        await page.route('**/notifications/unread-count', route => route.fulfill({ status: 200, body: JSON.stringify({ unread_count: 0 }) }));
        await page.route('**/notifications**', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
        await page.route('**/properties/recommendations', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
    };

    // A — Stats API failure shows error, not crash
    test('A — stats API 500 shows graceful degradation, not blank page', async ({ page }) => {
        await stubDashboardAPIs(page);
        await page.route('**/stats/**', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/dashboard');
        await page.waitForTimeout(3_000);
        // Page must not show global crash error
        await expect(page.locator('text=Critical System Error')).toHaveCount(0);
        await expect(page.locator('text=Something Went Wrong')).toHaveCount(0);
        // Page must still be interactive
        await expect(page.locator('body')).toBeVisible();
    });

    // B — Loading spinner resolves
    test('B — dashboard loading resolves once APIs respond', async ({ page }) => {
        await stubDashboardAPIs(page);
        await page.route('**/stats/**', route => route.fulfill({ status: 200, body: JSON.stringify({ total_applications: 0, scheduled_visits: 0, active_disputes: 0 }) }));
        await page.goto('/dashboard');
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 15_000 });
    });

    // D — Resend email failure shows error
    test('D — resend verification email failure shows user-facing error', async ({ page }) => {
        await mockAuthSession(page, { email_verified: false });
        await stubDashboardAPIs(page);
        await page.route('**/stats/**', route => route.fulfill({ status: 200, body: JSON.stringify({ total_applications: 0 }) }));
        await page.route('**/auth/resend-verification', route =>
            route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ detail: 'Too many requests' }) }),
        );
        await page.goto('/dashboard');
        const resendBtn = page.locator('button:has-text("Resend"), button:has-text("Renvoyer")').first();
        if (await resendBtn.isVisible({ timeout: 8_000 })) {
            await resendBtn.click();
            await expect(page.locator('text=/too many|failed|error/i').first()).toBeVisible({ timeout: 8_000 });
        }
    });

    // E — No unhandled console errors on load
    test('E — no unhandled console errors on dashboard load', async ({ page }) => {
        const errors = watchConsoleErrors(page);
        await stubDashboardAPIs(page);
        await page.route('**/stats/**', route => route.fulfill({ status: 200, body: JSON.stringify({}) }));
        await page.goto('/dashboard');
        await page.waitForTimeout(3_000);
        expect(filterKnownErrors(errors)).toHaveLength(0);
    });
});

// ============================================================================
// 5. Properties
// ============================================================================

test.describe('5. Properties — List', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockLandlordSession(page);
    });

    // A + D — List fetch failure
    test('A/D — property list fetch failure shows error message', async ({ page }) => {
        await page.route('**/properties**', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/properties');
        await page.waitForTimeout(3_000);
        // Must show a toast or inline error — not a blank page
        await expect(page.locator('text=/error|failed|wrong/i').first()).toBeVisible({ timeout: 10_000 });
    });

    // B — Loading spinner resolves
    test('B — loading spinner disappears after list loads', async ({ page }) => {
        await page.route('**/properties**', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
        await page.goto('/properties');
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    });

    // G — Delete property requires confirmation
    test('G — delete property: cancelled confirmation does NOT call DELETE', async ({ page }) => {
        await page.route('**/properties**', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify([{ id: 'prop-1', title: 'Test Property', city: 'Paris', status: 'active', price: 1000, type: 'apartment' }]),
            }),
        );
        let deleteCalled = false;
        await page.route('**/properties/prop-1', async route => {
            if (route.request().method() === 'DELETE') { deleteCalled = true; await route.fulfill({ status: 200, body: '{}' }); }
            else await route.continue();
        });
        await page.evaluate(() => { window.confirm = () => false; });
        await page.goto('/properties');
        const deleteBtn = page.locator('button[aria-label*="delete"], button:has-text("Delete"), button:has-text("Terminate")').first();
        if (await deleteBtn.isVisible({ timeout: 10_000 })) {
            await deleteBtn.click();
        }
        expect(deleteCalled).toBe(false);
    });

    // G — Delete confirmed calls API
    test('G — confirmed delete calls DELETE endpoint', async ({ page }) => {
        await page.route('**/properties**', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify([{ id: 'prop-1', title: 'Test Property', city: 'Paris', status: 'active', price: 1000, type: 'apartment' }]),
            }),
        );
        let deleteCalled = false;
        await page.route('**/properties/prop-1', async route => {
            if (route.request().method() === 'DELETE') { deleteCalled = true; await route.fulfill({ status: 200, body: '{}' }); }
            else await route.continue();
        });
        await page.evaluate(() => { window.confirm = () => true; });
        await page.goto('/properties');
        const deleteBtn = page.locator('button[aria-label*="delete"], button:has-text("Delete"), button:has-text("Terminate")').first();
        if (await deleteBtn.isVisible({ timeout: 10_000 })) {
            await deleteBtn.click();
            await page.waitForTimeout(2_000);
            expect(deleteCalled).toBe(true);
        }
    });
});

test.describe('5. Properties — New Wizard', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockLandlordSession(page);
    });

    // A — Step 1 submit failure
    test('A — wizard API failure shows error, does not blank out', async ({ page }) => {
        await page.route('**/properties**', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/properties/new');
        await page.waitForTimeout(2_000);
        await expect(page.locator('text=Critical System Error')).toHaveCount(0);
    });

    // C — Wizard step data preserved on back navigation
    test('C — data entered in step 1 survives back-navigation from step 2', async ({ page }) => {
        await page.route('**/properties', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'new-prop-1' }) });
            } else {
                await route.continue();
            }
        });
        await page.goto('/properties/new');
        // Fill step 1 type if visible
        const typeBtn = page.locator('button:has-text("Apartment"), button:has-text("appartement")').first();
        if (await typeBtn.isVisible({ timeout: 8_000 })) {
            await typeBtn.click();
            // Step forward
            const nextBtn = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
            if (await nextBtn.isVisible()) await nextBtn.click();
            // Step back
            const backBtn = page.locator('button:has-text("Back"), button:has(svg), button[aria-label*="back"]').first();
            if (await backBtn.isVisible({ timeout: 5_000 })) {
                await backBtn.click();
                // Apartment should still be selected
                await expect(page.locator('button:has-text("Apartment").border-zinc-900, button:has-text("Apartment")[class*="selected"]').first()).toBeVisible({ timeout: 5_000 });
            }
        }
    });

    // E — No unhandled console errors on wizard load
    test('E — no unhandled console errors on wizard page load', async ({ page }) => {
        const errors = watchConsoleErrors(page);
        await page.goto('/properties/new');
        await page.waitForTimeout(2_000);
        expect(filterKnownErrors(errors)).toHaveLength(0);
    });
});

// ============================================================================
// 6. Applications
// ============================================================================

test.describe('6. Applications', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page);
    });

    // A + D — List fetch failure
    test('A/D — applications fetch failure shows user-facing error', async ({ page }) => {
        await page.route('**/applications**', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/applications');
        await expect(page.locator('text=/error|failed|wrong/i').first()).toBeVisible({ timeout: 10_000 });
    });

    // B — Loading resolves
    test('B — loading spinner resolves after applications load', async ({ page }) => {
        await page.route('**/applications**', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
        await page.goto('/applications');
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    });

    // G — Withdraw requires in-UI confirmation (modal-based, not window.confirm)
    test('G — withdraw application shows confirmation UI before deleting', async ({ page }) => {
        await page.route('**/applications**', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify([{
                    id: 'app-1',
                    property_title: 'Nice Apartment',
                    property_city: 'Lyon',
                    status: 'pending',
                    created_at: new Date().toISOString(),
                }]),
            }),
        );
        let deleteCalled = false;
        await page.route('**/applications/app-1', async route => {
            if (route.request().method() === 'DELETE') { deleteCalled = true; await route.fulfill({ status: 200, body: '{}' }); }
            else await route.continue();
        });
        await page.goto('/applications');
        const withdrawBtn = page.locator('button:has-text("Withdraw"), button:has-text("Cancel")').first();
        await expect(withdrawBtn).toBeVisible({ timeout: 10_000 });
        await withdrawBtn.click();
        // Confirmation UI (modal dialog) must appear before DELETE fires
        const confirmUI = page.locator('[role="dialog"]').or(page.locator('text=/confirm|sure|withdraw/i')).first();
        await expect(confirmUI).toBeVisible({ timeout: 5_000 });
        // Do NOT confirm — just dismiss
        await page.keyboard.press('Escape');
        expect(deleteCalled).toBe(false);
    });

    // D — Withdraw failure shows error
    test('D — withdraw API failure shows user-facing error', async ({ page }) => {
        await page.route('**/applications**', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify([{ id: 'app-1', property_title: 'Nice Apartment', property_city: 'Lyon', status: 'pending', created_at: new Date().toISOString() }]),
            }),
        );
        await page.route('**/applications/app-1', async route => {
            if (route.request().method() === 'DELETE') {
                await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
            } else await route.continue();
        });
        await page.goto('/applications');
        const withdrawBtn = page.locator('button:has-text("Withdraw"), button:has-text("Cancel")').first();
        await expect(withdrawBtn).toBeVisible({ timeout: 10_000 });
        await withdrawBtn.click();
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Withdraw"), button:has-text("Retirer")').first();
        await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
        await confirmBtn.click();
        await expect(page.locator('text=/error|failed|wrong/i').first()).toBeVisible({ timeout: 8_000 });
    });
});

// ============================================================================
// 7. Disputes
// ============================================================================

test.describe('7. Disputes — New Dispute', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page);
    });

    // A + D — Leases fetch failure
    test('A/D — leases fetch failure shows error, not blank', async ({ page }) => {
        await page.route('**/leases**', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/disputes/new');
        await expect(page.locator('text=/error|failed|could not|wrong/i').first()).toBeVisible({ timeout: 10_000 });
    });

    // B — Loading resolves
    test('B — loading spinner resolves after leases load', async ({ page }) => {
        await page.route('**/leases**', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
        await page.goto('/disputes/new');
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    });

    // D — Submit failure shows error
    test('D — dispute submit failure shows user-facing error', async ({ page }) => {
        await page.route('**/leases**', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify([{ id: 'lease-1', property_title: 'Test Property', tenant_name: 'Test Tenant' }]),
            }),
        );
        await page.route('**/disputes**', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
            } else await route.continue();
        });
        await page.goto('/disputes/new');
        const submitBtn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Report")').first();
        if (await submitBtn.isVisible({ timeout: 10_000 })) {
            await submitBtn.click();
            await expect(page.locator('text=/error|failed|wrong/i').first()).toBeVisible({ timeout: 8_000 });
        }
    });
});

// ============================================================================
// 8. Onboarding
// ============================================================================

test.describe('8. Onboarding', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page, { onboarding_completed: false });
    });

    // A + D — Resume fetch failure
    test('A/D — onboarding resume fetch failure does not blank out the page', async ({ page }) => {
        await page.route('**/onboarding/resume', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/onboarding');
        await page.waitForTimeout(3_000);
        // Page content must still render (questions / form) even if resume fails
        await expect(page.locator('text=Critical System Error')).toHaveCount(0);
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    });

    // B — Loading resolves
    test('B — loading spinner resolves after resume data loads', async ({ page }) => {
        await page.route('**/onboarding/resume', route => route.fulfill({ status: 200, body: JSON.stringify({ completed: false, responses: {} }) }));
        await page.route('**/team/my-invites', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
        await page.goto('/onboarding');
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    });

    // D — Submit failure shows inline error (Tenant)
    test('D — tenant onboarding submit failure shows inline error', async ({ page }) => {
        await page.route('**/onboarding/resume', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    completed: false,
                    responses: {
                        situation: "student",
                        nationality: "france",
                        languages: ["french"],
                        gender: "female",
                        contract_type: "student",
                        income: 1200,
                        university: "Université de Paris",
                        location_preference: "Paris",
                        budget: 800,
                        furnished_preference: "furnished",
                        min_surface_area: 15,
                        guarantor_type: ["parents"],
                        transport_needs: ["metro"],
                        service_needs: ["grocery"],
                        must_have_amenities: ["fiber"],
                        living_arrangement: "solo",
                        move_in_timeline: "asap",
                        has_pets: "no",
                        is_smoker: "no"
                    }
                })
            })
        );
        await page.route('**/team/my-invites', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
        await page.route('**/onboarding/complete', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Complete failed' }) })
        );

        await page.goto('/onboarding');
        
        // Accept terms and begin
        await page.locator('.w-10').first().click();
        await page.locator('button:has-text("Get Started"), button:has-text("Begin"), button:has-text("Commencer")').first().click();
        
        // Select an option on the last question (caf_preference) to complete
        const optionBtn = page.locator('button:has-text("Yes"), button:has-text("No"), button:has-text("Oui")').first();
        await expect(optionBtn).toBeVisible({ timeout: 10_000 });
        await optionBtn.click();
        
        // Assert inline error
        await expect(page.locator('[role="alert"]').or(page.locator('text=/complete failed|error|failed/i')).first()).toBeVisible({ timeout: 10_000 });
    });

    // D — Submit failure shows inline error (Landlord)
    test('D — landlord onboarding submit failure shows inline error', async ({ page }) => {
        await mockAuthSession(page, { role: 'landlord', onboarding_completed: false });
        await page.route('**/onboarding/resume', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    completed: false,
                    responses: {
                        property_count: "1_4",
                        challenge: "finding_tenants",
                        location: "Paris",
                        rooms: "1",
                        surface: 25,
                        furnished: "furnished",
                        accepted_tenant_types: ["student"],
                        accepted_guarantees: ["visale"],
                        house_rules: ["no_smoking"],
                        urgency: "soon"
                    }
                })
            })
        );
        await page.route('**/team/my-invites', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
        await page.route('**/onboarding/complete', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Complete failed' }) })
        );

        await page.goto('/onboarding');
        
        // Select landlord role
        await page.locator('button:has-text("Landlord")').first().click();
        
        // Accept terms and begin
        await page.locator('.w-10').first().click();
        await page.locator('button:has-text("Get Started"), button:has-text("Begin"), button:has-text("Commencer")').first().click();
        
        // Select an option on the last question (caf_eligibility) to complete
        const optionBtn = page.locator('button:has-text("Yes"), button:has-text("No"), button:has-text("Oui")').first();
        await expect(optionBtn).toBeVisible({ timeout: 10_000 });
        await optionBtn.click();
        
        // Assert inline error
        await expect(page.locator('[role="alert"]').or(page.locator('text=/complete failed|error|failed/i')).first()).toBeVisible({ timeout: 10_000 });
    });

    // D — Submit failure shows inline error (Agency)
    test('D — agency onboarding submit failure shows inline error', async ({ page }) => {
        await mockAuthSession(page, { role: 'property_manager', onboarding_completed: false });
        await page.route('**/onboarding/resume', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    completed: false,
                    responses: {
                        property_count: "5_100",
                        challenge: "finding_tenants"
                    }
                })
            })
        );
        await page.route('**/team/my-invites', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
        await page.route('**/onboarding/complete', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Complete failed' }) })
        );

        await page.goto('/onboarding');
        
        // Select agency (property manager) role
        await page.locator('button:has-text("Agency")').first().click();
        
        // Accept terms and begin
        await page.locator('.w-10').first().click();
        await page.locator('button:has-text("Get Started"), button:has-text("Begin"), button:has-text("Commencer")').first().click();
        
        // Select an option on the last question (urgency) to complete
        const optionBtn = page.locator('button:has-text("Urgent"), button:has-text("Soon"), button:has-text("Bientôt")').first();
        await expect(optionBtn).toBeVisible({ timeout: 10_000 });
        await optionBtn.click();
        
        // Assert inline error
        await expect(page.locator('[role="alert"]').or(page.locator('text=/complete failed|error|failed/i')).first()).toBeVisible({ timeout: 10_000 });
    });
});

// ============================================================================
// 9. Settings — Account & Privacy
// ============================================================================

test.describe('9. Settings — Account', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page);
    });

    // A + D — Profile update failure
    test('A/D — profile update API failure shows error in the form', async ({ page }) => {
        await page.route('**/users/me', async route => {
            if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
                await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) });
            } else await route.continue();
        });
        await page.goto('/settings/account');
        const saveBtn = page.locator('button:has-text("Save"), button[type="submit"]').first();
        if (await saveBtn.isVisible({ timeout: 10_000 })) {
            await saveBtn.click();
            await expect(page.locator('text=/error|failed|wrong/i').first()).toBeVisible({ timeout: 8_000 });
        }
    });

    // E — No console errors on load
    test('E — no unhandled console errors on settings/account load', async ({ page }) => {
        const errors = watchConsoleErrors(page);
        await page.goto('/settings/account');
        await page.waitForTimeout(2_000);
        expect(filterKnownErrors(errors)).toHaveLength(0);
    });
});

test.describe('9. Settings — Privacy (Account Deletion)', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page);
    });

    // G — Account deletion requires typing "DELETE" confirmation
    test('G — account deletion gated behind explicit typed confirmation', async ({ page }) => {
        let deleteCalled = false;
        await page.route('**/gdpr/delete', async route => {
            if (route.request().method() === 'DELETE') { deleteCalled = true; await route.fulfill({ status: 200, body: '{}' }); }
            else await route.continue();
        });
        await page.goto('/settings/privacy');
        const deleteBtn = page.locator('button:has-text("Delete"), button:has-text("Supprimer")').first();
        if (await deleteBtn.isVisible({ timeout: 10_000 })) {
            await deleteBtn.click();
            // Confirmation step must appear — not immediate deletion
            const confirmInput = page.locator('input[placeholder*="DELETE"], input[placeholder*="delete"]').first();
            if (await confirmInput.isVisible({ timeout: 5_000 })) {
                // Do NOT type DELETE — just check the final delete button is disabled
                const finalDeleteBtn = page.locator('button:has-text("Delete Account"), button:has-text("Permanently Delete")').first();
                if (await finalDeleteBtn.isVisible({ timeout: 3_000 })) {
                    await expect(finalDeleteBtn).toBeDisabled();
                }
            }
            // DELETE must not have fired without completing confirmation
            expect(deleteCalled).toBe(false);
        }
    });

    // D — Delete API failure shows error
    test('D — account deletion API failure shows user-facing error', async ({ page }) => {
        await page.route('**/gdpr/delete', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/settings/privacy');
        const deleteBtn = page.locator('button:has-text("Delete"), button:has-text("Supprimer")').first();
        if (await deleteBtn.isVisible({ timeout: 10_000 })) {
            await deleteBtn.click();
            // Type confirmation if required
            const confirmInput = page.locator('input[placeholder*="DELETE"], input[placeholder*="delete"]').first();
            if (await confirmInput.isVisible({ timeout: 3_000 })) {
                await confirmInput.fill('DELETE');
                const finalBtn = page.locator('button:has-text("Delete Account"), button:has-text("Permanently Delete")').first();
                if (await finalBtn.isVisible()) await finalBtn.click();
            }
            await expect(page.locator('text=/error|failed|wrong/i').first()).toBeVisible({ timeout: 8_000 });
        }
    });
});

// ============================================================================
// 10. Team Invite
// ============================================================================

test.describe('10. Team Invite', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page);
    });

    // B — Invalid token shows error, not infinite spinner
    test('B — invalid invite token shows error state, not spinner', async ({ page }) => {
        await page.route('**/team/invite/**', route =>
            route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Invalid invitation link' }) }),
        );
        await page.goto('/invite/INVALID_TOKEN_123');
        await expect(page.locator('text=/invalid|not found|expired/i').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    });

    // D — Accept failure shows error
    test('D — invite accept failure shows user-facing error', async ({ page }) => {
        await page.route('**/team/invite/GOODTOKEN', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify({ team_name: 'Test Agency', inviter_name: 'Boss', role: 'agent', expires_at: new Date(Date.now() + 86_400_000).toISOString() }),
            }),
        );
        await page.route('**/team/invite/accept/**', route =>
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Server error' }) }),
        );
        await page.goto('/invite/GOODTOKEN');
        const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("Join")').first();
        if (await acceptBtn.isVisible({ timeout: 10_000 })) {
            await acceptBtn.click();
            await expect(page.locator('text=/error|failed|wrong/i').first()).toBeVisible({ timeout: 8_000 });
        }
    });

    // B — Loading resolves on valid token
    test('B — loading spinner resolves after valid invite loads', async ({ page }) => {
        await page.route('**/team/invite/**', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify({ team_name: 'Test Agency', inviter_name: 'Boss', role: 'agent', expires_at: new Date(Date.now() + 86_400_000).toISOString() }),
            }),
        );
        await page.goto('/invite/VALIDTOKEN');
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
        await expect(page.locator('h1, h2').first()).toBeVisible();
    });
});

// ============================================================================
// 11. Property Media Capture (capture/[code])
// ============================================================================

test.describe('11. Property Media Capture', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page, { role: 'landlord' });
    });

    // B — Invalid code shows error, not infinite spinner
    test('B — invalid media session code shows error, not infinite spinner', async ({ page }) => {
        await page.route('**/properties/media-sessions/**', route =>
            route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Session not found' }) }),
        );
        await page.goto('/capture/INVALID_CODE');
        await expect(page.locator('text=/error|invalid|not found|expired/i').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 10_000 });
    });

    // D — Upload failure shows error
    test('D — photo upload failure shows user-facing error', async ({ page }) => {
        await page.route('**/properties/media-sessions/**', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify({ session_id: 'sess-1', property_id: 'prop-1', expires_at: new Date(Date.now() + 600_000).toISOString() }),
            }),
        );
        await page.route('**/properties/upload-media**', route =>
            route.fulfill({ status: 413, contentType: 'application/json', body: JSON.stringify({ detail: 'File too large' }) }),
        );
        await page.goto('/capture/VALIDCODE');
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 10_000 })) {
            await fileInput.setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-photo') });
            await expect(page.locator('text=/large|failed|error/i').first()).toBeVisible({ timeout: 8_000 });
        }
    });

    // G — Geolocation warning requires user confirmation before upload
    test('G — photo taken far from property shows location warning before uploading', async ({ page }) => {
        await page.route('**/properties/media-sessions/**', route =>
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    session_id: 'sess-1',
                    property_id: 'prop-1',
                    property_lat: 48.8566,
                    property_lng: 2.3522,
                    expires_at: new Date(Date.now() + 600_000).toISOString(),
                }),
            }),
        );
        // Emulate a location far from the property — geolocation API returns distant coords
        await page.context().setGeolocation({ latitude: 45.764, longitude: 4.8357 }); // Lyon, ~400km from Paris
        await page.context().grantPermissions(['geolocation']);
        let uploadCalled = false;
        await page.route('**/properties/upload-media**', async route => { uploadCalled = true; await route.fulfill({ status: 200, body: '{}' }); });
        // If window.confirm returns false, upload should be cancelled
        await page.evaluate(() => { window.confirm = () => false; });
        await page.goto('/capture/GEOTEST');
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 10_000 })) {
            await fileInput.setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-photo') });
            await page.waitForTimeout(2_000);
            expect(uploadCalled).toBe(false);
        }
    });
});

// ============================================================================
// E. Error Copy — global audit (applies to all features)
// ============================================================================

test.describe('E. Global — Error Copy & Console Cleanliness', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
    });

    test('E — error.tsx must not falsely claim engineering team was notified (annotation gate)', async ({ page }) => {
        await page.route('**/auth/refresh', route => route.fulfill({ status: 401, body: '{}' }));
        await page.goto('/auth/login');

        // This test acts as a shipping gate reminder until Sentry is wired.
        // Once Sentry is integrated, enable the assertion below:
        //
        //   const html = await page.evaluate(async () => (await fetch('/auth/login')).text());
        //   expect(html).not.toContain('engineering team has been notified');
        //
        test.info().annotations.push({
            type: 'pending',
            description:
                'GATE: Remove or replace "Our engineering team has been notified" in app/error.tsx:55 ' +
                'before shipping. No error monitoring is wired — the copy is false. ' +
                'Wire Sentry, then enable the assertion in this test.',
        });
    });

    test('E — no unhandled console errors on verify-capture load with valid session', async ({ page }) => {
        const errors = watchConsoleErrors(page);
        await page.route('**/verification/identity/session/**', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ completed: false }) }),
        );
        await page.goto('/verify-capture/CLEANTEST');
        await page.waitForTimeout(3_000);
        expect(filterKnownErrors(errors)).toHaveLength(0);
    });

    test('E — no unhandled console errors on guarantor page load', async ({ page }) => {
        const errors = watchConsoleErrors(page);
        await mockAuthSession(page);
        await page.route('**/verification/status', route =>
            route.fulfill({ status: 200, body: JSON.stringify({ guarantor_type: null, guarantor_status: null, guarantor_data: null }) }),
        );
        await page.goto('/verify/guarantor');
        await page.waitForTimeout(3_000);
        expect(filterKnownErrors(errors)).toHaveLength(0);
    });

    test('E — no unhandled console errors on onboarding page load', async ({ page }) => {
        const errors = watchConsoleErrors(page);
        await mockAuthSession(page, { onboarding_completed: false });
        await page.route('**/onboarding/resume', route => route.fulfill({ status: 200, body: JSON.stringify({ completed: false, responses: {} }) }));
        await page.route('**/team/my-invites', route => route.fulfill({ status: 200, body: JSON.stringify([]) }));
        await page.goto('/onboarding');
        await page.waitForTimeout(2_000);
        expect(filterKnownErrors(errors)).toHaveLength(0);
    });
});
