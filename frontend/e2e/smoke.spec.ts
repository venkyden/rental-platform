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

    test('unauthenticated user is redirected from dashboard', async ({ page }) => {
        await page.goto('/dashboard');
        // Should redirect to login or show auth prompt
        await page.waitForURL(/auth|login|\//, { timeout: 10_000 });
        // Verify we're not on the dashboard anymore
        expect(page.url()).not.toContain('/dashboard');
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
