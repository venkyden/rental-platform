import { translations } from './frontend/lib/i18n';

function compareKeys(obj1: any, obj2: any, path = ''): string[] {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    let missing: string[] = [];

    for (const key of keys1) {
        const fullPath = path ? `${path}.${key}` : key;
        if (!(key in obj2)) {
            missing.push(`Missing in FR: ${fullPath}`);
        } else if (typeof obj1[key] === 'object' && obj1[key] !== null) {
            missing = missing.concat(compareKeys(obj1[key], obj2[key], fullPath));
        }
    }

    for (const key of keys2) {
        const fullPath = path ? `${path}.${key}` : key;
        if (!(key in obj1)) {
            missing.push(`Missing in EN: ${fullPath}`);
        }
    }

    return missing;
}

const missing = compareKeys(translations.en, translations.fr);
console.log('--- Missing or Mismatched Keys ---');
missing.forEach(m => console.log(m));

const checkKey = (key: string) => {
    const keys = key.split('.');
    let valEn: any = translations.en;
    let valFr: any = translations.fr;
    
    console.log(`\nChecking key: ${key}`);
    for (const k of keys) {
        valEn = valEn?.[k];
        valFr = valFr?.[k];
    }
    console.log(`EN: ${JSON.stringify(valEn)}`);
    console.log(`FR: ${JSON.stringify(valFr)}`);
};

checkKey('dashboard.verification.verification.pageTitle');
checkKey('dashboard.verification.verification.progress.email');
checkKey('dashboard.verification.verification.progress.identity');
checkKey('dashboard.verification.verification.progress.employment');
checkKey('dashboard.verification.verification.progress.trustScore');
checkKey('dashboard.verification.secureSubtitle');
checkKey('dashboard.points');
