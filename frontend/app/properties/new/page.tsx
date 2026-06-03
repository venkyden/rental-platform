'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from '@/lib/ToastContext';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import { PropertyFormData } from './steps/types';
import Step1Identity from './steps/Step1Identity';
import Step2Location from './steps/Step2Location';
import Step3Details from './steps/Step3Details';
import Step4Layout from './steps/Step4Layout';
import Step5Pricing from './steps/Step5Pricing';
import Step6Amenities from './steps/Step6Amenities';
import Step7Description from './steps/Step7Description';
import Step8Review from './steps/Step8Review';
import Step9Success from './steps/Step9Success';

export default function NewPropertyPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const toast = useToast();
    const reduceMotion = useReducedMotion() ?? false;

    // ── Wizard navigation ──────────────────────────────────────────────
    const [currentStep, setCurrentStep] = useState(1);

    // ── Async operation flags ──────────────────────────────────────────
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [generatingAi, setGeneratingAi] = useState(false);

    // ── Post-submit state ──────────────────────────────────────────────
    const [propertyId, setPropertyId] = useState<string | null>(null);
    const [mediaSession, setMediaSession] = useState<{ verification_code: string; id: string; expires_at: string } | null>(null);

    // ── Step-specific state ────────────────────────────────────────────
    const [roomAmenityInputs, setRoomAmenityInputs] = useState<Record<number, string>>({});
    const [showRentControl, setShowRentControl] = useState(false);
    const [descriptionEn, setDescriptionEn] = useState('');
    const [descriptionFr, setDescriptionFr] = useState('');
    const [descLanguage, setDescLanguage] = useState<'en' | 'fr'>('en');
    const [declared, setDeclared] = useState(false);

    useEffect(() => {
        if (language === 'fr' || language === 'en') setDescLanguage(language);
    }, [language]);

    // ── Form data ──────────────────────────────────────────────────────
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

    const updateFormData = (updates: Partial<PropertyFormData>) =>
        setFormData((prev) => ({ ...prev, ...updates }));

    // ── API helpers ────────────────────────────────────────────────────
    const handleEnrichLocation = async () => {
        setEnriching(true);
        try {
            const res = await apiClient.client.post('/location/enrich', {
                address: formData.address_line1,
                city: formData.city,
                postal_code: formData.postal_code,
                country: formData.country,
            });
            updateFormData({
                latitude: res.data.latitude,
                longitude: res.data.longitude,
                public_transport: res.data.public_transport || [],
                nearby_landmarks: res.data.nearby_landmarks || [],
            });
        } catch (e) {
            console.error('Enrichment error:', e);
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
            const res = await apiClient.client.post('/properties/generate-description', {
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
            if (descLanguage === 'en') setDescriptionEn(res.data.description);
            else setDescriptionFr(res.data.description);
            toast.success(t('properties.new.steps.narrative.aiSuggestSuccess'));
        } catch (e: any) {
            console.error('AI suggest error:', e);
            const fallback =
                descLanguage === 'en'
                    ? `Magnificent ${formData.property_type} located in the heart of ${formData.city || 'the city'}. This ${formData.size_sqm}m² property features ${formData.bedrooms} bedroom(s) and modern amenities. Ideal for those seeking comfort and convenience.`
                    : `Magnifique ${formData.property_type} situé au coeur de ${formData.city || 'la ville'}. Cette propriété de ${formData.size_sqm}m² comprend ${formData.bedrooms} chambre(s) et des équipements modernes. Idéal pour ceux qui recherchent le confort et la commodité.`;
            if (descLanguage === 'en') setDescriptionEn(fallback);
            else setDescriptionFr(fallback);
            toast.error(e.response?.data?.detail || 'Failed to generate AI description. Loaded default template.');
        } finally {
            setGeneratingAi(false);
        }
    };

    const handleSubmit = async () => {
        if (!declared) {
            toast.error(t('properties.new.steps.review.declarationRequired'));
            return;
        }
        setLoading(true);
        try {
            const payload = { ...formData };
            if (payload.dpe_rating === '') payload.dpe_rating = undefined as any;
            if (payload.ges_rating === '') payload.ges_rating = undefined as any;
            if (payload.complement_de_loyer_justification === '') payload.complement_de_loyer_justification = undefined as any;
            payload.description = descLanguage === 'fr' ? descriptionFr.trim() : descriptionEn.trim();

            const res = await apiClient.client.post('/properties', payload);
            const newId = res.data.id;
            setPropertyId(newId);
            const sessionRes = await apiClient.client.post(`/properties/${newId}/media-session`);
            setMediaSession(sessionRes.data);
            setCurrentStep(9);
        } catch (e: any) {
            console.error('Submit error:', e);
            let msg = e.response?.data?.detail || 'Failed to submit property details';
            if (Array.isArray(msg)) msg = msg.map((err: any) => `${err.loc[err.loc.length - 1]}: ${err.msg}`).join(', ');
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!propertyId) return;
        setPublishing(true);
        try {
            await apiClient.client.post(`/properties/${propertyId}/publish`);
        } catch (e) {
            console.error('Publish error:', e);
        } finally {
            setPublishing(false);
        }
    };

    // ── Step validation ────────────────────────────────────────────────
    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1: return !!formData.title;
            case 2: return !!(formData.address_line1 && formData.city && formData.postal_code);
            case 3: {
                const ok = formData.bedrooms >= 0 && formData.size_sqm > 0 && !!formData.dpe_rating;
                if (ok && formData.size_sqm < 9 * formData.accommodation_capacity)
                    toast.warning(t('properties.new.steps.pricing.decencyWarning'));
                return ok;
            }
            case 4: {
                const ok = formData.accommodation_capacity > 0;
                if (ok && formData.size_sqm < 9 * formData.accommodation_capacity)
                    toast.warning(t('properties.new.steps.pricing.decencyWarning'));
                return ok;
            }
            case 5: {
                const ok = formData.monthly_rent > 0;
                if (ok && formData.deposit !== undefined) {
                    const max = formData.monthly_rent * (formData.furnished ? 2 : 1);
                    if (formData.deposit > max)
                        toast.warning(t(formData.furnished
                            ? 'properties.new.steps.pricing.depositWarningFurnished'
                            : 'properties.new.steps.pricing.depositWarningUnfurnished'));
                }
                return ok;
            }
            case 7: return !!(descriptionEn.trim() || descriptionFr.trim());
            default: return true;
        }
    };

    const nextStep = async () => {
        if (currentStep === 2) await handleEnrichLocation();
        if (currentStep === 3 && formData.room_details.length !== formData.bedrooms) {
            updateFormData({
                room_details: Array(formData.bedrooms).fill({}).map((_, i) =>
                    formData.room_details[i] || { surface: 10, capacity: 1, description: '', bedding: 'Double', custom_amenities: [] }
                ),
            });
        }
        if (validateStep(currentStep)) setCurrentStep((s) => s + 1);
    };

    const prevStep = () => setCurrentStep((s) => Math.max(1, s - 1));

    // ── Step labels for the progress bar ──────────────────────────────
    const STEP_KEYS = ['identity', 'location', 'specs', 'capacity', 'pricing', 'features', 'narrative', 'review'] as const;

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none" />

                <div className="max-w-5xl mx-auto px-6 lg:px-12 py-20 relative z-10">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-16">
                        <div className="space-y-4">
                            <h1 className="text-5xl font-black tracking-tighter uppercase text-zinc-900 leading-none">
                                {t('properties.new.title')}
                            </h1>
                            <p className="text-zinc-500 font-medium tracking-tight">
                                {t('properties.new.stepStatus', {
                                    current: currentStep,
                                    status: currentStep === 1 ? t('properties.new.initializing') : '',
                                })}
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/properties')}
                            className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center hover:scale-110 transition-transform"
                        >
                            {t('properties.new.exit')}
                        </button>
                    </div>

                    {/* Progress bar */}
                    {currentStep < 9 && (
                        <div className="mb-20">
                            <div className="flex justify-between mb-4 px-2">
                                {STEP_KEYS.map((key, idx) => (
                                    <div
                                        key={key}
                                        className={`text-[9px] font-black uppercase tracking-widest transition-colors ${
                                            currentStep === idx + 1 ? 'text-zinc-900' : 'text-zinc-300'
                                        }`}
                                    >
                                        <span className="hidden sm:inline">{t(`properties.new.wizard.${key}`)}</span>
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

                    {/* Step content */}
                    <div className="flex justify-center">
                        <div className="w-full max-w-2xl">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={reduceMotion ? false : { opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                                    transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'circOut' }}
                                    className="space-y-12"
                                >
                                    {currentStep === 1 && (
                                        <Step1Identity formData={formData} updateFormData={updateFormData} t={t} />
                                    )}
                                    {currentStep === 2 && (
                                        <Step2Location formData={formData} updateFormData={updateFormData} t={t} enriching={enriching} onEnrich={handleEnrichLocation} />
                                    )}
                                    {currentStep === 3 && (
                                        <Step3Details formData={formData} updateFormData={updateFormData} t={t} />
                                    )}
                                    {currentStep === 4 && (
                                        <Step4Layout formData={formData} updateFormData={updateFormData} t={t} roomAmenityInputs={roomAmenityInputs} setRoomAmenityInputs={setRoomAmenityInputs} />
                                    )}
                                    {currentStep === 5 && (
                                        <Step5Pricing formData={formData} updateFormData={updateFormData} t={t} showRentControl={showRentControl} setShowRentControl={setShowRentControl} />
                                    )}
                                    {currentStep === 6 && (
                                        <Step6Amenities formData={formData} updateFormData={updateFormData} t={t} roomAmenityInputs={roomAmenityInputs} setRoomAmenityInputs={setRoomAmenityInputs} />
                                    )}
                                    {currentStep === 7 && (
                                        <Step7Description
                                            t={t}
                                            descriptionEn={descriptionEn}
                                            setDescriptionEn={setDescriptionEn}
                                            descriptionFr={descriptionFr}
                                            setDescriptionFr={setDescriptionFr}
                                            descLanguage={descLanguage}
                                            setDescLanguage={setDescLanguage}
                                            generatingAi={generatingAi}
                                            onAiSuggest={handleAiSuggest}
                                        />
                                    )}
                                    {currentStep === 8 && (
                                        <Step8Review formData={formData} t={t} declared={declared} setDeclared={setDeclared} loading={loading} onSubmit={handleSubmit} />
                                    )}
                                    {currentStep === 9 && (
                                        <Step9Success formData={formData} t={t} mediaSession={mediaSession} publishing={publishing} onPublish={handlePublish} onReturn={() => router.push('/properties')} />
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Nav buttons */}
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
                                        disabled={enriching}
                                        className="flex-1 py-6 bg-zinc-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                    >
                                        {enriching ? t('common.loading', undefined, 'Loading...') : t('properties.new.navigation.next')}
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
