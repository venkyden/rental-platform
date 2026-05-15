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
    type?: 'text' | 'range' | 'multiselect' | 'date' | 'select' | 'university_select' | 'location_radius' | 'address_autocomplete';
    restrictToCities?: string[];
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    maxSelections?: number;
    selectOptions?: { value: string; label: string }[];
    description?: string;
    showIf?: (responses: Record<string, any>) => boolean;
}

export interface QuestionnaireProps {
    userType: 'tenant' | 'landlord' | 'agency';
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
            question: 'question',
            emoji: '',
            options: [
                { value: 'student', label: 'options.student', segment: 'D1' },
                { value: 'young_professional', label: 'options.young_professional', segment: 'D2' },
                { value: 'self_employed', label: 'options.self_employed', segment: 'D3' },
                { value: 'retired', label: 'options.retired', segment: 'D2' },
                { value: 'other', label: 'options.other' },
            ],
        },
        {
            id: 'nationality',
            type: 'select',
            question: 'question',
            emoji: '',
            selectOptions: NATIONALITIES.map(n => ({ 
                value: n.toLowerCase(), 
                label: `common.nationalities.${n.toLowerCase()}` 
            })),
        },
        {
            id: 'languages',
            question: 'question',
            emoji: '',
            type: 'multiselect',
            options: LANGUAGES.map(l => ({ value: l.value, label: l.label })),
            maxSelections: 5,
        },
        {
            id: 'gender',
            question: 'question',
            emoji: '',
            options: [
                { value: 'female', label: 'options.female' },
                { value: 'male', label: 'options.male' },
                { value: 'other', label: 'options.other' },
            ],
        },
        {
            id: 'contract_type',
            question: 'question',
            emoji: '',
            options: [
                { value: 'cdi', label: 'options.cdi' },
                { value: 'cdd', label: 'options.cdd' },
                { value: 'internship', label: 'options.internship' },
                { value: 'self_employed', label: 'options.self_employed' },
                { value: 'student', label: 'options.student' },
                { value: 'other', label: 'options.other' },
            ],
        },
        {
            id: 'income',
            question: 'question',
            emoji: '',
            type: 'range',
            min: 500,
            max: 10000,
            step: 100,
            unit: '€',
        },
        {
            id: 'university',
            question: 'question',
            emoji: '',
            type: 'university_select',
            showIf: (r) => r.situation === 'student' || r.contract_type === 'student' || r.contract_type === 'internship',
        },
        {
            id: 'workplace',
            question: 'question',
            emoji: '',
            type: 'address_autocomplete',
            placeholder: 'common.placeholders.workplaceAddress',
            showIf: (r) => !(r.situation === 'student' || r.contract_type === 'student' || r.contract_type === 'internship'),
        },
        {
            id: 'location_preference',
            question: 'question',
            emoji: '',
            type: 'location_radius',
        },
        {
            id: 'budget',
            question: 'question',
            emoji: '',
            type: 'range',
            min: 300,
            max: 3000,
            step: 50,
            unit: '€',
        },
        {
            id: 'furnished_preference',
            question: 'question',
            emoji: '️',
            options: [
                { value: 'furnished', label: 'options.furnished' },
                { value: 'unfurnished', label: 'options.unfurnished' },
                { value: 'no_preference', label: 'options.no_preference' },
            ],
        },
        {
            id: 'min_surface_area',
            question: 'question',
            emoji: '',
            type: 'range',
            min: 9,
            max: 100,
            step: 1,
            unit: 'm²',
        },
        {
            id: 'guarantor_type',
            question: 'question',
            emoji: '️',
            type: 'multiselect',
            options: [
                { value: 'visale', label: 'options.visale' },
                { value: 'garantme', label: 'options.garantme' },
                { value: 'parents', label: 'options.parents' },
                { value: 'bank', label: 'options.bank' },
                { value: 'none', label: 'options.none' },
            ],
            maxSelections: 3,
        },
        {
            id: 'transport_needs',
            question: 'question',
            emoji: '',
            type: 'multiselect',
            options: [
                { value: 'metro', label: 'options.metro' },
                { value: 'bus', label: 'options.bus' },
                { value: 'rer', label: 'options.rer' },
                { value: 'bike', label: 'options.bike' },
            ],
            maxSelections: 4,
        },
        {
            id: 'service_needs',
            question: 'question',
            emoji: '',
            type: 'multiselect',
            options: [
                { value: 'grocery', label: 'options.grocery' },
                { value: 'hospital', label: 'options.hospital' },
                { value: 'pharmacy', label: 'options.pharmacy' },
                { value: 'atm', label: 'options.atm' },
            ],
            maxSelections: 4,
        },
        {
            id: 'must_have_amenities',
            question: 'question',
            emoji: '',
            type: 'multiselect',
            options: [
                { value: 'fiber', label: 'options.fiber' },
                { value: 'parking', label: 'options.parking' },
                { value: 'balcony', label: 'options.balcony' },
                { value: 'elevator', label: 'options.elevator' },
                { value: 'laundry', label: 'options.laundry' },
                { value: 'dishwasher', label: 'options.dishwasher' },
            ],
            maxSelections: 3,
        },
        {
            id: 'living_arrangement',
            question: 'question',
            emoji: '',
            options: [
                { value: 'solo', label: 'options.solo' },
                { value: 'couple', label: 'options.couple' },
                { value: 'roommates', label: 'options.roommates' },
                { value: 'family', label: 'options.family' },
            ],
        },
        {
            id: 'move_in_timeline',
            question: 'question',
            emoji: '⏰',
            options: [
                { value: 'asap', label: 'options.asap' },
                { value: 'soon', label: 'options.soon' },
                { value: 'flexible', label: 'options.flexible' },
                { value: 'browsing', label: 'options.browsing' },
            ],
        },
        {
            id: 'has_pets',
            question: 'question',
            emoji: '',
            options: [
                { value: 'yes', label: 'options.yes' },
                { value: 'no', label: 'options.no' },
            ],
        },
        {
            id: 'is_smoker',
            question: 'question',
            emoji: '',
            options: [
                { value: 'yes', label: 'options.yes' },
                { value: 'no', label: 'options.no' },
            ],
        },
        {
            id: 'caf_preference',
            question: 'question',
            emoji: '🏦',
            options: [
                { value: 'yes', label: 'options.yes' },
                { value: 'no', label: 'options.no' },
            ],
        },
    ];
}

export function getLandlordQuestions(): Question[] {
    return [
        {
            id: 'property_count',
            question: 'onboarding.questions.landlord.property_count.question',
            emoji: '🏠',
            options: [
                { value: '1_4', label: 'onboarding.questions.landlord.property_count.options.1_4', segment: 'S1' },
                { value: '5_100', label: 'onboarding.questions.landlord.property_count.options.5_100', segment: 'S2' },
                { value: '100_plus', label: 'onboarding.questions.landlord.property_count.options.100_plus', segment: 'S3' },
            ],
        },
        {
            id: 'challenge',
            question: 'onboarding.questions.landlord.challenge.question',
            emoji: '🎯',
            options: [
                { value: 'finding_tenants', label: 'onboarding.questions.landlord.challenge.options.finding_tenants' },
                { value: 'avoiding_fraud', label: 'onboarding.questions.landlord.challenge.options.avoiding_fraud' },
                { value: 'regulations', label: 'onboarding.questions.landlord.challenge.options.regulations' },
                { value: 'all', label: 'onboarding.questions.landlord.challenge.options.all' },
            ],
        },
        {
            id: 'location',
            question: 'onboarding.questions.landlord.property_location.question',
            emoji: '📍',
            type: 'address_autocomplete',
            restrictToCities: ['nantes', 'paris'],
            placeholder: 'common.placeholders.address',
            description: 'onboarding.questions.landlord.property_location.description',
        },
        {
            id: 'rooms',
            question: 'onboarding.questions.landlord.rooms.question',
            emoji: '️',
            options: [
                { value: '1', label: 'onboarding.questions.landlord.rooms.options.studio' },
                { value: '2', label: 'onboarding.questions.landlord.rooms.options.1_bed' },
                { value: '3', label: 'onboarding.questions.landlord.rooms.options.2_bed' },
                { value: '4', label: 'onboarding.questions.landlord.rooms.options.3_plus' },
            ],
        },
        {
            id: 'surface',
            question: 'onboarding.questions.landlord.property_size.question',
            emoji: '',
            type: 'range',
            min: 9,
            max: 500,
            step: 1,
            unit: 'm²',
        },
        {
            id: 'furnished',
            question: 'onboarding.questions.landlord.furnished_prop.question',
            emoji: '️',
            options: [
                { value: 'furnished', label: 'onboarding.questions.landlord.furnished_prop.options.furnished' },
                { value: 'unfurnished', label: 'onboarding.questions.landlord.furnished_prop.options.unfurnished' },
            ],
        },
        {
            id: 'accepted_tenant_types',
            question: 'onboarding.questions.landlord.tenant_types.question',
            emoji: '',
            type: 'multiselect',
            options: [
                { value: 'student', label: 'onboarding.questions.landlord.tenant_types.options.student' },
                { value: 'employee', label: 'onboarding.questions.landlord.tenant_types.options.employee' },
                { value: 'freelancer', label: 'onboarding.questions.landlord.tenant_types.options.freelancer' },
                { value: 'family', label: 'onboarding.questions.landlord.tenant_types.options.family' },
            ],
            maxSelections: 4,
        },
        {
            id: 'accepted_guarantees',
            question: 'onboarding.questions.landlord.guarantees.question',
            emoji: '️',
            type: 'multiselect',
            options: [
                { value: 'visale', label: 'onboarding.questions.landlord.guarantees.options.visale' },
                { value: 'garantme', label: 'onboarding.questions.landlord.guarantees.options.garantme' },
                { value: 'parents', label: 'onboarding.questions.landlord.guarantees.options.parents' },
                { value: 'bank', label: 'onboarding.questions.landlord.guarantees.options.bank' },
            ],
            maxSelections: 4,
        },
        {
            id: 'house_rules',
            question: 'onboarding.questions.landlord.rules.question',
            emoji: '',
            type: 'multiselect',
            options: [
                { value: 'no_smoking', label: 'onboarding.questions.landlord.rules.options.no_smoking' },
                { value: 'no_pets', label: 'onboarding.questions.landlord.rules.options.no_pets' },
                { value: 'no_parties', label: 'onboarding.questions.landlord.rules.options.no_parties' },
                { value: 'no_preference', label: 'onboarding.questions.landlord.rules.options.no_preference' },
            ],
            maxSelections: 4,
        },
        {
            id: 'urgency',
            question: 'onboarding.questions.landlord.urgency.question',
            emoji: '',
            options: [
                { value: 'urgent', label: 'onboarding.questions.landlord.urgency.options.urgent' },
                { value: 'soon', label: 'onboarding.questions.landlord.urgency.options.soon' },
                { value: 'planning', label: 'onboarding.questions.landlord.urgency.options.planning' },
            ],
        },
        {
            id: 'caf_eligibility',
            question: 'onboarding.questions.landlord.caf_eligibility.question',
            emoji: '🏦',
            options: [
                { value: 'yes', label: 'onboarding.questions.landlord.caf_eligibility.options.yes' },
                { value: 'no', label: 'onboarding.questions.landlord.caf_eligibility.options.no' },
            ],
        },
    ];
}

export function getAgencyQuestions(): Question[] {
    return [
        {
            id: 'property_count',
            question: 'onboarding.questions.landlord.property_count.question',
            emoji: '🏢',
            options: [
                { value: '5_100', label: 'onboarding.questions.landlord.property_count.options.5_100', segment: 'S2' },
                { value: '100_plus', label: 'onboarding.questions.landlord.property_count.options.100_plus', segment: 'S3' },
            ],
        },
        {
            id: 'challenge',
            question: 'onboarding.questions.landlord.challenge.question',
            emoji: '🚀',
            options: [
                { value: 'finding_tenants', label: 'onboarding.questions.landlord.challenge.options.finding_tenants' },
                { value: 'avoiding_fraud', label: 'onboarding.questions.landlord.challenge.options.avoiding_fraud' },
                { value: 'regulations', label: 'onboarding.questions.landlord.challenge.options.regulations' },
                { value: 'all', label: 'onboarding.questions.landlord.challenge.options.all' },
            ],
        },
        {
            id: 'urgency',
            question: 'onboarding.questions.landlord.urgency.question',
            emoji: '⏰',
            options: [
                { value: 'urgent', label: 'onboarding.questions.landlord.urgency.options.urgent' },
                { value: 'soon', label: 'onboarding.questions.landlord.urgency.options.soon' },
                { value: 'planning', label: 'onboarding.questions.landlord.urgency.options.planning' },
            ],
        },
    ];
}
