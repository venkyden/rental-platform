'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import WizardProgress from '@/components/WizardProgress';
import { useLanguage } from '@/lib/LanguageContext';
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
        setLoading(true);
        try {
            const response = await apiClient.client.post('/properties', formData);
            const newPropertyId = response.data.id;
            setPropertyId(newPropertyId);

            const sessionRes = await apiClient.client.post(
                `/properties/${newPropertyId}/media-session`
            );
            setMediaSession(sessionRes.data);
            setCurrentStep(8);
        } catch (error: any) {
            console.error('Submit error:', error);
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

    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1: return !!(formData.title && formData.description);
            case 2: return !!(formData.address_line1 && formData.city && formData.postal_code);
            case 3: return formData.bedrooms >= 0 && formData.size_sqm > 0 && !!formData.dpe_rating;
            case 4: return formData.accommodation_capacity > 0;
            case 5: return formData.monthly_rent > 0;
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
                    {currentStep < 8 && (
                        <div className="mb-20">
                            <div className="flex justify-between mb-4 px-2">
                                {['identity', 'location', 'specs', 'capacity', 'pricing', 'review', 'media'].map((step, idx) => (
                                    <div key={idx} className={`text-[9px] font-black uppercase tracking-widest transition-colors ${currentStep === idx + 1 ? 'text-zinc-900' : 'text-zinc-300'}`}>
                                        <span className="hidden sm:inline">{t(`properties.new.wizard.${step}`)}</span>
                                        <span className="sm:hidden">{idx + 1}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(currentStep / 7) * 100}%` }}
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
                                            <div className="space-y-6 relative group">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.identity.narrativeLabel')}</label>
                                                    <button 
                                                        onClick={() => {
                                                            const suggestion = `Magnificent ${formData.property_type} located in the heart of ${formData.city || 'the city'}. This ${formData.size_sqm}m² property features ${formData.bedrooms} bedroom(s) and modern amenities. Ideal for those seeking comfort and convenience.`;
                                                            updateFormData({ description: suggestion });
                                                        }}
                                                        className="flex items-center gap-2 px-3 py-1 bg-zinc-900/5 text-zinc-900 border border-zinc-900/10 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-zinc-900 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Zap className="w-3 h-3" /> {t('properties.new.steps.identity.aiSuggest', undefined, 'AI Suggest')}
                                                    </button>
                                                </div>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={(e) => updateFormData({ description: e.target.value })}
                                                    placeholder={t('properties.new.steps.identity.descriptionPlaceholder')}
                                                    className="w-full h-48 bg-transparent text-xl font-medium text-zinc-500 placeholder:text-zinc-200 border-none focus:ring-0 resize-none"
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
                                                        <button onClick={() => updateFormData({ bedrooms: Math.max(0, formData.bedrooms - 1) })} className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black">-</button>
                                                        <span className="text-6xl font-black tracking-tighter">{formData.bedrooms}</span>
                                                        <button onClick={() => updateFormData({ bedrooms: formData.bedrooms + 1 })} className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black">+</button>
                                                    </div>
                                                </div>
                                                <div className="space-y-6">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.details.surface')}</label>
                                                    <input
                                                        type="number"
                                                        value={isNaN(formData.size_sqm) ? '' : formData.size_sqm}
                                                        onChange={(e) => updateFormData({ size_sqm: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                                                        className="w-full bg-transparent text-6xl font-black tracking-tighter border-none focus:ring-0"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-10">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('properties.new.steps.details.energyProtocol')}</label>
                                                <div className="flex flex-wrap gap-4">
                                                    {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(r => (
                                                        <button
                                                            key={r}
                                                            onClick={() => updateFormData({ dpe_rating: r })}
                                                            className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${formData.dpe_rating === r ? 'bg-zinc-900 text-white shadow-2xl scale-110' : 'bg-zinc-100 text-zinc-400'}`}
                                                        >
                                                            {r}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
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
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-8">
                                                <button 
                                                    onClick={() => updateFormData({ charges_included: !formData.charges_included })}
                                                    className={`p-8 rounded-[3rem] border-2 text-left transition-all ${formData.charges_included ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'}`}
                                                >
                                                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${formData.charges_included ? 'text-zinc-400' : 'text-zinc-500'}`}>{t('properties.new.steps.pricing.chargesLabel')}</div>
                                                    <div className="text-xl font-black">{t('properties.new.steps.pricing.allInclusive')}</div>
                                                </button>
                                                <button 
                                                    onClick={() => updateFormData({ caf_eligible: !formData.caf_eligible })}
                                                    className={`p-8 rounded-[3rem] border-2 text-left transition-all ${formData.caf_eligible ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'}`}
                                                >
                                                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${formData.caf_eligible ? 'text-zinc-400' : 'text-zinc-500'}`}>{t('properties.new.steps.pricing.complianceLabel')}</div>
                                                    <div className="text-xl font-black">{t('properties.new.steps.pricing.cafEligible')}</div>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 7 && (
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
                                            <button
                                                onClick={handleSubmit}
                                                disabled={loading}
                                                className="w-full py-8 bg-zinc-900 text-white text-sm font-black uppercase tracking-[0.5em] rounded-[2.5rem] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                                            >
                                                {loading ? t('properties.new.steps.review.initializing') : t('properties.new.steps.review.commitButton')}
                                            </button>
                                        </div>
                                    )}

                                    {currentStep === 8 && (
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
                                                <button 
                                                    onClick={handlePublish}
                                                    disabled={publishing}
                                                    className="px-16 py-6 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 transition-all"
                                                >
                                                    {publishing ? t('properties.new.steps.success.synchronizing') : t('properties.new.steps.success.forcePublish')}
                                                </button>
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
                            {currentStep < 7 && (
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
