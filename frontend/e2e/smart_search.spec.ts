import { test, expect } from '@playwright/test';
import { translations } from '../lib/i18n';
import { parseSearch, suggestCities, toSearchUrl, formatMonth, KNOWN_CITIES, MAX_RENT } from '../lib/smartSearch';

/**
 * The landing page's sentence search (lib/smartSearch.ts). Pure functions, so
 * these run without a browser, like the i18n parity checks.
 */
// Local time, like the parser: a UTC literal would shift the month near midnight in some zones.
const NOW = new Date(2026, 9, 6, 12);
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
        expect(parse('un studio à Lyon à moins de 600 €')).toMatchObject({ city: 'Lyon', typology: 'studio', maxRent: 600 });
        expect(parse('une colocation à Nantes dès septembre')).toMatchObject({ city: 'Nantes', colocation: true, moveIn: '2027-09' });
        expect(parse('2 chambres, 2 salles de bain à Paris 11e avec balcon et parking')).toMatchObject({
            city: 'Paris 11e', postcode: '75011', bedrooms: 2, bathrooms: 2, amenities: ['balcony', 'parking'],
        });
        expect(parse('T2 non meublé à Bordeaux pour un an')).toMatchObject({ city: 'Bordeaux', typology: 't2', furnished: false, months: 12 });
    });

    test('a month range becomes a length of stay', () => {
        expect(parse('T2 in Lyon 7e, €750 a month, from 1 september 2027 until june')).toMatchObject({
            city: 'Lyon 7e', typology: 't2', maxRent: 750, moveIn: '2027-09', months: 10,
        });
    });

    test('a day before the month does not hide the month', () => {
        expect(parse('studio in Lyon from 1 September').moveIn).toBe('2027-09');
        expect(parse('studio à Lyon à partir du 15 septembre').moveIn).toBe('2027-09');
    });

    test('an end month alone is not a move-in month', () => {
        expect(parse('studio in Lyon until June').moveIn).toBeUndefined();
        expect(parse("studio à Lyon jusqu'en juin").moveIn).toBeUndefined();
    });

    test('a month already past this year means next year; a later one means this year', () => {
        expect(parse('room in Lille in January').moveIn).toBe('2027-01');
        expect(parse('room in Lille in December').moveIn).toBe('2026-12');
        expect(parse('studio in Lyon from September 2025').moveIn).toBeUndefined();
    });

    test('"sept mois" is seven months, not September', () => {
        expect(parse('studio à Lyon pour sept mois')).toMatchObject({ city: 'Lyon', months: 7 });
        expect(parse('studio à Lyon pour sept mois').moveIn).toBeUndefined();
    });

    test('ambiguous words are not over-read', () => {
        // "may" the verb, "nice" the adjective, "a month" as a price unit, a year as a budget.
        expect(parse('I may need a room in Bordeaux').moveIn).toBeUndefined();
        expect(parse('march in Lyon').moveIn).toBeUndefined();
        expect(parse('studio 8 mai 1945 Lyon').moveIn).toBeUndefined();
        expect(parse('a nice studio in Lyon').city).toBe('Lyon');
        expect(parse('a nice studio under 600').city).toBe('');
        expect(parse('studio in Nice').city).toBe('Nice');
        expect(parse('studio in Paris 600 a month').months).toBeUndefined();
        expect(parse('studio in Paris september 2027').maxRent).toBeUndefined();
        expect(parse('une chambre à Rennes').bedrooms).toBeUndefined();
        expect(parse('shared bathroom studio in Lyon').colocation).toBe(false);
        expect(parse('studio 20m2 in Lyon').maxRent).toBeUndefined();
    });

    test('a negated filter is never applied as its opposite', () => {
        expect(parse('studio sans ascenseur à Lyon')).toMatchObject({ city: 'Lyon', typology: 'studio', amenities: [] });
        expect(parse('no balcony studio in Lyon')).toMatchObject({ city: 'Lyon', typology: 'studio', amenities: [] });
        expect(parse('studio in Lyon without parking').amenities).toEqual([]);
        expect(parse('not furnished T2 in Paris')).toMatchObject({ city: 'Paris', typology: 't2', furnished: false });
    });

    test('budgets: only an upper figure becomes the maximum rent', () => {
        expect(parse('paris over 500').maxRent).toBeUndefined();
        expect(parse('paris at least 500').maxRent).toBeUndefined();
        expect(parse('between 600 and 800 paris').maxRent).toBe(800);
        expect(parse('entre 600 et 800 € à Lyon').maxRent).toBe(800);
        // Below the slider's minimum the figure is dropped, not silently raised.
        expect(parse('paris under 100').maxRent).toBeUndefined();
        expect(parse('paris budget 9000 euros').maxRent).toBe(MAX_RENT);
        expect(parse('toulouse 1 200€').maxRent).toBe(1200);
        expect(parse('studio 25 m² à Nantes 600e')).toMatchObject({ city: 'Nantes', maxRent: 600 });
    });

    test('districts and postcodes search by postcode', () => {
        expect(parse('T2 Paris 15 800€')).toMatchObject({ city: 'Paris 15e', postcode: '75015', typology: 't2', maxRent: 800 });
        expect(parse('lyon 7')).toMatchObject({ city: 'Lyon 7e', postcode: '69007' });
        expect(parse('lyon 7').maxRent).toBeUndefined();
        expect(parse('paris 75011 studio')).toMatchObject({ city: 'Paris 75011', postcode: '75011' });
        expect(toSearchUrl(parse('studio Lyon 7e'))).toBe('/search?q=69007&typology=studio');
        // A five-figure budget is not a postcode.
        expect(parse('max 10000 euros paris')).toMatchObject({ city: 'Paris', maxRent: MAX_RENT });
        expect(parse('max 10000 euros paris').postcode).toBeUndefined();
    });

    test('multi-word, hyphenated and accented places are kept whole', () => {
        expect(parse('flatshare near Aix-en-Provence').city).toBe('Aix-en-Provence');
        expect(parse('studio le mans').city).toBe('Le Mans');
        expect(parse('t1 à la rochelle').city).toBe('La Rochelle');
        expect(parse('studio saint etienne').city).toBe('Saint-Étienne');
        expect(parse('studio in Ivry-sur-Seine').city).toBe('Ivry-sur-Seine');
        expect(parse('studio near Paris-Saclay').city).toBe('Paris-Saclay');
        expect(parse('chambre à Évry').city).toBe('Évry');
        expect(parse('room near Champ de Mars').city).toBe('Champ de Mars');
        expect(parse('studio in montreuil sous bois').city).toBe('Montreuil sous Bois');
    });

    test('hostile and degenerate input never throws and never passes markup through', () => {
        const inputs: unknown[] = [
            '', '   ', '<script>alert(1)</script> paris', '"><img src=x onerror=alert(1)>', 'paris\u0000\u0007',
            'x'.repeat(5000), '🏠'.repeat(200), '../../etc/passwd', '%00%0a%27', '{{constructor.constructor("x")()}}',
            '999999999999999999999 bathrooms', '0 bathrooms', '-5 bedrooms', 'for 400 months', '31 février 2099',
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
        // An out-of-range number is dropped whole: its unit does not become a place.
        expect(parse('999999999999999999999 bathrooms')).toMatchObject({ city: '', amenities: [] });
        expect(parse('999999999999999999999 bathrooms').bathrooms).toBeUndefined();
        expect(parse('for 400 months')).toMatchObject({ city: '' });
        expect(parse('for 400 months').months).toBeUndefined();
        expect(parse('for 400 months').maxRent).toBeUndefined();
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
        expect(suggestCities('studio à mars')).toEqual(['Marseille']);
        expect(suggestCities('a')).toEqual([]);
        expect(suggestCities('studio in Lyon')).toEqual([]);
    });

    test('a month is written in the visitor\'s language, and a malformed one is left alone', () => {
        expect(formatMonth('2027-09', 'en')).toBe('September 2027');
        expect(formatMonth('2027-09', 'fr')).toBe('septembre 2027');
        expect(formatMonth('not-a-month', 'en')).toBe('not-a-month');
    });

    test('the examples offered on the landing page are understood, in both languages', () => {
        for (const lang of ['en', 'fr'] as const) {
            const examples = Object.values(translations[lang].landing.home.hero.search.examples) as string[];
            expect(examples).toHaveLength(3);
            for (const example of examples) {
                const parsed = parse(example);
                expect(KNOWN_CITIES, `${lang}: "${example}"`).toContain(parsed.city);
                const filters = [parsed.typology, parsed.colocation || undefined, parsed.bedrooms, parsed.maxRent, parsed.moveIn];
                expect(filters.filter(Boolean).length, `${lang}: "${example}"`).toBeGreaterThan(0);
            }
        }
    });
});
