'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import WizardProgress from '@/components/WizardProgress';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from '@/lib/ToastContext';
import { apiClient } from '@/lib/api';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { Building, MapPin, Euro, Info, Layout, Plus, CheckCircle2, ChevronRight, ChevronLeft, Zap, Shield, Camera } from 'lucide-react';

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
    dpe_value?: number;
    ges_value?: number;
    surface_type: string;
    construction_year?: number;
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
};

const PROPERTY_TYPES = ['apartment', 'house', 'studio', 'room'];
const STANDARD_AMENITIES = [
    'elevator', 'balcony', 'parking', 'garden', 'terrace',
    'cellar', 'pool', 'gym', 'security'
];

export default function NewPropertyPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [propertyId, setPropertyId] = useState<string | null>(null);
    const [mediaSession, setMediaSession] = useState<any>(null);
    const [mediaVerified, setMediaVerified] = useState(false);
    const [mediaCount, setMediaCount] = useState(0);
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);
    const [roomAmenityInputs, setRoomAmenityInputs] = useState<Record<number, string>>({});
    const [showRentControl, setShowRentControl] = useState(false);
    const toast = useToast();
    const [generatingAi, setGeneratingAi] = useState(false);
    const [descriptionEn, setDescriptionEn] = useState('');
    const [descriptionFr, setDescriptionFr] = useState('');
    const [descLanguage, setDescLanguage] = useState<'en' | 'fr'>('en');
    const [declared, setDeclared] = useState(false);

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
        accommodation_capacity: 1,
        rooms_count: 1,
        living_room_type: 'None',
        kitchen_type: 'None',
        room_details: [],
        dpe_rating: '',
        ges_rating: '',
        surface_type: 'standard',
        monthly_rent: 800,
        charges_included: false,
        caf_eligible: false,
        guarantor_required: false,
        accepted_guarantor_types: [],
        amenities: [],
        custom_amenities: [],
        public_transport: [],
        nearby_landmarks: [],
        loyer_reference: undefined,
        loyer_reference_majore: undefined,
        complement_de_loyer: undefined,
        complement_de_loyer_justification: '',
        natural_risks_compliant: false,
    });

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
        } catch (error) {
            console.error('Enrichment error:', error);
        } finally {
            setEnriching(false);
        }
    };

    const handleSubmit = async () => {
        if (!declared) {
            toast.error(t('properties.new.steps.review.declarationRequired'));
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

            // Save description in the active tab language only
            if (descLanguage === 'fr') {
                payload.description = descriptionFr.trim();
            } else {
                payload.description = descriptionEn.trim();
            }

            const response = await apiClient.client.post('/properties', payload);
            const newPropertyId = response.data.id;
            setPropertyId(newPropertyId);

            const sessionRes = await apiClient.client.post(
                `/properties/${newPropertyId}/media-session`
            );
            setMediaSession(sessionRes.data);
            setCurrentStep(9);
        } catch (error: any) {
            console.error('Submit error:', error);
            let errorMsg = error.response?.data?.detail || 'Failed to submit property details';
            if (Array.isArray(errorMsg)) {
                errorMsg = errorMsg.map((err: any) => `${err.loc[err.loc.length - 1]}: ${err.msg}`).join(', ');
            }
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!propertyId) return;
        setPublishing(true);
        try {
            await apiClient.client.post(`/properties/${propertyId}/publish`);
            setPublished(true);
        } catch (error: any) {
            console.error('Publish error:', error);
        } finally {
            setPublishing(false);
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

    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1: return !!formData.title;
            case 2: return !!(formData.address_line1 && formData.city && formData.postal_code);
            case 3: {
                const isValid = formData.bedrooms >= 0 && formData.size_sqm > 0 && !!formData.dpe_rating;
                if (isValid && formData.size_sqm < 9 * formData.accommodation_capacity) {
                    toast.warning(t('properties.new.steps.pricing.decencyWarning'));
                }
                return isValid;
            }
            case 4: {
                const isValid = formData.accommodation_capacity > 0;
                if (isValid && formData.size_sqm < 9 * formData.accommodation_capacity) {
                    toast.warning(t('properties.new.steps.pricing.decencyWarning'));
                }
                return isValid;
            }
            case 5: {
                const isValid = formData.monthly_rent > 0;
                if (isValid && formData.deposit !== undefined) {
                    const maxDepositMonths = formData.furnished ? 2 : 1;
                    const maxDeposit = formData.monthly_rent * maxDepositMonths;
                    if (formData.deposit > maxDeposit) {
                        toast.warning(t(formData.furnished ? 'properties.new.steps.pricing.depositWarningFurnished' : 'properties.new.steps.pricing.depositWarningUnfurnished'));
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
        if (validateStep(currentStep)) setCurrentStep(prev => prev + 1);
    };

    const prevStep = () => setCurrentStep(prev => Math.max(1, prev - 1));

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

                <div className="max-w-5xl mx-auto px-6 lg:px-12 py-20 relative z-10">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-16">
                        <div className="space-y-4">
                            <h1 className="text-5xl font-black tracking-tighter uppercase text-zinc-900 leading-none">
                                {t('properties.new.title')}
                            </h1>
                            <p className="text-zinc-500 font-medium tracking-tight">
                                {t('properties.new.stepStatus', { current: currentStep, status: currentStep === 1 ? t('properties.new.initializing') : '' })}
                            </p>
                        </div>
                        <button 
                            onClick={() => router.push('/properties')}
                            className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center hover:scale-110 transition-transform"
                        >
                            {t('properties.new.exit')}
                        </button>
                    </div>

                    {/* Progress with Labels */}
                    {currentStep < 9 && (
                        <div className="mb-20">
                            <div className="flex justify-between mb-4 px-2">
                                {['identity', 'location', 'specs', 'capacity', 'pricing', 'features', 'narrative', 'review'].map((step, idx) => (
                                    <div key={idx} className={`text-[9px] font-black uppercase tracking-widest transition-colors ${currentStep === idx + 1 ? 'text-zinc-900' : 'text-zinc-300'}`}>
                                        <span className="hidden sm:inline">{t(`properties.new.wizard.${step}`)}</span>
                                        <span className="sm:hidden">{idx + 1}</span>
                                    </div>
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
                    )}

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
                                    {currentStep === 1 && (
                                        <div className="space-y-10">
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.identity.label')}</label>
                                                <input
                                                    type="text"
                                                    value={formData.title}
                                                    onChange={(e) => updateFormData({ title: e.target.value })}
                                                    placeholder={t('properties.new.steps.identity.titlePlaceholder')}
                                                    className="w-full bg-transparent text-3xl sm:text-6xl font-black tracking-tighter text-zinc-900 placeholder:text-zinc-200 border-none focus:ring-0"
                                                />
                                             </div>
                                            <div className="grid grid-cols-2 gap-8">
                                                {PROPERTY_TYPES.map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => updateFormData({ property_type: type })}
                                                        className={`p-8 rounded-[2.5rem] border-2 transition-all text-left group ${formData.property_type === type ? 'bg-zinc-900 border-zinc-900 shadow-2xl' : 'border-zinc-100 hover:border-zinc-300'}`}
                                                    >
                                                        <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${formData.property_type === type ? 'text-zinc-400' : 'text-zinc-500'}`}>{type}</div>
                                                        <div className={`text-xl font-black ${formData.property_type === type ? 'text-white' : 'text-zinc-900'}`}>
                                                            {t(`properties.new.types.${type}`)}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 2 && (
                                        <div className="space-y-10">
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.geolocation.label')}</label>
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
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.geolocation.city')}</label>
                                                    <input
                                                        type="text"
                                                        value={formData.city}
                                                        onChange={(e) => updateFormData({ city: e.target.value })}
                                                        className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-xl"
                                                    />
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.geolocation.zip')}</label>
                                                    <input
                                                        type="text"
                                                        value={formData.postal_code}
                                                        onChange={(e) => updateFormData({ postal_code: e.target.value })}
                                                        className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-xl"
                                                    />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={handleEnrichLocation}
                                                disabled={enriching}
                                                className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                                            >
                                                {enriching ? t('properties.new.steps.geolocation.enriching') : t('properties.new.steps.geolocation.enrichButton')}
                                            </button>
                                        </div>
                                    )}

                                    {currentStep === 3 && (
                                        <div className="space-y-12">
                                            <div className="grid grid-cols-2 gap-12">
                                                <div className="space-y-6">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.details.bedrooms')}</label>
                                                    <div className="flex items-center gap-8">
                                                        <button onClick={() => updateFormData({ bedrooms: Math.max(0, formData.bedrooms - 1) })} className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black" aria-label={t('property.create.details.bedrooms', undefined, 'Decrease bedrooms')}>-</button>
                                                        <span className="text-6xl font-black tracking-tighter">{formData.bedrooms}</span>
                                                        <button onClick={() => updateFormData({ bedrooms: formData.bedrooms + 1 })} className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black" aria-label={t('property.create.details.bedrooms', undefined, 'Increase bedrooms')}>+</button>
                                                    </div>
                                                </div>
                                                <div className="space-y-6">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.details.surface')}</label>
                                                    <input
                                                        type="number"
                                                        value={isNaN(formData.size_sqm) ? '' : formData.size_sqm}
                                                        onChange={(e) => updateFormData({ size_sqm: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                                                        className="w-full bg-transparent text-6xl font-black tracking-tighter border-none focus:ring-0"
                                                        aria-label={t('property.create.details.size', undefined, 'Surface area in square meters')}
                                                    />
                                                    {formData.size_sqm > 0 && formData.size_sqm < 9 * formData.accommodation_capacity && (
                                                        <p className="text-amber-500 text-xs font-bold" role="alert">
                                                            ⚠️ {t('properties.new.steps.pricing.decencyWarning')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-10">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.details.energyProtocol')}</label>
                                                <div className="flex flex-wrap gap-4">
                                                    {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(r => (
                                                        <button
                                                            key={r}
                                                            onClick={() => updateFormData({ dpe_rating: r })}
                                                            className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${formData.dpe_rating === r ? 'bg-zinc-900 text-white shadow-2xl scale-110' : r === 'G' ? 'bg-red-50 text-red-300 line-through' : 'bg-zinc-100 text-zinc-400'}`}
                                                            aria-label={`DPE rating ${r}${r === 'G' ? ' (banned)' : ''}`}
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
                                        </div>
                                    )}

                                    {/* Step 4: Room Layout & Capacity */}
                                    {currentStep === 4 && (
                                        <div className="space-y-10">
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.layout.globalTitle', undefined, 'General Information')}
                                                </label>
                                                <div className="grid grid-cols-2 gap-8">
                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                            {t('property.create.layout.capacity', undefined, 'Total Occupancy')}
                                                        </label>
                                                        <div className="flex items-center gap-6">
                                                            <button onClick={() => updateFormData({ accommodation_capacity: Math.max(1, formData.accommodation_capacity - 1) })} className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-black" aria-label="Decrease capacity">-</button>
                                                            <span className="text-4xl font-black tracking-tighter">{formData.accommodation_capacity}</span>
                                                            <button onClick={() => updateFormData({ accommodation_capacity: formData.accommodation_capacity + 1 })} className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-black" aria-label="Increase capacity">+</button>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                            {t('property.create.layout.pieces', undefined, 'Total Rooms (Pièces)')}
                                                        </label>
                                                        <div className="flex items-center gap-6">
                                                            <button onClick={() => updateFormData({ rooms_count: Math.max(1, formData.rooms_count - 1) })} className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-black" aria-label="Decrease rooms">-</button>
                                                            <span className="text-4xl font-black tracking-tighter">{formData.rooms_count}</span>
                                                            <button onClick={() => updateFormData({ rooms_count: formData.rooms_count + 1 })} className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-black" aria-label="Increase rooms">+</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                        {t('property.create.layout.livingRoom', undefined, 'Living Room')}
                                                    </label>
                                                    <div className="flex gap-3">
                                                        {(['Private', 'Common', 'None'] as const).map(opt => (
                                                            <button
                                                                key={opt}
                                                                onClick={() => updateFormData({ living_room_type: opt })}
                                                                className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                                                                    formData.living_room_type === opt 
                                                                        ? 'bg-zinc-900 text-white shadow-lg' 
                                                                        : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                                                                }`}
                                                                aria-label={`Living room: ${opt}`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                        {t('property.create.layout.kitchen', undefined, 'Kitchen Type')}
                                                    </label>
                                                    <div className="flex gap-3">
                                                        {(['Private', 'Municipality', 'None'] as const).map(opt => (
                                                            <button
                                                                key={opt}
                                                                onClick={() => updateFormData({ kitchen_type: opt })}
                                                                className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                                                                    formData.kitchen_type === opt 
                                                                        ? 'bg-zinc-900 text-white shadow-lg' 
                                                                        : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                                                                }`}
                                                                aria-label={`Kitchen type: ${opt}`}
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Per-bedroom details */}
                                            {formData.room_details.length > 0 && (
                                                <div className="space-y-8">
                                                    {formData.room_details.map((room, idx) => (
                                                        <div key={idx} className="glass-card !p-8 rounded-[2rem] border-zinc-100 space-y-6">
                                                            <h4 className="text-sm font-black uppercase tracking-widest text-zinc-500">
                                                                {t('property.create.layout.bedroomTitle', { number: idx + 1 }, `Bedroom ${idx + 1}`)}
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
                                                                        className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-lg"
                                                                        aria-label={`Bedroom ${idx + 1} surface`}
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
                                                                        className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-lg"
                                                                        min={1}
                                                                        aria-label={`Bedroom ${idx + 1} occupancy`}
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
                                                                        className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-sm"
                                                                        aria-label={`Bedroom ${idx + 1} bed type`}
                                                                    >
                                                                        <option value="Single">Single</option>
                                                                        <option value="Double">Double</option>
                                                                        <option value="Queen">Queen</option>
                                                                        <option value="King">King</option>
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
                                                                    className="w-full bg-zinc-50 p-4 rounded-xl border-none font-medium text-sm text-zinc-500"
                                                                    aria-label={`Bedroom ${idx + 1} description`}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {formData.size_sqm > 0 && formData.size_sqm < 9 * formData.accommodation_capacity ? (
                                                <p className="text-amber-500 text-xs font-bold mt-2" role="alert">
                                                    ⚠️ {t('properties.new.steps.pricing.decencyWarning')}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-zinc-400 font-medium italic mt-2">
                                                    {t('property.create.layout.decencyNotice', undefined, 'Roomivo enforces French decency standards (min 9m² per occupant).')}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {currentStep === 5 && (
                                        <div className="space-y-12">
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.pricing.monthlyRent')}</label>
                                                <div className="flex items-baseline gap-4">
                                                    <span className="text-4xl font-black text-zinc-300">€</span>
                                                    <input
                                                        type="number"
                                                        value={isNaN(formData.monthly_rent) ? '' : formData.monthly_rent}
                                                        onChange={(e) => updateFormData({ monthly_rent: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                                                        className="bg-transparent text-8xl font-black tracking-tighter border-none focus:ring-0 w-full"
                                                        aria-label={t('property.create.pricing.monthlyRent', undefined, 'Monthly rent')}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                        {t('property.create.pricing.charges', undefined, 'Monthly Charges')}
                                                    </label>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xl font-black text-zinc-300">€</span>
                                                        <input
                                                            type="number"
                                                            value={formData.charges || ''}
                                                            onChange={(e) => updateFormData({ charges: parseInt(e.target.value) || 0 })}
                                                            placeholder={t('property.create.pricing.chargesPlaceholder', undefined, 'ex: 100')}
                                                            className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                                            aria-label={t('property.create.pricing.charges', undefined, 'Charges')}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                        {t('property.create.pricing.deposit', undefined, 'Security Deposit')}
                                                    </label>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xl font-black text-zinc-300">€</span>
                                                        <input
                                                            type="number"
                                                            value={formData.deposit || ''}
                                                            onChange={(e) => updateFormData({ deposit: parseInt(e.target.value) || 0 })}
                                                            className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                                            aria-label={t('property.create.pricing.deposit', undefined, 'Security deposit')}
                                                        />
                                                    </div>
                                                    <p className="text-[9px] text-zinc-400 font-medium">
                                                        {t('property.create.pricing.depositLimit', undefined, 'Max 1 month rent (Unfurnished) or 2 months (Furnished)')}
                                                    </p>
                                                    {formData.deposit !== undefined && formData.monthly_rent > 0 && formData.deposit > formData.monthly_rent * (formData.furnished ? 2 : 1) && (
                                                        <p className="text-amber-500 text-[10px] font-bold mt-1" role="alert">
                                                            ⚠️ {t(formData.furnished ? 'properties.new.steps.pricing.depositWarningFurnished' : 'properties.new.steps.pricing.depositWarningUnfurnished')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-8">
                                                <button 
                                                    type="button"
                                                    onClick={() => updateFormData({ charges_included: !formData.charges_included })}
                                                    className={`p-8 rounded-[3rem] border-2 text-left transition-all ${formData.charges_included ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'}`}
                                                    aria-label={t('properties.new.steps.pricing.allInclusive')}
                                                    aria-pressed={formData.charges_included}
                                                >
                                                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${formData.charges_included ? 'text-zinc-400' : 'text-zinc-500'}`}>{t('properties.new.steps.pricing.chargesLabel')}</div>
                                                    <div className="text-xl font-black">{t('properties.new.steps.pricing.allInclusive')}</div>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => updateFormData({ caf_eligible: !formData.caf_eligible })}
                                                    className={`p-8 rounded-[3rem] border-2 text-left transition-all ${formData.caf_eligible ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'}`}
                                                    aria-label={t('properties.new.steps.pricing.cafEligible')}
                                                    aria-pressed={formData.caf_eligible}
                                                >
                                                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${formData.caf_eligible ? 'text-zinc-400' : 'text-zinc-500'}`}>{t('properties.new.steps.pricing.complianceLabel')}</div>
                                                    <div className="text-xl font-black">{t('properties.new.steps.pricing.cafEligible')}</div>
                                                </button>
                                            </div>
                                            {/* Guarantor */}
                                            <div className="space-y-4">
                                                <button
                                                    type="button"
                                                    onClick={() => updateFormData({ guarantor_required: !formData.guarantor_required })}
                                                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                                                        formData.guarantor_required ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100'
                                                    }`}
                                                    aria-pressed={formData.guarantor_required}
                                                >
                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">{t('property.create.pricing.guarantor.title', undefined, 'Guarantor Required')}</div>
                                                    <div className="text-sm font-bold">{t('property.create.pricing.guarantor.elanNotice', undefined, 'ELAN Law Compliant')}</div>
                                                </button>
                                                {formData.guarantor_required && (
                                                    <div className="flex flex-wrap gap-3 pl-4">
                                                        {['physical', 'visale', 'garantme', 'organisation'].map(type => (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                onClick={() => {
                                                                    const types = formData.accepted_guarantor_types.includes(type)
                                                                        ? formData.accepted_guarantor_types.filter(t => t !== type)
                                                                        : [...formData.accepted_guarantor_types, type];
                                                                    updateFormData({ accepted_guarantor_types: types });
                                                                }}
                                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                                                    formData.accepted_guarantor_types.includes(type)
                                                                        ? 'bg-zinc-900 text-white'
                                                                        : 'bg-zinc-100 text-zinc-400'
                                                                }`}
                                                                aria-pressed={formData.accepted_guarantor_types.includes(type)}
                                                            >
                                                                {t(`property.guarantor.${type}`, undefined, type)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Rent Control */}
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('properties.new.steps.pricing.rentControlTitle')}
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
                                                        {t('properties.new.steps.pricing.rentControlToggle')}
                                                    </div>
                                                    <div className={`text-xs ${showRentControl ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                                        {t('properties.new.steps.pricing.rentControlToggleDesc')}
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
                                                                    {t('properties.new.steps.pricing.loyerReferenceLabel')}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={formData.loyer_reference ?? ''}
                                                                    onChange={(e) => updateFormData({ loyer_reference: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                                                                    placeholder="e.g. 25.50"
                                                                    className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                                                    aria-label={t('properties.new.steps.pricing.loyerReferenceLabel')}
                                                                />
                                                            </div>
                                                            <div className="space-y-4">
                                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                                    {t('properties.new.steps.pricing.loyerReferenceMajoreLabel')}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={formData.loyer_reference_majore ?? ''}
                                                                    onChange={(e) => updateFormData({ loyer_reference_majore: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                                                                    placeholder="e.g. 30.60"
                                                                    className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                                                    aria-label={t('properties.new.steps.pricing.loyerReferenceMajoreLabel')}
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
                                                                        })}
                                                                    </p>
                                                                </div>

                                                                <div className="grid grid-cols-1 gap-6">
                                                                    <div className="space-y-4">
                                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                                            {t('properties.new.steps.pricing.complementLoyerLabel')}
                                                                        </label>
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className="text-xl font-black text-zinc-300">€</span>
                                                                            <input
                                                                                type="number"
                                                                                value={formData.complement_de_loyer ?? ''}
                                                                                onChange={(e) => updateFormData({ complement_de_loyer: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })}
                                                                                placeholder="e.g. 150"
                                                                                className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                                                                aria-label={t('properties.new.steps.pricing.complementLoyerLabel')}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-4">
                                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                                                            {t('properties.new.steps.pricing.complementLoyerJustificationLabel')}
                                                                        </label>
                                                                        <textarea
                                                                            value={formData.complement_de_loyer_justification ?? ''}
                                                                            onChange={(e) => updateFormData({ complement_de_loyer_justification: e.target.value })}
                                                                            placeholder={t('properties.new.steps.pricing.complementLoyerJustificationPlaceholder')}
                                                                            className="w-full h-32 bg-zinc-50 p-4 rounded-xl border-none font-medium text-sm text-zinc-600 resize-none"
                                                                            aria-label={t('properties.new.steps.pricing.complementLoyerJustificationLabel')}
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
                                                    {t('properties.new.steps.pricing.naturalRisksTitle')}
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
                                                        {t('properties.new.steps.pricing.naturalRisksLabel')}
                                                    </div>
                                                    <div className={`text-xs ${formData.natural_risks_compliant ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                                        {t('properties.new.steps.pricing.naturalRisksDesc')}
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 6: Amenities & Features */}
                                    {currentStep === 6 && (
                                        <div className="space-y-10">
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.features.amenities', undefined, 'General Amenities')}
                                                </label>
                                                <div className="flex flex-wrap gap-3">
                                                    {STANDARD_AMENITIES.map(amenity => (
                                                        <button
                                                            key={amenity}
                                                            onClick={() => {
                                                                const amenities = formData.amenities.includes(amenity)
                                                                    ? formData.amenities.filter(a => a !== amenity)
                                                                    : [...formData.amenities, amenity];
                                                                updateFormData({ amenities });
                                                            }}
                                                            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                                                                formData.amenities.includes(amenity)
                                                                    ? 'bg-zinc-900 text-white shadow-lg scale-105'
                                                                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                                                            }`}
                                                            aria-pressed={formData.amenities.includes(amenity)}
                                                        >
                                                            {t(`property.amenity_labels.${amenity}`, undefined, amenity)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Custom Amenities */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                    {t('property.create.features.customAmenities', undefined, 'Custom Amenities')}
                                                </label>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="text"
                                                        value={roomAmenityInputs[-1] || ''}
                                                        onChange={(e) => setRoomAmenityInputs(prev => ({ ...prev, [-1]: e.target.value }))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && roomAmenityInputs[-1]?.trim()) {
                                                                updateFormData({ custom_amenities: [...formData.custom_amenities, roomAmenityInputs[-1].trim()] });
                                                                setRoomAmenityInputs(prev => ({ ...prev, [-1]: '' }));
                                                            }
                                                        }}
                                                        placeholder={t('property.create.features.addAmenity', undefined, 'Add Amenity')}
                                                        className="flex-1 bg-zinc-50 p-4 rounded-xl border-none font-medium text-sm"
                                                        aria-label={t('property.create.features.addAmenity', undefined, 'Add custom amenity')}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (roomAmenityInputs[-1]?.trim()) {
                                                                updateFormData({ custom_amenities: [...formData.custom_amenities, roomAmenityInputs[-1].trim()] });
                                                                setRoomAmenityInputs(prev => ({ ...prev, [-1]: '' }));
                                                            }
                                                        }}
                                                        className="px-6 py-3 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase"
                                                        aria-label="Add amenity"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                {formData.custom_amenities.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {formData.custom_amenities.map((amenity, idx) => (
                                                            <span key={idx} className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/5 rounded-xl text-xs font-bold">
                                                                {amenity}
                                                                <button
                                                                    onClick={() => updateFormData({ custom_amenities: formData.custom_amenities.filter((_, i) => i !== idx) })}
                                                                    className="text-zinc-400 hover:text-red-500 transition-colors"
                                                                    aria-label={`Remove ${amenity}`}
                                                                >
                                                                    ×
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Transport & Landmarks */}
                                            {(formData.public_transport.length > 0 || formData.nearby_landmarks.length > 0) && (
                                                <div className="grid grid-cols-2 gap-8">
                                                    {formData.public_transport.length > 0 && (
                                                        <div className="space-y-3">
                                                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                                {t('property.create.features.transport', undefined, 'Nearby Transport')}
                                                            </label>
                                                            <div className="space-y-2">
                                                                {formData.public_transport.map((item, idx) => (
                                                                    <div key={idx} className="flex items-center gap-2 text-sm text-zinc-600">
                                                                        <MapPin className="w-3 h-3 text-zinc-400" />
                                                                        {item}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {formData.nearby_landmarks.length > 0 && (
                                                        <div className="space-y-3">
                                                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                                                {t('property.create.features.landmarks', undefined, 'Surroundings & Landmarks')}
                                                            </label>
                                                            <div className="space-y-2">
                                                                {formData.nearby_landmarks.map((item, idx) => (
                                                                    <div key={idx} className="flex items-center gap-2 text-sm text-zinc-600">
                                                                        <Info className="w-3 h-3 text-zinc-400" />
                                                                        {item}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

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

                                    {currentStep === 8 && (
                                         <div className="space-y-10">
                                             <div className="glass-card !p-12 rounded-[4rem] border-zinc-100 space-y-8">
                                                 <h3 className="text-3xl font-black uppercase tracking-tighter italic">{t('properties.new.steps.review.title')}</h3>
                                                 <div className="space-y-4">
                                                     <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                         <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('properties.new.steps.review.asset')}</span>
                                                         <span className="text-sm font-black uppercase">{formData.title}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                                                         <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('properties.new.steps.review.location')}</span>
                                                         <span className="text-sm font-black uppercase">{formData.city}</span>
                                                     </div>
                                                     <div className="flex justify-between items-center py-4">
                                                         <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('properties.new.steps.review.pricing')}</span>
                                                         <span className="text-sm font-black uppercase">€{formData.monthly_rent}/{t('properties.new.steps.review.perMonth')}</span>
                                                     </div>
                                                 </div>
                                             </div>

                                             {/* Declaration Acknowledgment */}
                                             <label
                                                 htmlFor="declaration-checkbox"
                                                 className={`flex items-start gap-4 p-6 rounded-3xl border-2 cursor-pointer transition-all ${
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
                                                     {t('properties.new.steps.review.declaration')}
                                                 </span>
                                             </label>

                                             <button
                                                 onClick={handleSubmit}
                                                 disabled={loading || !declared}
                                                 className="w-full py-8 bg-zinc-900 text-white text-sm font-black uppercase tracking-[0.5em] rounded-[2.5rem] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                                             >
                                                 {loading ? t('properties.new.steps.review.initializing') : t('properties.new.steps.review.commitButton')}
                                             </button>
                                         </div>
                                    )}

                                    {currentStep === 9 && (
                                        <div className="text-center space-y-12">
                                            <div className="w-32 h-32 bg-zinc-900 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl shadow-zinc-900/20">
                                                <CheckCircle2 className="w-16 h-16 text-white" />
                                            </div>
                                            <div className="space-y-6">
                                                <h2 className="text-5xl font-black tracking-tighter uppercase">{t('properties.new.steps.success.title')}</h2>
                                                <p className="text-xl text-zinc-500 font-medium max-w-md mx-auto">{t('properties.new.steps.success.description')}</p>
                                            </div>
                                            
                                            <div className="glass-card !p-12 rounded-[4rem] inline-block shadow-2xl">
                                                <QRCodeDisplay 
                                                    verificationCode={mediaSession?.verification_code || ''} 
                                                    captureUrl={`${window.location.origin}/capture/${mediaSession?.id}`}
                                                    expiresAt={mediaSession?.expires_at || new Date().toISOString()}
                                                />
                                            </div>

                                            <div className="pt-12 flex flex-col gap-6">
                                                 {(() => {
                                                     const isDepositLimitExceeded = formData.deposit !== undefined && formData.monthly_rent > 0 && 
                                                         formData.deposit > formData.monthly_rent * (formData.furnished ? 2 : 1);
                                                     const isDpeGBanned = formData.dpe_rating === 'G';
                                                     const isSizeTooSmall = formData.size_sqm < 9;
                                                     const hasHardComplianceErrors = isDpeGBanned || isSizeTooSmall || isDepositLimitExceeded;

                                                     return (
                                                         <>
                                                             {hasHardComplianceErrors && (
                                                                 <div className="p-6 bg-red-50/80 backdrop-blur-md border border-red-200/50 rounded-3xl max-w-md mx-auto text-left space-y-3 mb-4 animate-fade-in" role="alert">
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
                                                                                 {t('properties.new.steps.pricing.decencyWarning')} (Min 9m²)
                                                                             </li>
                                                                         )}
                                                                         {isDepositLimitExceeded && (
                                                                             <li>
                                                                                 {t(formData.furnished ? 'properties.new.steps.pricing.depositWarningFurnished' : 'properties.new.steps.pricing.depositWarningUnfurnished')}
                                                                             </li>
                                                                         )}
                                                                     </ul>
                                                                 </div>
                                                             )}
                                                             <button 
                                                                 onClick={handlePublish}
                                                                 disabled={publishing || hasHardComplianceErrors}
                                                                 className="px-16 py-6 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                             >
                                                                 {publishing ? t('properties.new.steps.success.synchronizing') : t('properties.new.steps.success.forcePublish')}
                                                             </button>
                                                         </>
                                                     );
                                                 })()}
                                                 <button 
                                                     onClick={() => router.push('/properties')}
                                                     className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 hover:text-zinc-900 transition-colors"
                                                 >
                                                     {t('properties.new.steps.success.return')}
                                                 </button>
                                             </div>
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
                                            className="px-12 py-6 bg-zinc-100 text-zinc-500 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] hover:bg-zinc-200 transition-all"
                                        >
                                            {t('properties.new.navigation.back')}
                                        </button>
                                    )}
                                    <button 
                                        onClick={nextStep}
                                        className="flex-1 py-6 bg-zinc-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        {t('properties.new.navigation.next')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
