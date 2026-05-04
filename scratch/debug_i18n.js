
const fs = require('fs');
const content = fs.readFileSync('/Users/venkat/rental-platform/frontend/lib/i18n.ts', 'utf8');

let jsContent = content
    .replace(/export type Language = 'en' \| 'fr';/, '')
    .replace(/export const translations =/, 'const translations =')
    .replace(/};$/, 'module.exports = { translations };');

try {
    fs.writeFileSync('/Users/venkat/rental-platform/scratch/i18n_v2.js', jsContent);
    const { translations } = require('/Users/venkat/rental-platform/scratch/i18n_v2.js');
    
    console.log('FR Inbox:', JSON.stringify(translations.fr.inbox, null, 2));
    console.log('FR Dashboard Title:', translations.fr.dashboard.title);
} catch (e) {
    console.error('FAILURE:', e.message);
}
