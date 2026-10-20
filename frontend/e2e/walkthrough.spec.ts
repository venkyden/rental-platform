import { test, expect, Page, Route } from '@playwright/test';
import { translations } from '../lib/i18n';
import {
    WALKTHROUGH_ITEMS, WALK_STATES, bedroomCount, flattenAnswers, formatAnswerDate, hasFlatmates, householdLines, itemsFor,
    latestAnswerDate, spaceKeys, spaceLabel,
} from '../lib/walkthrough';
import { enqueue, failureOf, parseQueue, withoutSent, withoutTarget } from '../lib/walkthroughQueue';

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
        expect(latestAnswerDate(stored, 1)).toBe('2026-10-13');
        expect(latestAnswerDate(stored, 1, { count: 2, answered_at: '2026-11-01T00:00:00Z' })).toBe('2026-11-01');
        expect(latestAnswerDate({ kitchen: { hob: { state: 'working', answered_at: 'yesterday' } } }, 1)).toBeNull();
        expect(latestAnswerDate(null, 1)).toBeNull();
        // Only answers the panel shows: not a bedroom the listing no longer has, not an unknown item.
        const hidden = {
            kitchen: { hob: { state: 'working', answered_at: '2026-09-01T00:00:00Z' } },
            'bedroom:3': { desk: { state: 'present', answered_at: '2026-12-01T00:00:00Z' } },
            home: { sauna: { state: 'present', answered_at: '2026-12-02T00:00:00Z' } },
        };
        expect(latestAnswerDate(hidden, 2)).toBe('2026-09-01');
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

    test('the household card reads naturally, in both languages, and ignores anything unknown', () => {
        expect(householdLines(t('fr'), { count: 0, occupation: 'students', smoking: false, pets: true })).toEqual([
            'Aucun colocataire', 'Étudiants', 'On ne fume pas dans le logement', 'Animaux dans le logement',
        ]);
        expect(householdLines(t('en'), { count: 1 })).toEqual(['1 flatmate']);
        expect(householdLines(t('en'), { count: 3, smoking: true })).toEqual(['3 flatmates', 'Smoking in the home']);
        expect(householdLines(t('en'), { occupation: '<img src=x>' as never })).toEqual([]);
        expect(householdLines(t('en'), null)).toEqual([]);
        expect(householdLines(t('en'), { answered_at: '2026-10-13T00:00:00Z' })).toEqual([]);
    });

    test('the panel lines say "verified" nowhere, in either language', () => {
        for (const lang of ['en', 'fr'] as const) {
            const words = JSON.stringify(translations[lang].walkthrough);
            // "dépôt de garantie" is the security deposit, not a promise.
            expect(words.replace(/dépôt de garantie/g, '')).not.toMatch(/verif|vérifi|certif|guarant|garanti/i);
        }
    });

    test('the waiting queue keeps one entry per space, newest last', () => {
        const a = { space: 'kitchen', answers: { hob: 'working' as const } };
        const b = { space: 'home', answers: { internet: 'present' as const } };
        const a2 = { space: 'kitchen', answers: { hob: 'not_working' as const } };
        const card = { flatmates: { count: 2 } };
        expect(enqueue(enqueue(enqueue([], a), b), a2)).toEqual([b, a2]);
        expect(enqueue(enqueue([], card), { flatmates: { pets: true } })).toEqual([{ flatmates: { pets: true } }]);
        expect(withoutTarget([a, b, card], 'kitchen')).toEqual([b, card]);
        expect(withoutTarget([a, b, card], 'flatmates')).toEqual([a, b]);
        // Removing what was sent keeps a newer entry for the same space queued meanwhile.
        expect(withoutSent([a2, b], a)).toEqual([a2, b]);
        expect(withoutSent([a, b], a)).toEqual([b]);
    });

    test('a corrupted queue is read as empty or cleaned, never thrown on', () => {
        for (const raw of [null, '', 'not json', '{}', '7', '"x"']) expect(parseQueue(raw)).toEqual([]);
        expect(parseQueue(JSON.stringify([null, 5, 'x', [], {}, { space: 'kitchen' }, { space: 3, answers: {} },
            { space: 'kitchen', answers: [] }, { flatmates: null }, { space: 'home', answers: { internet: 'present' } }])))
            .toEqual([{ space: 'home', answers: { internet: 'present' } }]);
    });

    test('only a refusal drops a waiting answer; connection and server problems keep it', () => {
        for (const status of [undefined, 0, 408, 429, 500, 502, 503]) expect(failureOf(status), String(status)).toBe('retry-later');
        for (const status of [400, 404, 410]) expect(failureOf(status), String(status)).toBe('link-expired');
        for (const status of [401, 403, 409, 413, 422]) expect(failureOf(status), String(status)).toBe('refused');
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
        localStorage.setItem('roomivo_cookie_consent', JSON.stringify({ essential: true, analytics: false, preferences: false }));
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

/** Opens the list of spaces. The click is retried once: under parallel test load a first
 *  click has, rarely, not changed the screen (not reproduced in 110 isolated attempts). */
async function openAnswersList(page: Page, name = 'Answer the questions') {
    await expect(async () => {
        await page.getByRole('button', { name }).click({ timeout: 5000 });
        await expect(page.getByTestId('answer-spaces')).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20000 });
}

/** Answers waiting on the phone from an earlier visit, set once before the first load. */
async function seedQueue(page: Page, queue: unknown[]) {
    await page.addInitScript((entries) => {
        if (sessionStorage.getItem('walkthrough-queue-seeded')) return;
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('roomivo-walkthrough-pending:test-code-walkthrough', JSON.stringify(entries));
        sessionStorage.setItem('walkthrough-queue-seeded', '1');
    }, queue);
}

/** The capture session, with each PUT answered by `reply`: a status, a body, or 'abort' for no network. */
async function routeSession(page: Page, walkthrough: Record<string, unknown>,
    reply: (body: unknown) => Promise<number | 'abort' | Record<string, unknown>>) {
    await page.addInitScript(() => {
        localStorage.setItem('app-language', 'en');
        localStorage.setItem('roomivo_cookie_consent', JSON.stringify({ essential: true, analytics: false, preferences: false }));
    });
    await page.route('**/properties/media-sessions/**', async (route) => {
        if (route.request().method() !== 'PUT') return route.fulfill({ json: session(walkthrough) });
        const body = route.request().postDataJSON();
        const result = await reply(body);
        if (result === 'abort') return route.abort('internetdisconnected');
        if (typeof result === 'object') return route.fulfill({ json: result });
        if (result !== 200) return route.fulfill({ status: result, json: { detail: 'refused' } });
        const answers = body.space ? { [body.space]: stamped(body.answers) } : {};
        return route.fulfill({ json: { ...walkthrough, answers } });
    });
}

test.describe('Capture page: quick answers', () => {
    test('the landlord answers one space with taps and it is saved for that space', async ({ page }) => {
        const saved = await openCapture(page, WALK);
        await openAnswersList(page);

        const spaces = page.getByTestId('answer-spaces');
        await expect(spaces.getByRole('button')).toHaveCount(6);
        await expect(spaces.getByRole('button', { name: /Bedroom 2/ })).toBeVisible();
        await expect(spaces.getByRole('button', { name: /Who lives here/ })).toHaveCount(0);

        await spaces.getByRole('button', { name: /Kitchen/ }).click();
        await page.getByRole('group', { name: 'Hob' }).getByRole('button', { name: 'Works' }).click();
        await page.getByRole('group', { name: 'Dishwasher' }).getByRole('button', { name: 'Not here' }).click();
        await page.getByRole('group', { name: 'Oven' }).getByRole('button', { name: 'Not working' }).click();
        await expect(page.getByRole('group', { name: 'Hob' }).getByRole('button', { name: 'Works' })).toHaveAttribute('aria-pressed', 'true');
        // A thing is there or not: no "works" for plates.
        await expect(page.getByRole('group', { name: 'Plates, glasses and cutlery' }).getByRole('button')).toHaveCount(2);

        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(spaces.getByRole('button', { name: /Kitchen/ })).toContainText('3 of 7 answered');
        expect(saved).toEqual([{ space: 'kitchen', answers: { hob: 'working', dishwasher: 'absent', oven: 'not_working' } }]);
    });

    test('tapping the chosen answer again clears it, and reopening a space shows what was saved', async ({ page }) => {
        const saved = await openCapture(page, { ...WALK, answers: { home: stamped({ internet: 'present', lights: 'present' }) } });
        await openAnswersList(page);
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Whole home/ }).click();

        const internet = page.getByRole('group', { name: 'Internet' });
        await expect(internet.getByRole('button', { name: 'Here', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await internet.getByRole('button', { name: 'Here', exact: true }).click();
        await expect(internet.getByRole('button', { name: 'Here', exact: true })).toHaveAttribute('aria-pressed', 'false');

        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByTestId('answer-spaces').getByRole('button', { name: /Whole home/ })).toContainText('1 of 4 answered');
        expect(saved).toEqual([{ space: 'home', answers: { lights: 'present' } }]);
    });

    test('Back leaves a space without saving', async ({ page }) => {
        const saved = await openCapture(page, WALK);
        await openAnswersList(page);
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Bathroom/ }).click();
        await page.getByRole('group', { name: 'Washing machine' }).getByRole('button', { name: 'Works' }).click();
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        await expect(page.getByTestId('answer-spaces').getByRole('button', { name: /Bathroom/ })).toContainText('0 of 2 answered');
        expect(saved).toEqual([]);
    });

    test('a shared home also asks who lives there, and nothing about a person', async ({ page }) => {
        const saved = await openCapture(page, { ...WALK, is_colocation: true });
        await openAnswersList(page);
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Who lives here/ }).click();

        const fields = page.getByTestId('flatmates-fields');
        await expect(fields.locator('input')).toHaveCount(1);
        await expect(fields).not.toContainText(/name|age|gender|nationality|women|men\b/i);

        await fields.getByLabel('How many flatmates live here?').fill('3');
        await fields.getByRole('group', { name: 'They are' }).getByRole('button', { name: 'Students', exact: true }).click();
        await fields.getByRole('group', { name: 'Smoking in the home?' }).getByRole('button', { name: 'No' }).click();
        await fields.getByRole('group', { name: 'Pets in the home?' }).getByRole('button', { name: 'Yes' }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();

        await expect(page.getByTestId('answer-spaces')).toBeVisible();
        expect(saved).toEqual([{ flatmates: { count: 3, occupation: 'students', smoking: false, pets: true } }]);
    });

    test('an out-of-range flatmate count is not sent', async ({ page }) => {
        const saved = await openCapture(page, { ...WALK, is_colocation: true });
        await openAnswersList(page);
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Who lives here/ }).click();
        for (const value of ['999', '-4', '2.5']) {
            await page.getByLabel('How many flatmates live here?').fill(value);
        }
        await page.getByRole('group', { name: 'Pets in the home?' }).getByRole('button', { name: 'No' }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByTestId('answer-spaces')).toBeVisible();
        expect(saved).toEqual([{ flatmates: { pets: false } }]);
    });

    test('with no network the answers are kept on the phone and sent when the connection is back', async ({ page }) => {
        const saved = await openCapture(page, WALK);
        await openAnswersList(page);
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Living area/ }).click();
        await page.getByRole('group', { name: 'Sofa' }).getByRole('button', { name: 'Here', exact: true }).click();

        // The network drops for the save.
        const drop = (route: Route) => route.abort('internetdisconnected');
        await page.route('**/properties/media-sessions/**', drop);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('Saved on this phone. It will be sent as soon as the connection allows.')).toBeVisible();
        await expect(page.getByTestId('answer-spaces').getByRole('button', { name: /Living area/ })).toContainText('1 of 3 answered');
        await expect(page.getByTestId('answers-waiting')).toContainText('Answers waiting to be sent: 1');
        expect(saved).toEqual([]);

        // The connection comes back: the waiting answer is sent once, without reloading.
        await page.unroute('**/properties/media-sessions/**', drop);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await expect.poll(() => saved).toEqual([{ space: 'living', answers: { sofa: 'present' } }]);
        await expect(page.getByTestId('answers-waiting')).toHaveCount(0);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await page.waitForLoadState('networkidle');
        expect(saved).toHaveLength(1);
    });

    test('a server error or the rate limit keeps waiting answers for later', async ({ page }) => {
        await seedQueue(page, [{ space: 'kitchen', answers: { hob: 'working' } }]);
        let status = 503;
        const saved: unknown[] = [];
        await routeSession(page, WALK, async (body) => {
            saved.push(body);
            return status;
        });
        await page.goto('/capture/test-code-walkthrough');
        await openAnswersList(page);
        await expect(page.getByTestId('answers-waiting')).toContainText('Answers waiting to be sent: 1');
        await expect.poll(() => saved.length).toBe(1);

        status = 429;
        await page.getByRole('button', { name: 'Send now' }).click();
        await expect.poll(() => saved.length).toBe(2);
        await expect(page.getByTestId('answers-waiting')).toContainText('Answers waiting to be sent: 1');
        // Still shown as answered: it is kept on the phone, not lost.
        await expect(page.getByTestId('answer-spaces').getByRole('button', { name: /Kitchen/ })).toContainText('1 of 7 answered');

        status = 200;
        await page.getByRole('button', { name: 'Send now' }).click();
        await expect(page.getByTestId('answers-waiting')).toHaveCount(0);
        expect(saved).toEqual(Array(3).fill({ space: 'kitchen', answers: { hob: 'working' } }));
    });

    test('a refused waiting answer is dropped alone, and the landlord is told which space', async ({ page }) => {
        await seedQueue(page, [
            { space: 'kitchen', answers: { hob: 'working' } },
            { space: 'home', answers: { internet: 'present' } },
        ]);
        const saved: { space?: string }[] = [];
        await routeSession(page, WALK, async (body) => {
            saved.push(body as { space?: string });
            return (body as { space?: string }).space === 'kitchen' ? 422 : 200;
        });
        await page.goto('/capture/test-code-walkthrough');
        await expect(page.getByText('These answers were not accepted. Please answer again: Kitchen')).toBeVisible();
        await expect.poll(() => saved.map((b) => b.space)).toEqual(['kitchen', 'home']);
        await openAnswersList(page);
        const spaces = page.getByTestId('answer-spaces');
        await expect(spaces.getByRole('button', { name: /Kitchen/ })).toContainText('0 of 7 answered');
        await expect(spaces.getByRole('button', { name: /Whole home/ })).toContainText('1 of 4 answered');
        await expect(page.getByTestId('answers-waiting')).toHaveCount(0);
    });

    test('a newer save of a space replaces the answer waiting for it', async ({ page }) => {
        await seedQueue(page, [{ space: 'kitchen', answers: { hob: 'working' } }]);
        const saved: unknown[] = [];
        let reachable = false;
        await routeSession(page, WALK, async (body) => {
            if (!reachable) return 'abort';
            saved.push(body);
            return 200;
        });
        await page.goto('/capture/test-code-walkthrough');
        await openAnswersList(page);
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Kitchen/ }).click();
        await expect(page.getByRole('group', { name: 'Hob' }).getByRole('button', { name: 'Works' })).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('group', { name: 'Hob' }).getByRole('button', { name: 'Not working' }).click();

        reachable = true;
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByTestId('answer-spaces')).toBeVisible();
        await expect(page.getByTestId('answers-waiting')).toHaveCount(0);
        await page.reload();
        await page.waitForLoadState('networkidle');
        // The older "works" answer is never sent once the newer one exists.
        expect(saved).toEqual([{ space: 'kitchen', answers: { hob: 'not_working' } }]);
    });

    test('a reload while a save is on its way sends the newer answer, not the older one', async ({ page }) => {
        await seedQueue(page, [{ space: 'kitchen', answers: { hob: 'working' } }]);
        const saved: unknown[] = [];
        let phase: 'offline' | 'hang' | 'online' = 'offline';
        await routeSession(page, WALK, async (body) => {
            if (phase === 'offline') return 'abort';
            if (phase === 'hang') return new Promise(() => {});   // never answers: the page reloads first
            saved.push(body);
            return 200;
        });
        await page.goto('/capture/test-code-walkthrough');
        await openAnswersList(page);
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Kitchen/ }).click();
        await page.getByRole('group', { name: 'Hob' }).getByRole('button', { name: 'Not working' }).click();
        phase = 'hang';
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect.poll(() => page.evaluate(() => localStorage.getItem('roomivo-walkthrough-pending:test-code-walkthrough')))
            .toContain('not_working');
        phase = 'online';
        await page.reload();
        await expect.poll(() => saved).toEqual([{ space: 'kitchen', answers: { hob: 'not_working' } }]);
    });

    test('when the link has expired, answers kept on the phone are not silently lost', async ({ page }) => {
        await seedQueue(page, [{ space: 'kitchen', answers: { hob: 'working' } }, { space: 'home', answers: { internet: 'absent' } }]);
        await page.route('**/properties/media-sessions/**', (route) => route.fulfill({ status: 400, json: { detail: 'Session has expired' } }));
        await page.goto('/capture/test-code-walkthrough');
        await expect(page.getByTestId('answers-not-sent')).toContainText('Answers kept on this phone were not sent: 2');
    });

    test('what the server stored is what the page shows', async ({ page }) => {
        // The server keeps only the hob; the page must not keep showing its own draft.
        await routeSession(page, WALK, async () => ({ ...WALK, answers: { kitchen: stamped({ hob: 'working' }) } }));
        await page.goto('/capture/test-code-walkthrough');
        await openAnswersList(page);
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Kitchen/ }).click();
        await page.getByRole('group', { name: 'Hob' }).getByRole('button', { name: 'Works' }).click();
        await page.getByRole('group', { name: 'Oven' }).getByRole('button', { name: 'Works' }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByTestId('answer-spaces').getByRole('button', { name: /Kitchen/ })).toContainText('1 of 7 answered');
    });

    test('an answer the server refuses is reported and not shown as saved', async ({ page }) => {
        await openCapture(page, WALK);
        await openAnswersList(page);
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Kitchen/ }).click();
        await page.getByRole('group', { name: 'Hob' }).getByRole('button', { name: 'Works' }).click();
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
        await openAnswersList(page, 'Répondre aux questions');
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
        await openAnswersList(page);
        await page.getByTestId('answer-spaces').getByRole('button', { name: /Kitchen/ }).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        const cut = await page.evaluate(() => Array.from(document.querySelectorAll('[aria-pressed]'))
            .map((el) => el.getBoundingClientRect()).filter((box) => box.left < -1 || box.right > window.innerWidth + 1).length);
        expect(cut).toBe(0);

        const works = page.getByRole('group', { name: 'Hob' }).getByRole('button', { name: 'Works' });
        await works.focus();
        await page.keyboard.press('Enter');
        await expect(works).toHaveAttribute('aria-pressed', 'true');
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
        await editor.getByRole('group', { name: 'Hob' }).getByRole('button', { name: 'Not working' }).click();
        await editor.getByRole('button', { name: /Who lives here/ }).click();
        await editor.getByRole('group', { name: 'Pets in the home?' }).getByRole('button', { name: 'Yes' }).click();
        await save(page);

        await expect.poll(() => puts.length).toBe(1);
        const sent = puts[0] as { walkthrough_answers: Record<string, unknown>; flatmates: unknown };
        expect(Object.keys(sent.walkthrough_answers)).toEqual(['kitchen', 'bedroom:0', 'bedroom:1', 'living', 'bathroom', 'home']);
        expect(sent.walkthrough_answers.kitchen).toEqual({ hob: 'not_working' });
        // The household card goes back without its server-set date.
        expect(sent.flatmates).toEqual({ count: 2, pets: true });
    });
});
