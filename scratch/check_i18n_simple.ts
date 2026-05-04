import { translations } from './frontend/lib/i18n';

function checkKey(key: string) {
    const keys = key.split('.');
    let valEn: any = translations.en;
    let valFr: any = translations.fr;
    
    console.log(`Checking key: ${key}`);
    for (const k of keys) {
        valEn = valEn?.[k];
        valFr = valFr?.[k];
    }
    console.log(`EN: ${JSON.stringify(valEn)}`);
    console.log(`FR: ${JSON.stringify(valFr)}`);
    if (valEn === undefined) console.log(`!! Missing in EN: ${key}`);
    if (valFr === undefined) console.log(`!! Missing in FR: ${key}`);
}

const keysToCheck = [
    'dashboard.verification.verification.pageTitle',
    'dashboard.verification.secureSubtitle',
    'dashboard.verification.verification.progress.email',
    'dashboard.verification.verification.progress.identity',
    'dashboard.verification.verification.progress.employment',
    'dashboard.verification.verification.progress.trustScore',
    'dashboard.points',
    'dashboard.verification.verification.tabs.identity',
    'dashboard.verification.verification.tabs.employment',
    'dashboard.verification.verification.success.identity',
    'dashboard.verification.verification.success.identityMsg',
    'dashboard.verification.verification.success.employment',
    'dashboard.verification.verification.success.employmentMsg'
];

keysToCheck.forEach(checkKey);
