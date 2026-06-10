'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useToast } from '@/lib/ToastContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import { apiClient } from '@/lib/api';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { Camera, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight, Info, Shield, MapPin, Euro, Layout, Zap, Building, Plus, Image, X } from 'lucide-react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import QRCodeDisplay from '@/components/QRCodeDisplay';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

type PropertyFormData = {
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
    dpe_rating: string;
    ges_rating: string;
    dpe_value?: number;
    ges_value?: number;
    surface_type: string;
    construction_year?: number;
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
    monthly_rent: number;
    deposit?: number;
    charges?: number;
    charges_included: boolean;
    charges_description?: string;
    available_from?: string;
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
    utilities_included: string[];
    accepted_tenant_types: string[];
};

const PROPERTY_TYPES = ['apartment', 'house', 'studio', 'room'];
const STANDARD_AMENITIES = [
    'elevator', 'balcony', 'parking', 'garden', 'terrace',
    'cellar', 'pool', 'gym', 'security'
];
const ENERGY_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const GUARANTOR_TYPES = ['visale', 'garantme', 'physical', 'organisation'];
const TENANT_TYPES = ['student', 'employee', 'freelancer', 'family'];
const UTILITIES = ['wifi', 'elec', 'gas', 'water'];
const BEDDING_TYPES = ['Single', 'Double', 'Queen', 'King', 'Bunk', 'Sofa Bed'];

const STEP_LABELS = ['identity', 'location', 'specs', 'capacity', 'pricing', 'features', 'narrative', 'review'] as const;

export default function EditPropertyPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const toast = useToast();
    const { t } = useLanguage();
    const [generatingAi, setGeneratingAi] = useState(false);
    const propertyId = params?.id as string;

    const [declared, setDeclared] = useState(false);
    const [mediaSession, setMediaSession] = useState<any>(null);
    const [showMediaModal, setShowMediaModal] = useState(false);

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [mediaCount, setMediaCount] = useState(0);
    const [customAmenityInput, setCustomAmenityInput] = useState('');
    const [transportInput, setTransportInput] = useState('');
    const [landmarkInput, setLandmarkInput] = useState('');
    const [roomAmenityInputs, setRoomAmenityInputs] = useState<Record<number, string>>({});
    const [showRentControl, setShowRentControl] = useState(false);
    const [descriptionEn, setDescriptionEn] = useState('');
    const [descriptionFr, setDescriptionFr] = useState('');
    const [descLanguage, setDescLanguage] = useState<'en' | 'fr'>('en');

    const { language } = useLanguage();
    useEffect(() => {
        if (language === 'fr' || language === 'en') {
            setDescLanguage(language);
        }
    }, [language]);

    const [formData, setFormData] = useState<PropertyFormData>({
        title: '',
        property_type: 'apartment',
        description: '',
        address_line1: '',
        address_line2: '',
        city: '',
        postal_code: '',
        country: 'France',
        bedrooms: 1,
        bathrooms: 1,
        size_sqm: 30,
        furnished: false,
        dpe_rating: '',
        ges_rating: '',
        surface_type: 'standard',
        accommodation_capacity: 1,
        rooms_count: 1,
        living_room_type: 'None',
        kitchen_type: 'None',
        room_details: [],
        monthly_rent: 800,
        charges_included: false,
        caf_eligible: false,
        guarantor_required: false,
        accepted_guarantor_types: [],
        loyer_reference: undefined,
        loyer_reference_majore: undefined,
        complement_de_loyer: undefined,
        complement_de_loyer_justification: '',
        natural_risks_compliant: false,
        amenities: [],
        custom_amenities: [],
        public_transport: [],
        nearby_landmarks: [],
        utilities_included: [],
        accepted_tenant_types: [],
    });

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const response = await apiClient.client.get(`/properties/${propertyId}`);
                const property = response.data;
                const standardAmenities = property.amenities?.standard || [];
                const customAmenities = property.custom_amenities?.items || [];
                const photos = property.photos || [];

                setMediaCount(Array.isArray(photos) ? photos.length : 0);

                const rentControlActive = property.loyer_reference !== undefined && property.loyer_reference !== null;
                setShowRentControl(rentControlActive);

                const desc = property.description || '';
                const enMatch = desc.match(/### English\n([\s\S]*?)(?=\n\n### Français|$)/);
                const frMatch = desc.match(/### Français\n([\s\S]*?)(?=\n\n### English|$)/);

                let parsedEn = '';
                let parsedFr = '';

                if (enMatch) {
                    parsedEn = enMatch[1].trim();
                }
                if (frMatch) {
                    parsedFr = frMatch[1].trim();
                }

                if (!enMatch && !frMatch && desc.trim()) {
                    if (language === 'fr') {
                        parsedFr = desc.trim();
                    } else {
                        parsedEn = desc.trim();
                    }
                }

                setDescriptionEn(parsedEn);
                setDescriptionFr(parsedFr);

                setFormData({
                    title: property.title || '',
                    property_type: property.property_type || 'apartment',
                    description: property.description || '',
                    address_line1: property.address_line1 || '',
                    address_line2: property.address_line2 || '',
                    city: property.city || '',
                    postal_code: property.postal_code || '',
                    country: property.country || 'France',
                    latitude: property.latitude,
                    longitude: property.longitude,
                    bedrooms: property.bedrooms || 1,
                    bathrooms: property.bathrooms || 1,
                    size_sqm: property.size_sqm || 30,
                    floor_number: property.floor_number,
                    furnished: property.furnished || false,
                    dpe_rating: property.dpe_rating || '',
                    ges_rating: property.ges_rating || '',
                    dpe_value: property.dpe_value,
                    ges_value: property.ges_value,
                    surface_type: property.surface_type || 'standard',
                    construction_year: property.construction_year,
                    accommodation_capacity: property.accommodation_capacity || 1,
                    rooms_count: property.rooms_count || 1,
                    living_room_type: property.living_room_type || 'None',
                    kitchen_type: property.kitchen_type || 'None',
                    room_details: property.room_details || [],
                    monthly_rent: property.monthly_rent || 800,
                    deposit: property.deposit,
                    charges: property.charges,
                    charges_included: property.charges_included ?? false,
                    charges_description: property.charges_description,
                    available_from: property.available_from,
                    caf_eligible: property.caf_eligible ?? false,
                    guarantor_required: property.guarantor_required ?? false,
                    accepted_guarantor_types: property.accepted_guarantor_types || [],
                    loyer_reference: property.loyer_reference,
                    loyer_reference_majore: property.loyer_reference_majore,
                    complement_de_loyer: property.complement_de_loyer,
                    complement_de_loyer_justification: property.complement_de_loyer_justification,
                    natural_risks_compliant: property.natural_risks_compliant ?? false,
                    amenities: standardAmenities,
                    custom_amenities: customAmenities,
                    public_transport: property.public_transport?.items || [],
                    nearby_landmarks: property.nearby_landmarks?.items || [],
                    utilities_included: property.utilities_included || [],
                    accepted_tenant_types: property.accepted_tenant_types || [],
                });
            } catch (error) {
                console.error('Failed to fetch property:', error);
                toast.error(t('properties.edit.notFound', undefined, 'Property not found'));
                router.push('/properties');
            } finally {
                setInitialLoading(false);
            }
        };

        if (propertyId) fetchProperty();
    }, [propertyId, router]);

    const updateFormData = (updates: Partial<PropertyFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }));
    };

    const handleEnrichLocation = async () => {
        setEnriching(true);
        try {
            const response = await apiClient.client.post('/location/enrich', {
                address: formData.address_line1,
                city: formData.city,
                postal_code: formData.postal_code,
                country: formData.country
            });

            updateFormData({
                latitude: response.data.latitude,
                longitude: response.data.longitude,
                public_transport: response.data.public_transport || [],
                nearby_landmarks: response.data.nearby_landmarks || []
            });
            toast.success(t('property.create.validation.enrichSuccess', undefined, 'Location data enriched successfully!'));
        } catch (error) {
            console.error('Enrichment error:', error);
            toast.error(t('property.create.validation.enrichFail', undefined, 'Could not enrich location data'));
        } finally {
            setEnriching(false);
        }
    };

    const handleAiSuggest = async () => {
        if (!formData.address_line1 || !formData.city) {
            toast.info(t('properties.new.steps.narrative.aiSuggestAddressWarning', undefined, 'For a localized description, please enter the address in Step 2 first.'));
        }
        setGeneratingAi(true);
        try {
            const response = await apiClient.client.post('/properties/generate-description', {
                property_type: formData.property_type,
                address: formData.address_line1,
                city: formData.city,
                postal_code: formData.postal_code,
                country: formData.country,
                size_sqm: formData.size_sqm,
                bedrooms: formData.bedrooms,
                bathrooms: formData.bathrooms,
                furnished: formData.furnished,
                rooms_count: formData.rooms_count,
                monthly_rent: formData.monthly_rent,
                amenities: formData.amenities,
                custom_amenities: formData.custom_amenities,
                public_transport: formData.public_transport,
                nearby_landmarks: formData.nearby_landmarks,
                language: descLanguage,
            });

            if (descLanguage === 'en') {
                setDescriptionEn(response.data.description);
            } else {
                setDescriptionFr(response.data.description);
            }
            toast.success(t('properties.new.steps.narrative.aiSuggestSuccess', undefined, 'AI description generated successfully!'));
        } catch (error: any) {
            console.error('AI suggest error:', error);
            const fallback = descLanguage === 'en'
                ? `Magnificent ${formData.property_type} located in the heart of ${formData.city || 'the city'}. This ${formData.size_sqm}m² property features ${formData.bedrooms} bedroom(s) and modern amenities. Ideal for those seeking comfort and convenience.`
                : `Magnifique ${formData.property_type} situé au coeur de ${formData.city || 'la ville'}. Cette propriété de ${formData.size_sqm}m² comprend ${formData.bedrooms} chambre(s) et des équipements modernes. Idéal pour ceux qui recherchent le confort et la commodité.`;
            
            if (descLanguage === 'en') {
                setDescriptionEn(fallback);
            } else {
                setDescriptionFr(fallback);
            }
            toast.error(error.response?.data?.detail || 'Failed to generate AI description. Loaded default template.');
        } finally {
            setGeneratingAi(false);
        }
    };

    const handleManageMedia = async () => {
        if (!propertyId) return;
        try {
            const sessionRes = await apiClient.client.post(
                `/properties/${propertyId}/media-session`
            );
            setMediaSession(sessionRes.data);
            setShowMediaModal(true);
        } catch (error) {
            console.error('Failed to create media session:', error);
            toast.error('Failed to create media session');
        }
    };

    const handleSubmit = async () => {
        if (!declared) {
            toast.error(t('properties.new.steps.review.declarationRequired', undefined, 'You must declare that the information is true.'));
            return;
        }
        setLoading(true);
        try {
            // Clean empty strings for optional fields in payload
            const payload = { ...formData };
            if (payload.dpe_rating === '') payload.dpe_rating = undefined as any;
            if (payload.ges_rating === '') payload.ges_rating = undefined as any;
            if (payload.complement_de_loyer_justification === '') {
                payload.complement_de_loyer_justification = undefined as any;
            }

            // Merge bilingual descriptions
            let combinedDescription = "";
            if (descriptionEn.trim() && descriptionFr.trim()) {
                combinedDescription = `### English\n${descriptionEn.trim()}\n\n### Français\n${descriptionFr.trim()}`;
            } else if (descriptionEn.trim()) {
                combinedDescription = descriptionEn.trim();
            } else if (descriptionFr.trim()) {
                combinedDescription = descriptionFr.trim();
            }
            payload.description = combinedDescription;

            await apiClient.client.put(`/properties/${propertyId}`, payload);
            toast.success(t('properties.edit.saveSuccess', undefined, 'Property updated successfully'));
            router.push(`/properties/${propertyId}`);
        } catch (error: any) {
            console.error('Update error:', error);
            let errorMsg = error.response?.data?.detail || t('properties.edit.saveFailed', undefined, 'Failed to update property');
            if (Array.isArray(errorMsg)) {
                errorMsg = errorMsg.map((err: any) => `${err.loc[err.loc.length - 1]}: ${err.msg}`).join(', ');
            }
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1: return !!formData.title;
            case 2: return !!(formData.address_line1 && formData.city && formData.postal_code);
            case 3: {
                const isValid = formData.bedrooms >= 0 && formData.size_sqm > 0 && !!formData.dpe_rating;
                if (isValid && formData.size_sqm < 9 * formData.accommodation_capacity) {
                    toast.warning(t('properties.new.steps.pricing.decencyWarning', undefined, 'Decency warning: Surface area is below 9m² per occupant.'));
                }
                return isValid;
            }
            case 4: {
                const isValid = formData.accommodation_capacity > 0;
                if (isValid && formData.size_sqm < 9 * formData.accommodation_capacity) {
                    toast.warning(t('properties.new.steps.pricing.decencyWarning', undefined, 'Decency warning: Surface area is below 9m² per occupant.'));
                }
                return isValid;
            }
            case 5: {
                const isValid = formData.monthly_rent > 0;
                if (isValid && formData.deposit !== undefined) {
                    const maxDepositMonths = formData.furnished ? 2 : 1;
                    const maxDeposit = formData.monthly_rent * maxDepositMonths;
                    if (formData.deposit > maxDeposit) {
                        toast.warning(t(formData.furnished ? 'properties.new.steps.pricing.depositWarningFurnished' : 'properties.new.steps.pricing.depositWarningUnfurnished', undefined, `Deposit exceeds the legal limit of ${formData.furnished ? '2 months' : '1 month'} rent.`));
                    }
                }
                return isValid;
            }
            case 7: return !!(descriptionEn.trim() || descriptionFr.trim());
            default: return true;
        }
    };

    const nextStep = () => {
        if (currentStep === 3) {
            if (formData.room_details.length !== formData.bedrooms) {
                const newRoomDetails = Array(formData.bedrooms).fill({}).map((_, i) => formData.room_details[i] || {
                    surface: 10,
                    capacity: 1,
                    description: '',
                    bedding: 'Double',
                    custom_amenities: [],
                });
                updateFormData({ room_details: newRoomDetails });
            }
        }
        if (validateStep(currentStep)) setCurrentStep(prev => Math.min(8, prev + 1));
    };

    const prevStep = () => setCurrentStep(prev => Math.max(1, prev - 1));

    if (initialLoading) {
        return (
            <ProtectedRoute>
                <PremiumLayout withNavbar={true}>
                    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-zinc-900" />
                        <p className="text-zinc-400 text-sm font-black uppercase tracking-[0.3em]">
                            {t('properties.edit.loading', undefined, 'Loading property...')}
                        </p>
                    </div>
                </PremiumLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

                <div className="max-w-5xl mx-auto px-6 lg:px-12 py-20 relative z-10">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-16">
                        <div className="space-y-4">
                            <h1 className="text-5xl font-black tracking-tighter uppercase text-zinc-900 leading-none">
                                {t('properties.edit.title', undefined, 'Edit Property')}
                            </h1>
                            <p className="text-zinc-500 font-medium tracking-tight">
                                {formData.title}
                            </p>
                        </div>
                        <button
                            onClick={() => router.push(`/properties/${propertyId}`)}
                            aria-label={t('properties.edit.backToProperty', undefined, 'Back to property')}
                            className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center hover:scale-110 transition-transform"
                        >
                            ←
                        </button>
                    </div>

                    {/* Progress with Labels */}
                    <div className="mb-20">
                        <div className="flex justify-between mb-4 px-2">
                            {STEP_LABELS.map((step, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentStep(idx + 1)}
                                    aria-label={t(`properties.new.wizard.${step}`, undefined, step)}
                                    className={`text-[9px] font-black uppercase tracking-widest transition-colors cursor-pointer hover:text-zinc-600 ${currentStep === idx + 1 ? 'text-zinc-900' : 'text-zinc-300'}`}
                                >
                                    <span className="hidden sm:inline">{t(`properties.new.wizard.${step}`)}</span>
                                    <span className="sm:hidden">{idx + 1}</span>
                                </button>
                            ))}
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(currentStep / 8) * 100}%` }}
                                className="h-full bg-zinc-900 shadow-[0_0_20px_rgba(0,0,0,0.1)]"
                            />
                        </div>
                    </div>

                    <div className="flex justify-center">
                        {/* Main Interaction Area */}
                        <div className="w-full max-w-2xl">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.4, ease: "circOut" }}
                                    className="space-y-12"
                                >
                                    {/* Step 1: Identity */}
                                    {currentStep === 1 && (
                                        <div className="space-y-10">
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('properties.new.steps.identity.label', undefined, '01 // Identity')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.title}
                                                    onChange={(e) => updateFormData({ title: e.target.value })}
                                                    placeholder={t('properties.new.steps.identity.titlePlaceholder', undefined, 'Property title')}
                                                    aria-label={t('property.create.basic.propertyTitle', undefined, 'Property Title')}
                                                    className="w-full bg-transparent text-3xl sm:text-6xl font-black tracking-tighter text-zinc-900 placeholder:text-zinc-200 border-none focus:ring-0"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-8">
                                                {PROPERTY_TYPES.map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => updateFormData({ property_type: type })}
                                                        aria-label={t(`properties.new.types.${type}`, undefined, type)}
                                                        className={`p-8 rounded-[2.5rem] border-2 transition-all text-left group ${formData.property_type === type ? 'bg-zinc-900 border-zinc-900 shadow-2xl' : 'border-zinc-100 hover:border-zinc-300'}`}
                                                    >
                                                        <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${formData.property_type === type ? 'text-zinc-400' : 'text-zinc-500'}`}>{type}</div>
                                                        <div className={`text-xl font-black ${formData.property_type === type ? 'text-white' : 'text-zinc-900'}`}>
                                                            {t(`properties.new.types.${type}`, undefined, type)}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 2: Location */}
                                    {currentStep === 2 && (
                                        <div className="space-y-10">
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('properties.new.steps.geolocation.label', undefined, '03 // Geolocation')}
                                                </label>
                                                <div className="glass-card !p-8 rounded-[3rem] border-zinc-100">
                                                    <AddressAutocomplete
                                                        onSelectAction={(result) => {
                                                            updateFormData({
                                                                address_line1: result.address,
                                                                city: result.city,
                                                                postal_code: result.postal_code,
                                                                latitude: result.lat,
                                                                longitude: result.lng,
                                                            });
                                                        }}
                                                        countryCode="fr"
                                                        initialValue={formData.address_line1}
                                                        variant="form"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.location.addressLine2', undefined, 'Building, Floor, Suite')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.address_line2}
                                                    onChange={(e) => updateFormData({ address_line2: e.target.value })}
                                                    placeholder={t('property.create.location.addressLine2Placeholder', undefined, 'Optional')}
                                                    aria-label={t('property.create.location.addressLine2', undefined, 'Building, Floor, Suite')}
                                                    className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-xl"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('properties.new.steps.geolocation.city', undefined, 'City')}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={formData.city}
                                                        onChange={(e) => updateFormData({ city: e.target.value })}
                                                        aria-label={t('properties.new.steps.geolocation.city', undefined, 'City')}
                                                        className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-xl"
                                                    />
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('properties.new.steps.geolocation.zip', undefined, 'Zip')}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={formData.postal_code}
                                                        onChange={(e) => updateFormData({ postal_code: e.target.value })}
                                                        aria-label={t('properties.new.steps.geolocation.zip', undefined, 'Postal Code')}
                                                        className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-xl"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleEnrichLocation}
                                                disabled={enriching}
                                                aria-label={t('properties.new.steps.geolocation.enrichButton', undefined, 'Verify Connectivity & POIs')}
                                                className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {enriching ? t('properties.new.steps.geolocation.enriching', undefined, 'Enriching Data...') : t('properties.new.steps.geolocation.enrichButton', undefined, 'Verify Connectivity & POIs')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Step 3: Details (Specs) */}
                                    {currentStep === 3 && (
                                        <div className="space-y-12">
                                            <div className="grid grid-cols-2 gap-12">
                                                <div className="space-y-6">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('properties.new.steps.details.bedrooms', undefined, 'Bedrooms')}
                                                    </label>
                                                    <div className="flex items-center gap-8">
                                                        <button
                                                            onClick={() => updateFormData({ bedrooms: Math.max(0, formData.bedrooms - 1) })}
                                                            aria-label={t('property.create.details.bedrooms', undefined, 'Decrease bedrooms')}
                                                            className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black"
                                                        >-</button>
                                                        <span className="text-6xl font-black tracking-tighter">{formData.bedrooms}</span>
                                                        <button
                                                            onClick={() => updateFormData({ bedrooms: formData.bedrooms + 1 })}
                                                            aria-label={t('property.create.details.bedrooms', undefined, 'Increase bedrooms')}
                                                            className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black"
                                                        >+</button>
                                                    </div>
                                                </div>
                                                <div className="space-y-6">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('property.create.details.bathrooms', undefined, 'Bathrooms')}
                                                    </label>
                                                    <div className="flex items-center gap-8">
                                                        <button
                                                            onClick={() => updateFormData({ bathrooms: Math.max(0, formData.bathrooms - 1) })}
                                                            aria-label={t('property.create.details.bathrooms', undefined, 'Decrease bathrooms')}
                                                            className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black"
                                                        >-</button>
                                                        <span className="text-6xl font-black tracking-tighter">{formData.bathrooms}</span>
                                                        <button
                                                            onClick={() => updateFormData({ bathrooms: formData.bathrooms + 1 })}
                                                            aria-label={t('property.create.details.bathrooms', undefined, 'Increase bathrooms')}
                                                            className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black"
                                                        >+</button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-12">
                                                <div className="space-y-6">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('properties.new.steps.details.surface', undefined, 'Surface (m²)')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={isNaN(formData.size_sqm) ? '' : formData.size_sqm}
                                                        onChange={(e) => updateFormData({ size_sqm: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                                                        aria-label={t('property.create.details.size', undefined, 'Living Area')}
                                                        className="w-full bg-transparent text-6xl font-black tracking-tighter border-none focus:ring-0"
                                                    />
                                                    {formData.size_sqm > 0 && formData.size_sqm < 9 * formData.accommodation_capacity && (
                                                        <p className="text-amber-500 text-xs font-bold" role="alert">
                                                            ⚠️ {t('properties.new.steps.pricing.decencyWarning', undefined, 'Decency warning: Surface area is below 9m² per occupant.')}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="space-y-6">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('property.create.details.floor', undefined, 'Floor Number')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={formData.floor_number ?? ''}
                                                        onChange={(e) => updateFormData({ floor_number: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                                                        aria-label={t('property.create.details.floor', undefined, 'Floor Number')}
                                                        className="w-full bg-transparent text-6xl font-black tracking-tighter border-none focus:ring-0"
                                                    />
                                                </div>
                                            </div>

                                            {/* Furnished toggle */}
                                            <button
                                                onClick={() => updateFormData({ furnished: !formData.furnished })}
                                                aria-label={t('property.create.details.furnished', undefined, 'Furnished Property')}
                                                className={`w-full p-8 rounded-[3rem] border-2 text-left transition-all ${formData.furnished ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'}`}
                                            >
                                                <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${formData.furnished ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                    {t('property.create.details.furnished', undefined, 'Furnished')}
                                                </div>
                                                <div className="text-xl font-black">
                                                    {formData.furnished ? t('property.yes', undefined, 'Yes') : t('property.no', undefined, 'No')}
                                                </div>
                                            </button>

                                            {/* DPE Rating */}
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.details.dpeLabel', undefined, 'Energy Rating (DPE)')}
                                                </label>
                                                <p className="text-xs text-zinc-400 font-medium">
                                                    {t('property.create.details.energyRatingDesc', undefined, 'French law requires displaying energy efficiency for all listings.')}
                                                </p>
                                                <div className="flex flex-wrap gap-4">
                                                    {ENERGY_RATINGS.map(r => (
                                                        <button
                                                            key={`dpe-${r}`}
                                                            onClick={() => updateFormData({ dpe_rating: r })}
                                                            aria-label={`DPE ${r}${r === 'G' ? ' (banned)' : ''}`}
                                                            className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${formData.dpe_rating === r ? 'bg-zinc-900 text-white shadow-2xl scale-110' : r === 'G' ? 'bg-red-50 text-red-300 line-through' : 'bg-zinc-100 text-zinc-400'}`}
                                                        >
                                                            {r}
                                                        </button>
                                                    ))}
                                                </div>
                                                {formData.dpe_rating === 'G' && (
                                                    <p className="text-red-500 text-xs font-bold" role="alert">
                                                        ⚠️ {t('property.create.errors.dpeGBan', undefined, 'Properties with DPE G rating are banned from rental since January 2023.')}
                                                    </p>
                                                )}
                                            </div>

                                            {/* GES Rating */}
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.details.gesLabel', undefined, 'GHG Emission (GES)')}
                                                </label>
                                                <div className="flex flex-wrap gap-4">
                                                    {ENERGY_RATINGS.map(r => (
                                                        <button
                                                            key={`ges-${r}`}
                                                            onClick={() => updateFormData({ ges_rating: r })}
                                                            aria-label={`GES ${r}`}
                                                            className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${formData.ges_rating === r ? 'bg-zinc-900 text-white shadow-2xl scale-110' : 'bg-zinc-100 text-zinc-400'}`}
                                                        >
                                                            {r}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Surface Type */}
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('property.create.details.surfaceType', undefined, 'Surface Measurement Type')}
                                                    </label>
                                                    <div className="flex gap-4">
                                                        {['standard', 'loi_carrez'].map(st => (
                                                            <button
                                                                key={st}
                                                                onClick={() => updateFormData({ surface_type: st })}
                                                                aria-label={t(`property.surface.${st}`, undefined, st)}
                                                                className={`flex-1 p-4 rounded-2xl border-2 text-sm font-black transition-all ${formData.surface_type === st ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-100 text-zinc-600'}`}
                                                            >
                                                                {t(`property.surface.${st}`, undefined, st)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('property.create.details.constructionYear', undefined, 'Year of Construction')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={formData.construction_year ?? ''}
                                                        onChange={(e) => updateFormData({ construction_year: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                                                        placeholder="1990"
                                                        aria-label={t('property.create.details.constructionYear', undefined, 'Year of Construction')}
                                                        className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-xl"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 4: Room Layout & Capacity */}
                                    {currentStep === 4 && (
                                        <div className="space-y-12">
                                            <div className="space-y-6">
                                                <h2 className="text-2xl font-black uppercase tracking-tighter">
                                                    {t('property.create.layout.title', undefined, 'Room Layout & Capacity')}
                                                </h2>
                                            </div>

                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('property.create.layout.capacity', undefined, 'Total Occupancy')}
                                                    </label>
                                                    <div className="flex items-center gap-6">
                                                        <button
                                                            onClick={() => updateFormData({ accommodation_capacity: Math.max(1, formData.accommodation_capacity - 1) })}
                                                            aria-label={t('property.create.layout.capacity', undefined, 'Decrease capacity')}
                                                            className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black"
                                                        >-</button>
                                                        <span className="text-5xl font-black tracking-tighter">{formData.accommodation_capacity}</span>
                                                        <button
                                                            onClick={() => updateFormData({ accommodation_capacity: formData.accommodation_capacity + 1 })}
                                                            aria-label={t('property.create.layout.capacity', undefined, 'Increase capacity')}
                                                            className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black"
                                                        >+</button>
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('property.create.layout.pieces', undefined, 'Total Rooms (Pièces)')}
                                                    </label>
                                                    <div className="flex items-center gap-6">
                                                        <button
                                                            onClick={() => updateFormData({ rooms_count: Math.max(1, formData.rooms_count - 1) })}
                                                            aria-label={t('property.create.layout.pieces', undefined, 'Decrease rooms')}
                                                            className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black"
                                                        >-</button>
                                                        <span className="text-5xl font-black tracking-tighter">{formData.rooms_count}</span>
                                                        <button
                                                            onClick={() => updateFormData({ rooms_count: formData.rooms_count + 1 })}
                                                            aria-label={t('property.create.layout.pieces', undefined, 'Increase rooms')}
                                                            className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black"
                                                        >+</button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Living Room & Kitchen Type */}
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('property.create.layout.livingRoom', undefined, 'Living Room')}
                                                    </label>
                                                    <div className="flex flex-col gap-3">
                                                        {(['Private', 'Common', 'None'] as const).map(opt => (
                                                            <button
                                                                key={opt}
                                                                onClick={() => updateFormData({ living_room_type: opt })}
                                                                aria-label={`${t('property.create.layout.livingRoom', undefined, 'Living Room')} - ${opt}`}
                                                                className={`p-4 rounded-2xl border-2 text-sm font-black transition-all ${formData.living_room_type === opt ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-100 text-zinc-600'}`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('property.create.layout.kitchen', undefined, 'Kitchen Type')}
                                                    </label>
                                                    <div className="flex flex-col gap-3">
                                                        {(['Private', 'Municipality', 'None'] as const).map(opt => (
                                                            <button
                                                                key={opt}
                                                                onClick={() => updateFormData({ kitchen_type: opt })}
                                                                aria-label={`${t('property.create.layout.kitchen', undefined, 'Kitchen Type')} - ${opt}`}
                                                                className={`p-4 rounded-2xl border-2 text-sm font-black transition-all ${formData.kitchen_type === opt ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-100 text-zinc-600'}`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Per-room details */}
                                            {formData.room_details.length > 0 && (
                                                <div className="space-y-8">
                                                    <p className="text-xs text-zinc-400 font-medium italic">
                                                        {t('property.create.layout.decencyNotice', undefined, 'Roomivo enforces French decency standards (min 9m² per occupant).')}
                                                    </p>
                                                    {formData.room_details.map((room, idx) => (
                                                        <div key={idx} className="glass-card !p-8 rounded-[2.5rem] border-zinc-100 space-y-6">
                                                            <h4 className="text-lg font-black uppercase tracking-tighter">
                                                                {t('property.create.layout.bedroomTitle', { number: String(idx + 1) }, `Bedroom ${idx + 1}`)}
                                                            </h4>
                                                            <div className="grid grid-cols-3 gap-6">
                                                                <div className="space-y-2">
                                                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                                                        {t('property.create.layout.surface', undefined, 'Surface (m²)')}
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        value={room.surface}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.room_details];
                                                                            updated[idx] = { ...updated[idx], surface: parseInt(e.target.value) || 0 };
                                                                            updateFormData({ room_details: updated });
                                                                        }}
                                                                        aria-label={`${t('property.create.layout.surface', undefined, 'Surface')} - ${t('property.create.layout.bedroomTitle', { number: String(idx + 1) }, `Bedroom ${idx + 1}`)}`}
                                                                        className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-lg"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                                                        {t('property.create.layout.roomCapacity', undefined, 'Occupancy')}
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        value={room.capacity}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.room_details];
                                                                            updated[idx] = { ...updated[idx], capacity: parseInt(e.target.value) || 1 };
                                                                            updateFormData({ room_details: updated });
                                                                        }}
                                                                        aria-label={`${t('property.create.layout.roomCapacity', undefined, 'Occupancy')} - ${t('property.create.layout.bedroomTitle', { number: String(idx + 1) }, `Bedroom ${idx + 1}`)}`}
                                                                        className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-lg"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                                                        {t('property.create.layout.bedding', undefined, 'Bed Type')}
                                                                    </label>
                                                                    <select
                                                                        value={room.bedding}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.room_details];
                                                                            updated[idx] = { ...updated[idx], bedding: e.target.value };
                                                                            updateFormData({ room_details: updated });
                                                                        }}
                                                                        aria-label={`${t('property.create.layout.bedding', undefined, 'Bed Type')} - ${t('property.create.layout.bedroomTitle', { number: String(idx + 1) }, `Bedroom ${idx + 1}`)}`}
                                                                        className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-sm"
                                                                    >
                                                                        {BEDDING_TYPES.map(b => (
                                                                            <option key={b} value={b}>{b}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                                                    {t('property.create.layout.roomDescLabel', undefined, 'Notes (Optional)')}
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={room.description}
                                                                    onChange={(e) => {
                                                                        const updated = [...formData.room_details];
                                                                        updated[idx] = { ...updated[idx], description: e.target.value };
                                                                        updateFormData({ room_details: updated });
                                                                    }}
                                                                    placeholder={t('property.create.layout.roomDescPlaceholder', undefined, 'ex: View on the garden, built-in closet...')}
                                                                    aria-label={`${t('property.create.layout.roomDescLabel', undefined, 'Notes')} - ${t('property.create.layout.bedroomTitle', { number: String(idx + 1) }, `Bedroom ${idx + 1}`)}`}
                                                                    className="w-full bg-zinc-50 p-4 rounded-xl border-none font-medium text-sm"
                                                                />
                                                            </div>
                                                            {/* Room amenities */}
                                                            <div className="space-y-2">
                                                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                                                    {t('property.create.layout.amenities', undefined, 'Room Amenities')}
                                                                </label>
                                                                <div className="flex flex-wrap gap-2 mb-2">
                                                                    {(room.custom_amenities || []).map((a: string, ai: number) => (
                                                                        <span key={ai} className="px-3 py-1 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                                            {a}
                                                                            <button
                                                                                onClick={() => {
                                                                                    const updated = [...formData.room_details];
                                                                                    updated[idx] = { ...updated[idx], custom_amenities: updated[idx].custom_amenities.filter((_: string, i: number) => i !== ai) };
                                                                                    updateFormData({ room_details: updated });
                                                                                }}
                                                                                aria-label={`${t('property.create.features.customAmenities', undefined, 'Remove')} ${a}`}
                                                                                className="hover:text-zinc-300"
                                                                            >×</button>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={roomAmenityInputs[idx] || ''}
                                                                        onChange={(e) => setRoomAmenityInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                                                                        placeholder={t('property.create.layout.amenityPlaceholder', undefined, 'Add amenity...')}
                                                                        aria-label={`${t('property.create.layout.amenities', undefined, 'Room Amenities')} - ${t('property.create.layout.bedroomTitle', { number: String(idx + 1) }, `Bedroom ${idx + 1}`)}`}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' && roomAmenityInputs[idx]?.trim()) {
                                                                                const updated = [...formData.room_details];
                                                                                updated[idx] = { ...updated[idx], custom_amenities: [...(updated[idx].custom_amenities || []), roomAmenityInputs[idx].trim()] };
                                                                                updateFormData({ room_details: updated });
                                                                                setRoomAmenityInputs(prev => ({ ...prev, [idx]: '' }));
                                                                            }
                                                                        }}
                                                                        className="flex-1 bg-zinc-50 p-3 rounded-xl border-none text-sm font-medium"
                                                                    />
                                                                    <button
                                                                        onClick={() => {
                                                                            if (roomAmenityInputs[idx]?.trim()) {
                                                                                const updated = [...formData.room_details];
                                                                                updated[idx] = { ...updated[idx], custom_amenities: [...(updated[idx].custom_amenities || []), roomAmenityInputs[idx].trim()] };
                                                                                updateFormData({ room_details: updated });
                                                                                setRoomAmenityInputs(prev => ({ ...prev, [idx]: '' }));
                                                                            }
                                                                        }}
                                                                        aria-label={t('property.create.features.addAmenity', undefined, 'Add Amenity')}
                                                                        className="w-12 h-12 rounded-xl bg-zinc-900 text-white flex items-center justify-center"
                                                                    >
                                                                        <Plus className="w-5 h-5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {formData.size_sqm > 0 && formData.size_sqm < 9 * formData.accommodation_capacity ? (
                                                <p className="text-amber-500 text-xs font-bold mt-2" role="alert">
                                                    ⚠️ {t('properties.new.steps.pricing.decencyWarning', undefined, 'Decency warning: Surface area is below 9m² per occupant.')}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-zinc-400 font-medium italic mt-2">
                                                    {t('property.create.layout.decencyNotice', undefined, 'Roomivo enforces French decency standards (min 9m² per occupant).')}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Step 5: Pricing */}
                                    {currentStep === 5 && (
                                        <div className="space-y-12">
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.pricing.monthlyRent', undefined, 'Monthly Base Rent')}
                                                </label>
                                                <div className="flex items-baseline gap-4">
                                                    <span className="text-4xl font-black text-zinc-300">€</span>
                                                    <input
                                                        type="number"
                                                        value={isNaN(formData.monthly_rent) ? '' : formData.monthly_rent}
                                                        onChange={(e) => updateFormData({ monthly_rent: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                                                        aria-label={t('property.create.pricing.monthlyRent', undefined, 'Monthly Base Rent')}
                                                        className="bg-transparent text-8xl font-black tracking-tighter border-none focus:ring-0 w-full"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('property.create.pricing.charges', undefined, 'Monthly Charges')}
                                                    </label>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xl font-black text-zinc-300">€</span>
                                                        <input
                                                            type="number"
                                                            value={formData.charges ?? ''}
                                                            onChange={(e) => updateFormData({ charges: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                                                            placeholder={t('property.create.pricing.chargesPlaceholder', undefined, 'ex: 100')}
                                                            aria-label={t('property.create.pricing.charges', undefined, 'Monthly Charges')}
                                                            className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-xl"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-zinc-400">{t('property.create.pricing.chargesDesc', undefined, 'Maintenance, water, etc.')}</p>
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                        {t('property.create.pricing.deposit', undefined, 'Security Deposit')}
                                                    </label>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xl font-black text-zinc-300">€</span>
                                                        <input
                                                            type="number"
                                                            value={formData.deposit ?? ''}
                                                            onChange={(e) => updateFormData({ deposit: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                                                            aria-label={t('property.create.pricing.deposit', undefined, 'Security Deposit')}
                                                            className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-xl"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-zinc-400">{t('property.create.pricing.depositLimit', undefined, 'Max 1 month rent (Unfurnished) or 2 months (Furnished)')}</p>
                                                    {formData.deposit !== undefined && formData.monthly_rent > 0 && formData.deposit > formData.monthly_rent * (formData.furnished ? 2 : 1) && (
                                                        <p className="text-amber-500 text-[10px] font-bold mt-1" role="alert">
                                                            ⚠️ {t(formData.furnished ? 'properties.new.steps.pricing.depositWarningFurnished' : 'properties.new.steps.pricing.depositWarningUnfurnished', undefined, `Deposit exceeds the legal limit of ${formData.furnished ? '2 months' : '1 month'} rent.`)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Toggle buttons */}
                                            <div className="grid grid-cols-2 gap-8">
                                                <button
                                                    onClick={() => updateFormData({ charges_included: !formData.charges_included })}
                                                    aria-label={t('properties.new.steps.pricing.allInclusive', undefined, 'All-Inclusive')}
                                                    className={`p-8 rounded-[3rem] border-2 text-left transition-all ${formData.charges_included ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'}`}
                                                >
                                                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${formData.charges_included ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                        {t('properties.new.steps.pricing.chargesLabel', undefined, 'Charges')}
                                                    </div>
                                                    <div className="text-xl font-black">{t('properties.new.steps.pricing.allInclusive', undefined, 'All-Inclusive')}</div>
                                                </button>
                                                <button
                                                    onClick={() => updateFormData({ caf_eligible: !formData.caf_eligible })}
                                                    aria-label={t('properties.new.steps.pricing.cafEligible', undefined, 'CAF Eligible')}
                                                    className={`p-8 rounded-[3rem] border-2 text-left transition-all ${formData.caf_eligible ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'}`}
                                                >
                                                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${formData.caf_eligible ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                        {t('properties.new.steps.pricing.complianceLabel', undefined, 'Compliance')}
                                                    </div>
                                                    <div className="text-xl font-black">{t('properties.new.steps.pricing.cafEligible', undefined, 'CAF Eligible')}</div>
                                                </button>
                                            </div>

                                            {/* Available from */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.pricing.availableFrom', undefined, 'Available From')}
                                                </label>
                                                <input
                                                    type="date"
                                                    value={formData.available_from ?? ''}
                                                    onChange={(e) => updateFormData({ available_from: e.target.value || undefined })}
                                                    aria-label={t('property.create.pricing.availableFrom', undefined, 'Available From')}
                                                    className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-lg"
                                                />
                                            </div>

                                            {/* Guarantor */}
                                            <div className="space-y-6">
                                                <button
                                                    onClick={() => updateFormData({ guarantor_required: !formData.guarantor_required })}
                                                    aria-label={t('property.create.pricing.guarantor.title', undefined, 'Guarantor Information')}
                                                    className={`w-full p-8 rounded-[3rem] border-2 text-left transition-all ${formData.guarantor_required ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'}`}
                                                >
                                                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${formData.guarantor_required ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                        {t('property.create.pricing.guarantor.title', undefined, 'Guarantor Information')}
                                                    </div>
                                                    <div className="text-xl font-black">
                                                        {formData.guarantor_required ? t('property.guarantor.required', undefined, 'Required') : t('property.guarantor.notRequired', undefined, 'Not Required')}
                                                    </div>
                                                </button>

                                                {formData.guarantor_required && (
                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                            {t('property.create.pricing.guarantor.typesLabel', undefined, 'Accepted Guarantors')}
                                                        </label>
                                                        <div className="flex flex-wrap gap-3">
                                                            {GUARANTOR_TYPES.map(gt => (
                                                                <button
                                                                    key={gt}
                                                                    onClick={() => {
                                                                        const current = formData.accepted_guarantor_types;
                                                                        const updated = current.includes(gt) ? current.filter(g => g !== gt) : [...current, gt];
                                                                        updateFormData({ accepted_guarantor_types: updated });
                                                                    }}
                                                                    aria-label={t(`property.guarantor.${gt}`, undefined, gt)}
                                                                    className={`px-6 py-3 rounded-2xl border-2 text-sm font-black transition-all ${formData.accepted_guarantor_types.includes(gt) ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-100 text-zinc-600'}`}
                                                                >
                                                                    {t(`property.guarantor.${gt}`, undefined, gt)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <p className="text-xs text-zinc-400 italic">
                                                            {t('property.create.pricing.guarantor.elanNotice', undefined, 'ELAN Law Compliant')}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Rent Control */}
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('properties.new.steps.pricing.rentControlTitle', undefined, 'Rent Control (Loi ELAN)')}
                                                </label>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const nextValue = !showRentControl;
                                                        setShowRentControl(nextValue);
                                                        if (!nextValue) {
                                                            updateFormData({
                                                                loyer_reference: undefined,
                                                                loyer_reference_majore: undefined,
                                                                complement_de_loyer: undefined,
                                                                complement_de_loyer_justification: ''
                                                            });
                                                        }
                                                    }}
                                                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                                                        showRentControl ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100 hover:border-zinc-300'
                                                    }`}
                                                    aria-pressed={showRentControl}
                                                >
                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                                                        {t('properties.new.steps.pricing.rentControlToggle', undefined, 'Apply Rent Control')}
                                                    </div>
                                                    <div className={`text-xs ${showRentControl ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                                        {t('properties.new.steps.pricing.rentControlToggleDesc', undefined, 'Certain cities like Paris or Lille are subject to rent caps.')}
                                                    </div>
                                                </button>

                                                {showRentControl && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="space-y-6 pl-4 border-l-2 border-zinc-200"
                                                    >
                                                        <div className="grid grid-cols-2 gap-8">
                                                            <div className="space-y-4">
                                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                                    {t('properties.new.steps.pricing.loyerReferenceLabel', undefined, 'Reference Rent (€/m²)')}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={formData.loyer_reference ?? ''}
                                                                    onChange={(e) => updateFormData({ loyer_reference: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                                                                    placeholder="e.g. 25.50"
                                                                    className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                                                    aria-label={t('properties.new.steps.pricing.loyerReferenceLabel', undefined, 'Reference Rent')}
                                                                />
                                                            </div>
                                                            <div className="space-y-4">
                                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                                    {t('properties.new.steps.pricing.loyerReferenceMajoreLabel', undefined, 'Max Reference Rent (€/m²)')}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={formData.loyer_reference_majore ?? ''}
                                                                    onChange={(e) => updateFormData({ loyer_reference_majore: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                                                                    placeholder="e.g. 30.60"
                                                                    className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                                                    aria-label={t('properties.new.steps.pricing.loyerReferenceMajoreLabel', undefined, 'Max Reference Rent')}
                                                                />
                                                            </div>
                                                        </div>

                                                        {formData.monthly_rent > 0 && formData.size_sqm > 0 && formData.loyer_reference_majore !== undefined && (formData.monthly_rent / formData.size_sqm) > formData.loyer_reference_majore && (
                                                            <div className="space-y-6">
                                                                <div className="p-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-bold space-y-2" role="alert">
                                                                    <p>
                                                                        ⚠️ {t('properties.new.steps.pricing.rentControlWarning', {
                                                                            rentPerSqm: (formData.monthly_rent / formData.size_sqm).toFixed(2),
                                                                            maxRentPerSqm: formData.loyer_reference_majore.toFixed(2)
                                                                        }, `Rent per sqm (€${(formData.monthly_rent / formData.size_sqm).toFixed(2)}) exceeds the legal limit of €${formData.loyer_reference_majore.toFixed(2)}/m².`)}
                                                                    </p>
                                                                </div>

                                                                <div className="grid grid-cols-1 gap-6">
                                                                    <div className="space-y-4">
                                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                                            {t('properties.new.steps.pricing.complementLoyerLabel', undefined, 'Rent Supplement')}
                                                                        </label>
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className="text-xl font-black text-zinc-300">€</span>
                                                                            <input
                                                                                type="number"
                                                                                value={formData.complement_de_loyer ?? ''}
                                                                                onChange={(e) => updateFormData({ complement_de_loyer: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })}
                                                                                placeholder="e.g. 150"
                                                                                className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                                                                aria-label={t('properties.new.steps.pricing.complementLoyerLabel', undefined, 'Rent Supplement')}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-4">
                                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                                            {t('properties.new.steps.pricing.complementLoyerJustificationLabel', undefined, 'Justification for Rent Supplement')}
                                                                        </label>
                                                                        <textarea
                                                                            value={formData.complement_de_loyer_justification ?? ''}
                                                                            onChange={(e) => updateFormData({ complement_de_loyer_justification: e.target.value })}
                                                                            placeholder={t('properties.new.steps.pricing.complementLoyerJustificationPlaceholder', undefined, 'Explain features justifying this supplement (e.g., private terrace, view)...')}
                                                                            className="w-full h-32 bg-zinc-50 p-4 rounded-xl border-none font-medium text-sm text-zinc-600 resize-none"
                                                                            aria-label={t('properties.new.steps.pricing.complementLoyerJustificationLabel', undefined, 'Justification for Rent Supplement')}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </div>

                                            {/* Natural Risks (ERP) */}
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('properties.new.steps.pricing.naturalRisksTitle', undefined, 'Natural Risks (ERP)')}
                                                </label>
                                                <button 
                                                    type="button"
                                                    onClick={() => updateFormData({ natural_risks_compliant: !formData.natural_risks_compliant })}
                                                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                                                        formData.natural_risks_compliant ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100 hover:border-zinc-300'
                                                    }`}
                                                    aria-pressed={formData.natural_risks_compliant}
                                                >
                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                                                        {t('properties.new.steps.pricing.naturalRisksLabel', undefined, 'I certify providing the ERP report')}
                                                    </div>
                                                    <div className={`text-xs ${formData.natural_risks_compliant ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                                        {t('properties.new.steps.pricing.naturalRisksDesc', undefined, 'Providing State of Risks and Pollution report is mandatory in France.')}
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 6: Amenities */}
                                    {currentStep === 6 && (
                                        <div className="space-y-12">
                                            <div className="space-y-6">
                                                <h2 className="text-2xl font-black uppercase tracking-tighter">
                                                    {t('property.create.features.title', undefined, 'Amenities & Surroundings')}
                                                </h2>
                                            </div>

                                            {/* Standard amenities */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.features.amenities', undefined, 'General Amenities')}
                                                </label>
                                                <div className="flex flex-wrap gap-3">
                                                    {STANDARD_AMENITIES.map(amenity => (
                                                        <button
                                                            key={amenity}
                                                            onClick={() => {
                                                                const current = formData.amenities;
                                                                const updated = current.includes(amenity) ? current.filter(a => a !== amenity) : [...current, amenity];
                                                                updateFormData({ amenities: updated });
                                                            }}
                                                            aria-label={t(`property.amenity_labels.${amenity}`, undefined, amenity)}
                                                            className={`px-6 py-3 rounded-2xl border-2 text-sm font-black transition-all ${formData.amenities.includes(amenity) ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100 text-zinc-600 hover:border-zinc-300'}`}
                                                        >
                                                            {t(`property.amenity_labels.${amenity}`, undefined, amenity)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Custom amenities */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.features.customAmenities', undefined, 'Custom Amenities')}
                                                </label>
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {formData.custom_amenities.map((a, i) => (
                                                        <span key={i} className="px-4 py-2 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                            {a}
                                                            <button
                                                                onClick={() => updateFormData({ custom_amenities: formData.custom_amenities.filter((_, idx) => idx !== i) })}
                                                                aria-label={`${t('property.create.features.customAmenities', undefined, 'Remove')} ${a}`}
                                                                className="hover:text-zinc-300"
                                                            >×</button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="text"
                                                        value={customAmenityInput}
                                                        onChange={(e) => setCustomAmenityInput(e.target.value)}
                                                        placeholder={t('property.create.layout.amenityPlaceholder', undefined, 'Add amenity...')}
                                                        aria-label={t('property.create.features.customAmenities', undefined, 'Custom Amenities')}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && customAmenityInput.trim()) {
                                                                updateFormData({ custom_amenities: [...formData.custom_amenities, customAmenityInput.trim()] });
                                                                setCustomAmenityInput('');
                                                            }
                                                        }}
                                                        className="flex-1 bg-zinc-50 p-4 rounded-2xl border-none font-medium"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (customAmenityInput.trim()) {
                                                                updateFormData({ custom_amenities: [...formData.custom_amenities, customAmenityInput.trim()] });
                                                                setCustomAmenityInput('');
                                                            }
                                                        }}
                                                        aria-label={t('property.create.features.addAmenity', undefined, 'Add Amenity')}
                                                        className="w-14 h-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center"
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Public Transport */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.features.transport', undefined, 'Nearby Transport')}
                                                </label>
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {formData.public_transport.map((t_item, i) => (
                                                        <span key={i} className="px-4 py-2 bg-zinc-100 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                            {t_item}
                                                            <button
                                                                onClick={() => updateFormData({ public_transport: formData.public_transport.filter((_, idx) => idx !== i) })}
                                                                aria-label={`${t('property.create.features.transport', undefined, 'Remove')} ${t_item}`}
                                                                className="text-zinc-400 hover:text-zinc-900"
                                                            >×</button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="text"
                                                        value={transportInput}
                                                        onChange={(e) => setTransportInput(e.target.value)}
                                                        placeholder="Metro Ligne 4, Bus 42..."
                                                        aria-label={t('property.create.features.transport', undefined, 'Nearby Transport')}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && transportInput.trim()) {
                                                                updateFormData({ public_transport: [...formData.public_transport, transportInput.trim()] });
                                                                setTransportInput('');
                                                            }
                                                        }}
                                                        className="flex-1 bg-zinc-50 p-4 rounded-2xl border-none font-medium"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (transportInput.trim()) {
                                                                updateFormData({ public_transport: [...formData.public_transport, transportInput.trim()] });
                                                                setTransportInput('');
                                                            }
                                                        }}
                                                        aria-label={t('property.create.features.transport', undefined, 'Add Transport')}
                                                        className="w-14 h-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center"
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Nearby Landmarks */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.features.landmarks', undefined, 'Surroundings & Landmarks')}
                                                </label>
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {formData.nearby_landmarks.map((l, i) => (
                                                        <span key={i} className="px-4 py-2 bg-zinc-100 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                            {l}
                                                            <button
                                                                onClick={() => updateFormData({ nearby_landmarks: formData.nearby_landmarks.filter((_, idx) => idx !== i) })}
                                                                aria-label={`${t('property.create.features.landmarks', undefined, 'Remove')} ${l}`}
                                                                className="text-zinc-400 hover:text-zinc-900"
                                                            >×</button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="text"
                                                        value={landmarkInput}
                                                        onChange={(e) => setLandmarkInput(e.target.value)}
                                                        placeholder="Parc, École, Supermarché..."
                                                        aria-label={t('property.create.features.landmarks', undefined, 'Surroundings & Landmarks')}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && landmarkInput.trim()) {
                                                                updateFormData({ nearby_landmarks: [...formData.nearby_landmarks, landmarkInput.trim()] });
                                                                setLandmarkInput('');
                                                            }
                                                        }}
                                                        className="flex-1 bg-zinc-50 p-4 rounded-2xl border-none font-medium"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (landmarkInput.trim()) {
                                                                updateFormData({ nearby_landmarks: [...formData.nearby_landmarks, landmarkInput.trim()] });
                                                                setLandmarkInput('');
                                                            }
                                                        }}
                                                        aria-label={t('property.create.features.landmarks', undefined, 'Add Landmark')}
                                                        className="w-14 h-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center"
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Utilities included */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.utilitiesTitle', undefined, 'Utilities & Services')}
                                                </label>
                                                <div className="flex flex-wrap gap-3">
                                                    {UTILITIES.map(util => (
                                                        <button
                                                            key={util}
                                                            onClick={() => {
                                                                const current = formData.utilities_included;
                                                                const updated = current.includes(util) ? current.filter(u => u !== util) : [...current, util];
                                                                updateFormData({ utilities_included: updated });
                                                            }}
                                                            aria-label={t(`property.utilities.${util}`, undefined, util)}
                                                            className={`px-6 py-3 rounded-2xl border-2 text-sm font-black transition-all ${formData.utilities_included.includes(util) ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100 text-zinc-600 hover:border-zinc-300'}`}
                                                        >
                                                            {t(`property.utilities.${util}`, undefined, util)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Accepted tenant types */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('properties.edit.acceptedTenants', undefined, 'Accepted Tenant Types')}
                                                </label>
                                                <div className="flex flex-wrap gap-3">
                                                    {TENANT_TYPES.map(tt => (
                                                        <button
                                                            key={tt}
                                                            onClick={() => {
                                                                const current = formData.accepted_tenant_types;
                                                                const updated = current.includes(tt) ? current.filter(t_item => t_item !== tt) : [...current, tt];
                                                                updateFormData({ accepted_tenant_types: updated });
                                                            }}
                                                            aria-label={t(`settings.preferences.options.${tt}`, undefined, tt)}
                                                            className={`px-6 py-3 rounded-2xl border-2 text-sm font-black transition-all capitalize ${formData.accepted_tenant_types.includes(tt) ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100 text-zinc-600 hover:border-zinc-300'}`}
                                                        >
                                                            {t(`settings.preferences.options.${tt}`, undefined, tt)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Media Section (read-only info) */}
                                            <div className="glass-card !p-8 rounded-[3rem] border-zinc-100 space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-zinc-900/5 rounded-2xl flex items-center justify-center border border-zinc-900/10">
                                                        <Image className="w-6 h-6 text-zinc-900" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-black uppercase tracking-tighter">
                                                            {t('properties.edit.mediaSection.title', undefined, 'Property Media')}
                                                        </h4>
                                                        <p className="text-sm text-zinc-400">
                                                            {mediaCount > 0
                                                                ? t('properties.edit.mediaSection.count', { count: String(mediaCount) }, `${mediaCount} files uploaded`)
                                                                : t('properties.edit.mediaSection.noMedia', undefined, 'No media uploaded yet')
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleManageMedia}
                                                    aria-label={t('properties.edit.mediaSection.manageMedia', undefined, 'Manage Media')}
                                                    className="w-full py-4 border-2 border-zinc-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:border-zinc-900 transition-all"
                                                >
                                                    {t('properties.edit.mediaSection.manageMedia', undefined, 'Manage Media')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 7: Narrative */}
                                    {currentStep === 7 && (
                                         <div className="space-y-10 animate-fade-in">
                                             <div className="space-y-6">
                                                 <div className="flex justify-between items-center">
                                                     <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                         {t('properties.new.steps.narrative.label')}
                                                     </label>
                                                     
                                                     <button
                                                         type="button"
                                                         onClick={handleAiSuggest}
                                                         disabled={generatingAi}
                                                         className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-50"
                                                     >
                                                         <Zap className={`w-3.5 h-3.5 ${generatingAi ? 'animate-spin' : ''}`} />
                                                         {generatingAi ? 'Generating...' : t('properties.new.steps.narrative.aiSuggest')}
                                                     </button>
                                                 </div>

                                                 <div className="flex gap-4 border-b border-zinc-100 pb-4">
                                                     <button
                                                         type="button"
                                                         onClick={() => setDescLanguage('en')}
                                                         className={`pb-2 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                                                             descLanguage === 'en'
                                                                 ? 'border-zinc-900 text-zinc-900 font-bold'
                                                                 : 'border-transparent text-zinc-400 hover:text-zinc-600'
                                                         }`}
                                                     >
                                                         {t('properties.new.steps.narrative.englishTab')}
                                                     </button>
                                                     <button
                                                         type="button"
                                                         onClick={() => setDescLanguage('fr')}
                                                         className={`pb-2 px-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                                                             descLanguage === 'fr'
                                                                 ? 'border-zinc-900 text-zinc-900 font-bold'
                                                                 : 'border-transparent text-zinc-400 hover:text-zinc-600'
                                                         }`}
                                                     >
                                                         {t('properties.new.steps.narrative.frenchTab')}
                                                     </button>
                                                 </div>

                                                 <div className="relative">
                                                     {descLanguage === 'en' ? (
                                                         <textarea
                                                             value={descriptionEn}
                                                             onChange={(e) => setDescriptionEn(e.target.value)}
                                                             placeholder={t('properties.new.steps.narrative.descriptionEnPlaceholder')}
                                                             className="w-full h-64 bg-zinc-50 p-6 rounded-3xl border-none font-medium text-sm text-zinc-600 focus:ring-0 resize-none"
                                                         />
                                                     ) : (
                                                         <textarea
                                                             value={descriptionFr}
                                                             onChange={(e) => setDescriptionFr(e.target.value)}
                                                             placeholder={t('properties.new.steps.narrative.descriptionFrPlaceholder')}
                                                             className="w-full h-64 bg-zinc-50 p-6 rounded-3xl border-none font-medium text-sm text-zinc-600 focus:ring-0 resize-none"
                                                         />
                                                     )}
                                                 </div>
                                             </div>
                                         </div>
                                    )}

                                    {/* Step 8: Review & Submit */}
                                    {currentStep === 8 && (
                                        <div className="space-y-10">
                                            <div className="glass-card !p-12 rounded-[4rem] border-zinc-100 space-y-8">
                                                <h3 className="text-3xl font-black uppercase tracking-tighter italic">
                                                    {t('properties.new.steps.review.title', undefined, 'Review Protocol')}
                                                </h3>
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {t('properties.new.steps.review.asset', undefined, 'Asset')}
                                                        </span>
                                                        <span className="text-sm font-black uppercase">{formData.title}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {t('property.create.basic.propertyType', undefined, 'Type')}
                                                        </span>
                                                        <span className="text-sm font-black uppercase">
                                                            {t(`properties.new.types.${formData.property_type}`, undefined, formData.property_type)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {t('properties.new.steps.review.location', undefined, 'Location')}
                                                        </span>
                                                        <span className="text-sm font-black uppercase">{formData.city}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {t('properties.new.steps.details.surface', undefined, 'Surface')}
                                                        </span>
                                                        <span className="text-sm font-black uppercase">{formData.size_sqm}m²</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {t('properties.new.steps.details.bedrooms', undefined, 'Bedrooms')}
                                                        </span>
                                                        <span className="text-sm font-black uppercase">{formData.bedrooms}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {t('property.create.details.dpeLabel', undefined, 'DPE')}
                                                        </span>
                                                        <span className="text-sm font-black uppercase">{formData.dpe_rating || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {t('property.create.details.gesLabel', undefined, 'GES')}
                                                        </span>
                                                        <span className="text-sm font-black uppercase">{formData.ges_rating || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {t('properties.new.steps.review.pricing', undefined, 'Pricing')}
                                                        </span>
                                                        <span className="text-sm font-black uppercase">€{formData.monthly_rent}/{t('properties.new.steps.review.perMonth', undefined, 'mo')}</span>
                                                    </div>
                                                    {formData.deposit && (
                                                        <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                                {t('property.create.pricing.deposit', undefined, 'Deposit')}
                                                            </span>
                                                            <span className="text-sm font-black uppercase">€{formData.deposit}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {t('property.create.details.furnished', undefined, 'Furnished')}
                                                        </span>
                                                        <span className="text-sm font-black uppercase">
                                                            {formData.furnished ? t('property.yes', undefined, 'Yes') : t('property.no', undefined, 'No')}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-4">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                            {t('property.create.features.amenities', undefined, 'Amenities')}
                                                        </span>
                                                        <span className="text-sm font-black uppercase">
                                                            {formData.amenities.length + formData.custom_amenities.length}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Declaration Acknowledgment */}
                                            <label
                                                htmlFor="declaration-checkbox"
                                                className={`flex items-start gap-4 p-6 rounded-3xl border-2 cursor-pointer transition-all mb-8 ${
                                                    declared
                                                        ? 'border-zinc-900 bg-zinc-50'
                                                        : 'border-zinc-200 bg-white hover:border-zinc-400'
                                                }`}
                                            >
                                                <div className="relative mt-0.5 flex-shrink-0">
                                                    <input
                                                        id="declaration-checkbox"
                                                        type="checkbox"
                                                        checked={declared}
                                                        onChange={(e) => setDeclared(e.target.checked)}
                                                        className="sr-only"
                                                    />
                                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                        declared ? 'bg-zinc-900 border-zinc-900' : 'border-zinc-300 bg-white'
                                                    }`}>
                                                        {declared && (
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-xs font-semibold text-zinc-600 leading-relaxed">
                                                    {t('properties.new.steps.review.declaration', undefined, 'I declare that all the information provided is true and accurate to my knowledge.')}
                                                </span>
                                            </label>

                                            {(() => {
                                                const isDepositLimitExceeded = formData.deposit !== undefined && formData.monthly_rent > 0 && 
                                                    formData.deposit > formData.monthly_rent * (formData.furnished ? 2 : 1);
                                                const isDpeGBanned = formData.dpe_rating === 'G';
                                                const isSizeTooSmall = formData.size_sqm < 9;
                                                const hasHardComplianceErrors = isDpeGBanned || isSizeTooSmall || isDepositLimitExceeded;

                                                return (
                                                    <>
                                                        {hasHardComplianceErrors && (
                                                            <div className="p-6 bg-red-50/80 backdrop-blur-md border border-red-200/50 rounded-3xl text-left space-y-3 mb-4 animate-fade-in" role="alert">
                                                                <div className="flex items-center gap-2 text-red-800 font-black text-xs uppercase tracking-wider">
                                                                    <Shield className="w-4 h-4 text-red-600 animate-pulse" />
                                                                    <span>{t('common.requiredByLaw', undefined, 'Required by Law')}</span>
                                                                </div>
                                                                <ul className="list-disc pl-5 space-y-2 text-xs font-bold text-red-600">
                                                                    {isDpeGBanned && (
                                                                        <li>
                                                                            {t('property.create.errors.dpeGBan', undefined, 'Properties with DPE G rating are banned from rental since January 2023.')}
                                                                        </li>
                                                                    )}
                                                                    {isSizeTooSmall && (
                                                                        <li>
                                                                            {t('properties.new.steps.pricing.decencyWarning', undefined, 'Decency warning: Surface area is below 9m² per occupant.')} (Min 9m²)
                                                                        </li>
                                                                    )}
                                                                    {isDepositLimitExceeded && (
                                                                        <li>
                                                                            {t(formData.furnished ? 'properties.new.steps.pricing.depositWarningFurnished' : 'properties.new.steps.pricing.depositWarningUnfurnished', undefined, `Deposit exceeds the legal limit of ${formData.furnished ? '2 months' : '1 month'} rent.`)}
                                                                        </li>
                                                                    )}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={handleSubmit}
                                                            disabled={loading || hasHardComplianceErrors || !declared}
                                                            aria-label={t('properties.edit.saveButton', undefined, 'Save Changes')}
                                                            className="w-full py-8 bg-zinc-900 text-white text-sm font-black uppercase tracking-[0.5em] rounded-[2.5rem] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {loading ? t('properties.edit.saving', undefined, 'Saving changes...') : t('properties.edit.saveButton', undefined, 'Save Changes')}
                                                        </button>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Nav Controls */}
                            {currentStep < 8 && (
                                <div className="mt-20 flex gap-6">
                                    {currentStep > 1 && (
                                        <button
                                            onClick={prevStep}
                                            aria-label={t('properties.new.navigation.back', undefined, 'Back')}
                                            className="px-12 py-6 bg-zinc-100 text-zinc-500 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] hover:bg-zinc-200 transition-all"
                                        >
                                            {t('properties.new.navigation.back', undefined, 'Back')}
                                        </button>
                                    )}
                                    <button
                                        onClick={nextStep}
                                        aria-label={t('properties.new.navigation.next', undefined, 'Next Protocol')}
                                        className="flex-1 py-6 bg-zinc-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        {t('properties.new.navigation.next', undefined, 'Next Protocol')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Media Modal */}
                <AnimatePresence>
                    {showMediaModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/80 backdrop-blur-xl"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white rounded-[3rem] shadow-2xl p-8 max-w-lg w-full relative border border-zinc-100"
                            >
                                <button
                                    onClick={() => setShowMediaModal(false)}
                                    className="absolute top-8 right-8 p-3 bg-zinc-100 rounded-full hover:bg-zinc-200 transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5 text-zinc-600" />
                                </button>
                                
                                <div className="text-center space-y-8 pt-4">
                                    <div className="w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-zinc-900/20">
                                        <Camera className="w-10 h-10 text-white" />
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-3xl font-black tracking-tighter uppercase">{t('properties.edit.mediaSection.addMedia', undefined, 'Add Media')}</h3>
                                        <p className="text-sm text-zinc-500 font-medium px-4">{t('properties.new.steps.success.description', undefined, 'Scan the QR code with your mobile device to upload photos and videos.')}</p>
                                    </div>
                                    
                                    <div className="glass-card !p-8 rounded-[3rem] inline-block shadow-lg mx-auto">
                                        <QRCodeDisplay 
                                            verificationCode={mediaSession?.verification_code || ''} 
                                            captureUrl={`${window.location.origin}/capture/${mediaSession?.verification_code}`} 
                                            expiresAt={mediaSession?.expires_at || new Date().toISOString()}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </PremiumLayout>
        </ProtectedRoute>
    );
}
