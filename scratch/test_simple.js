
try {
    const i18n = require('./frontend/lib/i18n.ts');
    console.log('Keys:', Object.keys(i18n.translations));
    console.log('FR keys:', Object.keys(i18n.translations.fr).slice(0, 5));
} catch (e) {
    console.error(e);
}
