'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useToast } from '@/lib/ToastContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import { apiClient } from '@/lib/api';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { Camera, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight, Info, Shield, MapPin, Euro, Layout, Zap } from 'lucide-react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
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
    monthly_rent: number;
    deposit?: number;
    charges?: number;
    charges_included: boolean;
    charges_description?: string;
    available_from?: string;
    guarantor_required: boolean;
    accepted_guarantor_types: string[];
    amenities: string[];
    custom_amenities: string[];
    public_transport: string[];
    nearby_landmarks: string[];
};

const PROPERTY_TYPES = ['apartment', 'house', 'studio', 'room'];
const STANDARD_AMENITIES = [
    'Elevator', 'Balcony', 'Parking', 'Garden', 'Terrace',
    'Cellar', 'Pool', 'Gym', 'Security'
];

export default function EditPropertyPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const toast = useToast();
    const { t } = useLanguage();
    const propertyId = params?.id as string;

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [mediaSession, setMediaSession] = useState<any>(null);
    const [generatingSession, setGeneratingSession] = useState(false);
    const [mediaVerified, setMediaVerified] = useState(false);
    const [verifyingMedia, setVerifyingMedia] = useState(false);
    const [mediaCount, setMediaCount] = useState(0);

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
        monthly_rent: 800,
        charges_included: false,
        guarantor_required: false,
        accepted_guarantor_types: [],
        amenities: [],
        custom_amenities: [],
        public_transport: [],
        nearby_landmarks: [],
    });

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const response = await apiClient.client.get(`/properties/${propertyId}`);
                const property = response.data;
                const standardAmenities = property.amenities?.standard || [];
                const customAmenities = property.custom_amenities?.items || [];

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
                    monthly_rent: property.monthly_rent || 800,
                    deposit: property.deposit,
                    charges: property.charges,
                    charges_included: property.charges_included ?? false,
                    charges_description: property.charges_description,
                    available_from: property.available_from,
                    guarantor_required: property.guarantor_required ?? false,
                    accepted_guarantor_types: property.accepted_guarantor_types || [],
                    amenities: standardAmenities,
                    custom_amenities: customAmenities,
                    public_transport: property.public_transport?.items || [],
                    nearby_landmarks: property.nearby_landmarks?.items || [],
                });
            } catch (error) {
                console.error('Failed to fetch property:', error);
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

    const handleGenerateSession = async () => {
        setGeneratingSession(true);
        try {
            const response = await apiClient.client.post(`/properties/${propertyId}/media-session`);
            setMediaSession(response.data);
            setMediaVerified(false);
        } catch (error) {
            console.error('Failed to generate media session:', error);
        } finally {
            setGeneratingSession(false);
        }
    };

    const handleVerifyMedia = async () => {
        setVerifyingMedia(true);
        try {
            const response = await apiClient.client.get(`/properties/${propertyId}`);
            const photos = response.data.photos || [];
            setMediaCount(photos.length);
            if (photos.length > 0) {
                setMediaVerified(true);
                toast.success(`Success! Found ${photos.length} images.`);
            } else {
                toast.info('No media found yet.');
            }
        } catch (error) {
            console.error('Failed to verify media:', error);
        } finally {
            setVerifyingMedia(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await apiClient.client.put(`/properties/${propertyId}`, formData);
            toast.success('Protocol updated successfully');
            router.push(`/properties/${propertyId}`);
        } catch (error: any) {
            console.error('Update error:', error);
            toast.error('Failed to update registry');
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <ProtectedRoute>
                <PremiumLayout withNavbar={true}>
                     <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-zinc-900" />
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
                                Edit Protocol
                            </h1>
                            <p className="text-zinc-500 font-medium tracking-tight">Updating Asset: {formData.title}</p>
                        </div>
                        <button 
                            onClick={() => router.push(`/properties/${propertyId}`)}
                            className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center hover:scale-110 transition-transform"
                        >
                            ←
                        </button>
                    </div>

                    {/* Progress */}
                    <div className="mb-20">
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                             <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${(currentStep / 7) * 100}%` }}
                                 className="h-full bg-zinc-900 shadow-[0_0_20px_rgba(0,0,0,0.1)]"
                             />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                        <div className="lg:col-span-7">
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
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Identity</label>
                                                <input
                                                    type="text"
                                                    value={formData.title}
                                                    onChange={(e) => updateFormData({ title: e.target.value })}
                                                    className="w-full bg-transparent text-4xl font-black tracking-tighter text-zinc-900 border-none focus:ring-0"
                                                />
                                            </div>
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Narrative</label>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={(e) => updateFormData({ description: e.target.value })}
                                                    className="w-full h-48 bg-transparent text-xl font-medium text-zinc-500 border-none focus:ring-0 resize-none"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 3 && (
                                        <div className="space-y-12">
                                            <div className="grid grid-cols-2 gap-12">
                                                <div className="space-y-6">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Bedrooms</label>
                                                    <div className="flex items-center gap-8">
                                                        <button onClick={() => updateFormData({ bedrooms: Math.max(0, formData.bedrooms - 1) })} className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black">-</button>
                                                        <span className="text-6xl font-black tracking-tighter">{formData.bedrooms}</span>
                                                        <button onClick={() => updateFormData({ bedrooms: formData.bedrooms + 1 })} className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black">+</button>
                                                    </div>
                                                </div>
                                                <div className="space-y-6">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Surface (m²)</label>
                                                    <input
                                                        type="number"
                                                        value={formData.size_sqm}
                                                        onChange={(e) => updateFormData({ size_sqm: parseInt(e.target.value) })}
                                                        className="w-full bg-transparent text-6xl font-black tracking-tighter border-none focus:ring-0"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 4 && (
                                        <div className="space-y-12">
                                            <div className="space-y-6">
                                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Monthly Rent</label>
                                                <div className="flex items-baseline gap-4">
                                                    <span className="text-4xl font-black text-zinc-300">€</span>
                                                    <input
                                                        type="number"
                                                        value={formData.monthly_rent}
                                                        onChange={(e) => updateFormData({ monthly_rent: parseInt(e.target.value) })}
                                                        className="bg-transparent text-8xl font-black tracking-tighter border-none focus:ring-0 w-full"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 7 && (
                                        <div className="space-y-10">
                                            <div className="glass-card !p-12 rounded-[4rem] border-zinc-100 space-y-8">
                                                <h3 className="text-3xl font-black uppercase tracking-tighter italic">Update Registry</h3>
                                                <p className="text-zinc-500 font-medium">Commit the changes to the global asset registry.</p>
                                            </div>
                                            <button
                                                onClick={handleSubmit}
                                                disabled={loading}
                                                className="w-full py-8 bg-zinc-900 text-white text-sm font-black uppercase tracking-[0.5em] rounded-[2.5rem] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                                            >
                                                {loading ? 'Committing...' : 'Save Protocol Changes'}
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>

                            {/* Nav Controls */}
                            {currentStep < 7 && (
                                <div className="mt-20 flex gap-6">
                                    <button 
                                        onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                                        className="px-12 py-6 bg-zinc-100 text-zinc-500 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] hover:bg-zinc-200 transition-all"
                                    >
                                        Back
                                    </button>
                                    <button 
                                        onClick={() => setCurrentStep(prev => Math.min(7, prev + 1))}
                                        className="flex-1 py-6 bg-zinc-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        Next Protocol
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Visual Sidebar */}
                        <div className="lg:col-span-5">
                            <div className="sticky top-32 glass-card !p-12 rounded-[4rem] border-zinc-100 bg-zinc-50/50">
                                <div className="mb-12">
                                     <div className="w-16 h-16 bg-zinc-900/5 rounded-2xl flex items-center justify-center mb-6 border border-zinc-900/10">
                                         <RefreshCw className="w-8 h-8 text-zinc-900" />
                                     </div>
                                    <h4 className="text-xl font-black uppercase tracking-tighter mb-4 italic text-zinc-900">Registry Management</h4>
                                    <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                                        Frequent updates to your property details maintain high visibility rankings within the Roomivo algorithmic feed.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
