import { test, expect, Page } from '@playwright/test';
import { translations } from '../lib/i18n';
import {
    WALKTHROUGH_ITEMS, WALK_STATES, bedroomCount, flattenAnswers, formatAnswerDate, hasFlatmates, itemsFor,
    latestAnswerDate, spaceKeys, spaceLabel,
} from '../lib/walkthrough';

/**
 * Walk-through answers: the tap lists a landlord fills in on the phone capture page
 * (and can correct on the listing edit page), and the helpers the listing page's
 * "Good to know" panel is built from.
 */

const t = (lang: 'en' | 'fr') => (key: string, params?: Record<string, string | number>, fallback?: string) => {
    let node: unknown = translations[lang];
    for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
    let text = typeof node === 'string' ? node : fallback ?? key;
    for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{{${name}}}`, String(value));
    return text;
};

test.describe('walk-through helpers', () => {
    test('every item and state has a label in both languages', () => {
        for (const lang of ['en', 'fr'] as const) {
            const words = translations[lang].walkthrough;
            for (const item of WALKTHROUGH_ITEMS) {
                expect((words.items as Record<string, string>)[item.key], `${lang} ${item.key}`).toBeTruthy();
                for (const state of WALK_STATES[item.kind]) {
                    expect((words.states as Record<string, string>)[state], `${lang} ${state}`).toBeTruthy();
                }
            }
        }
    });

    test('spaces follow the room list, and a studio still has one bedroom', () => {
        expect(bedroomCount(undefined)).toBe(1);
        expect(bedroomCount([])).toBe(1);
        expect(bedroomCount([{}, {}, {}])).toBe(3);
        expect(bedroomCount('junk')).toBe(1);
        expect(spaceKeys(1)).toEqual(['kitchen', 'bedroom:0', 'living', 'bathroom', 'home']);
        expect(spaceKeys(2)).toEqual(['kitchen', 'bedroom:0', 'bedroom:1', 'living', 'bathroom', 'home']);
        expect(itemsFor('bedroom:1').map((i) => i.key)).toEqual(['bed_bedding', 'curtains_shutters', 'desk', 'wardrobe']);
        expect(itemsFor('garage')).toEqual([]);
    });

    test('a single bedroom is not numbered; several are', () => {
        expect(spaceLabel(t('en'), 'bedroom:0', 1)).toBe('Bedroom');
        expect(spaceLabel(t('en'), 'bedroom:1', 2)).toBe('Bedroom 2');
        expect(spaceLabel(t('fr'), 'bedroom:1', 2)).toBe('Chambre 2');
        expect(spaceLabel(t('fr'), 'kitchen', 1)).toBe('Cuisine');
    });

    test('stored answers are flattened, and anything malformed is dropped without throwing', () => {
        const stored = {
            kitchen: {
                hob: { state: 'working', answered_at: '2026-10-13T10:00:00Z' },
                oven: { state: 'present' },                 // a thing's state on an appliance
                sofa: { state: 'present' },                 // another space's item
                dishwasher: 'absent',                       // not the stored shape
                '<img onerror=x>': { state: 'working' },
            },
            'bedroom:0': { desk: { state: 'absent' } },
            garage: { hob: { state: 'working' } },
            home: 'junk',
            living: {},
        };
        expect(flattenAnswers(stored)).toEqual({ kitchen: { hob: 'working' }, 'bedroom:0': { desk: 'absent' } });
        for (const junk of [null, undefined, 'x', 7, [], [{ kitchen: {} }], { kitchen: null }, { kitchen: [1] }]) {
            expect(flattenAnswers(junk)).toEqual({});
        }
    });

    test('the source line uses the most recent answer, written in the visitor\'s language', () => {
        const stored = {
            kitchen: { hob: { state: 'working', answered_at: '2026-09-12T08:00:00Z' } },
            home: { internet: { state: 'present', answered_at: '2026-10-13T23:30:00Z' } },
        };
        expect(latestAnswerDate(stored)).toBe('2026-10-13');
        expect(latestAnswerDate(stored, { count: 2, answered_at: '2026-11-01T00:00:00Z' })).toBe('2026-11-01');
        expect(latestAnswerDate({ kitchen: { hob: { state: 'working', answered_at: 'yesterday' } } })).toBeNull();
        expect(latestAnswerDate(null)).toBeNull();
        expect(formatAnswerDate('2026-10-13', 'en')).toBe('13 October 2026');
        expect(formatAnswerDate('2026-10-13', 'fr')).toBe('13 octobre 2026');
        expect(formatAnswerDate('junk', 'en')).toBe('junk');
    });

    test('an empty household card is no card', () => {
        expect(hasFlatmates(null)).toBe(false);
        expect(hasFlatmates({})).toBe(false);
        expect(hasFlatmates({ answered_at: '2026-10-13T00:00:00Z' })).toBe(false);
        expect(hasFlatmates({ count: 0 })).toBe(true);
        expect(hasFlatmates({ pets: false })).toBe(true);
    });
});

const session = (walkthrough: Record<string, unknown> | null) => ({
    target_address: '10 Rue de Rivoli, 75001 Paris',
    target_latitude: 48.8566,
    target_longitude: 2.3522,
    gps_radius_meters: 500,
    location_verified: false,
    expires_at: '2099-01-01T00:00:00Z',
    rooms: [{ index: 0, surface: 12 }, { index: 1, surface: 9 }],
    has_video: false,
    walkthrough,
});

const stamped = (answers: Record<string, string>) =>
    Object.fromEntries(Object.entries(answers).map(([key, state]) => [key, { state, answered_at: '2026-10-13T10:00:00Z' }]));

/** Mocks the capture session. PUTs are recorded and answered as the server would. */
async function openCapture(page: Page, walkthrough: Record<string, unknown> | null, lang: 'en' | 'fr' = 'en') {
    const state = { ...(walkthrough ?? {}) } as { answers?: Record<string, unknown>; flatmates?: unknown };
    const saved: Record<string, unknown>[] = [];
    await page.addInitScript((language) => {
        if (!sessionStorage.getItem('walkthrough-test-started')) {
            localStorage.setItem('app-language', language);
            sessionStorage.setItem('walkthrough-test-started', '1');
        }
    }, lang);
    await page.route('**/properties/media-sessions/**', async (route) => {
        const request = route.request();
        if (request.method() === 'PUT') {
            const body = request.postDataJSON();
            saved.push(body);
            if (body.space) {
                const answers = { ...(state.answers ?? {}) };
                if (Object.keys(body.answers ?? {}).length) answers[body.space] = stamped(body.answers);
                else delete answers[body.space];
                state.answers = answers;
            }
            if (body.flatmates) state.flatmates = { ...body.flatmates, answered_at: '2026-10-13T10:00:00Z' };
            await route.fulfill({ json: { ...walkthrough, ...state } });
            return;
        }
        await route.fulfill({ json: session(walkthrough ? { ...walkthrough, ...state } : null) });
    });
    await page.goto('/capture/test-code-walkthrough');
    return saved;
}

const WALK = { bedrooms: 2, is_colocation: false, answers: {}, flatmates: null };

test.describe('Capture page: quick answers', () => {
    test('the landlord answers one space with taps and it is saved for that space', async ({ page }) => {
        const saved = await openCapture(page, WALK);
        await page.getByRole('button', { name: 'Answer the questions' }).click();

        const spaces = page.getByTestId('answer-spaces');
        await expect(spaces.getByRole('button')).toHaveCount(6);
        await expect(spaces.getByRole('button', { name: /Bedroom 2/ })).toBeVisible();
        await expect(spaces.getByRole('button', { name: /Who lives here/ })).toHaveCount(0);

        await spaces.getByRole('button', { name: /Kitchen/ }).click();
        await page.getByRole('radiogroup', { name: 'Hob' }).getByRole('radio', { name: 'Works' }).click();
        await page.getByRole('radiogroup', { name: 'Dishwasher' }).getByRole('radio', { name: 'Not here' }).click();
        await page.getByRole('radiogroup', { name: 'Oven' }).getByRole('radio', { name: 'Not working' }).click();
        await expect(page.getByRole('radiogroup', { name: 'Hob' }).getByRole('radio', { name: 'Works' })).toHaveAttribute('aria-checked', 'true');
        // A thing is there or not: no "works" for plates.
        await expect(page.getByRole('radiogroup', { name: 'Plates and glasses' }).getByRole('radio')).toHaveCount(2);

        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(spaces.getByRole('button', { name: /Kitchen/ })).toContainText('3 of 7 answered');
        expect(saved).toEqual([{ space: 'kitchen', answers: { hob: 'working', dishwasher: 'absent', oven: 'not_working' } }]);
    });

    test('tapping the chosen answer again clears it, and reopening a space shows what was saved', async ({ page }) => {
        const saved = await openCapture(page, { ...WALK, answers: { home: stamped({ internet: 'present', lights: 'present' }) } });
        await page.getByRole('button', { name: 'Answer the questions' }).click();
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Whole home/ }).click();

        const internet = page.getByRole('radiogroup', { name: 'Internet' });
        await expect(internet.getByRole('radio', { name: 'Here', exact: true })).toHaveAttribute('aria-checked', 'true');
        await internet.getByRole('radio', { name: 'Here', exact: true }).click();
        await expect(internet.getByRole('radio', { name: 'Here', exact: true })).toHaveAttribute('aria-checked', 'false');

        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByTestId('answer-spaces').getByRole('button', { name: /Whole home/ })).toContainText('1 of 4 answered');
        expect(saved).toEqual([{ space: 'home', answers: { lights: 'present' } }]);
    });

    test('Back leaves a space without saving', async ({ page }) => {
        const saved = await openCapture(page, WALK);
        await page.getByRole('button', { name: 'Answer the questions' }).click();
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Bathroom/ }).click();
        await page.getByRole('radiogroup', { name: 'Washing machine' }).getByRole('radio', { name: 'Works' }).click();
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await expect(page.getByTestId('answer-spaces').getByRole('button', { name: /Bathroom/ })).toContainText('0 of 2 answered');
        expect(saved).toEqual([]);
    });

    test('a shared home also asks who lives there, and nothing about a person', async ({ page }) => {
        const saved = await openCapture(page, { ...WALK, is_colocation: true });
        await page.getByRole('button', { name: 'Answer the questions' }).click();
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Who lives here/ }).click();

        const fields = page.getByTestId('flatmates-fields');
        await expect(fields.locator('input')).toHaveCount(1);
        await expect(fields).not.toContainText(/name|age|gender|nationality|women|men\b/i);

        await fields.getByLabel('How many flatmates live here?').fill('3');
        await fields.getByRole('radiogroup', { name: 'They are' }).getByRole('radio', { name: 'Students', exact: true }).click();
        await fields.getByRole('radiogroup', { name: 'Smoking in the home?' }).getByRole('radio', { name: 'No' }).click();
        await fields.getByRole('radiogroup', { name: 'Pets in the home?' }).getByRole('radio', { name: 'Yes' }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();

        await expect(page.getByTestId('answer-spaces')).toBeVisible();
        expect(saved).toEqual([{ flatmates: { count: 3, occupation: 'students', smoking: false, pets: true } }]);
    });

    test('an out-of-range flatmate count is not sent', async ({ page }) => {
        const saved = await openCapture(page, { ...WALK, is_colocation: true });
        await page.getByRole('button', { name: 'Answer the questions' }).click();
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Who lives here/ }).click();
        for (const value of ['999', '-4', '2.5']) {
            await page.getByLabel('How many flatmates live here?').fill(value);
        }
        await page.getByRole('radiogroup', { name: 'Pets in the home?' }).getByRole('radio', { name: 'No' }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByTestId('answer-spaces')).toBeVisible();
        expect(saved).toEqual([{ flatmates: { pets: false } }]);
    });

    test('with no network the answers are kept on the phone and sent when it is back', async ({ page }) => {
        const saved = await openCapture(page, WALK);
        await page.getByRole('button', { name: 'Answer the questions' }).click();
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Living area/ }).click();
        await page.getByRole('radiogroup', { name: 'Sofa' }).getByRole('radio', { name: 'Here', exact: true }).click();

        // The network drops for the save.
        await page.route('**/properties/media-sessions/**', (route) => route.abort('internetdisconnected'));
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('Saved on this phone. It will be sent when you are back online.')).toBeVisible();
        await expect(page.getByTestId('answer-spaces').getByRole('button', { name: /Living area/ })).toContainText('1 of 3 answered');
        expect(saved).toEqual([]);

        // Back online: the page loads again and sends what it kept, once.
        await page.unroute('**/properties/media-sessions/**');
        await page.route('**/properties/media-sessions/**', async (route) => {
            if (route.request().method() === 'PUT') {
                saved.push(route.request().postDataJSON());
                await route.fulfill({ json: { ...WALK, answers: { living: stamped({ sofa: 'present' }) } } });
            } else {
                await route.fulfill({ json: session(WALK) });
            }
        });
        await page.reload();
        await expect.poll(() => saved).toEqual([{ space: 'living', answers: { sofa: 'present' } }]);
        await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('roomivo-walkthrough-pending')))).toEqual([]);
        await page.reload();
        await page.waitForTimeout(500);
        expect(saved).toHaveLength(1);
    });

    test('an answer the server refuses is reported and not shown as saved', async ({ page }) => {
        await openCapture(page, WALK);
        await page.getByRole('button', { name: 'Answer the questions' }).click();
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Kitchen/ }).click();
        await page.getByRole('radiogroup', { name: 'Hob' }).getByRole('radio', { name: 'Works' }).click();
        await page.route('**/properties/media-sessions/**', (route) =>
            route.request().method() === 'PUT' ? route.fulfill({ status: 422, json: { detail: 'Unknown item' } }) : route.fallback());
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('Could not save. Please try again.')).toBeVisible();
        await expect(page.getByTestId('tap-list-kitchen')).toBeVisible();
        expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('roomivo-walkthrough-pending')))).toEqual([]);
    });

    test('an older session without the answers block still works for photos', async ({ page }) => {
        await openCapture(page, null);
        await expect(page.getByRole('button', { name: /Take Room Photos/i })).toBeVisible();
        await expect(page.getByTestId('quick-answers-card')).toHaveCount(0);
    });

    test('French is complete on the answers screens', async ({ page }) => {
        await openCapture(page, { ...WALK, is_colocation: true }, 'fr');
        await page.getByRole('button', { name: 'Répondre aux questions' }).click();
        const spaces = page.getByTestId('answer-spaces');
        await expect(spaces.getByRole('button', { name: /Chambre 2/ })).toBeVisible();
        await expect(spaces.getByRole('button', { name: /Qui habite ici/ })).toBeVisible();
        await spaces.getByRole('button', { name: /Cuisine/ }).click();
        const text = await page.getByTestId('tap-list-kitchen').innerText();
        expect(text).toMatch(/Plaques de cuisson/);
        expect(text).not.toMatch(/walkthrough\.|Works|Not here|Not working|Hob|Dishwasher/);
    });

    test('the answers screens fit a small phone and work from the keyboard', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await openCapture(page, WALK);
        await page.getByRole('button', { name: 'Answer the questions' }).click();
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Kitchen/ }).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        const cut = await page.evaluate(() => Array.from(document.querySelectorAll('[role="radio"]'))
            .map((el) => el.getBoundingClientRect()).filter((box) => box.left < -1 || box.right > window.innerWidth + 1).length);
        expect(cut).toBe(0);

        const works = page.getByRole('radiogroup', { name: 'Hob' }).getByRole('radio', { name: 'Works' });
        await works.focus();
        await page.keyboard.press('Enter');
        await expect(works).toHaveAttribute('aria-checked', 'true');
    });
});

test.describe('Listing edit page: quick answers', () => {
    const PROPERTY = {
        id: '11111111-1111-4111-8111-111111111111',
        landlord_id: 'dummy-landlord-id',
        title: 'Quiet two-bedroom flat near the tram',
        description: 'A quiet flat.',
        property_type: 'apartment',
        address_line1: '1 rue de Test', city: 'Nantes', postal_code: '44000', country: 'France',
        bedrooms: 2, bathrooms: 1, size_sqm: 45, furnished: true, is_colocation: true,
        room_details: [{ surface: 12 }, { surface: 10 }],
        monthly_rent: 900, deposit: 900, charges: 50, charges_included: false,
        amenities: [], custom_amenities: [], dpe_rating: 'C', ges_rating: 'C', status: 'draft',
        walkthrough_answers: {
            kitchen: stamped({ hob: 'working' }),
            'bedroom:4': stamped({ desk: 'present' }),   // a bedroom the listing no longer has
        },
        flatmates: { count: 2, answered_at: '2026-10-01T00:00:00Z' },
    };

    const openEdit = async (page: Page) => {
        const puts: Record<string, unknown>[] = [];
        await page.addInitScript(() => {
            localStorage.setItem('app-language', 'en');
            // Keep the cookie banner from covering the controls on a phone-sized screen.
            localStorage.setItem('roomivo_cookie_consent', JSON.stringify({ essential: true, analytics: false, preferences: false }));
        });
        await page.route(/\/auth\/refresh/, (route) => route.fulfill({ json: { access_token: 'dummy-token', token_type: 'bearer' } }));
        await page.route(/\/auth\/me\/segment-config/, (route) => route.fulfill({ json: {
            segment: 'landlord', segment_name: 'Landlord', segment_type: 'supply', dashboard_path: '/dashboard',
            common_features: [], segment_features: [], all_features: [], quick_actions: [], settings: {},
            verification_status: { id_verified: true, email_verified: true, employment_verified: true, onboarding_completed: true },
        } }));
        await page.route(/\/auth\/me(?!\/segment-config)/, (route) => route.fulfill({ json: {
            id: 'dummy-landlord-id', email: 'landlord@roomivo.com', full_name: 'Test Landlord', role: 'landlord',
            email_verified: true, identity_verified: true, employment_verified: true, trust_score: 95,
            onboarding_completed: true, available_roles: ['landlord'],
        } }));
        await page.route(new RegExp(`/api/v1/properties/${PROPERTY.id}(\\?.*)?$`), async (route) => {
            if (route.request().method() === 'PUT') {
                puts.push(route.request().postDataJSON());
                await route.fulfill({ json: PROPERTY });
            } else {
                await route.fulfill({ json: PROPERTY });
            }
        });
        await page.goto(`/properties/${PROPERTY.id}/edit`);
        await expect(page.getByText(PROPERTY.title).first()).toBeVisible();
        return puts;
    };

    const save = async (page: Page) => {
        await page.getByRole('button', { name: 'Review', exact: true }).click();
        await page.getByText(/I declare that all the information/).click();
        await page.getByRole('button', { name: /save|update/i }).last().click();
    };

    test('an edit that does not touch the answers does not send them', async ({ page }) => {
        const puts = await openEdit(page);
        await save(page);
        await expect.poll(() => puts.length).toBe(1);
        expect(puts[0]).not.toHaveProperty('walkthrough_answers');
        expect(puts[0]).not.toHaveProperty('flatmates');
    });

    test('a corrected answer is sent for the spaces the listing has now', async ({ page }) => {
        const puts = await openEdit(page);
        await page.getByRole('button', { name: 'Amenities', exact: true }).click();
        const editor = page.getByTestId('walkthrough-editor');
        await expect(editor.getByRole('button', { name: /Kitchen/ })).toContainText('1 of 7 answered');
        await editor.getByRole('button', { name: /Kitchen/ }).click();
        await editor.getByRole('radiogroup', { name: 'Hob' }).getByRole('radio', { name: 'Not working' }).click();
        await editor.getByRole('button', { name: /Who lives here/ }).click();
        await editor.getByRole('radiogroup', { name: 'Pets in the home?' }).getByRole('radio', { name: 'Yes' }).click();
        await save(page);

        await expect.poll(() => puts.length).toBe(1);
        const sent = puts[0] as { walkthrough_answers: Record<string, unknown>; flatmates: unknown };
        expect(Object.keys(sent.walkthrough_answers)).toEqual(['kitchen', 'bedroom:0', 'bedroom:1', 'living', 'bathroom', 'home']);
        expect(sent.walkthrough_answers.kitchen).toEqual({ hob: 'not_working' });
        // The household card goes back without its server-set date.
        expect(sent.flatmates).toEqual({ count: 2, pets: true });
    });
});
