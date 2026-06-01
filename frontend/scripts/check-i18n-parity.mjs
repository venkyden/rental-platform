/**
 * i18n parity checker — ensures the FR and EN translation trees have identical
 * key sets so the silent English fallback never masks a missing translation.
 *
 * Usage:
 *   node --experimental-strip-types frontend/scripts/check-i18n-parity.mjs [keyPrefix]
 *
 * With no argument it reports all gaps and exits 1 if any exist.
 * With a prefix (e.g. "auth.") it only checks that subtree and exits 1 on a gap.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prefix = process.argv[2] || '';

const { translations } = await import(
  'file://' + path.resolve(__dirname, '../lib/i18n.ts')
);

const flatKeys = (obj, p = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flatKeys(v, p + k + '.')
      : [p + k]
  );

const en = new Set(flatKeys(translations.en).filter((k) => k.startsWith(prefix)));
const fr = new Set(flatKeys(translations.fr).filter((k) => k.startsWith(prefix)));

const missingFr = [...en].filter((k) => !fr.has(k));
const missingEn = [...fr].filter((k) => !en.has(k));

console.log(`Scope: ${prefix || '(all)'}  EN=${en.size}  FR=${fr.size}`);
if (missingFr.length) console.log(`Missing in FR (${missingFr.length}):\n  ` + missingFr.join('\n  '));
if (missingEn.length) console.log(`Missing in EN (${missingEn.length}):\n  ` + missingEn.join('\n  '));

if (missingFr.length || missingEn.length) {
  console.error('\n❌ i18n parity check FAILED');
  process.exit(1);
}
console.log('✅ i18n parity OK');
