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
        // Check for the Search button (the credential verify box also has a submit button)
        await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
        // Check for Trending Cities
        await expect(page.getByRole('button', { name: 'Paris', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Lyon', exact: true })).toBeVisible();
    });

    test('value proposition bento grid renders', async ({ page }) => {
        // Check for Value Props ("Why Roomivo?" is a badge chip, not a heading)
        await expect(page.getByText('Why Roomivo?')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Evidence you can keep' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Landlords are verified too' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'French law, built in' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Your Money Stays Yours' })).toBeVisible();
    });

    test('how it works progressive steps render', async ({ page }) => {
        // Check for Steps
        await expect(page.getByRole('heading', { name: 'Get verified', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Search & apply' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Sign & move in' })).toBeVisible();
    });

    test('credential layer section renders', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'One verification. Portable, signed proof.' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Both sides verified' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Nothing left to leak' })).toBeVisible();
        // Verify-by-code box (anti-phishing: type the code, don't trust the link)
        await expect(page.getByPlaceholder('Credential code')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Check' })).toBeVisible();
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

    test('featured section renders real listings or the city grid', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Find a home in your city' })).toBeVisible();
        // Either ≥3 real listing cards (article elements) or the honest city-exploration
        // grid — never fake property cards.
        const cards = page.locator('article');
        const cityGrid = page.getByText('Haussmannian apartments, studios and flatshares');
        await expect(async () => {
            const cardCount = await cards.count();
            const cityVisible = await cityGrid.isVisible().catch(() => false);
            expect(cardCount >= 3 || cityVisible).toBeTruthy();
        }).toPass({ timeout: 15_000 });
        await expect(page.getByText('Haussmannian Luxury Apartment')).toHaveCount(0);
    });

    test('language switcher changes text', async ({ page }) => {
        // "Browse Listings"/"Browse listings" appears in several sections — anchor on the tenant CTA
        const tenantBtn = page.locator('a[href="/auth/register?role=tenant"]');

        // Verify default english text
        await expect(tenantBtn).toContainText(/Browse Listings/i);

        // Click FR button using test-id
        await page.getByTestId('lang-switch-fr').click();

        // Wait for potential hydration/translation update
        await page.waitForTimeout(500);

        // Check if text changed to French
        await expect(tenantBtn).toContainText(/Parcourir les annonces/i);

        // Click EN button to revert using test-id
        await page.getByTestId('lang-switch-en').click();

        // Wait
        await page.waitForTimeout(500);

        // Verify back to English
        await expect(tenantBtn).toContainText(/Browse Listings/i);
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
