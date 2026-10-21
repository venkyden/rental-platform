import { test, expect, Page, Route } from '@playwright/test';
import { translations } from '../lib/i18n';

/**
 * The compliance pack as people meet it: the report form (DSA art. 16), the admin
 * queue that decides reports, and the privacy notice, legal notice and terms that
 * describe them. The decisions themselves are tested in the backend
 * (tests_integration/test_content_reports.py).
 */

const LISTING = '11111111-1111-4111-8111-111111111111';
type Lang = 'en' | 'fr';

async function start(page: Page, lang: Lang, handle: (route: Route, path: string, method: string) => Promise<void> | void) {
    await page.addInitScript((l) => {
        localStorage.setItem('app-language', l);
        localStorage.setItem('roomivo_cookie_consent', JSON.stringify({ essential: true, analytics: false, preferences: false }));
    }, lang);
    await page.route(/\/api\/v1\//, async (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/^.*\/api\/v1/, '');
        await handle(route, path, route.request().method());
    });
}

function listingAndReports(sent: unknown[], reply: { status: number; json?: unknown }) {
    return async (route: Route, path: string, method: string) => {
        if (path === `/properties/${LISTING}`) return route.fulfill({ json: { id: LISTING, title: 'Studio Commerce', status: 'active' } });
        if (path === '/reports' && method === 'POST') {
            sent.push(route.request().postDataJSON());
            return route.fulfill({ status: reply.status, json: reply.json ?? {} });
        }
        return route.fulfill({ status: 401, json: { detail: 'Not authenticated' } });
    };
}

async function fillReport(page: Page, lang: Lang) {
    const r = translations[lang].report;
    await page.getByLabel(new RegExp(r.reasons.discrimination)).check();
    await page.getByLabel(r.explanationLabel).fill('The description says the room is not for foreign students.');
    await page.getByLabel(r.nameLabel).fill('Alex Martin');
    await page.getByLabel(r.emailLabel).fill('alex@example.com');
    await page.getByLabel(r.goodFaith).check();
}

test.describe('report a listing', () => {
    for (const lang of ['en', 'fr'] as const) {
        test(`sends the report and shows the reference (${lang})`, async ({ page }) => {
            const sent: unknown[] = [];
            await start(page, lang, listingAndReports(sent, { status: 201, json: { id: 'ref-123', status: 'received' } }));
            await page.goto(`/report?listing=${LISTING}`);
            const r = translations[lang].report;

            await expect(page.getByRole('heading', { name: r.title })).toBeVisible();
            await expect(page.getByRole('link', { name: 'Studio Commerce' })).toBeVisible();
            await expect(page.getByText(r.howItWorks)).toBeVisible();
            await fillReport(page, lang);
            await page.getByRole('button', { name: r.submit }).click();

            await expect(page.getByRole('heading', { name: r.doneTitle })).toBeVisible();
            await expect(page.getByText('ref-123')).toBeVisible();
            expect(sent).toEqual([{
                property_id: LISTING,
                reason: 'discrimination',
                explanation: 'The description says the room is not for foreign students.',
                notifier_name: 'Alex Martin',
                notifier_email: 'alex@example.com',
                good_faith: true,
            }]);
        });
    }

    test('an incomplete form is not sent', async ({ page }) => {
        const sent: unknown[] = [];
        await start(page, 'en', listingAndReports(sent, { status: 201, json: { id: 'x' } }));
        await page.goto(`/report?listing=${LISTING}`);
        const r = translations.en.report;

        await fillReport(page, 'en');
        await page.getByLabel(r.goodFaith).uncheck();
        await page.getByRole('button', { name: r.submit }).click();

        await expect(page.locator('p[role="alert"]')).toHaveText(r.errors.invalid);
        expect(sent).toEqual([]);
    });

    for (const [status, key] of [[404, 'notFound'], [429, 'tooMany']] as const) {
        test(`explains a ${status} from the server`, async ({ page }) => {
            await start(page, 'en', listingAndReports([], { status }));
            await page.goto(`/report?listing=${LISTING}`);
            await fillReport(page, 'en');
            await page.getByRole('button', { name: translations.en.report.submit }).click();
            await expect(page.locator('p[role="alert"]')).toHaveText(translations.en.report.errors[key]);
        });
    }

    test('without a listing the page says how to report one', async ({ page }) => {
        await start(page, 'en', (route) => route.fulfill({ status: 401, json: {} }));
        await page.goto('/report');
        await expect(page.getByText(translations.en.report.missingListing)).toBeVisible();
    });
});

const ADMIN = {
    id: 'admin-1', email: 'admin@roomivo.eu', full_name: 'Admin', role: 'admin', email_verified: true,
    onboarding_completed: true, available_roles: ['admin'],
};

const REPORTS = [
    {
        id: 'r-open', property_id: LISTING, property_title: 'Studio Commerce', reason: 'scam',
        explanation: 'Asked me for a deposit before any visit.', notifier_name: 'Alex', notifier_email: 'alex@example.com',
        status: 'received', ground: null, decision_reason: null, created_at: '2026-10-20T10:00:00', decided_at: null,
    },
    {
        id: 'r-done', property_id: LISTING, property_title: 'Studio Commerce', reason: 'misleading',
        explanation: 'Photos are from another flat.', notifier_name: null, notifier_email: null,
        status: 'rejected', ground: null, decision_reason: 'The photos match the capture session.',
        created_at: '2026-10-18T10:00:00', decided_at: '2026-10-19T10:00:00',
    },
];

function asAdmin(decisions: unknown[], listStatus = 200) {
    return async (route: Route, path: string, method: string) => {
        if (path.startsWith('/auth/refresh')) return route.fulfill({ json: { access_token: 't', token_type: 'bearer' } });
        if (path.startsWith('/auth/me/segment-config')) return route.fulfill({ json: { segment: 'admin', dashboard_path: '/dashboard', verification_status: {} } });
        if (path.startsWith('/auth/me')) return route.fulfill({ json: ADMIN });
        if (path === '/reports/admin') return route.fulfill({ status: listStatus, json: listStatus === 200 ? REPORTS : { detail: 'Admin access required' } });
        if (path.startsWith('/reports/admin/') && method === 'POST') {
            decisions.push({ path, body: route.request().postDataJSON() });
            return route.fulfill({ json: { status: 'upheld' } });
        }
        return route.fulfill({ json: [] });
    };
}

test.describe('report queue', () => {
    test('a report is upheld with a reason and a ground', async ({ page }) => {
        const decisions: unknown[] = [];
        await start(page, 'en', asAdmin(decisions));
        await page.goto('/admin/reports');
        const a = translations.en.reportsAdmin;

        const open = page.locator('article').filter({ hasText: 'Asked me for a deposit' });
        await expect(open.getByText(a.status.received)).toBeVisible();
        await expect(open.getByText('alex@example.com', { exact: false })).toBeVisible();
        const uphold = open.getByRole('button', { name: a.uphold });
        await expect(uphold).toBeDisabled();

        await open.getByLabel(a.decisionReason).fill('The listing asks for money before any visit.');
        await open.getByLabel(a.groundTerms).check();
        await uphold.click();

        await expect.poll(() => decisions).toEqual([{
            path: '/reports/admin/r-open/decision',
            body: { decision: 'upheld', reason: 'The listing asks for money before any visit.', ground: 'terms' },
        }]);

        const done = page.locator('article').filter({ hasText: 'Photos are from another flat.' });
        await expect(done.getByText(a.reporterErased)).toBeVisible();
        await expect(done.getByRole('button')).toHaveCount(0);
    });

    test('someone who is not an admin is told so', async ({ page }) => {
        await start(page, 'en', asAdmin([], 403));
        await page.goto('/admin/reports');
        await expect(page.locator('p[role="alert"]')).toHaveText(translations.en.reportsAdmin.forbidden);
    });
});

test.describe('legal pages', () => {
    for (const lang of ['en', 'fr'] as const) {
        test(`the privacy notice covers what the GDPR requires (${lang})`, async ({ page }) => {
            await start(page, lang, (route) => route.fulfill({ status: 401, json: {} }));
            await page.goto('/legal/privacy');
            const sections = translations[lang].legal.privacy.sections as Record<string, { title: string }>;
            for (const key of ['controller', 'data', 'purposes', 'recipients', 'transfers', 'retention', 'automated', 'rights', 'security']) {
                await expect(page.getByRole('heading', { name: sections[key].title })).toBeVisible();
            }
            await expect(page.getByText(/CNIL/)).toBeVisible();
        });

        test(`the legal notice gives the DSA contact points (${lang})`, async ({ page }) => {
            await start(page, lang, (route) => route.fulfill({ status: 401, json: {} }));
            await page.goto('/legal/mentions-legales');
            const notice = translations[lang].legal.notice;
            await expect(page.getByRole('heading', { name: notice.contactPoints.title })).toBeVisible();
            await expect(page.getByText(notice.contactPoints.content)).toBeVisible();
        });

        test(`the legal notice names the company that publishes the site (${lang})`, async ({ page }) => {
            await start(page, lang, (route) => route.fulfill({ status: 401, json: {} }));
            await page.goto('/legal/mentions-legales');
            const editor = translations[lang].legal.notice.editor;
            await expect(page.getByText(editor.company, { exact: true })).toBeVisible();
            await expect(page.getByText(/U58200PY2026PTC009828/)).toBeVisible();
            await expect(page.getByText(editor.labels.address)).toBeVisible();
            await expect(page.getByText(/Pondicherry 605011, India/)).toBeVisible();
            await expect(page.getByText(/Audencia Pôle Entrepreneuriat/).first()).toBeVisible();
        });
    }

    test('nothing claims more than the code does', () => {
        for (const lang of ['en', 'fr'] as const) {
            const words = JSON.stringify(translations[lang].legal.privacy) + JSON.stringify(translations[lang].legal.notice)
                + JSON.stringify(translations[lang].report);
            // Fernet is AES-128; the old notice said AES-256. Nothing is "verified" by a report.
            expect(words, lang).not.toMatch(/AES-256|verify-and-forget|never the original file/i);
        }
    });

    test('the terms say how to report a listing and what happens next', () => {
        expect(translations.en.legal.terms.sections.listings.content).toContain('“Report this listing”');
        expect(translations.fr.legal.terms.sections.listings.content).toContain('« Signaler cette annonce »');
        expect(translations.en.legal.terms.sections.listings.content).toContain('225-1');
    });
});
