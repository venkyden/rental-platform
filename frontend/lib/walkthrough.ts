/**
 * The walk-through tap list: what a landlord answers once, space by space, so a
 * student does not have to ask (is there internet, does the oven work, who lives
 * there). The answers are the landlord's own statements.
 */

export type WalkSpace = 'kitchen' | 'bedroom' | 'living' | 'bathroom' | 'home';
export type WalkKind = 'appliance' | 'thing';
export type WalkState = 'working' | 'not_working' | 'absent' | 'present';

export interface WalkItem {
    key: string;
    space: WalkSpace;
    kind: WalkKind;
}

// Must equal CATALOGUE in backend/app/services/walkthrough_catalogue.py, which checks
// answers against its own copy. backend/tests/test_walkthrough_catalogue.py compares the two.
export const WALKTHROUGH_ITEMS: WalkItem[] = [
    { key: 'hob', space: 'kitchen', kind: 'appliance' },
    { key: 'oven', space: 'kitchen', kind: 'appliance' },
    { key: 'microwave', space: 'kitchen', kind: 'appliance' },
    { key: 'fridge_freezer', space: 'kitchen', kind: 'appliance' },
    { key: 'plates_glasses', space: 'kitchen', kind: 'thing' },
    { key: 'pans_utensils', space: 'kitchen', kind: 'thing' },
    { key: 'dishwasher', space: 'kitchen', kind: 'appliance' },
    { key: 'bed_bedding', space: 'bedroom', kind: 'thing' },
    { key: 'curtains_shutters', space: 'bedroom', kind: 'thing' },
    { key: 'desk', space: 'bedroom', kind: 'thing' },
    { key: 'wardrobe', space: 'bedroom', kind: 'thing' },
    { key: 'table_chairs', space: 'living', kind: 'thing' },
    { key: 'sofa', space: 'living', kind: 'thing' },
    { key: 'tv', space: 'living', kind: 'appliance' },
    { key: 'shower_bath', space: 'bathroom', kind: 'thing' },
    { key: 'washing_machine', space: 'bathroom', kind: 'appliance' },
    { key: 'internet', space: 'home', kind: 'thing' },
    { key: 'lights', space: 'home', kind: 'thing' },
    { key: 'storage_shelves', space: 'home', kind: 'thing' },
    { key: 'cleaning_equipment', space: 'home', kind: 'thing' },
];

// An appliance can be there and broken; a thing is either there or not.
export const WALK_STATES: Record<WalkKind, WalkState[]> = {
    appliance: ['working', 'not_working', 'absent'],
    thing: ['present', 'absent'],
};

/** item key -> state, for one space */
export type SpaceAnswers = Record<string, WalkState>;
/** As stored and served: space key -> item key -> dated answer */
export type StoredAnswers = Record<string, Record<string, { state: WalkState; answered_at?: string }>>;

export const FLATMATE_OCCUPATIONS = ['students', 'working', 'both'] as const;
export interface Flatmates {
    count?: number;
    occupation?: (typeof FLATMATE_OCCUPATIONS)[number];
    smoking?: boolean;
    pets?: boolean;
    answered_at?: string;
}

type Translate = (key: string, params?: Record<string, string | number>, fallback?: string) => string;

/** A studio has no room list but still has a bed, so there is always one bedroom. */
export const bedroomCount = (roomDetails: unknown): number =>
    Math.max(1, Math.min(20, Array.isArray(roomDetails) ? roomDetails.length : 0));

/** Space keys for a listing, in display order: kitchen, bedroom:0…, living, bathroom, home. */
export function spaceKeys(bedrooms: number): string[] {
    const rooms = Array.from({ length: Math.max(1, bedrooms) }, (_, i) => `bedroom:${i}`);
    return ['kitchen', ...rooms, 'living', 'bathroom', 'home'];
}

const baseSpace = (spaceKey: string): string => spaceKey.split(':')[0];

export const itemsFor = (spaceKey: string): WalkItem[] =>
    WALKTHROUGH_ITEMS.filter((item) => item.space === baseSpace(spaceKey));

export function spaceLabel(t: Translate, spaceKey: string, bedrooms: number): string {
    const [base, index] = spaceKey.split(':');
    if (base !== 'bedroom') return t(`walkthrough.spaces.${base}`, undefined, base);
    return bedrooms > 1
        ? t('walkthrough.spaces.bedroomNumbered', { n: Number(index) + 1 }, `Bedroom ${Number(index) + 1}`)
        : t('walkthrough.spaces.bedroom', undefined, 'Bedroom');
}

const isState = (value: unknown): value is WalkState =>
    value === 'working' || value === 'not_working' || value === 'absent' || value === 'present';

/** Stored answers as plain item -> state maps. Anything malformed is dropped, never thrown on. */
export function flattenAnswers(stored: unknown): Record<string, SpaceAnswers> {
    const out: Record<string, SpaceAnswers> = {};
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return out;
    for (const [spaceKey, items] of Object.entries(stored as Record<string, unknown>)) {
        if (!items || typeof items !== 'object' || Array.isArray(items)) continue;
        const known = new Map(itemsFor(spaceKey).map((item) => [item.key, item]));
        const space: SpaceAnswers = {};
        for (const [key, answer] of Object.entries(items as Record<string, unknown>)) {
            const state = answer && typeof answer === 'object' ? (answer as { state?: unknown }).state : undefined;
            const item = known.get(key);
            if (item && isState(state) && WALK_STATES[item.kind].includes(state)) space[key] = state;
        }
        if (Object.keys(space).length > 0) out[spaceKey] = space;
    }
    return out;
}

/** The most recent date among the answers the panel shows (this listing's spaces, known
 *  items, valid answers) and the household card, as a UTC YYYY-MM-DD. */
export function latestAnswerDate(stored: unknown, bedrooms: number, flatmates?: Flatmates | null): string | null {
    const dates: string[] = [];
    const shown = flattenAnswers(stored);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        for (const spaceKey of spaceKeys(bedrooms)) {
            const items = (stored as Record<string, unknown>)[spaceKey];
            if (!shown[spaceKey] || !items || typeof items !== 'object') continue;
            for (const key of Object.keys(shown[spaceKey])) {
                const at = ((items as Record<string, unknown>)[key] as { answered_at?: unknown } | undefined)?.answered_at;
                if (typeof at === 'string') dates.push(at);
            }
        }
    }
    if (typeof flatmates?.answered_at === 'string') dates.push(flatmates.answered_at);
    const valid = dates.filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d)).sort();
    return valid.length ? valid[valid.length - 1].slice(0, 10) : null;
}

/** "13 October 2026" / "13 octobre 2026". The input is the UTC date of the answer; it is
 *  formatted in UTC so it is not shifted a second time (and server and browser agree). */
export function formatAnswerDate(isoDate: string, language: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    if (!year || !month || !day) return isoDate;
    return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** True when the household card says anything at all. */
export const hasFlatmates = (flatmates?: Flatmates | null): boolean =>
    !!flatmates && (typeof flatmates.count === 'number' || !!flatmates.occupation ||
        typeof flatmates.smoking === 'boolean' || typeof flatmates.pets === 'boolean');

/** The household card as the lines the listing page shows, in order. Empty when there is nothing to say. */
export function householdLines(t: Translate, flatmates?: Flatmates | null): string[] {
    if (!hasFlatmates(flatmates)) return [];
    const card = flatmates!;
    const lines: (string | false | undefined)[] = [
        typeof card.count === 'number' &&
            (card.count === 0
                ? t('walkthrough.flatmates.countZero', undefined, 'No flatmates')
                : card.count === 1
                    ? t('walkthrough.flatmates.countOne', undefined, '1 flatmate')
                    : t('walkthrough.flatmates.count', { count: card.count }, `${card.count} flatmates`)),
        card.occupation && (FLATMATE_OCCUPATIONS as readonly string[]).includes(card.occupation) &&
            t(`walkthrough.flatmates.occupation.${card.occupation}`, undefined, card.occupation),
        typeof card.smoking === 'boolean' &&
            (card.smoking
                ? t('walkthrough.flatmates.smokingYes', undefined, 'Smoking in the home')
                : t('walkthrough.flatmates.smokingNo', undefined, 'No smoking in the home')),
        typeof card.pets === 'boolean' &&
            (card.pets
                ? t('walkthrough.flatmates.petsYes', undefined, 'Pets in the home')
                : t('walkthrough.flatmates.petsNo', undefined, 'No pets in the home')),
    ];
    return lines.filter((line): line is string => typeof line === 'string');
}
