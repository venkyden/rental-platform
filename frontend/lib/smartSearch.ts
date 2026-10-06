/**
 * Smart search: turns one free-text sentence ("a furnished studio with 2
 * bathrooms in Lyon under 600 from September for 9 months") into the filters
 * the search page understands. Deterministic and local on purpose: no AI, no
 * network, instant, works in English and French. Anything it does not
 * recognise is kept as the place to search in.
 */

export type Typology = 'studio' | 't1' | 't2' | 't3plus';

export interface ParsedSearch {
    /** City, district or any other locality text. */
    city: string;
    typology?: Typology;
    colocation: boolean;
    furnished?: boolean;
    maxRent?: number;
    bedrooms?: number;
    bathrooms?: number;
    amenities: string[];
    /** Month the tenant wants to move in, as YYYY-MM. */
    moveIn?: string;
    /** Length of stay in months. */
    months?: number;
}

// The search page's budget slider range (app/search/page.tsx).
export const MIN_RENT = 300;
export const MAX_RENT = 5000;
export const MAX_MONTHS = 36;
const MAX_QUERY_LENGTH = 60;

/** Cities where students most often look; used to recognise a city anywhere in the sentence. */
export const KNOWN_CITIES = [
    'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes', 'Rennes', 'Montpellier',
    'Strasbourg', 'Grenoble', 'Nice', 'Angers', 'Dijon', 'Clermont-Ferrand', 'Aix-en-Provence', 'Rouen',
    'Tours', 'Reims', 'Caen', 'Nancy', 'Metz', 'Poitiers', 'Saint-Étienne', 'Brest', 'Le Mans', 'Orléans',
    'Besançon', 'Limoges', 'Amiens', 'Pau', 'La Rochelle', 'Toulon', 'Le Havre', 'Villeurbanne', 'Cergy',
];

/** Amenity keys the listings API filters on (STANDARD_AMENITIES in the listing wizard). */
export const AMENITY_KEYS = ['elevator', 'balcony', 'parking', 'garden', 'terrace', 'cellar', 'pool', 'gym', 'security'];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// "unfurnished" must be tested before "furnished".
const UNFURNISHED = /\b(unfurnished|non[\s-]?meublee?s?|vide|nue?)\b/;
const FURNISHED = /\b(furnished|meublee?s?)\b/;
const COLOCATION = /\b(colocations?|colocs?|flat[\s-]?shares?|house[\s-]?shares?|shared|room[\s-]?mates?|flat[\s-]?mates?|house[\s-]?mates?)\b/;
const TYPOLOGIES: [RegExp, Typology][] = [
    [/\b(t[3-9]|f[3-9]|[3-9]\s?(rooms?|pieces?)|(three|four|trois|quatre)\s?(rooms?|pieces?))\b/, 't3plus'],
    [/\b(t2|f2|2\s?(rooms?|pieces?)|(two|deux)\s?(rooms?|pieces?))\b/, 't2'],
    [/\b(t1|f1|1\s?(room|piece)|one\s?room|une\s?piece)\b/, 't1'],
    [/\bstudios?\b/, 'studio'],
];

const NUMBER_WORDS: Record<string, number> = {
    a: 1, an: 1, one: 1, un: 1, une: 1, two: 2, deux: 2, three: 3, trois: 3, four: 4, quatre: 4,
    six: 6, nine: 9, neuf: 9, twelve: 12, douze: 12,
};
const toNumber = (word: string) => NUMBER_WORDS[word] ?? Number(word);
const COUNT = '(\\d|one|two|three|four|deux|trois|quatre)';
// "2 bathrooms", "deux salles de bain", "2 sdb"
const BATHROOMS = new RegExp(`\\b${COUNT}\\s?(?:bathrooms?|baths?|salles? de bains?|salles? d'eau|sdb)\\b`);
// "2 bedrooms", "3 chambres" ("une chambre" is left alone: it usually means a room, not a T2)
const BEDROOMS = new RegExp(`\\b${COUNT}\\s?(?:bedrooms?|beds?|chambres?)\\b`);
const AMENITIES: [RegExp, string][] = [
    [/\b(elevator|lift|ascenseur)\b/, 'elevator'],
    [/\b(balcony|balcon)\b/, 'balcony'],
    [/\b(parking|garage|car park)\b/, 'parking'],
    [/\b(garden|jardin)\b/, 'garden'],
    [/\b(terrace|terrasse)\b/, 'terrace'],
    [/\b(cellar|cave)\b/, 'cellar'],
    [/\b(pool|piscine)\b/, 'pool'],
    [/\b(gym|salle de sport)\b/, 'gym'],
    [/\b(security|secure|securisee?|gardien|digicode)\b/, 'security'],
];

// "for 9 months", "6 mois", "one year", "un semestre". "a month" is left alone: "€600 a month" is a price.
const DURATION =
    /\b(?:(\d{1,2}|one|two|three|six|nine|twelve|deux|trois|neuf|douze)\s?(months?|mois|years?|ans?|annees?|semesters?|semestres?)|(a|an|un|une)\s(years?|an|annee|semesters?|semestres?))\b/;
const MONTH_NAMES: [string, number][] = [
    ['january|janvier|janv', 1], ['february|fevrier|fevr|fev', 2], ['march|mars', 3], ['april|avril|avr', 4],
    ['may|mai', 5], ['june|juin', 6], ['july|juillet|juil', 7], ['august|aout', 8],
    ['september|septembre|sept', 9], ['october|octobre', 10], ['november|novembre', 11], ['december|decembre', 12],
];
const START_MARK = "from|starting|start|in|since|des|a partir de|a partir du|debut|en";
const END_MARK = "until|till|to|through|jusqu'?a|jusqu'?en|jusqu'?au|au";
const MONTH = new RegExp(
    `(?:\\b(${START_MARK}|${END_MARK})\\s+)?(?:(?:the\\s+|le\\s+)?\\d{1,2}(?:er|st|nd|rd|th)?\\s+)?\\b(${MONTH_NAMES.map(([n]) => n).join('|')})\\b(?:\\s+(20\\d{2}))?`,
    'g',
);
const END_MARK_RE = new RegExp(`^(?:${END_MARK})$`);

const AMOUNT = '(\\d{1,2}[ .,]\\d{3}|\\d{3,4})';
// "under 600", "max 750", "€600", "600€", "600 euros", "1 200 eur"
const BUDGET_MARKED = new RegExp(
    `\\b(?:under|below|max(?:imum)?|up to|less than|moins de|jusqu'?a|budget(?: de)?)\\s*(?:€|eur(?:os?)?)?\\s*${AMOUNT}\\b\\s?(?:€|eur(?:os?)?\\b)?` +
    `|€\\s?${AMOUNT}\\b` +
    `|\\b${AMOUNT}\\s?(?:€|eur(?:os?)?\\b)`,
);
const BUDGET_BARE = /\b(\d{3,4})\b/;
const NOISE =
    /\b(i|im|i'm|am|we|are|looking|look|search|searching|find|want|need|arriving|arrive|moving|for|a|an|the|in|at|near|around|to|with|per|month|monthly|mo|cheap|budget|room|rooms|apartment|apartments|flat|flats|home|house|place|rent|rental|stay|from|starting|start|until|till|since|and|or|je|j'|nous|cherche|cherchons|recherche|veux|voudrais|un|une|des|le|la|les|l'|au|aux|dans|sur|pres|proche|de|du|d'|en|pour|avec|par|mois|pas|cher|chambre|chambres|appartement|appartements|logement|logements|maison|piece|pieces|location|louer|euros?|eur|et|ou|pendant|durant|sejour|partir|debut)\b/g;
const PREPOSITION = /\b(in|at|near|around|a|au|sur|dans|vers|de)\s*$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Parse a free-text search sentence into structured filters. Never throws. */
export function parseSearch(input: string, now: Date = new Date()): ParsedSearch {
    let text = fold(String(input ?? '')).replace(/[\u0000-\u001f<>"`{}\\]/g, ' ').slice(0, 300);
    const result: ParsedSearch = { city: '', colocation: false, amenities: [] };

    if (UNFURNISHED.test(text)) {
        result.furnished = false;
        text = text.replace(UNFURNISHED, ' ');
    } else if (FURNISHED.test(text)) {
        result.furnished = true;
        text = text.replace(FURNISHED, ' ');
    }

    if (COLOCATION.test(text)) {
        result.colocation = true;
        text = text.replace(COLOCATION, ' ');
    }

    const baths = text.match(BATHROOMS);
    if (baths) {
        result.bathrooms = toNumber(baths[1]);
        text = text.replace(baths[0], ' ');
    }
    const beds = text.match(BEDROOMS);
    if (beds) {
        result.bedrooms = toNumber(beds[1]);
        text = text.replace(beds[0], ' ');
    }

    for (const [pattern, key] of AMENITIES) {
        if (pattern.test(text)) {
            result.amenities.push(key);
            text = text.replace(pattern, ' ');
        }
    }

    for (const [pattern, typology] of TYPOLOGIES) {
        if (pattern.test(text)) {
            result.typology = typology;
            text = text.replace(pattern, ' ');
            break;
        }
    }

    text = extractDates(text, result, now);

    const marked = text.match(BUDGET_MARKED);
    if (marked) {
        // A stated budget is kept even outside the slider range, clamped into it.
        const amount = Number((marked[1] ?? marked[2] ?? marked[3]).replace(/[ .,]/g, ''));
        result.maxRent = Math.min(MAX_RENT, Math.max(MIN_RENT, amount));
        text = text.replace(marked[0], ' ');
    } else {
        // A bare number counts as a budget only when it is a plausible rent (and not a year).
        const bare = text.match(BUDGET_BARE);
        const amount = bare ? Number(bare[1]) : NaN;
        if (bare && amount >= MIN_RENT && amount <= MAX_RENT && !(amount >= 2020 && amount <= 2045)) {
            result.maxRent = amount;
            text = text.replace(bare[0], ' ');
        }
    }

    const known = findKnownCity(text);
    result.city = (known ?? tidyFreeText(text)).slice(0, MAX_QUERY_LENGTH);
    return result;
}

/** Move-in month and length of stay: "from September", "until June", "for 9 months". */
function extractDates(text: string, result: ParsedSearch, now: Date): string {
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;
    let start: { year: number; month: number } | undefined;
    let end: { year?: number; month: number } | undefined;

    text = text.replace(MONTH, (whole, mark: string | undefined, name: string, year: string | undefined) => {
        // "may" is also a verb: only read it as a month when something marks it as one.
        if (name === 'may' && !mark && !year && !/\d/.test(whole)) return whole;
        const month = MONTH_NAMES.find(([names]) => names.split('|').includes(name))![1];
        if (mark && END_MARK_RE.test(mark) && start) {
            end = { year: year ? Number(year) : undefined, month };
        } else if (!start) {
            // No year given: the next time that month comes round.
            start = { year: year ? Number(year) : month >= thisMonth ? thisYear : thisYear + 1, month };
        } else if (!end) {
            end = { year: year ? Number(year) : undefined, month };
        }
        return ' ';
    });

    if (start) result.moveIn = `${start.year}-${pad(start.month)}`;

    const duration = text.match(DURATION);
    if (duration) {
        const unit = duration[2] ?? duration[4];
        const perUnit = /^(year|an|annee)/.test(unit) ? 12 : /^semest/.test(unit) ? 6 : 1;
        const months = toNumber(duration[1] ?? duration[3]) * perUnit;
        if (months >= 1 && months <= MAX_MONTHS) {
            result.months = months;
            text = text.replace(duration[0], ' ');
        }
    } else if (start && end) {
        // "from September to June": count the months in between, inclusive.
        const endYear = end.year ?? (end.month >= start.month ? start.year : start.year + 1);
        const months = (endYear - start.year) * 12 + (end.month - start.month) + 1;
        if (months >= 1 && months <= MAX_MONTHS) result.months = months;
    }
    return text;
}

/** A known city anywhere in the sentence, with a district number kept ("Lyon 7e"). */
function findKnownCity(text: string): string | null {
    let best: { city: string; index: number; preposition: boolean } | null = null;
    for (const city of KNOWN_CITIES) {
        const name = fold(city).replace(/[\s-]+/g, '[\\s-]+');
        const match = new RegExp(`(^|[^a-z0-9])(${name})(\\s+\\d{1,2}(?:e|er|eme)?)?(?![a-z0-9])`).exec(text);
        if (!match) continue;
        const index = match.index + match[1].length;
        const candidate = {
            city: city + (match[3] ? ` ${match[3].trim()}` : ''),
            index,
            preposition: PREPOSITION.test(text.slice(0, index)),
        };
        // "a nice studio in lyon": prefer the city that follows a preposition, then the later one.
        if (
            !best ||
            (candidate.preposition && !best.preposition) ||
            (candidate.preposition === best.preposition && candidate.index > best.index)
        ) {
            best = candidate;
        }
    }
    return best ? best.city : null;
}

/** Whatever is left once filters and filler words are removed, title-cased. */
function tidyFreeText(text: string): string {
    return text
        .replace(/[€/]/g, ' ')
        .replace(NOISE, ' ')
        .replace(/[^a-z0-9' -]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s'-]+|[\s'-]+$/g, '')
        .replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** The /search URL for a parsed sentence. */
export function toSearchUrl(parsed: ParsedSearch): string {
    const params = new URLSearchParams();
    if (parsed.city) params.set('q', parsed.city);
    if (parsed.typology) params.set('typology', parsed.typology);
    if (parsed.colocation) params.set('colocation', '1');
    if (parsed.furnished !== undefined) params.set('furnished', String(parsed.furnished));
    if (parsed.maxRent) params.set('max_rent', String(parsed.maxRent));
    if (parsed.bedrooms) params.set('bedrooms', String(parsed.bedrooms));
    if (parsed.bathrooms) params.set('bathrooms', String(parsed.bathrooms));
    for (const amenity of parsed.amenities) params.append('amenities', amenity);
    if (parsed.moveIn) params.set('from', parsed.moveIn);
    if (parsed.months) params.set('months', String(parsed.months));
    const query = params.toString();
    return query ? `/search?${query}` : '/search';
}

/** Known cities that start with the place text typed so far. */
export function suggestCities(input: string, limit = 4): string[] {
    const typed = fold(parseSearch(input).city);
    if (typed.length < 2) return [];
    return KNOWN_CITIES.filter((c) => fold(c).startsWith(typed) && fold(c) !== typed).slice(0, limit);
}

/** "2027-09" as "September 2027" / "septembre 2027". */
export function formatMonth(yearMonth: string, language: string): string {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(year, month - 1, 1)));
}
