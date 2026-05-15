import { test, expect } from '@playwright/test';

test.describe('Landing Page E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('app-language', 'en'));
        await page.reload();
    });

    test('hero section renders with correct title and elements', async ({ page }) => {
        // Check for the main title
        await expect(page.locator('h1').first()).toBeVisible();
        // Check for the search input
        await expect(page.locator('input[type="text"][placeholder*="Where do you want to live"]')).toBeVisible();
        // Check for the Search button
        await expect(page.locator('button[type="submit"]')).toBeVisible();
        // Check for Trending Cities
        await expect(page.getByText('Paris')).toBeVisible();
        await expect(page.getByText('Lyon')).toBeVisible();
    });

    test('value proposition bento grid renders', async ({ page }) => {
        // Check for Value Props
        await expect(page.getByText('Digital Dossier')).toBeVisible();
        await expect(page.getByText('AI-Powered Matching')).toBeVisible();
        await expect(page.getByText('French Law Compliant')).toBeVisible();
        await expect(page.getByText('Secure Payments')).toBeVisible();
    });

    test('how it works progressive steps render', async ({ page }) => {
        // Check for Steps
        await expect(page.getByText('Create Profile')).toBeVisible();
        await expect(page.getByText('Smart Matching')).toBeVisible();
        await expect(page.getByText('Automated Lease')).toBeVisible();
    });

    test('dual cta section renders with correct buttons', async ({ page }) => {
        // Tenant CTA
        const tenantBtn = page.locator('a[href="/auth/register?role=tenant"]');
        await expect(tenantBtn).toBeVisible();
        await expect(tenantBtn).toContainText('Browse Listings');

        // Landlord CTA
        const landlordBtn = page.locator('a[href="/auth/register?role=landlord"]');
        await expect(landlordBtn).toBeVisible();
        await expect(landlordBtn).toContainText('List Property');
    });

    test('language switcher changes text', async ({ page }) => {
        // Verify default english text (case-insensitive for CSS uppercase)
        await expect(page.getByText(/Browse Listings/i)).toBeVisible();

        // Click FR button using test-id
        await page.getByTestId('lang-switch-fr').click();

        // Wait for potential hydration/translation update
        await page.waitForTimeout(500);

        // Check if text changed to French (case-insensitive)
        await expect(page.getByText(/Parcourir les annonces/i)).toBeVisible();
        
        // Click EN button to revert using test-id
        await page.getByTestId('lang-switch-en').click();

        // Wait
        await page.waitForTimeout(500);

        // Verify back to English
        await expect(page.getByText(/Browse Listings/i)).toBeVisible();
    });
});
