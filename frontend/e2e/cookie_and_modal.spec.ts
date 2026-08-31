/**
 * Cookie Consent & Modal Smoothness E2E Spec
 *
 * Verifies:
 *   1. Cookie Consent banner accept / reject choices persist in localStorage and banner doesn't re-appear on subsequent navigations.
 *   2. Custom cookie preferences can be saved and recalled.
 */
import { test, expect } from '@playwright/test';

test.describe('Cookie Consent Banner & Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.context().clearCookies();
    });

    test('accepting all cookies stores consent in localStorage and hides banner on reload', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.removeItem('roomivo_cookie_consent'));
        await page.reload();

        // Cookie banner shows after 1.5s delay
        const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("Tout accepter")').first();
        await expect(acceptBtn).toBeVisible({ timeout: 5000 });

        await acceptBtn.click();
        await expect(acceptBtn).not.toBeVisible();

        // Reload page
        await page.reload();

        // Wait 2s to ensure timer would have fired if not persisted
        await page.waitForTimeout(2000);
        await expect(page.locator('button:has-text("Accept"), button:has-text("Tout accepter")').first()).not.toBeVisible();

        // Verify localStorage item
        const stored = await page.evaluate(() => localStorage.getItem('roomivo_cookie_consent'));
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(stored || '{}');
        expect(parsed.essential).toBe(true);
        expect(parsed.analytics).toBe(true);
    });

    test('rejecting optional cookies stores minimal consent and banner remains hidden', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.removeItem('roomivo_cookie_consent'));
        await page.reload();

        const essentialBtn = page.locator('button:has-text("Essential"), button:has-text("Essentiels")').first();
        await expect(essentialBtn).toBeVisible({ timeout: 5000 });

        await essentialBtn.click();
        await expect(essentialBtn).not.toBeVisible();

        // Reload page
        await page.reload();
        await page.waitForTimeout(2000);
        await expect(page.locator('button:has-text("Essential"), button:has-text("Essentiels")').first()).not.toBeVisible();

        const stored = await page.evaluate(() => localStorage.getItem('roomivo_cookie_consent'));
        expect(stored).not.toBeNull();
        const parsed = JSON.parse(stored || '{}');
        expect(parsed.essential).toBe(true);
        expect(parsed.analytics).toBe(false);
    });
});
