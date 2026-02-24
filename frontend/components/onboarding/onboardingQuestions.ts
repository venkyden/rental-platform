// Static data, types, and question definitions for OnboardingQuestionnaire
// Extracted from the monolithic OnboardingQuestionnaire.tsx for maintainability

// ─── Types ───────────────────────────────────────────────────────

export interface QuestionOption {
    value: string;
    label: string;
    emoji?: string;
    segment?: string;
}

export interface Question {
    id: string;
    question: string;
    emoji: string;
    options?: QuestionOption[];
    type?: 'text' | 'range' | 'multiselect' | 'date' | 'select' | 'university_select' | 'location_radius';
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    maxSelections?: number;
    selectOptions?: { value: string; label: string }[];
    showIf?: (responses: Record<string, any>) => boolean;
}

export interface QuestionnaireProps {
    userType: 'tenant' | 'landlord';
    onComplete: (responses: Record<string, any>) => void;
}

// ─── Static Data ─────────────────────────────────────────────────

export const NATIONALITIES = [
    'French', 'American', 'British', 'German', 'Italian', 'Spanish', 'Portuguese',
    'Chinese', 'Indian', 'Japanese', 'Korean', 'Brazilian', 'Mexican', 'Canadian',
    'Australian', 'Dutch', 'Belgian', 'Swiss', 'Swedish', 'Norwegian', 'Danish',
    'Finnish', 'Polish', 'Romanian', 'Turkish', 'Moroccan', 'Tunisian', 'Algerian',
    'Senegalese', 'Cameroonian', 'Ivorian', 'Lebanese', 'Egyptian', 'Nigerian',
    'Other',
];

export const LANGUAGES = [
    { value: 'fr', label: '🇫🇷 French' },
    { value: 'en', label: '🇬🇧 English' },
    { value: 'es', label: '🇪🇸 Spanish' },
    { value: 'de', label: '🇩🇪 German' },
    { value: 'it', label: '🇮🇹 Italian' },
    { value: 'pt', label: '🇵🇹 Portuguese' },
    { value: 'zh', label: '🇨🇳 Chinese' },
    { value: 'ar', label: '🇸🇦 Arabic' },
    { value: 'ru', label: '🇷🇺 Russian' },
    { value: 'ja', label: '🇯🇵 Japanese' },
];

export const FRENCH_UNIVERSITIES: { city: string; universities: { value: string; label: string }[] }[] = [
    {
        city: 'Paris',
        universities: [
            { value: 'sorbonne_paris', label: 'Sorbonne Université' },
            { value: 'psl', label: 'Université PSL' },
            { value: 'paris_saclay', label: 'Université Paris-Saclay' },
            { value: 'polytechnique', label: 'École Polytechnique' },
            { value: 'hec', label: 'HEC Paris' },
            { value: 'essec', label: 'ESSEC Business School' },
            { value: 'sciences_po', label: 'Sciences Po' },
            { value: 'paris_dauphine', label: 'Université Paris Dauphine' },
            { value: 'paris_cite', label: 'Université Paris Cité' },
            { value: 'paris_pantheon', label: 'Université Panthéon-Assas' },
            { value: 'ens_paris', label: 'ENS Paris' },
        ],
    },
    {
        city: 'Lyon',
        universities: [
            { value: 'lyon_1', label: 'Université Claude Bernard Lyon 1' },
            { value: 'lyon_2', label: 'Université Lumière Lyon 2' },
            { value: 'lyon_3', label: 'Université Jean Moulin Lyon 3' },
            { value: 'em_lyon', label: 'EM Lyon Business School' },
            { value: 'centrale_lyon', label: 'Centrale Lyon' },
            { value: 'insa_lyon', label: 'INSA Lyon' },
            { value: 'ens_lyon', label: 'ENS de Lyon' },
        ],
    },
    {
        city: 'Toulouse',
        universities: [
            { value: 'toulouse_1', label: 'Université Toulouse 1 Capitole' },
            { value: 'toulouse_2', label: 'Université Toulouse Jean Jaurès' },
            { value: 'toulouse_3', label: 'Université Toulouse III - Paul Sabatier' },
            { value: 'insa_toulouse', label: 'INSA Toulouse' },
            { value: 'tbs_toulouse', label: 'TBS Education' },
            { value: 'isae_supaero', label: 'ISAE-SUPAERO' },
        ],
    },
    {
        city: 'Bordeaux',
        universities: [
            { value: 'bordeaux', label: 'Université de Bordeaux' },
            { value: 'bordeaux_montaigne', label: 'Université Bordeaux Montaigne' },
            { value: 'kedge_bordeaux', label: 'KEDGE Business School' },
        ],
    },
    {
        city: 'Lille',
        universities: [
            { value: 'lille', label: 'Université de Lille' },
            { value: 'edhec', label: 'EDHEC Business School' },
            { value: 'centrale_lille', label: 'Centrale Lille' },
            { value: 'ieseg', label: 'IÉSEG School of Management' },
        ],
    },
    {
        city: 'Marseille / Aix',
        universities: [
            { value: 'aix_marseille', label: 'Aix-Marseille Université' },
            { value: 'kedge_marseille', label: 'KEDGE Marseille' },
            { value: 'centrale_marseille', label: 'Centrale Marseille' },
        ],
    },
    {
        city: 'Nantes',
        universities: [
            { value: 'nantes', label: 'Nantes Université' },
            { value: 'audencia', label: 'Audencia Business School' },
            { value: 'centrale_nantes', label: 'Centrale Nantes' },
        ],
    },
    {
        city: 'Strasbourg',
        universities: [
            { value: 'strasbourg', label: 'Université de Strasbourg' },
            { value: 'em_strasbourg', label: 'EM Strasbourg Business School' },
        ],
    },
    {
        city: 'Montpellier',
        universities: [
            { value: 'montpellier', label: 'Université de Montpellier' },
            { value: 'montpellier_bs', label: 'Montpellier Business School' },
        ],
    },
    {
        city: 'Rennes',
        universities: [
            { value: 'rennes_1', label: 'Université de Rennes' },
            { value: 'rennes_sb', label: 'Rennes School of Business' },
        ],
    },
    {
        city: 'Grenoble',
        universities: [
            { value: 'grenoble_alpes', label: 'Université Grenoble Alpes' },
            { value: 'grenoble_em', label: 'Grenoble EM' },
            { value: 'grenoble_inp', label: 'Grenoble INP' },
        ],
    },
    {
        city: 'Nice',
        universities: [
            { value: 'cote_azur', label: 'Université Côte d\'Azur' },
            { value: 'skema_nice', label: 'SKEMA Business School' },
            { value: 'edhec_nice', label: 'EDHEC Nice' },
        ],
    },
];

// ─── Question Builders ───────────────────────────────────────────

export function getTenantQuestions(): Question[] {
    return [
        {
            id: 'situation',
            question: 'What best describes you?',
            emoji: '👋',
            options: [
                { value: 'student_budget', label: '🎓 Student', segment: 'D1' },
                { value: 'family_stability', label: '👨‍👩‍👧 Employee/Family', segment: 'D2' },
                { value: 'flexibility_relocation', label: '🌍 Freelancer/Remote', segment: 'D3' },
                { value: 'other', label: '🏠 Other' },
            ],
        },
        {
            id: 'nationality',
            question: 'Where are you from?',
            emoji: '🌍',
            type: 'select',
            selectOptions: NATIONALITIES.map(n => ({ value: n.toLowerCase(), label: n })),
        },
        {
            id: 'languages',
            question: 'What languages do you speak?',
            emoji: '💬',
            type: 'multiselect',
            options: LANGUAGES.map(l => ({ value: l.value, label: l.label })),
            maxSelections: 5,
        },
        {
            id: 'gender',
            question: 'Gender',
            emoji: '👤',
            options: [
                { value: 'female', label: '👩 Female' },
                { value: 'male', label: '👨 Male' },
                { value: 'other', label: '🧑 Other / Prefer not to say' },
            ],
        },
        {
            id: 'contract_type',
            question: 'Employment status?',
            emoji: '💼',
            options: [
                { value: 'cdi', label: '📋 CDI (Permanent)' },
                { value: 'cdd', label: '📝 CDD (Fixed-term)' },
                { value: 'internship', label: '🎓 Internship' },
                { value: 'self_employed', label: '💻 Self-employed' },
                { value: 'student', label: '📚 Student' },
                { value: 'other', label: '🔄 Other' },
            ],
        },
        {
            id: 'income',
            question: 'Net monthly income?',
            emoji: '💶',
            type: 'range',
            min: 500,
            max: 10000,
            step: 100,
            unit: '€',
        },
        {
            id: 'university',
            question: 'Which university or school are you attending?',
            emoji: '🎓',
            type: 'university_select',
            showIf: (r) => r.situation === 'student_budget' || r.contract_type === 'student' || r.contract_type === 'internship',
        },
        {
            id: 'location_preference',
            question: 'Where would you like to live?',
            emoji: '📍',
            type: 'location_radius',
        },
        {
            id: 'budget',
            question: 'Max budget for rent?',
            emoji: '💰',
            type: 'range',
            min: 300,
            max: 3000,
            step: 50,
            unit: '€',
        },
        {
            id: 'furnished_preference',
            question: 'Furnished or unfurnished?',
            emoji: '🛋️',
            options: [
                { value: 'furnished', label: '🛋️ Furnished' },
                { value: 'unfurnished', label: '📦 Unfurnished' },
                { value: 'no_preference', label: '🤷 No preference' },
            ],
        },
        {
            id: 'min_surface_area',
            question: 'Minimum space needed?',
            emoji: '📐',
            type: 'range',
            min: 9,
            max: 100,
            step: 1,
            unit: 'm²',
        },
        {
            id: 'guarantor_type',
            question: 'Guarantor status?',
            emoji: '🛡️',
            type: 'multiselect',
            options: [
                { value: 'visale', label: '🏛️ Visale' },
                { value: 'garantme', label: '🔐 GarantMe' },
                { value: 'parents', label: '👨‍👩‍👧 Parents' },
                { value: 'bank', label: '🏦 Bank Guarantee' },
                { value: 'none', label: '❌ No Guarantor' },
            ],
            maxSelections: 3,
        },
        {
            id: 'transport_needs',
            question: 'Transport connectivity needed?',
            emoji: '🚇',
            type: 'multiselect',
            options: [
                { value: 'metro', label: '🚇 Metro' },
                { value: 'bus', label: '🚌 Bus' },
                { value: 'rer', label: '🚉 RER/Train' },
                { value: 'bike', label: '🚲 Bike Station' },
            ],
            maxSelections: 4,
        },
        {
            id: 'service_needs',
            question: 'Nearby services needed?',
            emoji: '🏪',
            type: 'multiselect',
            options: [
                { value: 'grocery', label: '🛒 Grocery' },
                { value: 'hospital', label: '🏥 Hospital' },
                { value: 'pharmacy', label: '💊 Pharmacy' },
                { value: 'atm', label: '🏧 ATM' },
            ],
            maxSelections: 4,
        },
        {
            id: 'must_have_amenities',
            question: 'Must-have amenities? (Pick 3)',
            emoji: '✨',
            type: 'multiselect',
            options: [
                { value: 'fiber', label: '📶 Fiber Internet' },
                { value: 'parking', label: '🚗 Parking' },
                { value: 'balcony', label: '☀️ Balcony' },
                { value: 'elevator', label: '🛗 Elevator' },
                { value: 'laundry', label: '🧺 Laundry' },
                { value: 'dishwasher', label: '🍽️ Dishwasher' },
            ],
            maxSelections: 3,
        },
        {
            id: 'living_arrangement',
            question: 'Living arrangement?',
            emoji: '🏠',
            options: [
                { value: 'solo', label: '👤 Solo' },
                { value: 'couple', label: '👫 Couple' },
                { value: 'roommates', label: '👥 Roommates' },
                { value: 'family', label: '👨‍👩‍👧‍👦 Family' },
            ],
        },
        {
            id: 'move_in_timeline',
            question: 'When do you need to move in?',
            emoji: '⏰',
            options: [
                { value: 'asap', label: '🔥 ASAP' },
                { value: 'soon', label: '📅 2-4 weeks' },
                { value: 'flexible', label: '🌊 Flexible' },
            ],
        },
        {
            id: 'has_pets',
            question: 'Do you have pets?',
            emoji: '🐾',
            options: [
                { value: 'yes', label: '🐶 Yes' },
                { value: 'no', label: '❌ No' },
            ],
        },
        {
            id: 'is_smoker',
            question: 'Are you a smoker?',
            emoji: '🚬',
            options: [
                { value: 'yes', label: '🚬 Yes' },
                { value: 'no', label: '🚭 No' },
            ],
        },
    ];
}

export function getLandlordQuestions(): Question[] {
    return [
        {
            id: 'location',
            question: 'Where is your property located?',
            emoji: '📍',
            type: 'text',
            placeholder: 'e.g. Paris 15e, Lyon 3e...',
        },
        {
            id: 'rooms',
            question: 'How many rooms?',
            emoji: '🛏️',
            options: [
                { value: '1', label: 'Studio' },
                { value: '2', label: '1 Bedroom' },
                { value: '3', label: '2 Bedrooms' },
                { value: '4', label: '3+ Bedrooms' },
            ],
        },
        {
            id: 'surface',
            question: 'Property size?',
            emoji: '📐',
            type: 'range',
            min: 9,
            max: 200,
            step: 5,
            unit: 'm²',
        },
        {
            id: 'furnished',
            question: 'Is the property furnished?',
            emoji: '🛋️',
            options: [
                { value: 'furnished', label: '🛋️ Furnished' },
                { value: 'unfurnished', label: '📦 Unfurnished' },
            ],
        },
        {
            id: 'accepted_tenant_types',
            question: 'Preferred tenant profiles?',
            emoji: '👥',
            type: 'multiselect',
            options: [
                { value: 'student', label: '🎓 Students' },
                { value: 'employee', label: '💼 Employees' },
                { value: 'freelancer', label: '💻 Freelancers' },
                { value: 'family', label: '👨‍👩‍👧 Families' },
            ],
            maxSelections: 4,
        },
        {
            id: 'accepted_guarantees',
            question: 'Accepted guarantees?',
            emoji: '🛡️',
            type: 'multiselect',
            options: [
                { value: 'visale', label: '🏛️ Visale' },
                { value: 'garantme', label: '🔐 GarantMe' },
                { value: 'parents', label: '👨‍👩‍👧 Parents' },
                { value: 'bank', label: '🏦 Bank Guarantee' },
            ],
            maxSelections: 4,
        },
        {
            id: 'house_rules',
            question: 'House rules?',
            emoji: '📋',
            type: 'multiselect',
            options: [
                { value: 'no_smoking', label: '🚭 No Smoking' },
                { value: 'no_pets', label: '🐾 No Pets' },
                { value: 'no_parties', label: '🎉 No Parties' },
            ],
            maxSelections: 3,
        },
        {
            id: 'urgency',
            question: 'How urgent is the listing?',
            emoji: '⚡',
            options: [
                { value: 'urgent', label: '🔥 Very urgent' },
                { value: 'soon', label: '📅 Soon' },
                { value: 'planning', label: '🗓️ Planning ahead' },
            ],
        },
    ];
}
