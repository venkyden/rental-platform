// Pure display helpers for listing cards. Shared by landing + search.

export interface ListingSummary {
    id: string;
    title: string;
    description?: string | null;
    city: string;
    postal_code?: string | null;
    monthly_rent: number;
    charges?: number | null;
    charges_included?: boolean;
    bedrooms: number;
    rooms_count?: number | null;
    property_type: string;
    furnished: boolean;
    size_sqm?: number | null;
    photos?: { url: string }[] | null;
    amenities?: string[] | null;
    available_from?: string | null;
    dpe_rating?: string | null;
    ownership_verified?: boolean;
    is_saved?: boolean;
    landlord_first_name?: string | null;
    landlord_identity_verified?: boolean;
}

// 'Studio' / 'T2' / 'Colocation' are language-neutral tokens; returns null when
// only a translated type name (apartment/house) applies — caller falls back to t().
export function getTypology(p: ListingSummary): string | null {
    const propType = p.property_type?.toLowerCase();
    if (propType === 'studio') return 'Studio';
    if (propType === 'room' || propType === 'colocation' || propType === 'chambre') return 'Colocation';
    if (p.amenities?.some(a => a.toLowerCase().includes('colocation') || a.toLowerCase().includes('coloc'))) return 'Colocation';
    if (p.title?.toLowerCase().includes('colocation') || p.title?.toLowerCase().includes('coloc')) return 'Colocation';
    if (p.rooms_count && p.rooms_count >= 1) {
        return p.rooms_count >= 6 ? 'T6+' : `T${p.rooms_count}`;
    }
    return null;
}

export function getDisplayPrice(p: ListingSummary): { amount: number; suffix: 'cc' | 'hc' } {
    const rent = Number(p.monthly_rent) || 0;
    if (p.charges_included) return { amount: rent, suffix: 'cc' };
    const charges = Number(p.charges) || 0;
    if (charges > 0) return { amount: rent + charges, suffix: 'cc' };
    return { amount: rent, suffix: 'hc' };
}

export function getDescriptionPreview(description?: string | null, maxLength = 160): string | null {
    if (!description) return null;
    const cleaned = description
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return null;
    if (cleaned.length <= maxLength) return cleaned;
    const cut = cleaned.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

export function getAvailability(availableFrom?: string | null): { immediate: boolean; date: Date | null } {
    if (!availableFrom) return { immediate: true, date: null };
    const date = new Date(`${availableFrom}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date <= new Date()) return { immediate: true, date: null };
    return { immediate: false, date };
}

// One differentiator max, by priority. Returns an i18n key.
const DIFFERENTIATOR_PRIORITY: Array<[RegExp, string]> = [
    [/salle de bain priv|private bath/i, 'listing.diff.privateBathroom'],
    [/balcon|balcony/i, 'listing.diff.balcony'],
    [/terrasse|terrace/i, 'listing.diff.terrace'],
    [/parking|garage/i, 'listing.diff.parking'],
    [/ascenseur|elevator|lift/i, 'listing.diff.elevator'],
];

export function getDifferentiatorKey(amenities?: string[] | null): string | null {
    if (!amenities?.length) return null;
    for (const [pattern, key] of DIFFERENTIATOR_PRIORITY) {
        if (amenities.some(a => pattern.test(a))) return key;
    }
    return null;
}
