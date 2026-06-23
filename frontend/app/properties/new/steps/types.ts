export type PropertyFormData = {
    title: string;
    property_type: string;
    description: string;
    address_line1: string;
    address_line2: string;
    city: string;
    postal_code: string;
    country: string;
    latitude?: number;
    longitude?: number;
    bedrooms: number;
    bathrooms: number;
    size_sqm: number;
    floor_number?: number;
    furnished: boolean;
    accommodation_capacity: number;
    rooms_count: number;
    living_room_type: 'Private' | 'Common' | 'None';
    kitchen_type: 'Private' | 'Municipality' | 'None';
    room_details: Array<{
        surface: number;
        capacity: number;
        description: string;
        bedding: string;
        custom_amenities: string[];
    }>;
    dpe_rating: string;
    ges_rating: string;
    dpe_value: number | undefined;
    ges_value: number | undefined;
    surface_type: string;
    construction_year?: number;
    monthly_rent: number;
    deposit?: number;
    charges?: number;
    charges_included: boolean;
    charges_description?: string;
    available_from?: string;
    lease_duration_months?: number;
    caf_eligible: boolean;
    guarantor_required: boolean;
    accepted_guarantor_types: string[];
    loyer_reference?: number;
    loyer_reference_majore?: number;
    complement_de_loyer?: number;
    complement_de_loyer_justification?: string;
    natural_risks_compliant: boolean;
    amenities: string[];
    custom_amenities: string[];
    public_transport: string[];
    nearby_landmarks: string[];
};

export const PROPERTY_TYPES = ['apartment', 'house', 'studio', 'room'] as const;
export const STANDARD_AMENITIES = [
    'elevator', 'balcony', 'parking', 'garden', 'terrace',
    'cellar', 'pool', 'gym', 'security',
] as const;

export type TFn = (key: string, params?: Record<string, string | number>, fallback?: string) => string;
