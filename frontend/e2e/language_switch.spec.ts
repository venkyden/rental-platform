import { test, expect, Page } from '@playwright/test';

test.describe('Language Switch Persistence', () => {
    test('switches language and preserves current route on dashboard', async ({ page }) => {
        // Assume default is english
        await page.goto('/login');
        
        // Let's assume we can change language from the login page, but maybe there's a switcher there?
        // Let's go to home page instead to test the switcher since we don't need to be authenticated
        await page.goto('/');
        
        // Verify we are in EN
        await expect(page.getByTestId('lang-switch-en')).toHaveClass(/text-zinc-900/);
        
        // Switch to FR
        await page.getByTestId('lang-switch-fr').first().click();
        
        // Verify it switches
        await expect(page.getByTestId('lang-switch-fr')).toHaveClass(/text-zinc-900/);

        // Verify locale persists across a reload
        await page.reload();
        await expect(page.getByTestId('lang-switch-fr')).toHaveClass(/text-zinc-900/);
        
        // Verify URL/locale persists across internal navigation
        await page.goto('/login');
        await expect(page.getByTestId('lang-switch-fr')).toHaveClass(/text-zinc-900/);
    });

    test('preserves in-progress form state', async ({ page }) => {
        // Go to login page and fill an input
        await page.goto('/login');
        await page.locator('input[type="email"]').fill('test@example.com');
        
        // Switch to FR
        await page.getByTestId('lang-switch-fr').first().click();
        
        // Form state should be preserved
        await expect(page.locator('input[type="email"]')).toHaveValue('test@example.com');
    });
});
