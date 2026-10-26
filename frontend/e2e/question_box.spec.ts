import { test, expect, Route } from '@playwright/test';
import { matchQuestion, ITEM_KEYS_WITH_WORDS } from '../lib/questionMatch';
import { WALKTHROUGH_ITEMS, householdLines, householdLine } from '../lib/walkthrough';
import { translations } from '../lib/i18n';

/**
 * The question box, step 1: as a student types, the owner's walk-through answers
 * that match are found. Sending a question and refusing questions about who may
 * rent are tested in the backend (tests_integration/test_listing_questions.py,
 * tests/test_question_screen.py).
 */

const ANSWERS = {
    kitchen: { dishwasher: { state: 'absent', answered_at: '2026-10-12T10:00:00Z' }, oven: { state: 'working' } },
    'bedroom:0': { desk: { state: 'present' } },
    'bedroom:1': { desk: { state: 'absent' } },
    bathroom: { washing_machine: { state: 'not_working' } },
    home: { internet: { state: 'present' } },
};

const keys = (q: string, bedrooms = 2) => matchQuestion(q, ANSWERS, bedrooms).items.map((m) => `${m.spaceKey}.${m.key}`);

test.describe('question box: matching the owner\'s answers', () => {
    test('every walk-through item has words a student may use', () => {
        expect([...ITEM_KEYS_WITH_WORDS].sort()).toEqual(WALKTHROUGH_ITEMS.map((i) => i.key).sort());
    });

    test('English and French, with or without accents and hyphens', () => {
        expect(keys('Is there a dishwasher?')).toEqual(['kitchen.dishwasher']);
        expect(keys('Y a-t-il un lave-vaisselle ?')).toEqual(['kitchen.dishwasher']);
        expect(keys('le wifi marche ?')).toEqual(['home.internet']);
        expect(keys('Does the washing machine work?')).toEqual(['bathroom.washing_machine']);
        expect(keys('Le lave linge fonctionne ?')).toEqual(['bathroom.washing_machine']);
    });

    test('an item answered in several rooms is shown for each', () => {
        expect(keys('is there a desk in the rooms')).toEqual(['bedroom:0.desk', 'bedroom:1.desk']);
        expect(keys('is there a desk', 1)).toEqual(['bedroom:0.desk']);
    });

    test('whole words only, and nothing the owner did not answer', () => {
        expect(keys('is it comfortable and stable?')).toEqual([]);
        expect(keys('is there a microwave?')).toEqual([]);
        expect(keys('')).toEqual([]);
    });

    test('household facts only for a shared home and only what the owner said', () => {
        const flatmates = { count: 2, smoking: false, answered_at: '2026-10-12' };
        expect(matchQuestion('Do the flatmates smoke?', {}, 1, flatmates).household).toEqual(['count', 'smoking']);
        expect(matchQuestion('any pets?', {}, 1, flatmates).household).toEqual([]);
        expect(matchQuestion('Do the flatmates smoke?', {}, 1, null).household).toEqual([]);
    });

    test('the household card reads the same as before', () => {
        const t = (key: string, params?: Record<string, string | number>, fallback?: string) =>
            fallback ?? (params ? `${key}:${JSON.stringify(params)}` : key);
        const card = { count: 2, occupation: 'students', smoking: false, pets: true };
        expect(householdLines(t, card)).toEqual(['2 flatmates', 'students', 'No smoking in the home', 'Pets in the home']);
        expect(householdLine(t, card, 'pets')).toBe('Pets in the home');
        expect(householdLine(t, { count: 1 }, 'smoking')).toBeUndefined();
    });

    test('the notice about who may rent names the protected grounds in both languages', () => {
        expect(translations.en.questionBox.whoMayRent).toMatch(/nationality.*religion.*family situation.*disability/);
        expect(translations.fr.questionBox.whoMayRent).toMatch(/nationalité.*religion.*situation de famille.*handicap/);
    });
});

test.describe('inbox link', () => {
    test('/inbox?conversation=<id> opens that conversation', async ({ page }) => {
        const asked: string[] = [];
        await page.addInitScript(() => {
            localStorage.setItem('app-language', 'en');
            localStorage.setItem('roomivo_cookie_consent', JSON.stringify({ essential: true, analytics: false, preferences: false }));
        });
        await page.route(/\/api\/v1\//, async (route: Route) => {
            const path = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, '');
            if (path.startsWith('/auth/refresh')) return route.fulfill({ json: { access_token: 't', token_type: 'bearer' } });
            if (path.startsWith('/auth/me/segment-config')) return route.fulfill({ json: { segment: 'tenant', dashboard_path: '/dashboard', verification_status: {} } });
            if (path.startsWith('/auth/me')) return route.fulfill({ json: { id: 'u1', email: 's@x.com', role: 'tenant', email_verified: true, onboarding_completed: true, available_roles: ['tenant'] } });
            if (path.startsWith('/conversations/')) {
                asked.push(path);
                return route.fulfill({ json: { id: 'conv-1', property_id: 'p1', property_title: 'Studio Commerce', messages: [], other_party_name: 'Owner' } });
            }
            return route.fulfill({ json: [] });
        });

        await page.goto('/inbox?conversation=conv-1');
        await expect.poll(() => asked.some((p) => p.startsWith('/conversations/conv-1'))).toBe(true);
    });
});
