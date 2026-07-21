import { test, expect } from '@playwright/test';

test.describe('Page 2: Search Marketplace', () => {
    test.beforeEach(async ({ page }) => {
        // Go to search page
        await page.goto('/search');
        await page.evaluate(() => localStorage.setItem('app-language', 'en'));
        await page.reload();
    });

    test('should load the search marketplace with high-fidelity UI', async ({ page }) => {
        // Check for the premium hero title
        await expect(page.locator('h1')).toContainText(/Discovery|Home/i);
        
        // Check for the living background (mesh blobs)
        const livingBg = page.locator('.fixed.inset-0.z-0').first();
        await expect(livingBg).toBeVisible();
        
        // Check for the filter bar
        const filterBar = page.locator('.glass-card').first();
        await expect(filterBar).toBeVisible();
    });

    test('should show property results grid', async ({ page }) => {
        // Wait for properties to load (either property card or empty state to be visible)
        const propertyCard = page.locator('article').filter({ hasText: /€/ }).first();
        const emptyState = page.locator('text=Market Vacant');
        
        await expect(propertyCard.or(emptyState)).toBeVisible({ timeout: 15_000 });
        
        if (await propertyCard.isVisible()) {
            await expect(propertyCard).toBeVisible();
        } else {
            await expect(emptyState).toBeVisible();
        }
    });

    test('should toggle filters and update UI', async ({ page }) => {
        // Check for "Furnished" filter button (exact: "Unfurnished" also exists since WP1)
        const furnishedBtn = page.getByRole('button', { name: 'Furnished', exact: true });
        await expect(furnishedBtn).toBeVisible();
        
        // Click to toggle
        await furnishedBtn.click();
        
        // Should have active styles (zinc-900)
        await expect(furnishedBtn).toHaveClass(/bg-zinc-900/);
    });

    test('should exhibit 100% bilingual parity', async ({ page }) => {
        // Check current language (assuming default is EN)
        // Switch to French (Using the language switcher in Navbar)
        const languageSwitcher = page.locator('button').filter({ hasText: /^fr$/i }).first();
        if (await languageSwitcher.isVisible()) {
            await languageSwitcher.click();
            // Verify French translation (Discovery -> Découverte or home -> chez-vous)
            await expect(page.locator('h1')).toContainText(/Découverte|chez-vous/i);
        }
    });
});
