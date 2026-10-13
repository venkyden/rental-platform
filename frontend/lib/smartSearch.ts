/**
 * Smart search: turns one free-text sentence ("a furnished studio with 2
 * bathrooms in Lyon under 600 from September for 9 months") into the filters
 * the search page understands. Deterministic and local: no AI, no network,
 * English and French.
 *
 * A city from KNOWN_CITIES wins and the rest of the sentence is dropped. With
 * no known city, what is left once filters and filler words are removed is
 * sent as the place, with its accents and hyphens as typed.
 */

export type Typology = 'studio' | 't1' | 't2' | 't3plus';

export interface ParsedSearch {
    /** Place as shown to the visitor: "Paris 15e", "Ivry-sur-Seine". */
    city: string;
    /** Set when a district of Paris, Lyon or Marseille was given; searched instead of `city`. */
    postcode?: string;
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

// MIN_RENT and MAX_RENT mirror the budget slider in app/search/page.tsx;
// MAX_MONTHS mirrors the backend bound on min_duration_months (properties.py).
export const MIN_RENT = 300;
export const MAX_RENT = 5000;
export const MAX_MONTHS = 36;
const MAX_QUERY_LENGTH = 60;

/** Fixed list of French student cities, recognised anywhere in the sentence. */
export const KNOWN_CITIES = [
    'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes', 'Rennes', 'Montpellier',
    'Strasbourg', 'Grenoble', 'Nice', 'Angers', 'Dijon', 'Clermont-Ferrand', 'Aix-en-Provence', 'Rouen',
    'Tours', 'Reims', 'Caen', 'Nancy', 'Metz', 'Poitiers', 'Saint-Étienne', 'Brest', 'Le Mans', 'Orléans',
    'Besançon', 'Limoges', 'Amiens', 'Pau', 'La Rochelle', 'Toulon', 'Le Havre', 'Villeurbanne', 'Cergy',
];
// Also ordinary words ("a nice flat", "virtual tours"): only a city after a preposition or at the end.
const AMBIGUOUS_CITIES = new Set(['nice', 'tours']);
// Cities with numbered districts, and the postcode each district maps to.
const DISTRICTS: Record<string, { max: number; base: number }> = {
    Paris: { max: 20, base: 75000 },
    Lyon: { max: 9, base: 69000 },
    Marseille: { max: 16, base: 13000 },
};

/** Must equal STANDARD_AMENITIES in app/properties/new/steps/types.ts. */
export const AMENITY_KEYS = ['elevator', 'balcony', 'parking', 'garden', 'terrace', 'cellar', 'pool', 'gym', 'security'];

/** Unaccented lower case, one character for one character, so positions line up with the original. */
const foldChar = (ch: string) => {
    const base = (ch.normalize('NFD')[0] ?? ch).toLowerCase();
    return base.length === 1 ? base : ch;
};
const fold = (s: string) => Array.from({ length: s.length }, (_, i) => foldChar(s[i])).join('');

const NEGATION = /\b(?:no|not|without|sans|pas|non|aucune?|ni)\s+(?:de\s+|d')?$/;
const UPPER_BOUND = /\b(?:max(?:imum)?|less than|under|up to|at most|moins de|jusqu'?a|au plus)\s*$/;

// Test UNFURNISHED first: "non meublé" also matches FURNISHED.
const UNFURNISHED = /\b(unfurnished|non[\s-]?meublee?s?|vide|nue?)\b/;
const FURNISHED = /\b(furnished|meublee?s?|meubles)\b/;
const COLOCATION = /\b(colocations?|colocs?|flat[\s-]?shares?|house[\s-]?shares?|shared\s(?:flat|house|apartment|home|accommodation)|room[\s-]?mates?|flat[\s-]?mates?|house[\s-]?mates?)\b/;
const TYPOLOGIES: [RegExp, Typology][] = [
    [/\b(t[3-9]|f[3-9]|[3-9]\s?(rooms?|pieces?)|(three|four|trois|quatre)\s?(rooms?|pieces?))\b/, 't3plus'],
    [/\b(t2|f2|2\s?(rooms?|pieces?)|(two|deux)\s?(rooms?|pieces?))\b/, 't2'],
    [/\b(t1|f1|1\s?(room|piece)|one\s?room|une\s?piece)\b/, 't1'],
    [/\bstudios?\b/, 'studio'],
];

const NUMBER_WORDS: Record<string, number> = {
    a: 1, an: 1, one: 1, un: 1, une: 1, two: 2, deux: 2, three: 3, trois: 3, four: 4, quatre: 4,
    five: 5, cinq: 5, six: 6, seven: 7, sept: 7, eight: 8, huit: 8, nine: 9, neuf: 9, ten: 10, dix: 10,
    eleven: 11, onze: 11, twelve: 12, douze: 12,
};
const toNumber = (word: string) => NUMBER_WORDS[word] ?? Number(word);
const COUNT = '(\\d+|one|two|three|four|five|deux|trois|quatre|cinq)';
// "2 bathrooms", "deux salles de bain", "2 sdb"
const BATHROOMS = new RegExp(`\\b${COUNT}\\s?(?:bathrooms?|baths?|salles? de bains?|salles? d'eau|sdb)\\b`);
// "2 bedrooms", "3 chambres". "une chambre" is left alone: it usually means a room, not a T2.
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
const SURFACE = /\b\d{1,3}\s?(?:m2|m²|sqm|sq\.?\s?m|metres? carres?|square met(?:er|re)s?)(?![a-z0-9])/;

// "for 9 months", "sept mois", "one year", "un semestre". "a month" is left alone: "€600 a month" is a price.
const DURATION =
    /\b(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|deux|trois|quatre|cinq|sept|huit|neuf|dix|onze|douze)\s?(months?|mois|years?|ans?|annees?|semesters?|semestres?)|(a|an|un|une)\s(years?|an|annee|semesters?|semestres?))\b/;
const MONTH_NAMES: [string, number][] = [
    ['january|janvier|janv', 1], ['february|fevrier|fevr|fev', 2], ['march|mars', 3], ['april|avril|avr', 4],
    ['may|mai', 5], ['june|juin', 6], ['july|juillet|juil', 7], ['august|aout', 8],
    ['september|septembre|sept', 9], ['october|octobre', 10], ['november|novembre', 11], ['december|decembre', 12],
];
// Also a verb, a street name or a number: read as a month only with a marker, a day or a year
// (and never before a 19xx year: "place du 8 mai 1945").
const AMBIGUOUS_MONTHS = new Set(['may', 'march', 'mars', 'sept']);
const START_MARK = 'from|starting|start|in|since|des|a partir de|a partir du|debut|en';
const END_MARK = "until|till|to|through|jusqu'?a|jusqu'?en|jusqu'?au|au";
const MONTH = new RegExp(
    `(?:\\b(${START_MARK}|${END_MARK})\\s+)?(?:\\b(?:the\\s+|le\\s+)?(\\d{1,2})(?:er|st|nd|rd|th)?\\s+)?\\b(${MONTH_NAMES.map(([n]) => n).join('|')})\\b(?:\\s+(20\\d{2}))?(?!\\s+1[89]\\d{2})`,
    'g',
);
const END_MARK_RE = new RegExp(`^(?:${END_MARK})$`);

const EUR = '(?:€|eur(?:os?)?\\b)';
const AMOUNT = '(\\d{1,2}[ .,]\\d{3}|\\d{3,4})';
const AMOUNT_LONG = '(\\d{1,2}[ .,]\\d{3}|\\d{3,5})';
// "600-800", "between 600 and 800", "de 600 à 800": the upper figure is the budget.
const BUDGET_RANGE = new RegExp(`\\b${AMOUNT}\\s?${EUR}?\\s*(?:-|–|—|to|a|et|and)\\s*${AMOUNT}\\b\\s?${EUR}?`);
// "min 500", "at least 500", "à partir de 500": a floor, not a budget.
const BUDGET_FLOOR = new RegExp(
    `\\b(?:min(?:imum)?|at least|over|above|more than|plus de|au moins|a partir de|from)\\s*${EUR}?\\s*${AMOUNT_LONG}\\b\\s?${EUR}?`,
);
// "under 600", "max 750", "€600", "600€", "600 euros", "600e", "1 200 eur"
const BUDGET_MARKED = new RegExp(
    `\\b(?:under|below|max(?:imum)?|up to|less than|moins de|jusqu'?a|budget(?: de)?)\\s*${EUR}?\\s*${AMOUNT_LONG}\\b\\s?${EUR}?` +
    `|€\\s?${AMOUNT_LONG}\\b` +
    `|\\b${AMOUNT_LONG}\\s?(?:€|eur(?:os?)?\\b|e\\b)`,
);
const BUDGET_BARE = /\b(\d{1,2}[.,]\d{3}|\d{3,4})\b(?!\s*(?:rue|avenue|av|boulevard|bd|place|chemin|allee|quai|impasse|cours|route|bis)\b)/;

// A French postcode typed as such. Not a figure with a currency sign or a budget word in front.
const POSTCODE = /\b((?:0[1-9]|[1-8]\d|9[0-8])\d{3})\b(?!\s?(?:€|eur|e\b))/;

const DESTINATION = /\b(?:in|at|near|around|to|sur|dans|vers|en|au)\s+$/;
const ORIGIN = /\b(?:from|depuis|de)\s+$|\bd'$/;

// Words that carry no place: dropped from what is left of the sentence.
const NOISE = new Set(
    ('i im i\'m am we are is be it looking look search searching find want need arriving arrive moving for a an the in at near around ' +
    'to with without per month monthly mo cheap budget room rooms apartment apartments flat flats home house place rent rental stay ' +
    'from starting start until till since and or no not under below over above up than least most less more between max maximum min ' +
    'minimum one my me that nice quiet small big large new good lovely cosy cozy bright clean modern private single double campus ' +
    'university school student students intern people person week weeks days minutes please hello hi ' +
    'je nous cherche cherchons recherche veux voudrais un une avec sans par mois pas cher chambre chambres appartement appartements ' +
    'logement logements maison piece pieces location louer euro euros eur ou pendant durant sejour partir debut pour dans pres proche ' +
    'vers moins plus entre non aucun aucune ni mon universite fac ecole etudiant etudiante etudiants etudiantes personne personnes ' +
    'semaine semaines jours bonjour svp merci tours').split(' '),
);
// Kept only between two place words: "Champ de Mars", "Ivry sur Seine".
const CONNECTORS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'sous', 'en', 'aux', 'au', 'et']);
const SMALL_WORDS = new Set([...CONNECTORS, 'd', 'l']);

const pad = (n: number) => String(n).padStart(2, '0');
const amountOf = (raw: string) => Number(raw.replace(/[ .,]/g, ''));

/** Parse a free-text search sentence into structured filters. Never throws. */
export function parseSearch(input: string, now: Date = new Date()): ParsedSearch {
    // `text` keeps what was typed; `folded` is the same string, same length, unaccented and
    // lower-cased. Patterns run on `folded`; a recognised span is blanked in both.
    let text = String(input ?? '').replace(/[\u0000-\u001f<>"`{}\\]/g, ' ').slice(0, 300);
    let folded = fold(text);
    const typed = folded;
    const result: ParsedSearch = { city: '', colocation: false, amenities: [] };

    const blank = (start: number, length: number) => {
        const gap = ' '.repeat(length);
        text = text.slice(0, start) + gap + text.slice(start + length);
        folded = folded.slice(0, start) + gap + folded.slice(start + length);
    };
    const take = (pattern: RegExp) => {
        const match = pattern.exec(folded);
        if (!match) return null;
        const before = folded.slice(0, match.index);
        blank(match.index, match[0].length);
        // A "not" or "max" in front belongs to this match: remove it so it cannot negate the next one.
        const negation = NEGATION.exec(before);
        const cap = UPPER_BOUND.exec(before);
        if (negation) blank(negation.index, negation[0].length);
        if (cap) blank(cap.index, cap[0].length);
        return { match, negated: negation !== null, capped: cap !== null };
    };

    if (take(UNFURNISHED)) {
        result.furnished = false;
    } else {
        const furnished = take(FURNISHED);
        if (furnished) result.furnished = !furnished.negated;
    }

    const shared = take(COLOCATION);
    if (shared && !shared.negated) result.colocation = true;

    // Before the counts and the months: "sept mois" is seven months, not September.
    const stay = take(DURATION);
    if (stay && !stay.negated && !stay.capped) {
        const unit = stay.match[2] ?? stay.match[4];
        const perUnit = /^(year|an|annee)/.test(unit) ? 12 : /^semest/.test(unit) ? 6 : 1;
        const months = toNumber(stay.match[1] ?? stay.match[3]) * perUnit;
        if (months >= 1 && months <= MAX_MONTHS) result.months = months;
    }

    const baths = take(BATHROOMS);
    if (baths && !baths.negated && toNumber(baths.match[1]) >= 1 && toNumber(baths.match[1]) <= 9) {
        result.bathrooms = toNumber(baths.match[1]);
    }
    const beds = take(BEDROOMS);
    if (beds && !beds.negated && toNumber(beds.match[1]) >= 1 && toNumber(beds.match[1]) <= 9) {
        result.bedrooms = toNumber(beds.match[1]);
    }

    for (const [pattern, key] of AMENITIES) {
        const amenity = take(pattern);
        if (amenity && !amenity.negated) result.amenities.push(key);
    }

    for (const [pattern, typology] of TYPOLOGIES) {
        const home = take(pattern);
        if (home) {
            if (!home.negated) result.typology = typology;
            break;
        }
    }
    // A studio has no separate bedroom; "studio with 1 bed" must not filter it out.
    if (result.typology === 'studio') delete result.bedrooms;

    take(SURFACE);

    // Months.
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;
    let start: { year: number; month: number } | undefined;
    let end: { year?: number; month: number } | undefined;
    for (const found of Array.from(folded.matchAll(MONTH))) {
        const [whole, mark, day, name, year] = found;
        if (AMBIGUOUS_MONTHS.has(name) && !mark && !day && !year) continue;
        const month = MONTH_NAMES.find(([names]) => names.split('|').includes(name))![1];
        blank(found.index!, whole.length);
        if (mark && END_MARK_RE.test(mark)) {
            end = { year: year ? Number(year) : undefined, month };
        } else if (!start) {
            // No year: this year if the month is the current one or later, otherwise next year.
            start = { year: year ? Number(year) : month >= thisMonth ? thisYear : thisYear + 1, month };
        } else if (!end) {
            end = { year: year ? Number(year) : undefined, month };
        }
    }
    // A month already past cannot be a move-in date.
    if (start && (start.year < thisYear || (start.year === thisYear && start.month < thisMonth))) start = undefined;
    if (start) {
        result.moveIn = `${start.year}-${pad(start.month)}`;
        if (!result.months && end) {
            // "from September to June": the months in between, inclusive.
            const endYear = end.year ?? (end.month >= start.month ? start.year : start.year + 1);
            const months = (endYear - start.year) * 12 + (end.month - start.month) + 1;
            if (months >= 1 && months <= MAX_MONTHS) result.months = months;
        }
    }

    // City and district before the budget, so "Paris 15 800€" is district 15 and €800.
    const known = findKnownCity(text, folded, typed);
    for (const span of known.spans) blank(span.index, span.length);

    let postcode = known.postcode;
    const code = postcode ? null : POSTCODE.exec(folded);
    if (code && !/(?:€|\bbudget(?: de)?)\s*$/.test(folded.slice(0, code.index)) && !UPPER_BOUND.test(folded.slice(0, code.index))) {
        postcode = code[1];
        blank(code.index, code[0].length);
    }

    // Budget.
    const range = take(BUDGET_RANGE);
    if (range) {
        const upper = Math.max(amountOf(range.match[1]), amountOf(range.match[2]));
        if (upper >= MIN_RENT) result.maxRent = Math.min(MAX_RENT, upper);
    } else if (!take(BUDGET_FLOOR)) {
        const marked = take(BUDGET_MARKED);
        if (marked) {
            // Below the slider's minimum the figure is dropped rather than raised.
            const amount = amountOf(marked.match[1] ?? marked.match[2] ?? marked.match[3]);
            if (amount >= MIN_RENT) result.maxRent = Math.min(MAX_RENT, amount);
        } else {
            // The first bare number is a budget only if it looks like a rent, not a year or a street number.
            const bare = BUDGET_BARE.exec(folded);
            const amount = bare ? amountOf(bare[1]) : NaN;
            const yearLike = bare !== null && /^\d{4}$/.test(bare[1]) && amount >= 1900 && amount <= 2100;
            if (bare && amount >= MIN_RENT && amount <= MAX_RENT && !yearLike) {
                result.maxRent = amount;
                blank(bare.index, bare[0].length);
            }
        }
    }

    const place = known.city ?? freePlace(text, folded).slice(0, MAX_QUERY_LENGTH);
    // A district already names its postcode; one typed separately is shown next to the place.
    result.city = postcode && !known.postcode ? `${place} ${postcode}`.trim() : place;
    if (postcode) result.postcode = postcode;
    return result;
}

interface KnownCity {
    city?: string;
    postcode?: string;
    /** Spans to blank: the chosen city, its district, and ambiguous names read as ordinary words. */
    spans: { index: number; length: number }[];
}

/** A known city anywhere in the sentence, and its district for Paris, Lyon and Marseille. */
function findKnownCity(text: string, folded: string, typed: string): KnownCity {
    const spans: KnownCity['spans'] = [];
    type Candidate = { name: string; index: number; length: number; destination: boolean; origin: boolean };
    let best: Candidate | null = null;

    for (const name of KNOWN_CITIES) {
        const pattern = new RegExp(`(^|[^a-z0-9-])(${fold(name).replace(/[\s-]+/g, '[\\s-]+')})(?![a-z0-9-])`);
        const match = pattern.exec(folded);
        if (!match) continue;
        const index = match.index + match[1].length;
        const length = match[2].length;
        const before = folded.slice(0, index);
        // "à Lyon" is a destination; the English article in "a nice flat" is not, so look at the accent.
        const destination = DESTINATION.test(before) || /(^|\s)à\s+$/i.test(text.slice(0, index));
        const origin = !destination && ORIGIN.test(before);
        if (AMBIGUOUS_CITIES.has(fold(name))) {
            // Judged on the sentence as typed: "nice studio" is an adjective, "studio nice" a city.
            const after = typed.slice(index + length);
            if (!destination && !/^\s*(?:$|\d)/.test(after)) {
                spans.push({ index, length });
                continue;
            }
        }
        const candidate: Candidate = { name, index, length, destination, origin };
        // Where the person is going beats where they come from; then a preposition; then the later one.
        const better =
            !best ||
            (best.origin && !candidate.origin) ||
            (best.origin === candidate.origin &&
                ((candidate.destination && !best.destination) ||
                    (candidate.destination === best.destination && candidate.index > best.index)));
        if (better) best = candidate;
    }
    if (!best) return { spans };

    spans.push({ index: best.index, length: best.length });
    const rule = DISTRICTS[best.name];
    const tail = folded.slice(best.index + best.length);
    const district = rule ? /^(\s+)(\d{1,2})(e|er|eme|th|st|nd|rd)?(?![a-z0-9])/.exec(tail) : null;
    if (rule && district) {
        const number = Number(district[2]);
        const rest = tail.slice(district[0].length);
        const hasSuffix = Boolean(district[3]);
        // "Lyon 1 200€" is a rent of 1 200, not district 1 and €200.
        const startsAmount = /^\s\d{3}\b/.test(rest) && Number(rest.trim().slice(0, 3)) < MIN_RENT;
        const standsAlone = /^\s*(?:$|[,;.](?:\s|$)|\d)/.test(rest);
        if (number >= 1 && number <= rule.max && (hasSuffix || (standsAlone && !startsAmount))) {
            spans.push({ index: best.index + best.length, length: district[0].length });
            return {
                city: `${best.name} ${number}${number === 1 ? 'er' : 'e'}`,
                postcode: String(rule.base + number),
                spans,
            };
        }
    }
    return { city: best.name, spans };
}

/** What is left of the sentence once filters and filler words are gone, as typed. */
function freePlace(text: string, folded: string): string {
    const words = text.split(/\s+/);
    const foldedWords = folded.split(/\s+/);
    const tokens: { word: string; kind: 'place' | 'connector' }[] = [];
    let dropped = true; // a connector right after a dropped word does not join two place words

    words.forEach((raw, i) => {
        const strip = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
        let word = strip(raw);
        let key = strip(foldedWords[i] ?? '');
        const elision = /^(?:l|d|j|n|qu)'/.exec(key);
        if (elision) {
            word = word.slice(elision[0].length);
            key = key.slice(elision[0].length);
        }
        if (!key) return;
        if (CONNECTORS.has(key)) {
            if (!dropped) tokens.push({ word, kind: 'connector' });
            return;
        }
        // Bare numbers are noise unless they are a postcode.
        if (NOISE.has(key) || (/^\d+$/.test(key) && key.length !== 5)) {
            dropped = true;
            return;
        }
        tokens.push({ word, kind: 'place' });
        dropped = false;
    });

    // Trailing connectors join nothing.
    while (tokens.length && tokens[tokens.length - 1].kind === 'connector') tokens.pop();
    return tokens.map((t, i) => tidyWord(t.word, i === 0)).join(' ');
}

/** Capitalise a place word typed in lower case: "ivry-sur-seine" → "Ivry-sur-Seine". */
function tidyWord(word: string, first: boolean): string {
    if (word !== word.toLowerCase()) return word;
    return word
        .split('-')
        .map((part, i) => {
            const [head, ...rest] = part.split("'");
            if (rest.length) return `${head}'${capitalise(rest.join("'"))}`;
            return SMALL_WORDS.has(fold(part)) && !(first && i === 0) ? part : capitalise(part);
        })
        .join('-');
}
const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The /search URL for a parsed sentence. `from` is the move-in month, `months` the length of stay. */
export function toSearchUrl(parsed: ParsedSearch): string {
    const params = new URLSearchParams();
    const place = parsed.postcode ?? parsed.city;
    if (place) params.set('q', place);
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

/** Known cities starting with the place text left after parsing (two letters or more). */
export function suggestCities(input: string, limit = 4): string[] {
    const parsed = parseSearch(input);
    if (parsed.postcode || KNOWN_CITIES.includes(parsed.city)) return [];
    const typed = fold(parsed.city);
    if (typed.length < 2) return [];
    return KNOWN_CITIES.filter((city) => {
        const name = fold(city);
        return name.startsWith(typed) || name.replace(/^(?:le|la|les)\s/, '').startsWith(typed);
    }).slice(0, limit);
}

/** "2027-09" as "September 2027" / "septembre 2027"; anything else is returned unchanged. */
export function formatMonth(yearMonth: string, language: string): string {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth);
    if (!match) return yearMonth;
    return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}
