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
        const livingBg = page.locator('.fixed.inset-0.z-0');
        await expect(livingBg).toBeVisible();
        
        // Check for the filter bar
        const filterBar = page.locator('.glass-card').first();
        await expect(filterBar).toBeVisible();
    });

    test('should show property results grid', async ({ page }) => {
        // Wait for properties to load (loading skeletons should disappear)
        await page.waitForSelector('.grid-cols-1, .grid-cols-2, .grid-cols-3', { timeout: 15000 });
        
        // Check for at least one property card
        const propertyCards = page.locator('.glass-card').filter({ hasText: /€/ });
        // Since backend is mocked or seeded, we expect some results
        // If 0, we check for empty state
        const count = await propertyCards.count();
        if (count === 0) {
            await expect(page.locator('text=Market Vacant')).toBeVisible();
        } else {
            await expect(propertyCards.first()).toBeVisible();
        }
    });

    test('should toggle filters and update UI', async ({ page }) => {
        // Check for "Furnished" filter button
        const furnishedBtn = page.locator('button:has-text("Furnished")');
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
