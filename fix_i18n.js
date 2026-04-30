const fs = require('fs');

let content = fs.readFileSync('frontend/lib/i18n.ts', 'utf-8');

const enInsert = `
            globalFooter: {
                terms: "Terms of Service",
                privacy: "Privacy & CNIL",
                cookies: "Cookie Policy",
                gdpr: "GDPR Rights",
                help: "Help Center",
                rights: "All rights reserved."
            },
            landing: {
                trustBadges: {
                    gdpr: "GDPR Compliant",
                    frenchLaw: "French Law Compliant",
                    stripe: "Secured by Stripe"
                },
                footer: {
                    slogan: "Rent securely in France",
                    platform: "Platform",
                    legal: "Legal",
                    support: "Support",
                    terms: "Terms of Sale",
                    privacy: "Privacy Policy",
                    notices: "Legal Notices",
                    help: "Help"
                }
            },`;

const frInsert = `
            globalFooter: {
                terms: "Conditions Générales",
                privacy: "Confidentialité & CNIL",
                cookies: "Politique des Cookies",
                gdpr: "Droits RGPD",
                help: "Centre d'Aide",
                rights: "Tous droits réservés."
            },
            landing: {
                trustBadges: {
                    gdpr: "Conforme RGPD",
                    frenchLaw: "Conforme à la loi ALUR",
                    stripe: "Sécurisé par Stripe"
                },
                footer: {
                    slogan: "Louez en toute sécurité en France",
                    platform: "Plateforme",
                    legal: "Légal",
                    support: "Support",
                    terms: "Conditions Générales de Vente",
                    privacy: "Politique de Confidentialité",
                    notices: "Mentions Légales",
                    help: "Aide"
                }
            },`;

// Find "en: {" and "fr: {"
const enStart = content.indexOf('en: {');
const frStart = content.indexOf('fr: {');

if (enStart !== -1 && frStart !== -1) {
    const enVerificationIndex = content.indexOf('verification: {', enStart);
    if (enVerificationIndex !== -1) {
        content = content.slice(0, enVerificationIndex) + enInsert + '\n' + content.slice(enVerificationIndex);
    }
    
    // Find frStart again because indices shifted
    const newFrStart = content.indexOf('fr: {');
    const frVerificationIndex = content.indexOf('verification: {', newFrStart);
    if (frVerificationIndex !== -1) {
        content = content.slice(0, frVerificationIndex) + frInsert + '\n' + content.slice(frVerificationIndex);
    }
}

fs.writeFileSync('frontend/lib/i18n.ts', content);
console.log('Fixed i18n.ts');
