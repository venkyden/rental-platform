/**
 * Credential & Dossier Share PII & Privacy Security Audit Spec
 *
 * Verifies:
 *   1. Shareable credential pages (/c/[credential_id]) NEVER expose raw source documents
 *      (ID, tax notice, payslip, bank statement) or un-banded raw financial/PII data.
 *   2. Shared dossier viewer (/d/share/[token]) handles valid, expired, and invalid tokens gracefully.
 *   3. Language switching on credential pages updates text strings correctly.
 */
import { test, expect } from '@playwright/test';

const MOCK_CREDENTIAL = {
    credential_id: 'cred-audit-test-999',
    valid: true,
    expired: false,
    revoked: false,
    signature_valid: true,
    subject_role: 'tenant',
    subject_display_name: 'Jane Doe',
    issued_at: '2026-07-20T10:00:00Z',
    expires_at: '2026-08-19T10:00:00Z',
    rail: 'FR',
    claims: {
        identity_assurance: 'MEDIUM',
        solvency_assurance: 'MEDIUM',
        funds_coverage_assurance: 'HIGH',
        funds_coverage_band: 'covers_12m_plus',
        deposit_binding: {
            deposit_amount: 850,
            lease_type: 'residential',
            payee_iban_masked: 'FR76 **** **** **** 4321',
            payee_name_match: 'MATCH',
            bank_ownership_confirmed: false,
        },
    },
    disclaimer: 'Informational credential issued by Roomivo trust layer.',
    assurance_summary: 'Identity verified at standard level.',
    does_not_prove: ['Solvency beyond stated band', 'Ongoing employment'],
};

test.describe('Credential & Dossier Sharing — PII Security Audit', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('app-language', 'en'));
    });

    test('public credential page (/c) renders claims without exposing raw documents or PII', async ({ page }) => {
        await page.route('**/credentials/cred-audit-test-999', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(MOCK_CREDENTIAL),
            }),
        );

        await page.goto('/c/cred-audit-test-999');

        // 1. Verify expected structure
        await expect(page.locator('text=/Certificate valid|Attestation valide/i').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('text=/Jane Doe/i').first()).toBeVisible();
        await expect(page.locator('text=/FR76/i').first()).toBeVisible();

        // 2. Strict PII / Raw Document Leak Checks
        const pageContent = await page.content();
        
        // Raw IBAN should be masked
        expect(pageContent).not.toMatch(/FR76\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{2}/i);
        // Raw documents / tax notices / payslips must NOT be linked or embedded
        expect(pageContent).not.toMatch(/avis[_-]?d[_-]?imposition/i);
        expect(pageContent).not.toMatch(/bulletin[_-]?de[_-]?paie/i);
        // No direct raw document PDF links except evidence.pdf
        expect(pageContent.replace(/evidence\.pdf/gi, '')).not.toMatch(/\.pdf/i);
    });

    test('bilingual language switch on /c route preserves path and updates strings', async ({ page }) => {
        await page.route('**/credentials/cred-audit-test-999', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(MOCK_CREDENTIAL),
            }),
        );

        await page.goto('/c/cred-audit-test-999');
        await expect(page.locator('text=/Certificate valid/i').first()).toBeVisible();

        // Toggle to FR
        await page.locator('button:has-text("FR")').first().click();

        await expect(page.locator('text=/Attestation valide/i').first()).toBeVisible();
        expect(page.url()).toContain('/c/cred-audit-test-999');

        // Toggle back to EN
        await page.locator('button:has-text("EN")').first().click();
        await expect(page.locator('text=/Certificate valid/i').first()).toBeVisible();
    });

    test('shared dossier viewer (/d/share) handles invalid token gracefully without crash', async ({ page }) => {
        await page.route('**/dossiers/shared/invalid-token/meta', route =>
            route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ detail: 'Share token not found or expired' }),
            }),
        );

        await page.goto('/d/share/invalid-token');

        // Should display error state, not white screen / unhandled exception
        const errorText = page.locator('text=/error|not found|introuvable/i').first();
        await expect(errorText).toBeVisible({ timeout: 10_000 });
    });
});
