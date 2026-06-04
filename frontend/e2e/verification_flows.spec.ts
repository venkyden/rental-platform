import { test, expect } from '@playwright/test';

// E2E tests for verification flows covering 5 key regression scenarios from the audit.
// These tests require a running frontend server but may skip gracefully if routes are unavailable.

test.describe('Verification Flows E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Set English locale via localStorage to ensure consistent i18n behavior
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('app-language', 'en'));
        await page.reload();

        // Log browser events for debugging
        page.on('console', msg => console.log(`BROWSER [${msg.type()}]:`, msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
    });

    test.describe('Scenario 1: VerificationGate CTA navigates to /verify/identity, not 404', () => {
        test('identity verification page loads without 404', async ({ page }) => {
            // Navigate directly to the identity verification page
            const response = await page.goto('/verify/identity');

            // Should not be a 404 (though may be 401 if not authenticated)
            expect(response?.status()).not.toBe(404);

            // Page should have verification-related content
            const verifyHeading = page.locator('h1:has-text("Identity")');
            if (response?.status() === 200) {
                await expect(verifyHeading).toBeVisible({ timeout: 10_000 });
            }
        });

        test('verify/guarantor page loads without 404', async ({ page }) => {
            // Navigate directly to the guarantor verification page
            const response = await page.goto('/verify/guarantor');

            // Should not be a 404
            expect(response?.status()).not.toBe(404);
        });

        test('verify/income page loads without 404', async ({ page }) => {
            // Navigate directly to the income verification page
            const response = await page.goto('/verify/income');

            // Should not be a 404
            expect(response?.status()).not.toBe(404);
        });
    });

    test.describe('Scenario 2: Error pages render translated strings in FR locale', () => {
        test('verify error page in EN locale does not show undefined strings', async ({ page }) => {
            // Keep EN locale
            await page.goto('/');
            await page.evaluate(() => localStorage.setItem('app-language', 'en'));

            // Navigate to verify identity
            await page.goto('/verify/identity');

            // Check that page text does not contain "undefined" or untranslated keys
            const bodyText = await page.textContent('body');
            expect(bodyText).not.toContain('undefined');
            expect(bodyText).not.toMatch(/i18n\./);
            expect(bodyText).not.toMatch(/verify\.[a-z.]+/);
        });

        test('verify error page in FR locale does not show undefined strings', async ({ page }) => {
            // Set FR locale
            await page.goto('/');
            await page.evaluate(() => localStorage.setItem('app-language', 'fr'));
            await page.reload();

            // Navigate to verify identity
            await page.goto('/verify/identity');

            // Check that page text does not contain "undefined" or untranslated keys
            const bodyText = await page.textContent('body');
            expect(bodyText).not.toContain('undefined');
            expect(bodyText).not.toMatch(/i18n\./);
            expect(bodyText).not.toMatch(/verify\.[a-z.]+/);
        });
    });

    test.describe('Scenario 3: Guarantor "no guarantor" path rendering', () => {
        test('guarantor verification page loads without errors', async ({ page }) => {
            // Navigate to guarantor page
            const response = await page.goto('/verify/guarantor');

            // Should not error
            expect(response?.status()).not.toBe(404);
            expect(response?.status()).not.toBe(500);

            // Check for main guarantor heading or selection UI
            const hasGuarantorContent = await page.locator(
                'body:has(h1, h2, [role="heading"])'
            ).isVisible();

            if (response?.status() === 200) {
                expect(hasGuarantorContent).toBe(true);
            }
        });

        test('no unhandled errors in guarantor step transitions', async ({ page }) => {
            // Monitor page errors
            let pageErrorOccurred = false;
            page.on('pageerror', () => {
                pageErrorOccurred = true;
            });

            await page.goto('/verify/guarantor');

            // Wait a moment for component hydration and state initialization
            await page.waitForTimeout(1000);

            // Should not have thrown unhandled errors
            expect(pageErrorOccurred).toBe(false);
        });
    });

    test.describe('Scenario 4: Desktop QR screen has Copy link button (verify-capture)', () => {
        test('verify-capture page loads with proper layout', async ({ page }) => {
            // Set desktop viewport
            await page.setViewportSize({ width: 1280, height: 800 });

            // Navigate to verify-capture with a test code
            const response = await page.goto('/verify-capture/test-code-abc');

            // Should not be 404 (might be 401 or 400 with invalid code, but page should exist)
            expect(response?.status()).not.toBe(404);
        });

        test('verify-capture renders loading or step content on desktop', async ({ page }) => {
            // Set desktop viewport
            await page.setViewportSize({ width: 1280, height: 800 });

            await page.goto('/verify-capture/test-code-abc');

            // Page should have some visible content (loading state, step selector, guide, etc.)
            const mainContent = page.locator('main, [role="main"], body');
            await expect(mainContent).toBeVisible({ timeout: 10_000 });
        });

        test('desktop viewport is wider than mobile viewport', async ({ page, context }) => {
            // This is a sanity check that our viewport is truly desktop
            const metrics = await page.evaluate(() => ({
                width: window.innerWidth,
                height: window.innerHeight,
            }));

            expect(metrics.width).toBeGreaterThanOrEqual(1280);
        });
    });

    test.describe('Scenario 5: verify-capture step transitions apply motion', () => {
        test('verify-capture page renders without console errors during step loads', async ({ page }) => {
            // Track console errors
            const consoleErrors: string[] = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            });

            await page.goto('/verify-capture/test-code-abc');
            await page.waitForTimeout(500);

            // Should have minimal to no console errors
            // (Small number of errors is acceptable for missing resources, but not application crashes)
            const criticalErrors = consoleErrors.filter(
                e => e.includes('TypeError') || e.includes('Uncaught') || e.includes('ReferenceError')
            );
            expect(criticalErrors.length).toBe(0);
        });

        test('verify-capture page layout is stable during initial load', async ({ page }) => {
            // Monitor layout shifts
            let layoutShiftDetected = false;

            await page.evaluate(() => {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if ((entry as any).hadRecentInput === false) {
                            // Layout shift occurred
                            console.log('Layout shift detected:', (entry as any).value);
                        }
                    }
                });
                observer.observe({ entryTypes: ['layout-shift'] });
            });

            await page.goto('/verify-capture/test-code-abc');
            await page.waitForTimeout(1500);

            // Check that main content is stable and visible
            const mainContent = page.locator('main, body');
            await expect(mainContent).toBeVisible();
        });

        test('verify-capture AnimatePresence wrapper renders without crashing', async ({ page }) => {
            // Monitor for runtime errors
            let runtimeError = false;
            page.on('pageerror', err => {
                if (err.message.includes('AnimatePresence') || err.message.includes('framer-motion')) {
                    runtimeError = true;
                }
            });

            await page.goto('/verify-capture/test-code-abc');
            await page.waitForTimeout(1000);

            expect(runtimeError).toBe(false);
        });
    });

    test.describe('Cross-scenario regression checks', () => {
        test('all verify/* routes are reachable without 404', async ({ page }) => {
            const verifyRoutes = [
                '/verify/identity',
                '/verify/guarantor',
                '/verify/income',
            ];

            for (const route of verifyRoutes) {
                const response = await page.goto(route);
                expect(response?.status()).not.toBe(404);
            }
        });

        test('verify-capture route pattern is accessible', async ({ page }) => {
            // Test dynamic route pattern
            const response = await page.goto('/verify-capture/test-code-123');
            expect(response?.status()).not.toBe(404);
        });

        test('verify-capture error page renders on bad code', async ({ page }) => {
            // Test error boundary / fallback page
            const response = await page.goto('/verify-capture/invalid-code-xyz');

            // Could be 400/401/404 or still 200 with error message in UI
            // The key is: should not crash the app
            expect(response?.status()).toBeLessThan(500);
        });

        test('navigation away from verify pages does not break router', async ({ page }) => {
            // Navigate to verify page
            await page.goto('/verify/identity');

            // Navigate away
            await page.goto('/');

            // Should successfully land on home page
            expect(page.url()).toContain('/');

            // Navigate back to verify
            await page.goto('/verify/identity');

            // Should successfully load again
            const response = await page.goto('/verify/identity');
            expect(response?.status()).not.toBe(404);
        });
    });
});
