/**
 * The question box, step 1: as a student types, find what the owner already
 * answered in the walk-through. Deterministic word matching in English and
 * French; nothing is inferred and no AI is involved.
 */
import { flattenAnswers, spaceKeys, type Flatmates, type HouseholdTopic, type WalkState } from './walkthrough';

// Words a student may use for each walk-through item, without accents.
const ITEM_WORDS: Record<string, string[]> = {
    hob: ['hob', 'stove', 'cooker', 'cooktop', 'induction', 'plaque', 'plaques', 'cuisiniere', 'gaziniere'],
    oven: ['oven', 'four'],
    microwave: ['microwave', 'micro ondes', 'microondes', 'micro onde'],
    fridge_freezer: ['fridge', 'refrigerator', 'freezer', 'frigo', 'refrigerateur', 'congelateur'],
    plates_glasses: ['plate', 'plates', 'glass', 'glasses', 'cutlery', 'dishes', 'crockery', 'vaisselle', 'assiette', 'assiettes', 'verre', 'verres', 'couverts'],
    pans_utensils: ['pan', 'pans', 'pot', 'pots', 'utensils', 'cookware', 'casserole', 'casseroles', 'poele', 'poeles', 'ustensiles'],
    dishwasher: ['dishwasher', 'lave vaisselle'],
    bed_bedding: ['bed', 'mattress', 'bedding', 'sheets', 'duvet', 'pillow', 'lit', 'matelas', 'draps', 'couette', 'oreiller', 'literie'],
    curtains_shutters: ['curtain', 'curtains', 'blind', 'blinds', 'shutter', 'shutters', 'rideau', 'rideaux', 'volet', 'volets', 'store', 'stores'],
    desk: ['desk', 'bureau'],
    wardrobe: ['wardrobe', 'closet', 'armoire', 'placard', 'penderie'],
    table_chairs: ['table', 'chair', 'chairs', 'chaise', 'chaises'],
    sofa: ['sofa', 'couch', 'canape'],
    tv: ['tv', 'television', 'tele'],
    shower_bath: ['shower', 'bath', 'bathtub', 'douche', 'baignoire'],
    washing_machine: ['washing machine', 'washer', 'laundry', 'lave linge', 'machine a laver'],
    internet: ['internet', 'wifi', 'wi fi', 'fibre', 'fiber', 'broadband'],
    lights: ['light', 'lights', 'lamp', 'lamps', 'lighting', 'lumiere', 'lumieres', 'lampe', 'lampes', 'luminaires', 'eclairage'],
    storage_shelves: ['shelf', 'shelves', 'storage', 'etagere', 'etageres', 'rangement', 'rangements'],
    cleaning_equipment: ['vacuum', 'hoover', 'broom', 'mop', 'cleaning', 'aspirateur', 'balai', 'serpilliere', 'menage'],
};

const HOUSEHOLD_WORDS: Record<HouseholdTopic, string[]> = {
    count: ['flatmate', 'flatmates', 'roommate', 'roommates', 'housemate', 'housemates', 'who lives', 'how many people',
        'colocataire', 'colocataires', 'colocs', 'coloc', 'qui habite', 'qui vit', 'combien de personnes'],
    occupation: ['students', 'working', 'workers', 'etudiants', 'travaillent'],
    smoking: ['smoke', 'smoking', 'smoker', 'smokers', 'cigarette', 'fumer', 'fumeur', 'fumeurs', 'tabac'],
    pets: ['pet', 'pets', 'animal', 'animals', 'dog', 'dogs', 'cat', 'cats', 'animaux', 'chien', 'chiens', 'chat', 'chats'],
};

export interface ItemMatch {
    spaceKey: string;
    key: string;
    state: WalkState;
}

export interface QuestionMatches {
    items: ItemMatch[];
    household: HouseholdTopic[];
}

/** Lowercase, no accents, hyphens and apostrophes as spaces: "Lave-vaisselle ?" -> "lave vaisselle ?" */
export function foldText(text: string): string {
    return text
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[-'’]/g, ' ')
        .replace(/\s+/g, ' ');
}

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function mentions(folded: string, words: string[]): boolean {
    return words.some((word) => new RegExp(`(^|[^a-z0-9])${escape(word)}($|[^a-z0-9])`).test(folded));
}

/** What the owner already answered that the question mentions. Empty when nothing matches. */
export function matchQuestion(
    question: string,
    storedAnswers: unknown,
    bedrooms: number,
    flatmates?: Flatmates | null,
): QuestionMatches {
    const folded = foldText(question || '');
    const result: QuestionMatches = { items: [], household: [] };
    if (folded.trim().length < 2) return result;

    const answers = flattenAnswers(storedAnswers);
    for (const spaceKey of spaceKeys(bedrooms)) {
        for (const [key, state] of Object.entries(answers[spaceKey] || {})) {
            if (mentions(folded, ITEM_WORDS[key] || [])) result.items.push({ spaceKey, key, state });
        }
    }
    if (flatmates) {
        const known: Record<HouseholdTopic, boolean> = {
            count: typeof flatmates.count === 'number',
            occupation: !!flatmates.occupation,
            smoking: typeof flatmates.smoking === 'boolean',
            pets: typeof flatmates.pets === 'boolean',
        };
        for (const topic of Object.keys(HOUSEHOLD_WORDS) as HouseholdTopic[]) {
            if (known[topic] && mentions(folded, HOUSEHOLD_WORDS[topic])) result.household.push(topic);
        }
    }
    return result;
}

export const ITEM_KEYS_WITH_WORDS = Object.keys(ITEM_WORDS);
