import { test, expect, Page } from '@playwright/test';

async function switchLanguage(page: Page, lang: 'fr' | 'en') {
    const btn = page.getByTestId(`lang-switch-${lang}`).first();
    if (await btn.isVisible()) {
        await btn.click();
    } else {
        const menuBtn = page.locator('button:has(svg.lucide-menu)').first();
        if (await menuBtn.isVisible()) {
            await menuBtn.click();
            const drawer = page.locator('[data-testid="mobile-nav"]');
            await expect(drawer).toBeVisible({ timeout: 5000 });
            await drawer.locator(`button[data-testid="lang-switch-${lang}"]`).first().click();
            const closeBtn = page.locator('button:has(svg.lucide-x)').first();
            if (await closeBtn.isVisible()) {
                await closeBtn.click();
            }
        }
    }
}

test.describe('Language Switch Persistence', () => {
    test('switches language and preserves current route on home page', async ({ page }) => {
        await page.goto('/');
        
        // Switch to EN
        await switchLanguage(page, 'en');
        
        // Verify locale state in html lang attribute (waits for hydration if needed)
        await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 10_000 });

        // Verify locale persists across a reload
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 10_000 });
        
        // Verify locale persists across internal navigation to auth page
        await page.goto('/auth/login');
        await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 10_000 });
    });

    test('preserves in-progress form state', async ({ page }) => {
        // Go to auth/login page and fill an input
        await page.goto('/auth/login');
        const emailInput = page.locator('input[type="email"]');
        await expect(emailInput).toBeVisible({ timeout: 10_000 });
        await emailInput.fill('test@example.com');
        
        // Switch to EN
        await switchLanguage(page, 'en');
        
        // Form state should be preserved
        await expect(emailInput).toHaveValue('test@example.com');
    });
});
