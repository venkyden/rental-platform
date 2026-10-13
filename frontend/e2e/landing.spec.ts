import { test, expect, Page } from '@playwright/test';
import { translations } from '../lib/i18n';

/**
 * Home page (components/landing/home). One page for both audiences: the switch
 * rewrites it for a student arriving in France or an owner letting a place.
 */

const prepare = async (page: Page, lang: 'en' | 'fr' = 'en') => {
    await page.addInitScript((language) => {
        localStorage.setItem('app-language', language);
        // Keep the cookie banner out of the way of clicks near the bottom of the viewport.
        localStorage.setItem('roomivo_cookie_consent', JSON.stringify({ essential: true, analytics: false, preferences: false }));
    }, lang);
    // The page must not depend on a backend to render: answer API calls locally.
    // Tests that care about listings register their own, more specific route afterwards.
    await page.route('**/api/v1/**', (route) =>
        route.request().url().includes('/properties')
            ? route.fulfill({ json: [] })
            : route.fulfill({ status: 401, json: { detail: 'Not authenticated' } }));
};

const home = (page: Page) => page.getByTestId('home-experience');
// WebKit words a cancelled request as an "access control" page error. Two cases are set aside, by
// URL shape: a mocked API call cut short by a navigation, and a Next.js link prefetch (?_rsc=) on
// the page's own origin, which cannot fail a cross-origin check. Anything else fails the test.
const CANCELLED = [
    /^XMLHttpRequest cannot load \S+ ?\S*\/api\/v1\/\S* due to access control checks\.?$/,
    /^Fetch API cannot load http: ?\/+127\.0\.0\.1:\d+\/\S*[?&]_rsc=[\w-]+ due to access control checks\.?$/,
];
const realErrors = (errors: string[]) => errors.filter((e) => !CANCELLED.some((pattern) => pattern.test(e)));
const switchTo = (page: Page, name: RegExp) => page.getByRole('button', { name }).first().click();

test.describe('Landing page', () => {
    test.beforeEach(async ({ page }) => {
        await prepare(page);
        await page.goto('/');
    });

    test('hero shows the tagline, headline, smart search and audience switch', async ({ page }) => {
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('h1')).toContainText('Land your real home.');
        await expect(home(page).getByText('Where your heart wants to live').first()).toBeVisible();
        await expect(page.getByRole('search')).toBeVisible();
        await expect(page.locator('#smart-search')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show me rooms' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Moving to France' })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByRole('button', { name: 'Letting a place' })).toHaveAttribute('aria-pressed', 'false');
    });

    test('the switch rewrites the page for landlords and back', async ({ page }) => {
        await switchTo(page, /Letting a place/);
        await expect(page.locator('h1')).toContainText('Film it once.');
        await expect(page.locator('h1')).toContainText('Your place speaks for itself.');
        const list = home(page).locator('a[href="/auth/register?role=landlord"]').first();
        await expect(list).toContainText('List my place');
        await expect(home(page).getByText('Listing is free. One small flat fee, once.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'From empty room to signed lease' })).toBeVisible();
        await expect(page.getByRole('search')).toHaveCount(0);

        await switchTo(page, /Moving to France/);
        await expect(page.locator('h1')).toContainText('Land your real home.');
        await expect(page.getByRole('search')).toBeVisible();
    });

    test('the thread shows four stops for each side', async ({ page }) => {
        for (const name of ['See it move.', 'Checked once. Then deleted.', 'Signed from your phone.', "One small fee. That's all."]) {
            await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
        }
        await expect(home(page).getByText('What you pay Roomivo')).toBeVisible();
        await switchTo(page, /Letting a place/);
        for (const name of ['Film it once.', 'Checked once. Then deleted.', 'Signed from your phone.', "One small fee. That's all."]) {
            await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
        }
        await expect(home(page).getByText('Receiving applications')).toBeVisible();
    });

    test('each phone drawing is one labelled image, not loose text', async ({ page }) => {
        for (const name of [/Taken on site · 6 rooms/, /Scan your passport/, /Your lease is ready/, /What you pay Roomivo: .*Roomivo's fee, One small fee, once/]) {
            await expect(home(page).getByRole('img', { name })).toHaveCount(1);
        }
        await expect(page.getByRole('group', { name: 'Who is this page for?' })).toBeVisible();
    });

    test('pricing copy: no amount, no commission wording and no fee timing, for either side', async ({ page }) => {
        for (const side of [/Moving to France/, /Letting a place/]) {
            await switchTo(page, side);
            const text = await home(page).innerText();
            // The only figure on the page is the visitor's own budget in the search example.
            expect(text.replace(/a studio in Lyon under €600/g, '')).not.toMatch(/€\s?\d|\d\s?€/);
            expect(text).not.toMatch(/commission/i);
            expect(text).not.toMatch(/when the lease is signed|once (a|the) landlord accepts|lease signed/i);
        }
    });

    test('nothing from the credential layer, and no named state file service, on the home page', async ({ page }) => {
        const text = await page.locator('main').innerText();
        expect(text).not.toMatch(/credential|trust layer|portable proof|dossierfacile/i);
    });

    test('copy rules hold for every landing string, in both languages', () => {
        const strings = (node: unknown, out: string[] = []): string[] => {
            if (typeof node === 'string') out.push(node);
            else if (node && typeof node === 'object') Object.values(node).forEach((v) => strings(v, out));
            return out;
        };
        const example = { en: 'a studio in Lyon under €600', fr: 'un studio à Lyon à moins de 600 €' };
        for (const lang of ['en', 'fr'] as const) {
            for (const text of strings(translations[lang].landing.home)) {
                const where = `${lang}: "${text}"`;
                if (text !== example[lang]) expect(text, where).not.toMatch(/€\s?\d|\d\s?€|\d\s?(euros?|eur)\b/i);
                expect(text, where).not.toMatch(/commission|dossier\s?facile|credential|trust layer|portable proof|justificatif num/i);
                // No promise about the brand, no claim about anyone else, no fee timing.
                expect(text, where).not.toMatch(/\bsafe\b|en toute s[ée]curit[ée]|guaranteed|\bgaranti(s|t|ssons)?\b|scam|arnaque|the only|le seul site|unlike|contrairement/i);
                expect(text, where).not.toMatch(/lease is signed|signature du bail|landlord accepts|propri[ée]taire accepte/i);
            }
        }
    });

    test('"How we check" opens the trust page with the verify-by-code box', async ({ page }) => {
        await home(page).getByRole('link', { name: /How we check, and what we keep/ }).click();
        await expect(page).toHaveURL(/\/trust$/);
        await expect(page.getByPlaceholder('Credential code')).toBeVisible();
        await page.getByPlaceholder('Credential code').fill('ABC123');
        await page.getByRole('button', { name: 'Check' }).click();
        await expect(page).toHaveURL(/\/c\/ABC123/);
    });

    test('final call offers a door to each side', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
        await expect(home(page).locator('a[href="/search"]')).toContainText('Find a room');
        await expect(home(page).locator('a[href="/auth/register?role=landlord"]').last()).toContainText('List my place');
    });
});

test.describe('Landing page: smart search', () => {
    test.beforeEach(async ({ page }) => {
        await prepare(page);
        await page.goto('/');
    });

    test('echoes what it understood as the visitor types', async ({ page }) => {
        await page.locator('#smart-search').fill('2 bathrooms studio in Lyon under 600 with balcony');
        const understood = page.locator('#smart-search-understood');
        for (const chip of ['Lyon', 'Studio', 'Bathrooms: 2+', 'Up to €600', 'Balcony']) {
            await expect(understood.getByText(chip, { exact: true })).toBeVisible();
        }
    });

    test('submitting carries every filter into the search page', async ({ page }) => {
        await page.locator('#smart-search').fill('furnished studio in Lyon under 600, 2 bathrooms, for 9 months');
        await page.locator('#smart-search').press('Enter');
        await expect(page).toHaveURL(/\/search\?/);
        const params = new URL(page.url()).searchParams;
        expect(Object.fromEntries(params)).toMatchObject({ q: 'Lyon', typology: 'studio', furnished: 'true', max_rent: '600', bathrooms: '2', months: '9' });
        const chips = page.getByTestId('smart-filters');
        await expect(chips.getByText('Bathrooms: 2+')).toBeVisible();
        await expect(chips.getByText('Stay of 9+ months')).toBeVisible();
    });

    test('a district is searched by its postcode', async ({ page }) => {
        await page.locator('#smart-search').fill('T2 Paris 15 800€');
        await expect(page.locator('#smart-search-understood').getByText('Paris 15e', { exact: true })).toBeVisible();
        await page.locator('#smart-search').press('Enter');
        await expect(page).toHaveURL(/\/search\?q=75015&typology=t2&max_rent=800$/);
    });

    test('a filter the visitor ruled out is not shown as understood', async ({ page }) => {
        await page.locator('#smart-search').fill('studio in Lyon without parking');
        const understood = page.locator('#smart-search-understood');
        await expect(understood.getByText('Lyon', { exact: true })).toBeVisible();
        await expect(understood.getByText('Parking')).toHaveCount(0);
    });

    test('what was understood is announced once typing pauses', async ({ page }) => {
        await page.locator('#smart-search').fill('studio in Lyon');
        await expect(page.getByRole('search').getByRole('status')).toHaveText('Understood: Lyon, Studio');
    });

    test('an example fills the sentence; a city suggestion completes it', async ({ page }) => {
        await page.getByRole('button', { name: 'a flatshare in Nantes from September' }).click();
        await expect(page.locator('#smart-search')).toHaveValue('a flatshare in Nantes from September');
        await page.locator('#smart-search').fill('studio in ly');
        await page.getByRole('button', { name: 'Lyon?' }).click();
        await expect(page.locator('#smart-search')).toHaveValue(/studio in Lyon\s?$/);
        // The suggestion button is gone, so focus goes back to the sentence.
        await expect(page.locator('#smart-search')).toBeFocused();
    });

    test('an empty search still goes to the search page', async ({ page }) => {
        await page.getByRole('button', { name: 'Show me rooms' }).click();
        await expect(page).toHaveURL(/\/search$/);
    });

    test('hostile input is treated as text, never executed', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('dialog', (d) => { errors.push(`dialog: ${d.message()}`); void d.dismiss(); });
        const inputs = [
            '<script>window.__pwned=1</script> paris',
            '"><img src=x onerror="window.__pwned=1">',
            "javascript:alert(1) ' OR 1=1 --",
            '../../etc/passwd %00 %0a',
            'é'.repeat(400),
        ];
        for (const input of inputs) {
            await page.goto('/');
            await page.locator('#smart-search').fill(input);
            await page.locator('#smart-search').press('Enter');
            await expect(page).toHaveURL(/\/search/);
            expect(page.url()).not.toContain('<');
            expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
            await expect(page.locator('body')).toBeVisible();
        }
        expect(realErrors(errors)).toEqual([]);
    });

    test('the search page ignores malformed smart-search parameters', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto('/search?max_rent=abc&bedrooms=-4&bathrooms=1e99&months=9999&from=2027-13&amenities=<script>&amenities=balcony');
        await expect(page.locator('body')).toBeVisible();
        const chips = page.getByTestId('smart-filters');
        await expect(chips.getByText('Balcony')).toBeVisible();
        await expect(chips.locator('button')).toHaveCount(1);
        expect(realErrors(errors)).toEqual([]);
    });
});

test.describe('Search page: filters from the sentence search', () => {
    const SENTENCE_URL = '/search?q=69007&typology=studio&furnished=true&max_rent=600&bathrooms=2&amenities=balcony&amenities=parking&from=2027-09&months=9';
    const isListCall = (url: string) => /\/api\/v1\/properties\?/.test(url);
    const query = (url: string) => new URL(url).searchParams;

    test('every filter in the URL reaches the listings API', async ({ page }) => {
        await prepare(page);
        const call = page.waitForRequest((r) => isListCall(r.url()) && query(r.url()).has('bathrooms_min'));
        await page.goto(SENTENCE_URL);
        const params = query((await call).url());
        expect(Object.fromEntries(params)).toMatchObject({
            city: '69007', property_type: 'studio', furnished: 'true', max_rent: '600',
            bathrooms_min: '2', min_duration_months: '9', available_by: '2027-09-30',
        });
        expect(params.getAll('amenities')).toEqual(['balcony', 'parking']);
    });

    test('the move-in month is sent as the last day of that month', async ({ page }) => {
        await prepare(page);
        const call = page.waitForRequest((r) => isListCall(r.url()) && query(r.url()).has('available_by'));
        await page.goto('/search?q=Lyon&from=2028-02');
        expect(query((await call).url()).get('available_by')).toBe('2028-02-29');
    });

    test('removing a chip removes its filter from the next request', async ({ page }) => {
        await prepare(page);
        const first = page.waitForRequest((r) => isListCall(r.url()) && query(r.url()).has('bathrooms_min'));
        await page.goto(SENTENCE_URL);
        await first;
        const chips = page.getByTestId('smart-filters');
        const next = page.waitForRequest((r) => isListCall(r.url()) && !query(r.url()).has('bathrooms_min'));
        await chips.getByRole('button', { name: /Bathrooms: 2\+/ }).click();
        await expect(chips.getByText('Bathrooms: 2+')).toHaveCount(0);
        const params = query((await next).url());
        expect(params.get('min_duration_months')).toBe('9');
        expect(params.getAll('amenities')).toEqual(['balcony', 'parking']);
    });

    test('Reset clears the chips and the filters behind them', async ({ page }) => {
        await prepare(page);
        const first = page.waitForRequest((r) => isListCall(r.url()) && query(r.url()).has('bathrooms_min'));
        await page.goto(SENTENCE_URL);
        await first;
        const cleared = page.waitForRequest((r) => {
            if (!isListCall(r.url())) return false;
            const params = query(r.url());
            return !['bathrooms_min', 'min_duration_months', 'available_by', 'amenities', 'city', 'property_type'].some((k) => params.has(k));
        });
        await page.getByRole('button', { name: /^Reset/ }).first().click();
        await cleared;
        await expect(page.getByTestId('smart-filters')).toHaveCount(0);
    });

    test('a failed load says so and offers a retry, instead of "no results"', async ({ page }) => {
        await prepare(page);
        let fail = true;
        await page.route('**/api/v1/properties?**', (route) =>
            fail ? route.fulfill({ status: 500, body: 'boom' }) : route.fulfill({ json: [] }));
        await page.goto('/search?q=Lyon');
        const alert = page.getByTestId('search-error');
        await expect(alert).toBeVisible();
        await expect(alert).toHaveAttribute('role', 'alert');
        fail = false;
        await alert.getByRole('button', { name: 'Try again' }).click();
        await expect(alert).toHaveCount(0);
    });
});

test.describe('Landing page: listings block', () => {
    const listing = (i: number) => ({
        id: `00000000-0000-4000-8000-00000000000${i}`, title: `Test studio ${i}`, city: 'Lyon', postal_code: '69007',
        monthly_rent: 540, charges: 0, charges_included: true, bedrooms: 0, rooms_count: 1, property_type: 'studio',
        furnished: true, size_sqm: 18, photos: [], amenities: [], dpe_rating: 'D',
    });

    test('stays hidden below three real listings, with no placeholder homes', async ({ page }) => {
        await prepare(page);
        await page.route('**/api/v1/properties?**', (route) => route.fulfill({ json: [listing(1), listing(2)] }));
        await page.goto('/');
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Find a home in your city' })).toHaveCount(0);
        // Copy and ids of the placeholder cards removed in PR #86.
        await expect(page.getByText('Haussmannian')).toHaveCount(0);
        for (const fakeId of ['1', '2', '3']) {
            await expect(page.locator(`a[href="/properties/${fakeId}"]`)).toHaveCount(0);
        }
    });

    test('appears once there are three', async ({ page }) => {
        await prepare(page);
        await page.route('**/api/v1/properties?**', (route) => route.fulfill({ json: [listing(1), listing(2), listing(3)] }));
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'Find a home in your city' })).toBeVisible();
        await expect(page.getByText('Test studio 1')).toBeVisible();
    });

    test('an unreachable or failing API leaves the page intact', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await prepare(page);
        await page.route('**/api/v1/properties?**', (route) => route.fulfill({ status: 500, body: 'boom' }));
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('Land your real home.');
        await expect(page.getByRole('heading', { name: 'Find a home in your city' })).toHaveCount(0);
        expect(realErrors(errors)).toEqual([]);
    });
});

test.describe('Landing page: languages', () => {
    test('French is complete: no English fallback and no raw keys', async ({ page }) => {
        await prepare(page, 'fr');
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('Trouvez votre vrai chez-vous.');
        await switchTo(page, /Je propose un logement/);
        await expect(page.locator('h1')).toContainText('Filmez-le une fois.');
        for (const side of [/J'arrive en France/, /Je propose un logement/]) {
            await switchTo(page, side);
            const text = await home(page).innerText();
            expect(text).not.toMatch(/landing\.home\.|search\.smart\./);
            expect(text).not.toMatch(/Show me rooms|List my place|One small fee|Checked once|Signed from your phone|Understood:|Try:|Taken on site|Recording|Roomivo's fee/);
        }
    });

    test('the language switcher rewrites the hero', async ({ page }) => {
        await prepare(page);
        await page.goto('/');
        const switchLang = async (lang: 'fr' | 'en') => {
            const btn = page.getByTestId(`lang-switch-${lang}`).first();
            if (await btn.isVisible()) {
                await btn.click();
                return;
            }
            await page.locator('button:has(svg.lucide-menu)').first().click();
            const drawer = page.locator('[data-testid="mobile-nav"]');
            await expect(drawer).toBeVisible({ timeout: 5000 });
            await drawer.locator(`button[data-testid="lang-switch-${lang}"]`).first().click();
            const close = page.locator('button:has(svg.lucide-x)').first();
            if (await close.isVisible()) await close.click();
        };
        await switchLang('fr');
        await expect(page.locator('h1')).toContainText('Trouvez votre vrai chez-vous.');
        await switchLang('en');
        await expect(page.locator('h1')).toContainText('Land your real home.');
    });
});

test.describe('Landing page: stress', () => {
    test('no horizontal overflow from small phones to wide screens, on both sides', async ({ page }) => {
        await prepare(page);
        for (const width of [320, 375, 414, 768, 1024, 1440, 1920]) {
            await page.setViewportSize({ width, height: 800 });
            await page.goto('/');
            for (const side of [/Moving to France/, /Letting a place/]) {
                await switchTo(page, side);
                const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
                expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
                // The root hides horizontal overflow, so also check that no text or control is cut off.
                const cutOff = await page.evaluate(() => {
                    const root = document.querySelector('[data-testid="home-experience"]');
                    const seen = Array.from(root?.querySelectorAll('h1, h2, h3, p, a, button, input, label') ?? []);
                    return seen
                        .filter((el) => !el.closest('[aria-hidden="true"], .sr-only'))
                        .map((el) => ({ el, box: el.getBoundingClientRect() }))
                        .filter(({ box }) => box.width > 0 && (box.left < -1 || box.right > window.innerWidth + 1))
                        .map(({ el }) => `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 40)}"`);
                });
                expect(cutOff, `cut off at ${width}px`).toEqual([]);
            }
        }
    });

    test('rapid switching and typing stay stable', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await prepare(page);
        await page.goto('/');
        for (let i = 0; i < 30; i++) {
            await page.getByRole('button', { name: i % 2 ? 'Moving to France' : 'Letting a place' }).click({ noWaitAfter: true });
        }
        await expect(page.getByRole('button', { name: 'Moving to France' })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('h1')).toContainText('Land your real home.');
        await page.locator('#smart-search').pressSequentially('2 bathrooms studio in Lyon under 600 from September for 9 months with balcony', { delay: 2 });
        await expect(page.locator('#smart-search-understood').getByText('Lyon', { exact: true })).toBeVisible();
        expect(realErrors(errors)).toEqual([]);
    });

    test('reduced motion: every stop is still there', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await prepare(page);
        await page.goto('/');
        for (const name of ['See it move.', 'Checked once. Then deleted.', 'Signed from your phone.', "One small fee. That's all."]) {
            const heading = page.getByRole('heading', { name, exact: true });
            await heading.scrollIntoViewIfNeeded();
            await expect(heading).toBeVisible();
        }
        await expect(home(page).getByText('What you pay Roomivo')).toBeVisible();
    });

    test('keyboard: the switch and the search work without a mouse', async ({ page }) => {
        await prepare(page);
        await page.goto('/');
        await page.getByRole('button', { name: 'Letting a place' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('button', { name: 'Letting a place' })).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: 'Moving to France' }).focus();
        await page.keyboard.press('Space');
        await page.locator('#smart-search').focus();
        await page.keyboard.type('studio in Lyon');
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/search\?q=Lyon&typology=studio/);
    });

    test('no broken images and no page errors while scrolling the whole page', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await prepare(page);
        await page.goto('/');
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y <= height; y += 400) {
            await page.evaluate((v) => window.scrollTo(0, v), y);
            await page.waitForTimeout(80);
        }
        const broken = await page.evaluate(() =>
            Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.src));
        expect(broken).toEqual([]);
        expect(realErrors(errors)).toEqual([]);
    });

    test('without JavaScript the hero and every stop are in the page and not faded out', async ({ browser }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto('/');
        // No script runs, so the stored language is not read: the server renders French.
        await expect(page.locator('h1')).toContainText('Trouvez votre vrai chez-vous.');
        const headings = ['h1', ...['Voyez-le bouger.', 'Vérifié une fois. Puis supprimé.', 'Signé depuis votre téléphone.', "Un seul petit tarif. C'est tout."].map((h) => `h3:has-text("${h}")`)];
        for (const selector of headings) {
            const heading = page.locator(selector).first();
            await expect(heading).toBeVisible();
            // Measured inside the landing page only: the site-wide page transition (app/template.tsx)
            // fades every route in and is not this page's to change.
            const opacity = await heading.evaluate((el) => {
                let value = 1;
                for (let node: Element | null = el; node && !node.matches('[data-testid="home-experience"]'); node = node.parentElement) {
                    value *= Number(getComputedStyle(node).opacity);
                }
                return value;
            });
            expect(opacity, selector).toBe(1);
        }
        await expect(page.locator('a[href="/auth/register?role=landlord"]').first()).toBeVisible();
        await context.close();
    });
});
