import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
    test('homepage loads and has title', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Roomivo/i);
    });

    test('login page renders', async ({ page }) => {
        await page.goto('/auth/login');
        // Should have email and password fields
        await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
        await expect(page.locator('input[type="password"]').first()).toBeVisible();
    });

    test('register page renders', async ({ page }) => {
        await page.goto('/auth/register');
        // Should have role selection or registration form
        const heading = page.locator('h1, h2').first();
        await expect(heading).toBeVisible();
    });

    test('unauthenticated user stays on dashboard but is gated by secure modal', async ({ page }) => {
        await page.goto('/dashboard');
        // Should not redirect to /auth/login, preserving URL context
        expect(page.url()).toContain('/dashboard');
        // Should render the premium "Roomivo Secure" modal. The UI defaults to
        // French, so match either localisation rather than pinning to English.
        await expect(page.locator('text=/Roomivo S(ecure|écurisé)/i').first()).toBeVisible({ timeout: 10_000 });
    });

    test('search page loads', async ({ page }) => {
        await page.goto('/search');
        await expect(page.locator('body')).toBeVisible();
        // Should have some search-related content
    });

    test('404 page for invalid route', async ({ page }) => {
        const resp = await page.goto('/this-page-does-not-exist-at-all');
        expect(resp?.status()).toBe(404);
    });
});
