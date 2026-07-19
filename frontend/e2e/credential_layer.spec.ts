/**
 * Credential layer UX — the explainer must give the feature context and the
 * issue → share flow must work from the verification page.
 */
import { test, expect, Page } from '@playwright/test';

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
            }),
        }),
    );
}

const VERIFIED_STATUS = {
    identity_verified: true,
    identity_assurance: 'MEDIUM',
    employment_verified: false,
    income_verified: true,
    income_status: 'verified',
    solvency_verified: true,
    ownership_verified: false,
    kbis_verified: false,
    carte_g_verified: false,
    identity_data: { verified: true, status: 'verified' },
    employment_data: null,
    ownership_data: null,
    income_data: null,
    guarantor_type: null,
    guarantor_status: 'unverified',
    guarantor_assurance: null,
    guarantor_data: { file_count: 0 },
    visale_id: null,
    garantme_ref: null,
    trust_score: 95,
};

test.describe('Credential layer — verification page', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page);
        await page.route('**/verification/status', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VERIFIED_STATUS) }),
        );
    });

    test('explainer gives the feature context before the generate button', async ({ page }) => {
        await page.goto('/verification');
        await expect(page.locator('text=/without handing over your documents/i').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('text=/Leboncoin/i').first()).toBeVisible();
        await expect(page.locator('text=/expires after 30 days/i').first()).toBeVisible();
        await expect(page.locator('button:has-text("Generate my verified certificate")').first()).toBeVisible();
    });

    test('issuing a credential shows the bilingual share panel', async ({ page }) => {
        await page.route('**/credentials/issue-mine', route =>
            route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    credential_id: 'cred-test-123456',
                    subject_role: 'tenant',
                    subject_display_name: 'Test User',
                    issued_at: '2026-07-19T12:00:00Z',
                    expires_at: '2026-08-18T12:00:00Z',
                    rail: 'FR',
                    claims: { identity_assurance: 'MEDIUM' },
                    disclaimer: 'test',
                    signature: 'sig',
                    kid: 'k1',
                    shareable_url: 'https://roomivo.app/c/cred-test-123456',
                }),
            }),
        );
        await page.goto('/verification');
        await page.locator('button:has-text("Generate my verified certificate")').first().click();
        await expect(page.locator('text=/Certificate issued/i').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('text=/c\\/cred-test-123456/').first()).toBeVisible();
        await expect(page.locator('text=/Anti-phishing tip/i').first()).toBeVisible();
    });

    test('guarantor tab explains the credential as the no-guarantor alternative', async ({ page }) => {
        await page.goto('/verification');
        await page.locator('button:has-text("Guarantor")').first().click();
        await expect(page.locator('text=/No guarantor\\? You have something better/i').first()).toBeVisible({ timeout: 10_000 });
    });

    test('explainer is French for French users', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'fr'));
        await page.goto('/verification');
        await expect(page.locator('text=/sans transmettre vos documents/i').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('button:has-text("Générer mon attestation vérifiée")').first()).toBeVisible();
    });
});

test.describe('Credential layer — guarantor selection page', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
        await mockAuthSession(page);
        await page.route('**/verification/status', route =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VERIFIED_STATUS) }),
        );
    });

    test('selection screen pitches the verified profile as guarantor alternative', async ({ page }) => {
        await page.goto('/verify/guarantor');
        await expect(page.locator('text=/No guarantor\\? You have something better/i').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('a:has-text("Generate my certificate")').first()).toBeVisible();
    });
});
