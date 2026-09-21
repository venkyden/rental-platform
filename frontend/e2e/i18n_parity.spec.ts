import { test, expect } from '@playwright/test';
import { translations } from '../lib/i18n';

/**
 * WP5 — EN/FR dictionary parity.
 *
 * The UI defaults to French, so a key present in `en` but missing in `fr` shows
 * a real French user either English text or (when there is no inline fallback)
 * a raw dotted key. This walks both dictionaries and fails with the exact paths,
 * so a missing translation is caught here instead of in front of a user.
 */

type Dict = Record<string, unknown>;

function collectPaths(node: unknown, prefix = '', out: string[] = []): string[] {
    if (node && typeof node === 'object' && !Array.isArray(node)) {
        for (const [key, value] of Object.entries(node as Dict)) {
            collectPaths(value, prefix ? `${prefix}.${key}` : key, out);
        }
    } else {
        out.push(prefix);
    }
    return out;
}

test.describe('i18n dictionary parity (WP5)', () => {
    test('every English key has a French counterpart', () => {
        const en = new Set(collectPaths(translations.en));
        const fr = new Set(collectPaths(translations.fr));
        const missingInFr = [...en].filter((k) => !fr.has(k)).sort();
        expect(missingInFr, `Keys missing from the French dictionary:\n${missingInFr.join('\n')}`).toEqual([]);
    });

    test('every French key has an English counterpart', () => {
        const en = new Set(collectPaths(translations.en));
        const fr = new Set(collectPaths(translations.fr));
        const missingInEn = [...fr].filter((k) => !en.has(k)).sort();
        expect(missingInEn, `Keys missing from the English dictionary:\n${missingInEn.join('\n')}`).toEqual([]);
    });

    test('no translated value is an empty string', () => {
        const empties: string[] = [];
        for (const lang of ['en', 'fr'] as const) {
            const walk = (node: unknown, prefix = '') => {
                if (node && typeof node === 'object' && !Array.isArray(node)) {
                    for (const [k, v] of Object.entries(node as Dict)) {
                        walk(v, prefix ? `${prefix}.${k}` : k);
                    }
                } else if (typeof node === 'string' && node.trim() === '') {
                    empties.push(`${lang}.${prefix}`);
                }
            };
            walk(translations[lang]);
        }
        expect(empties, `Empty translation values:\n${empties.join('\n')}`).toEqual([]);
    });
});
