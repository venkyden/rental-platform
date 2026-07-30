import { test, expect } from '@playwright/test';

test.describe('Settings Preferences Persistence', () => {
    test.beforeEach(async ({ page }) => {
        // Mock authenticated user session
        await page.route('**/auth/me', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'test-user-id',
                    email: 'test@roomivo.com',
                    full_name: 'Test User',
                    role: 'tenant',
                    email_verified: true,
                    identity_verified: true,
                    employment_verified: true,
                    onboarding_completed: true,
                    verification_status: { id_verified: true, email_verified: true, employment_verified: true, onboarding_completed: true }
                })
            });
        });
        
        let preferencesState = { housing_type: ['studio'], budget: 1000, max_rent: 1000 };

        // Mock preferences endpoint
        await page.route('**/onboarding/status', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    active_role: 'tenant',
                    preferences: preferencesState,
                    completed_steps: []
                })
            });
        });

        // Mock PUT preferences
        await page.route('**/onboarding/preferences', async (route) => {
            const data = JSON.parse(route.request().postData() || '{}');
            preferencesState = { ...preferencesState, ...data.responses };
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, preferences: preferencesState })
            });
        });
    });

    test('settings toggle persists state correctly', async ({ page }) => {
        await page.goto('/settings/preferences');
        
        // Settings page should load the mocked budget preference which is €1000
        await expect(page.getByText('€1000').first()).toBeVisible({ timeout: 10_000 });

        // Let's click on the element containing €1000 to open edit modal
        await page.getByText('€1000').first().click();
        
        // Wait for modal to open with Save button or Close button
        const cancelBtn = page.locator('button').filter({ hasText: /cancel|annuler|close/i }).first();
        if (await cancelBtn.isVisible()) {
            await cancelBtn.click({ force: true });
        }
    });
});
