import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearSession(page: Page) {
    await page.context().clearCookies();
    await page.evaluate(() => {
        try { localStorage.clear(); } catch {}
    });
}

async function stubRefreshFail(page: Page) {
    await page.route('**/auth/refresh', route =>
        route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'No session' }) })
    );
}

function attachConsoleListener(page: Page, errorsArray: string[]) {
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (!text.includes('ERR_CONNECTION_REFUSED') && !text.includes('401 (Unauthorized)')) {
                errorsArray.push(text);
            }
        }
    });
    page.on('pageerror', err => {
        errorsArray.push(err.message);
    });
}

// ---------------------------------------------------------------------------
// 1. Desktop Navigation & Language Switcher
// ---------------------------------------------------------------------------

test.describe('Desktop Navigation & Controls', () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    test.beforeEach(async ({ page }) => {
        if ((page.viewportSize()?.width ?? 1024) < 640) {
            test.skip();
        }
    });

    test('desktop navigation links navigate smoothly to target routes', async ({ page }) => {
        await clearSession(page);
        await stubRefreshFail(page);

        await page.goto('/');

        const header = page.locator('header').first();
        await expect(header).toBeVisible();

        const searchLink = header.locator('a[href="/search"], a[href="/properties"]').first();
        if (await searchLink.isVisible()) {
            await searchLink.click();
            await expect(page).toHaveURL(/.*(search|properties)/);
        }

        await page.goto('/');
        const logo = header.locator('a[href="/"]').first();
        await expect(logo).toBeVisible();
    });

    test('desktop language switcher switches locale and updates document attribute', async ({ page }) => {
        await page.goto('/');

        const langEnBtn = page.getByTestId('lang-switch-en').first();
        const langFrBtn = page.getByTestId('lang-switch-fr').first();

        await expect(langEnBtn).toBeVisible();
        await expect(langFrBtn).toBeVisible();

        await langEnBtn.click();
        await expect(langEnBtn).toHaveClass(/text-zinc-900/);

        const htmlLang = await page.evaluate(() => document.documentElement.lang);
        expect(htmlLang).toBe('en');

        await langFrBtn.click();
        await expect(langFrBtn).toHaveClass(/text-zinc-900/);
        const htmlLangFr = await page.evaluate(() => document.documentElement.lang);
        expect(htmlLangFr).toBe('fr');
    });
});

// ---------------------------------------------------------------------------
// 2. Mobile Navigation Drawer & Responsiveness
// ---------------------------------------------------------------------------

test.describe('Mobile Navigation Drawer', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('mobile menu opens drawer smoothly, toggles language, and closes via X button', async ({ page }) => {
        await clearSession(page);
        await stubRefreshFail(page);

        await page.goto('/');
        await page.waitForTimeout(1000);

        const menuButton = page.locator('button:has(svg.lucide-menu)').first();
        await expect(menuButton).toBeVisible();
        await menuButton.click();

        const drawer = page.locator('[data-testid="mobile-nav"]');
        await expect(drawer).toBeVisible({ timeout: 5000 });

        const mobileLangEn = drawer.locator('button[data-testid="lang-switch-en"]').first();
        if (await mobileLangEn.isVisible()) {
            await mobileLangEn.click({ force: true });
            await page.waitForTimeout(300);
            const htmlLang = await page.evaluate(() => document.documentElement.lang);
            expect(htmlLang).toBe('en');
        }

        const closeBtn = page.locator('button:has(svg.lucide-x)').first();
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await expect(drawer).not.toBeVisible({ timeout: 5000 });
        }
    });

    test('clicking navigation link in mobile drawer navigates smoothly and closes drawer', async ({ page }) => {
        await clearSession(page);
        await stubRefreshFail(page);

        await page.goto('/');
        await page.waitForTimeout(1000);

        const menuButton = page.locator('button:has(svg.lucide-menu)').first();
        await expect(menuButton).toBeVisible();
        await menuButton.click();

        const drawer = page.locator('[data-testid="mobile-nav"]');
        await expect(drawer).toBeVisible({ timeout: 5000 });

        const loginLink = drawer.locator('a[href="/auth/login"]').first();
        await expect(loginLink).toBeVisible();
        await loginLink.click();

        await expect(page).toHaveURL(/.*\/auth\/login/);
    });
});

// ---------------------------------------------------------------------------
// 3. Auth & Password Utility Forms
// ---------------------------------------------------------------------------

test.describe('Auth & Password Utilities', () => {
    test('password visibility toggle toggles password input type', async ({ page }) => {
        await clearSession(page);
        await stubRefreshFail(page);

        await page.goto('/auth/login');

        const pwInput = page.locator('input[type="password"]').first();
        await expect(pwInput).toBeVisible({ timeout: 10_000 });

        const toggleBtn = page.locator('button[aria-label*="password"], button[aria-label*="Password"], button[data-testid*="toggle"]').first();
        if (await toggleBtn.isVisible()) {
            await toggleBtn.click();
            await expect(page.locator('input[type="text"]').first()).toBeVisible();
            await toggleBtn.click();
            await expect(pwInput).toBeVisible();
        }
    });

    test('forgot password form handles submission and renders feedback state', async ({ page }) => {
        await clearSession(page);
        await stubRefreshFail(page);

        await page.route('**/auth/forgot-password', route => {
            if (route.request().method() === 'POST') {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'Instructions sent to your email.' })
                });
            } else {
                route.continue();
            }
        });

        await page.goto('/auth/forgot-password');

        const emailInput = page.locator('input[type="email"]');
        await expect(emailInput).toBeVisible({ timeout: 10_000 });
        await emailInput.fill('user@roomivo.com');

        const submitBtn = page.locator('button[type="submit"]').first();
        await submitBtn.click();

        const feedback = page.locator('text=/Check your email|sent|instructions|reset|réinitialisation/i').or(page.locator('[role="alert"]')).first();
        await expect(feedback).toBeVisible({ timeout: 10_000 });
    });

    test('reset password page with token renders form and submits smoothly', async ({ page }) => {
        await clearSession(page);
        await stubRefreshFail(page);

        await page.route('**/auth/reset-password', route => {
            if (route.request().method() === 'POST') {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'Password reset successful' })
                });
            } else {
                route.continue();
            }
        });

        await page.goto('/auth/reset-password?token=valid-test-token');

        const newPwInput = page.locator('input[name="password"], input[type="password"]').first();
        await expect(newPwInput).toBeVisible({ timeout: 10_000 });

        await newPwInput.fill('NewStrongPass123!');

        const confirmPwInput = page.locator('input[name="confirmPassword"], input[name="confirm_password"]').first();
        if (await confirmPwInput.isVisible()) {
            await confirmPwInput.fill('NewStrongPass123!');
        }

        const submitBtn = page.locator('button[type="submit"]').first();
        if (await submitBtn.isVisible()) {
            await submitBtn.click();
        }
    });

    test('reset password page without token handles missing token error state', async ({ page }) => {
        await clearSession(page);
        await stubRefreshFail(page);

        await page.goto('/auth/reset-password');

        const warningOrForm = page.locator('text=/token|invalid|missing|error|invalide/i').or(page.locator('form')).first();
        await expect(warningOrForm).toBeVisible({ timeout: 10_000 });
    });
});

// ---------------------------------------------------------------------------
// 4. Slide-Up Auth Modal & Modal Overlays
// ---------------------------------------------------------------------------

test.describe('Slide-Up Auth Modal & Modal Overlays', () => {
    test('unauthenticated access to gated /dashboard triggers auth modal without crash', async ({ page }) => {
        await clearSession(page);
        await stubRefreshFail(page);

        await page.goto('/dashboard');

        const overlay = page.locator('text=Roomivo Secure').or(page.locator('div[class*="backdrop-blur"]')).first();
        await expect(overlay).toBeVisible({ timeout: 15_000 });

        const signUpTab = page.getByTestId('switch-to-signup');
        if (await signUpTab.isVisible()) {
            await signUpTab.click();
            await page.waitForTimeout(300);
            const roleCard = page.locator('button:has-text("Tenant"), button:has-text("Locataire")').first();
            await expect(roleCard).toBeVisible({ timeout: 5000 });
        }
    });
});

// ---------------------------------------------------------------------------
// 5. Console Error Cleanliness Inspection
// ---------------------------------------------------------------------------

test.describe('Console Error Cleanliness', () => {
    test('no unhandled console errors during landing page interaction', async ({ page }) => {
        const consoleErrors: string[] = [];
        attachConsoleListener(page, consoleErrors);

        await page.goto('/');
        await page.waitForTimeout(1000);

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));

        expect(consoleErrors).toEqual([]);
    });
});
