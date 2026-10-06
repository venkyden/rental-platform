import { test, expect } from '@playwright/test';
import { parseSearch, suggestCities, toSearchUrl, MAX_RENT, MIN_RENT } from '../lib/smartSearch';

/**
 * The landing page's sentence search (lib/smartSearch.ts). Pure functions, so
 * these run without a browser, like the i18n parity checks.
 */
const NOW = new Date('2026-10-06T12:00:00Z');
const parse = (text: string) => parseSearch(text, NOW);

test.describe('smart search parser', () => {
    test('place, type and bathrooms from a loose sentence', () => {
        expect(parse('2 bathrooms studio in Croix-Rousse')).toMatchObject({ city: 'Croix-Rousse', typology: 'studio', bathrooms: 2 });
    });

    test('budget, furnished, move-in month and length of stay', () => {
        expect(parse('a furnished studio in Lyon under 600 from September for 9 months')).toMatchObject({
            city: 'Lyon', typology: 'studio', furnished: true, maxRent: 600, moveIn: '2027-09', months: 9,
        });
    });

    test('French sentences', () => {
        expect(parse('un studio à Lyon moins de 600 €')).toMatchObject({ city: 'Lyon', typology: 'studio', maxRent: 600 });
        expect(parse('une colocation à Nantes dès septembre')).toMatchObject({ city: 'Nantes', colocation: true, moveIn: '2027-09' });
        expect(parse('2 chambres, 2 salles de bain à Paris 11e avec balcon et parking')).toMatchObject({
            city: 'Paris 11e', bedrooms: 2, bathrooms: 2, amenities: ['balcony', 'parking'],
        });
        expect(parse('T2 non meublé à Bordeaux pour un an')).toMatchObject({ city: 'Bordeaux', typology: 't2', furnished: false, months: 12 });
    });

    test('a month range becomes a length of stay', () => {
        expect(parse('T2 in Lyon 7e, €750 a month, from 1 september 2027 until june')).toMatchObject({
            city: 'Lyon 7e', typology: 't2', maxRent: 750, moveIn: '2027-09', months: 10,
        });
    });

    test('a month already past this year means next year; a later one means this year', () => {
        expect(parse('room in Lille in January').moveIn).toBe('2027-01');
        expect(parse('room in Lille in December').moveIn).toBe('2026-12');
    });

    test('ambiguous words are not over-read', () => {
        // "may" the verb, "nice" the adjective, "a month" as a price unit, a year as a budget.
        expect(parse('I may need a room in Bordeaux').moveIn).toBeUndefined();
        expect(parse('a nice studio in Lyon').city).toBe('Lyon');
        expect(parse('studio in Paris 600 a month').months).toBeUndefined();
        expect(parse('studio in Paris september 2027').maxRent).toBeUndefined();
        expect(parse('une chambre à Rennes').bedrooms).toBeUndefined();
    });

    test('budgets: stated ones are clamped, bare ones must look like a rent', () => {
        expect(parse('paris under 100').maxRent).toBe(MIN_RENT);
        expect(parse('paris max 99999').maxRent).toBeUndefined();
        expect(parse('paris budget 9000 euros').maxRent).toBe(MAX_RENT);
        expect(parse('lyon 7').maxRent).toBeUndefined();
        expect(parse('toulouse 1 200€').maxRent).toBe(1200);
    });

    test('multi-word and hyphenated cities survive filler-word removal', () => {
        expect(parse('flatshare near Aix-en-Provence').city).toBe('Aix-en-Provence');
        expect(parse('studio le mans').city).toBe('Le Mans');
        expect(parse('t1 à la rochelle').city).toBe('La Rochelle');
        expect(parse('studio saint etienne').city).toBe('Saint-Étienne');
    });

    test('unknown places are kept as typed, tidied', () => {
        expect(parse('studio in montreuil sous bois').city).toBe('Montreuil Sous Bois');
    });

    test('hostile and degenerate input never throws and never passes markup through', () => {
        const inputs = [
            '', '   ', '<script>alert(1)</script> paris', '"><img src=x onerror=alert(1)>', 'paris\u0000\u0007',
            'x'.repeat(5000), '🏠'.repeat(200), '../../etc/passwd', '%00%0a%27', '{{constructor.constructor("x")()}}',
            '999999999999999999999 bathrooms', '0 bathrooms', '-5 bedrooms', 'for 400 months', '31 février 2099',
            // @ts-expect-error deliberately wrong types
            null, undefined, 42, {},
        ];
        for (const input of inputs) {
            const parsed = parseSearch(input as string, NOW);
            expect(parsed.city.length).toBeLessThanOrEqual(60);
            expect(parsed.city).not.toMatch(/[<>"`{}\\\u0000-\u001f]/);
            const url = toSearchUrl(parsed);
            expect(url.startsWith('/search')).toBe(true);
            expect(url).not.toContain('<');
        }
        expect(parse('999999999999999999999 bathrooms').bathrooms).toBeUndefined();
        expect(parse('for 400 months').months).toBeUndefined();
    });

    test('search URL carries every understood filter', () => {
        const url = toSearchUrl(parse('2 bedrooms 2 bathrooms furnished flatshare in Lyon under 800 with balcony from September for 9 months'));
        const params = new URL(url, 'http://x').searchParams;
        expect(Object.fromEntries(params)).toMatchObject({
            q: 'Lyon', colocation: '1', furnished: 'true', max_rent: '800', bedrooms: '2', bathrooms: '2', from: '2027-09', months: '9',
        });
        expect(params.getAll('amenities')).toEqual(['balcony']);
        expect(toSearchUrl(parse(''))).toBe('/search');
    });

    test('city suggestions complete a half-typed place', () => {
        expect(suggestCities('studio in ly')).toEqual(['Lyon']);
        expect(suggestCities('a')).toEqual([]);
        expect(suggestCities('studio in Lyon')).toEqual([]);
    });
});
