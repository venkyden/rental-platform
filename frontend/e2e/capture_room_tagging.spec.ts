import { test, expect } from '@playwright/test';

/**
 * WP5 — property media capture must never allow an untagged upload.
 *
 * The publish gate requires at least one photo/video per room in room_details,
 * and there is no endpoint to re-tag or delete already-uploaded media. A landlord
 * who shot every photo without picking a room was therefore stuck: photos
 * uploaded, publish blocked, no way to fix it. The capture page now forces an
 * explicit choice — a specific room, or "Common area" — before shooting.
 */

const SESSION = {
    target_address: '10 Rue de Rivoli, 75001 Paris',
    target_latitude: 48.8566,
    target_longitude: 2.3522,
    gps_radius_meters: 500,
    location_verified: false,
    expires_at: '2099-01-01T00:00:00Z',
    rooms: [
        { index: 0, surface: 12 },
        { index: 1, surface: 9 },
    ],
    has_video: false,
};

test.describe('Capture page room tagging (WP5)', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/properties/media-sessions/**', async (route) => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) });
        });
        await page.goto('/capture/test-code-wp5');
        await page.evaluate(() => localStorage.setItem('app-language', 'en'));
        await page.reload();
    });

    test('photo button is disabled until a room or common area is chosen', async ({ page }) => {
        const photoBtn = page.getByRole('button', { name: /Take Room Photos/i });
        await expect(photoBtn).toBeVisible();
        await expect(photoBtn).toBeDisabled();

        // The guidance explains why, rather than leaving a dead button.
        await expect(page.getByText(/Pick a room before shooting/i)).toBeVisible();
    });

    test('choosing a specific room enables shooting', async ({ page }) => {
        await page.getByRole('button', { name: /Room 1/ }).click();
        await expect(page.getByRole('button', { name: /Take Room Photos/i })).toBeEnabled();
    });

    test('common area is an explicit choice, not an accidental default', async ({ page }) => {
        // Common-area photos stay possible — they just have to be deliberate.
        await expect(page.getByRole('button', { name: /Common area/i })).toBeVisible();
        await page.getByRole('button', { name: /Common area/i }).click();
        await expect(page.getByRole('button', { name: /Take Room Photos/i })).toBeEnabled();
    });

    test('room chips show their surface so the right room gets the right photo', async ({ page }) => {
        await expect(page.getByRole('button', { name: /Room 1 — 12m²/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Room 2 — 9m²/ })).toBeVisible();
    });
});
