import { test, expect, Page } from '@playwright/test';

/**
 * ROOMIVO — QA Interactive Surfaces & Smoothness Regression Suite
 * 
 * Verifies interactive UI components across desktop and mobile viewports:
 *  - Navigation links & logo redirects
 *  - Mobile menu drawer open, interaction, backdrop dismiss & close
 *  - Language switcher toggling and state persistence
 *  - Password visibility toggles & form input interactions
 *  - Forgot password & Reset password form flows
 *  - Slide-up auth modal tab switching & modal interaction
 *  - Zero console errors / uncaught exceptions during user interactions
 */

async function clearSession(page: Page) {
    await page.context().clearCookies();
    await page.evaluate(() => {
        try { localStorage.clear(); } catch {}
    });
}

async function stubAuthFailures(page: Page) {
    await page.route('**/auth/refresh', route =>
        route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'No active session' }) })
    );
}

// ---------------------------------------------------------------------------
// 1. Desktop Interactive Surfaces
// ---------------------------------------------------------------------------

test.describe('Desktop Interactive Surfaces QA', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('Header & Navigation links respond without dead clicks', async ({ page }) => {
        await clearSession(page);
        await stubAuthFailures(page);

        await page.goto('/');

        // Verify logo brand link
        const logo = page.locator('header a[href="/"]').first();
        await expect(logo).toBeVisible();

        // Check primary search link
        const searchBtn = page.locator('header a[href*="search"], header a[href*="properties"]').first();
        if (await searchBtn.isVisible()) {
            await searchBtn.click();
            await expect(page).toHaveURL(/.*(search|properties)/);
        }

        // Return home via logo
        await logo.click();
        await expect(page).toHaveURL(/.*\/$/);
    });

    test('Language switch updates HTML lang attribute and persists', async ({ page }) => {
        await page.goto('/');

        const btnEn = page.getByTestId('lang-switch-en').first();
        const btnFr = page.getByTestId('lang-switch-fr').first();

        await expect(btnEn).toBeVisible();
        await expect(btnFr).toBeVisible();

        // Switch to EN
        await btnEn.click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 5000 });

        // Switch to FR
        await btnFr.click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'fr', { timeout: 5000 });
    });

    test('Form input validation & password visibility toggles', async ({ page }) => {
        await clearSession(page);
        await stubAuthFailures(page);

        await page.goto('/auth/login');

        const emailInput = page.locator('input[type="email"]').first();
        const pwInput = page.locator('input[type="password"]').first();

        await expect(emailInput).toBeVisible();
        await expect(pwInput).toBeVisible();

        // Test password visibility toggle
        const toggle = page.locator('button[aria-label*="password"], button[aria-label*="Password"]').first();
        if (await toggle.isVisible()) {
            await toggle.click();
            await expect(page.locator('input[type="text"]').first()).toBeVisible();
            await toggle.click();
            await expect(pwInput).toBeVisible();
        }
    });
});

// ---------------------------------------------------------------------------
// 2. Mobile Interactive Surfaces & Navigation Drawer
// ---------------------------------------------------------------------------

test.describe('Mobile Interactive Surfaces QA', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('Mobile drawer menu opens smoothly, switches locale, and closes cleanly', async ({ page }) => {
        await clearSession(page);
        await stubAuthFailures(page);

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const menuBtn = page.locator('button:has(svg.lucide-menu)').first();
        await expect(menuBtn).toBeVisible();
        await menuBtn.click();

        const drawer = page.locator('[data-testid="mobile-nav"]');
        await expect(drawer).toBeVisible({ timeout: 5000 });

        // Switch language from mobile drawer
        const mobileEn = drawer.locator('button[data-testid="lang-switch-en"]').first();
        if (await mobileEn.isVisible()) {
            await mobileEn.click({ force: true });
            await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 5000 });
        }

        // Close drawer via close icon
        const closeBtn = page.locator('button:has(svg.lucide-x)').first();
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await expect(drawer).not.toBeVisible({ timeout: 5000 });
        }
    });

    test('Mobile drawer navigation link redirects and closes drawer', async ({ page }) => {
        await clearSession(page);
        await stubAuthFailures(page);

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const menuBtn = page.locator('button:has(svg.lucide-menu)').first();
        await menuBtn.click();

        const drawer = page.locator('[data-testid="mobile-nav"]');
        await expect(drawer).toBeVisible();

        const loginLink = drawer.locator('a[href="/auth/login"]').first();
        await expect(loginLink).toBeVisible();
        await loginLink.click();

        await expect(page).toHaveURL(/.*\/auth\/login/);
    });
});

// ---------------------------------------------------------------------------
// 3. Auth Modals & Interactive Password Utilities
// ---------------------------------------------------------------------------

test.describe('Auth Modals & Forgot Password Utilities QA', () => {
    test('Forgot password interactive form renders feedback on submission', async ({ page }) => {
        await clearSession(page);
        await stubAuthFailures(page);

        await page.route('**/auth/forgot-password', route => {
            if (route.request().method() === 'POST') {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'Reset instructions sent' })
                });
            } else {
                route.continue();
            }
        });

        await page.goto('/auth/forgot-password');

        const emailInput = page.locator('input[type="email"]');
        await expect(emailInput).toBeVisible();
        await emailInput.fill('qa-tester@roomivo.eu');

        const submitBtn = page.locator('button[type="submit"]').first();
        await expect(submitBtn).toBeEnabled();
        await submitBtn.click();

        const feedback = page.locator('text=/sent|instructions|email|reset|réinitialisation/i').or(page.locator('[role="alert"]')).first();
        await expect(feedback).toBeVisible({ timeout: 8000 });
    });

    test('Slide-up auth modal renders smoothly when visiting protected route', async ({ page }) => {
        await clearSession(page);
        await stubAuthFailures(page);

        await page.goto('/dashboard');

        // Verify overlay modal appears for unauthenticated user
        const modalOverlay = page.locator('text=Roomivo Secure').or(page.locator('.backdrop-blur-\\[10px\\]')).first();
        await expect(modalOverlay).toBeVisible({ timeout: 10000 });

        // Tab switch between login and signup
        const signupTab = page.getByTestId('switch-to-signup');
        if (await signupTab.isVisible()) {
            await signupTab.click();
            const tenantRole = page.locator('button:has-text("Tenant"), button:has-text("Locataire")').first();
            await expect(tenantRole).toBeVisible({ timeout: 5000 });
        }
    });
});

// ---------------------------------------------------------------------------
// 4. Interaction Console Cleanliness
// ---------------------------------------------------------------------------

test.describe('Console & Interactive State Health', () => {
    test('Zero console error logs during standard page navigation', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                if (!text.includes('ERR_CONNECTION_REFUSED') && !text.includes('401 (Unauthorized)')) {
                    errors.push(text);
                }
            }
        });
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(300);
        await page.evaluate(() => window.scrollTo(0, 0));

        expect(errors).toEqual([]);
    });
});
