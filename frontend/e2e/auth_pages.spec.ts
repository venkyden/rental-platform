import { test, expect } from '@playwright/test';

/**
 * Auth pages E2E — covers the pass-1/pass-2 hardening:
 * accessibility (labelled inputs, announced errors, password-toggle aria),
 * client-side input validation, and FR/EN i18n.
 *
 * These tests exercise the static page behaviour (no backend mock needed) so
 * they stay stable regardless of API state.
 */

test.describe('Auth — Login page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('app-language', 'en');
            localStorage.removeItem('access_token');
        });
        await page.context().clearCookies();
    });

    test('renders accessible, labelled email + password inputs', async ({ page }) => {
        await page.goto('/auth/login');

        const email = page.locator('#email');
        const password = page.locator('#password');
        await expect(email).toBeVisible();
        await expect(password).toBeVisible();

        // Labels are programmatically associated (htmlFor → id).
        await expect(page.locator('label[for="email"]')).toBeVisible();
        await expect(page.locator('label[for="password"]')).toBeVisible();
    });

    test('password visibility toggle exposes an aria-label and flips type', async ({ page }) => {
        await page.goto('/auth/login');
        const password = page.locator('#password');
        await password.fill('secret123');
        await expect(password).toHaveAttribute('type', 'password');

        const toggle = page.getByRole('button', { name: /show password|hide password/i });
        await expect(toggle).toBeVisible();
        await toggle.click();
        await expect(password).toHaveAttribute('type', 'text');
    });

    test('invalid email is caught client-side and announced via role=alert', async ({ page }) => {
        await page.goto('/auth/login');
        // "a@b" satisfies the browser's native type=email check but fails our
        // stricter isValidEmail (requires a dotted domain) — so it exercises the
        // JS validation layer rather than being blocked by the native popup.
        await page.locator('#email').fill('a@b');
        await page.locator('#password').fill('whatever123');
        await page.locator('button[type="submit"]').click();

        // Scope to OUR alert banner — Next injects its own empty
        // #__next-route-announcer__ with role="alert".
        const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
        await expect(alert).toBeVisible();
        await expect(alert).toContainText(/valid email/i);
    });

    test('empty password is caught client-side', async ({ page }) => {
        await page.goto('/auth/login');
        await page.locator('#email').fill('user@example.com');
        // Strip `required` from BOTH fields so the browser's native popup doesn't
        // pre-empt our JS validation, then submit the form programmatically
        // (avoids native constraint validation entirely — stable cross-browser).
        await page.locator('#email').evaluate((el: HTMLInputElement) => el.removeAttribute('required'));
        await page.locator('#password').evaluate((el: HTMLInputElement) => el.removeAttribute('required'));
        await page.locator('#password').evaluate((el: HTMLInputElement) =>
            el.closest('form')?.requestSubmit()
        );

        const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
        await expect(alert).toBeVisible();
        await expect(alert).toContainText(/password/i);
    });
});

test.describe('Auth — i18n parity (FR/EN)', () => {
    test('login page renders French copy when language is fr', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('app-language', 'fr'));
        await page.goto('/auth/login');

        // French login title ("Bon retour parmi nous") — proves no English leakage.
        await expect(page.locator('h2')).toContainText(/Bon retour/i);
    });

    test('login page renders English copy when language is en', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('app-language', 'en'));
        await page.goto('/auth/login');
        await expect(page.locator('h2')).toContainText(/Welcome back/i);
    });
});

test.describe('Auth — secondary pages', () => {
    test('forgot-password page is labelled and reachable', async ({ page }) => {
        await page.goto('/auth/forgot-password');
        await expect(page.locator('label[for="email"]')).toBeVisible();
        await expect(page.locator('#email')).toBeVisible();
    });

    test('forgot-email page shows a neutral message and never reveals an address', async ({ page }) => {
        // Mock ONLY the backend API POST (port 8000) — not the Next page route,
        // which shares the /auth/forgot-email path. Matching POST avoids hijacking
        // the page navigation (a GET) and rendering raw JSON.
        await page.route(/:8000\/auth\/forgot-email/, async (route) => {
            if (route.request().method() !== 'POST') {
                await route.fallback();
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: "If an account matches the details you provided, we've sent a reminder to its email address.",
                }),
            });
        });

        await page.goto('/auth/forgot-email');
        await expect(page.locator('#fullName')).toBeVisible();
        await page.locator('#fullName').fill('Some Person');
        await page.locator('#phone').fill('+33611223344');
        await page.locator('button[type="submit"]').click();

        // Neutral confirmation heading appears…
        await expect(page.locator('h2')).toContainText(/check your inbox|consultez/i);
        // …with neutral body copy, and WITHOUT the old oracle's "Your email
        // address is" masked-email reveal.
        await expect(page.getByText(/if an account matches/i)).toBeVisible();
        await expect(page.getByText(/your email address is/i)).toHaveCount(0);
    });

    test('reset-password without a token prompts to request a new link', async ({ page }) => {
        await page.goto('/auth/reset-password');
        await expect(page.locator('text=/request new reset link/i')).toBeVisible();
    });
});
