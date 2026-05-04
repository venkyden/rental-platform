
import { translations } from './frontend/lib/i18n.ts';

console.log('Keys in translations:', Object.keys(translations));
if (translations.fr) {
    console.log('Keys in translations.fr:', Object.keys(translations.fr));
    console.log('FR Inbox Title:', translations.fr.inbox ? translations.fr.inbox.title : 'MISSING');
} else {
    console.log('translations.fr is UNDEFINED');
}
