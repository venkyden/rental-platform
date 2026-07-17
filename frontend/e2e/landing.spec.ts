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
        await expect(page.getByRole('button', { name: 'Paris', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Lyon', exact: true })).toBeVisible();
    });

    test('value proposition bento grid renders', async ({ page }) => {
        // Check for Value Props
        await expect(page.getByText('Digital Dossier')).toBeVisible();
        // exact: the funds-card copy contains the substring "signed proof"
        await expect(page.getByText('Signed Proof', { exact: true })).toBeVisible();
        await expect(page.getByText('French Law Compliant')).toBeVisible();
        await expect(page.getByText('Your Money Stays Yours')).toBeVisible();
    });

    test('how it works progressive steps render', async ({ page }) => {
        // Check for Steps
        await expect(page.getByText('Create Profile')).toBeVisible();
        await expect(page.getByText('Smart Matching')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Automated Lease', exact: true })).toBeVisible();
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

    test('french compliance section renders', async ({ page }) => {
        await expect(page.getByText('French Data & Rental Law Compliance')).toBeVisible();
        await expect(page.getByText('Data Conservation')).toBeVisible();
        await expect(page.getByText('Right to Erasure')).toBeVisible();
    });

    test('featured listings section renders real content or honest empty state', async ({ page }) => {
        await expect(page.getByText('Featured Listings')).toBeVisible();
        // Either ≥3 real listing cards (article elements) or the landlord empty-state CTA —
        // never the old hardcoded fake cards.
        const cards = page.locator('section').filter({ hasText: 'Featured Listings' }).locator('article');
        const emptyCta = page.getByText('Publish the first verified listing in your city');
        await expect(async () => {
            const cardCount = await cards.count();
            const emptyVisible = await emptyCta.isVisible().catch(() => false);
            expect(cardCount >= 3 || emptyVisible).toBeTruthy();
        }).toPass({ timeout: 15_000 });
        await expect(page.getByText('Haussmannian Luxury Apartment')).toHaveCount(0);
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

test.describe('Landing truth (WP1)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('app-language', 'en'));
        await page.reload();
    });

    test('no dead placeholder listing links', async ({ page }) => {
        for (const fakeId of ['1', '2', '3']) {
            await expect(page.locator(`a[href="/properties/${fakeId}"]`)).toHaveCount(0);
        }
    });

    test('typology chip deep-links into search', async ({ page }) => {
        await page.getByRole('link', { name: 'T2', exact: true }).click();
        await expect(page).toHaveURL(/\/search\?typology=t2/);
    });

    test('colocation chip deep-links into search', async ({ page }) => {
        await page.getByRole('link', { name: /^colocation$/i }).first().click();
        await expect(page).toHaveURL(/\/search\?colocation=1/);
    });

    test('furnished chip deep-links into search', async ({ page }) => {
        await page.getByRole('link', { name: /^(meublé|furnished)$/i }).first().click();
        await expect(page).toHaveURL(/\/search\?furnished=true/);
    });
});

