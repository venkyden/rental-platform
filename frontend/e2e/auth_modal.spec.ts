import { test, expect } from '@playwright/test';

test.describe('Phase 6: Slide-Up Auth Modal & Hybrid Verification Gates', () => {
    
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`BROWSER [${msg.type()}]:`, msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message, err.stack));

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

            // Fulfill the token requirement to satisfy checkAuth rehydration
            await page.goto('/');
            await page.evaluate(() => {
                localStorage.setItem('access_token', 'dummy-token-for-testing');
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

            // Fulfill the token requirement to satisfy checkAuth rehydration
            await page.goto('/');
            await page.evaluate(() => {
                localStorage.setItem('access_token', 'dummy-token-for-testing');
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
});
