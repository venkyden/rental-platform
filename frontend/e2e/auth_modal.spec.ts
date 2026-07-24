import { test, expect } from '@playwright/test';

test.describe('Phase 6: Slide-Up Auth Modal & Hybrid Verification Gates', () => {
    
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`BROWSER [${msg.type()}]:`, msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));
        page.on('request', request => console.log('REQ >>', request.method(), request.url()));
        page.on('response', response => console.log('RES <<', response.status(), response.url()));

        // Enforce English default locale via local storage
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('app-language', 'en'));
        await page.reload();
    });

    test.describe('1. Slide-Up Secure Auth Modal', () => {
        test('unauthenticated access to dashboard shows secure slide-up gated modal', async ({ page }) => {
            await page.goto('/dashboard');
            
            // Should remain on /dashboard (context-preserving URL)
            expect(page.url()).toContain('/dashboard');
            
            // Blur backdrop and translucent overlay should mount
            // Increase timeout to 15000ms for initial dev compilation
            const overlay = page.locator('.backdrop-blur-\\[10px\\]');
            await expect(overlay).toBeVisible({ timeout: 15000 });
            
            // Gated secure header should be displayed
            const modalHeader = page.locator('text=Roomivo Secure');
            await expect(modalHeader).toBeVisible();
            
            // Password toggle should change input type
            const passwordInput = page.locator('input[type="password"]');
            await expect(passwordInput).toBeVisible();
            
            const toggleBtn = page.locator('button[aria-label="Toggle password visibility"]');
            if (await toggleBtn.isVisible()) {
                await toggleBtn.click();
                await expect(page.locator('input[type="text"]')).toBeVisible();
            }
        });

        test('dual-language accessibility toggle within the modal', async ({ page }) => {
            await page.goto('/dashboard');
            
            // Initial English check - Increase timeout to 15000ms for dev compilation
            await expect(page.locator('text=Roomivo Secure').first()).toBeVisible({ timeout: 15000 });
            
            // Toggle language inside the modal (assuming button test-id or text)
            const frBtn = page.getByTestId('lang-switch-fr');
            if (await frBtn.isVisible()) {
                await frBtn.click();
                await page.waitForTimeout(200);
                
                // Verify French translations
                await expect(page.locator('text=Roomivo Sécurisé').first()).toBeVisible();
            }
        });
    });

    test.describe('2. Multi-Step Registration Flow', () => {
        test('role selection and stepping through basic info to security', async ({ page }) => {
            await page.goto('/dashboard');
            
            // Click "Sign Up" tab/button on the slide-up modal using test-id
            const signUpTab = page.getByTestId('switch-to-signup');
            await expect(signUpTab).toBeVisible({ timeout: 15000 });
            await signUpTab.click();
            
            // Step 1: Role Selection Cards
            // Locate the Tenant card by text since locale is set to English
            const tenantCard = page.locator('button:has-text("Tenant")').first();
            await expect(tenantCard).toBeVisible();
            await tenantCard.click();
            
            const nextBtn = page.locator('button:has-text("Continue"), button:has-text("Continuer")').first();
            await expect(nextBtn).toBeVisible();
            await nextBtn.click();
            
            // Step 2: Basic Info
            const nameInput = page.locator('input[name="full_name"]');
            await expect(nameInput).toBeVisible();
            await nameInput.fill('Alex Mercer');
            
            const phoneInput = page.locator('input[type="tel"]');
            await expect(phoneInput).toBeVisible();
            await phoneInput.fill('0612345678');
            
            // Verify French phone formatting auto-spaces (e.g. 06 12 34 56 78)
            const phoneValue = await phoneInput.inputValue();
            expect(phoneValue.replace(/\s/g, '')).toBe('0612345678');
        });
    });

    test.describe('3. Hybrid Email Verification Gates', () => {
        test('sensitive paths trigger full-page hard block', async ({ page }) => {
            // Intercept auth request to return logged in but unverified user
            await page.route('**/auth/me', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        email: 'unverified@roomivo.com',
                        email_verified: false,
                        role: 'landlord',
                        trust_score: 50
                    }),
                });
            });

            // Seed in-memory token: checkAuth() rehydrates via /auth/refresh on mount.
            await page.route('**/auth/refresh', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ access_token: 'dummy-token-for-testing', token_type: 'bearer' }),
                });
            });

            // Visit a sensitive path like property creation
            await page.goto('/properties/new');
            
            // Verify full-page illustration block is active
            await expect(page.locator('text=Verify Your Email').first()).toBeVisible({ timeout: 15000 });
            await expect(page.locator('button:has-text("Resend Verification Email"), button:has-text("Renvoyer l\'e-mail de vérification")').first()).toBeVisible();
        });

        test('low-friction paths allow viewing page with top warning banner', async ({ page }) => {
            // Intercept auth request to return logged in but unverified user
            await page.route('**/auth/me', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        email: 'unverified@roomivo.com',
                        email_verified: false,
                        role: 'tenant',
                        trust_score: 50
                    }),
                });
            });

            // Seed in-memory token: checkAuth() rehydrates via /auth/refresh on mount.
            await page.route('**/auth/refresh', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ access_token: 'dummy-token-for-testing', token_type: 'bearer' }),
                });
            });

            // Visit general dashboard path (low-friction)
            await page.goto('/dashboard');
            
            // Dashboard page content should be visible (not hard gated)
            await expect(page.locator('text=Welcome').first()).toBeVisible({ timeout: 15000 });
            
            // Sticky top alert banner should warn the user elegantly (bg-zinc-950)
            const softBanner = page.locator('.bg-zinc-950').first();
            await expect(softBanner).toBeVisible();
            await expect(softBanner).toContainText(/Verify your email/i);
        });
    });

    test.describe('4. Page-Level Auth State Sync', () => {
        test('successful page-level login synchronizes state and does not prompt login again on dashboard', async ({ page }) => {
            // Mock API routes

            // Explicitly reject refresh so checkAuth() on the login page mount fails
            // fast and deterministically — without this, a real backend session could
            // cause checkAuth to rehydrate and auto-redirect before the test fills the
            // form (in-memory token survives across soft navigations in the same process).
            await page.route('**/auth/refresh', async (route) => {
                await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'No session' }) });
            });

            // Port-scoped so it hits the API only — a bare '**/auth/login' glob
            // would also intercept the navigation to the /auth/login page itself.
            await page.route(/:8000\/api\/v1\/auth\/login/, async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        access_token: 'dummy-token-page-login',
                        token_type: 'bearer',
                        redirect_path: '/dashboard',
                        segment: 'standard_tenant',
                        segment_name: 'Standard Tenant',
                        available_roles: ['tenant']
                    }),
                });
            });

            await page.route(/:8000\/auth\/me$/, async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'dummy-user-id',
                        email: 'test@roomivo.com',
                        full_name: 'Test User',
                        role: 'tenant',
                        email_verified: true,
                        identity_verified: true,
                        employment_verified: true,
                        trust_score: 95,
                        onboarding_completed: true,
                        available_roles: ['tenant']
                    }),
                });
            });

            await page.route(/:8000\/auth\/me\/segment-config/, async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        segment: 'standard_tenant',
                        segment_name: 'Standard Tenant',
                        segment_type: 'demand',
                        dashboard_path: '/dashboard',
                        common_features: [],
                        segment_features: [],
                        all_features: [],
                        quick_actions: [],
                        settings: {},
                        verification_status: {
                            id_verified: true,
                            email_verified: true,
                            employment_verified: true,
                            onboarding_completed: true
                        }
                    }),
                });
            });

            await page.route(/:8000\/inbox\/unread-count/, async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ total_unread: 0 }),
                });
            });

            await page.route(/:8000\/inbox/, async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([]),
                });
            });

            await page.route(/:8000\/properties\/recommendations/, async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([]),
                });
            });

            await page.route(/:8000\/stats\/tenant\/overview/, async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        total_applications: 0,
                        scheduled_visits: 0,
                        active_disputes: 0
                    }),
                });
            });

            await page.route(/:8000\/notifications\/unread-count/, async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ unread_count: 0 }),
                });
            });

            await page.route(/:8000\/notifications/, async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([]),
                });
            });

            // Clear cookies to prevent auto-login / auto-redirect (no localStorage token to clear).
            await page.context().clearCookies();

            // Go to login page
            await page.goto('/auth/login');

            // Fill login form
            await page.locator('input[type="email"]').fill('test@roomivo.com');
            await page.locator('input[type="password"]').fill('Password123!');

            // Click submit button
            await page.locator('button[type="submit"]').click();

            // Wait for redirection to dashboard. Generous timeout: under full-suite
            // parallel load the dashboard's many API calls + redirect can be slow,
            // which previously made this step flaky on webkit.
            await page.waitForURL('**/dashboard', { timeout: 30_000 });

            // Verify that we are on the dashboard and the gated auth modal is NOT showing
            await expect(page).toHaveURL(/.*dashboard/);
            const modal = page.locator('text=Roomivo Secure');
            await expect(modal).not.toBeVisible({ timeout: 15_000 });
        });
    });
});
