import { test, expect, Page } from '@playwright/test';
import { translations } from '../lib/i18n';

/**
 * The furnished rule as students and owners meet it: a listing whose owner marked an
 * item the furnished-housing decree requires as missing or not working is not called
 * furnished. The rule itself is tested in the backend (tests_integration/test_furnished_rule.py).
 */

// Keys of lease_rules.FURNISHED_REQUIRED_ITEMS (Décret n° 2015-981), in the decree's order.
const DECREE_KEYS = [
    'literie', 'occultation_chambres', 'plaques_cuisson', 'four_ou_micro_ondes', 'refrigerateur_congelateur',
    'vaisselle', 'ustensiles_cuisine', 'table_et_sieges', 'etageres_rangement', 'luminaires', 'materiel_entretien',
];

test.describe('furnished rule: words', () => {
    test('every decree category has a name in both languages', () => {
        for (const lang of ['en', 'fr'] as const) {
            const legal = translations[lang].walkthrough.legal as Record<string, string>;
            expect(Object.keys(legal).sort(), lang).toEqual([...DECREE_KEYS].sort());
            for (const key of DECREE_KEYS) expect(legal[key], `${lang} ${key}`).toBeTruthy();
        }
    });

    test('nothing says verified or compliant', () => {
        for (const lang of ['en', 'fr'] as const) {
            const words = JSON.stringify(translations[lang].walkthrough.furnished) + translations[lang].legal.terms.sections.listings.content;
            // Saying Roomivo does NOT check the answers is the point; nothing else may claim a check.
            // "dépôt de garantie" is the security deposit, not a promise.
            const rest = words.replace("Roomivo ne les vérifie pas", '').replace(/dépôt de garantie/g, '');
            expect(rest, lang).not.toMatch(/verif|vérifi|complian|conforme|certif|guarant|garanti/i);
        }
    });
});

const listing = (id: string, furnished: boolean, furnished_missing: string[] = []) => ({
    id, title: `Studio ${id}`, city: 'Nantes', postal_code: '44000', monthly_rent: 600, charges: 0,
    charges_included: true, bedrooms: 0, rooms_count: 1, property_type: 'studio', furnished,
    furnished_missing, size_sqm: 20, photos: [], amenities: [], status: 'active',
});

async function searchWith(page: Page, rows: unknown[]) {
    await page.addInitScript(() => {
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('roomivo_cookie_consent', JSON.stringify({ essential: true, analytics: false, preferences: false }));
    });
    await page.route('**/api/v1/**', (route) =>
        route.request().url().includes('/properties')
            ? route.fulfill({ json: rows })
            : route.fulfill({ status: 401, json: { detail: 'Not authenticated' } }));
    await page.goto('/search');
}

test.describe('furnished rule: listing cards', () => {
    test('a card is not called furnished while the owner marked a required item missing', async ({ page }) => {
        await searchWith(page, [
            listing('11111111-1111-4111-8111-111111111111', true),
            listing('22222222-2222-4222-8222-222222222222', true, ['plaques_cuisson']),
            listing('33333333-3333-4333-8333-333333333333', false),
        ]);
        const card = (id: string) => page.locator(`a[href="/properties/${id}"]`).first().locator('xpath=ancestor::*[.//h3][1]');
        await expect(page.getByText('Studio 11111111-1111-4111-8111-111111111111')).toBeVisible();
        await expect(card('11111111-1111-4111-8111-111111111111')).toContainText("Furnished · owner's statement");
        await expect(page.getByRole('button', { name: 'Furnished (as stated by the owner)' })).toBeVisible();
        await expect(card('22222222-2222-4222-8222-222222222222')).not.toContainText(/Furnished|Unfurnished/);
        await expect(card('33333333-3333-4333-8333-333333333333')).toContainText('Unfurnished');
    });
});

test.describe('furnished rule: terms of use', () => {
    test('the terms say answers are the owner\'s statements and state the rule, in both languages', async ({ page }) => {
        for (const [lang, heading, phrase] of [
            ['en', "4. Listings and Owners' Statements", 'shown as furnished only while'],
            ['fr', '4. Annonces et déclarations des propriétaires', "n'apparaît comme meublée que tant que"],
        ] as const) {
            await page.addInitScript((l) => localStorage.setItem('app-language', l), lang);
            await page.goto('/legal/terms');
            await expect(page.getByRole('heading', { name: heading })).toBeVisible();
            await expect(page.getByText(phrase, { exact: false })).toBeVisible();
        }
    });
});
