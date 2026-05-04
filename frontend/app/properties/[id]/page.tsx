'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import { apiClient } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { PropertyDetailSkeleton } from '@/components/SkeletonLoaders';
import { useToast } from '@/lib/ToastContext';
import VisitScheduler from '@/components/VisitScheduler';
import VisitBookingWizard from '@/components/VisitBookingWizard';
import LeaseManager from '@/components/LeaseManager';
import { useLanguage } from '@/lib/LanguageContext';
import { motion } from 'framer-motion';

interface Property {
    id: string;
    landlord_id: string;
    title: string;
    description: string;
    property_type: string;
    address_line1: string;
    address_line2?: string;
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
    charges_included?: boolean;
    charges_description?: string;
    available_from?: string;
    amenities: any;
    custom_amenities: any;
    public_transport: any;
    nearby_landmarks: any;
    photos: any;
    room_details?: any[];
    status: string;
    views_count: number;
    created_at: string;
    updated_at?: string;
    published_at?: string;
    utilities_included?: string[];
    dpe_rating?: string;
    dpe_value?: number;
    ges_rating?: string;
    ges_value?: number;
    guarantor_required?: boolean;
    accepted_guarantor_types?: string[];
    caf_eligible?: boolean;
}

export default function PropertyDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const toast = useToast();
    const { t } = useLanguage();
    const [property, setProperty] = useState<Property | null>(null);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const propertyId = params?.id as string;
    const [isApplying, setIsApplying] = useState(false);
    const [coverLetter, setCoverLetter] = useState('');
    const [submittingApp, setSubmittingApp] = useState(false);
    const [activePhotoIdx, setActivePhotoIdx] = useState(0);

    useEffect(() => {
        if (propertyId) {
            loadProperty();
        }
    }, [propertyId]);

    const loadProperty = async () => {
        try {
            const response = await apiClient.client.get(`/properties/${propertyId}`);
            setProperty(response.data);
        } catch (error: any) {
            console.error('Error loading property:', error);
            if (error.response?.status === 404) {
                toast.error(t('property.error.notFound', undefined, undefined));
                router.push('/properties');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('property.actions.deleteConfirm', undefined, undefined))) return;

        try {
            await apiClient.client.delete(`/properties/${propertyId}`);
            toast.success(t('property.error.deleteSuccess', undefined, 'Property deleted successfully'));
            router.push('/properties');
        } catch (error) {
            toast.error(t('property.error.deleteFail', undefined, undefined));
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            await apiClient.client.post(`/properties/${propertyId}/publish`);
            toast.success(t('property.error.publishSuccess', undefined, undefined));
            loadProperty();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || t('property.error.publishFail', undefined, undefined));
        } finally {
            setPublishing(false);
        }
    };

    const handleApply = async () => {
        setSubmittingApp(true);
        try {
            await apiClient.client.post('/applications', {
                property_id: propertyId,
                cover_letter: coverLetter
            });
            toast.success(t('property.apply.success', undefined, undefined));
            setIsApplying(false);
            setCoverLetter('');
        } catch (error: any) {
            const msg = error.response?.data?.detail || t('property.apply.error', undefined, undefined);
            toast.error(msg);
            if (msg.includes('already applied')) {
                setIsApplying(false);
            }
        } finally {
            setSubmittingApp(false);
        }
    };

    if (loading) {
        return <PropertyDetailSkeleton />;
    }

    if (!property) {
        return null;
    }

    const isOwner = user?.id === property.landlord_id;
    const fullAddress = [
        property.address_line1,
        property.address_line2,
        property.postal_code,
        property.city,
        property.country
    ].filter(Boolean).join(', ');

    // Parse amenities and features
    const amenities = property.amenities?.standard || [];
    const customAmenities = property.custom_amenities?.items || [];
    const publicTransport = property.public_transport?.items || [];
    const nearbyLandmarks = property.nearby_landmarks?.items || [];
    const photos = Array.isArray(property.photos) ? property.photos : property.photos?.urls ? property.photos.urls.map((url: string) => ({ url })) : [];

    const activePhoto = photos[activePhotoIdx];

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 relative z-10">
                    <header className="mb-16 flex items-center justify-between">
                        <button
                            onClick={() => router.push('/properties')}
                            className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-white/40 dark:border-zinc-800/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-transparent dark:from-white/5 opacity-50"></div>
                            <span className="text-2xl font-black relative z-10 group-hover:-translate-x-1 transition-transform">←</span>
                        </button>
                        
                        {isOwner && (
                            <div className="flex gap-4">
                                <button
                                    onClick={() => router.push(`/properties/${propertyId}/edit`)}
                                    className="px-8 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl hover:scale-105 active:scale-95 text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                                >
                                    {t('property.actions.edit', undefined, 'Configure Property')}
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="px-8 py-4 bg-red-500/10 text-red-500 rounded-2xl hover:scale-105 active:scale-95 text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-red-500/20"
                                >
                                    {t('property.actions.delete', undefined, 'Terminate Listing')}
                                </button>
                            </div>
                        )}
                    </header>

                    <main>
                        {/* Status Grid */}
                        <div className="mb-10 flex flex-wrap items-center gap-4">
                            <div className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] backdrop-blur-3xl shadow-2xl border ${property.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                                {property.status === 'active' ? t('property.status.published', undefined, 'Market Active') : t('property.status.draft', undefined, 'Draft Protocol')}
                            </div>
                            {property.caf_eligible && (
                                <div className="px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 shadow-2xl">
                                    {t('property.pricing.cafEligible', undefined, 'CAF Approved')}
                                </div>
                            )}
                            <div className="px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] bg-white/50 dark:bg-zinc-900/50 backdrop-blur-3xl border border-white/20 dark:border-zinc-800/50 text-zinc-400">
                                {property.property_type}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                            {/* Left Column - Deep Tech Details */}
                            <div className="lg:col-span-8 space-y-12">
                                {/* Cinema Gallery */}
                                <div className="glass-card !p-0 rounded-[3.5rem] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_60px_120px_-20px_rgba(0,0,0,0.5)] border-zinc-100 dark:border-zinc-800/50 overflow-hidden group">
                                    {photos && photos.length > 0 && activePhoto ? (
                                        <div className="relative w-full aspect-[16/9] lg:aspect-[21/9]">
                                            <motion.img
                                                key={activePhotoIdx}
                                                initial={{ opacity: 0, scale: 1.1 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ duration: 1 }}
                                                src={resolveMediaUrl(activePhoto.url || activePhoto)}
                                                alt={property.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                                            
                                            {activePhoto.room_label && (
                                                <div className="absolute top-8 left-8 px-6 py-3 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-2xl">
                                                    {activePhoto.room_label}
                                                </div>
                                            )}

                                            <div className="absolute bottom-8 right-8 flex gap-3">
                                                <button
                                                    onClick={() => setActivePhotoIdx(i => i === 0 ? photos.length - 1 : i - 1)}
                                                    className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-3xl border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                                                >
                                                    ←
                                                </button>
                                                <button
                                                    onClick={() => setActivePhotoIdx(i => i === photos.length - 1 ? 0 : i + 1)}
                                                    className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-3xl border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                                                >
                                                    →
                                                </button>
                                            </div>

                                            <div className="absolute bottom-8 left-8 text-white/60 text-[10px] font-black uppercase tracking-[0.4em]">
                                                {activePhotoIdx + 1} // {photos.length}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="aspect-[16/9] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                            <span className="text-3xl font-black text-zinc-300 dark:text-zinc-700 italic tracking-tighter">ROOMIVO VISUALS MISSING</span>
                                        </div>
                                    )}
                                </div>

                                {/* Core Identity */}
                                <div className="space-y-6">
                                    <h1 className="text-6xl sm:text-8xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase leading-[0.85]">
                                        {property.title}
                                    </h1>
                                    <div className="flex items-center gap-6 text-zinc-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-[0.4em]">
                                        <span>{property.city}</span>
                                        <span className="w-1 h-1 rounded-full bg-zinc-200" />
                                        <span>{property.size_sqm}m²</span>
                                        <span className="w-1 h-1 rounded-full bg-zinc-200" />
                                        <span>{property.bedrooms} Bedrooms</span>
                                    </div>
                                    <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-4xl">
                                        {property.description}
                                    </p>
                                </div>

                                {/* Detail Matrix */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                    {[
                                        { label: 'Surface Area', value: `${property.size_sqm}m²`, icon: '📐' },
                                        { label: 'Bedroom Count', value: property.bedrooms, icon: '🛌' },
                                        { label: 'Bathrooms', value: property.bathrooms, icon: '🚿' },
                                        { label: 'Floor Level', value: property.floor_number || 'GF', icon: '🏢' }
                                    ].map((stat, i) => (
                                        <div key={i} className="glass-card !p-8 rounded-[2.5rem] border-zinc-100 dark:border-zinc-800/50">
                                            <div className="text-2xl mb-4">{stat.icon}</div>
                                            <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{stat.label}</div>
                                            <div className="text-xl font-black text-zinc-900 dark:text-white">{stat.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Energy & Compliance */}
                                <div className="glass-card !p-12 rounded-[3rem] border-zinc-100 dark:border-zinc-800/50 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-10">{t('property.energyTitle', undefined, 'Energy Intelligence')}</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                                        <div className="flex items-center gap-8">
                                            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-2xl ${
                                                property.dpe_rating === 'A' ? 'bg-emerald-500 shadow-emerald-500/20' : 
                                                property.dpe_rating === 'B' ? 'bg-lime-500 shadow-lime-500/20' : 
                                                'bg-zinc-900 shadow-zinc-900/20'
                                            }`}>
                                                {property.dpe_rating || 'N/A'}
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Energy Performance (DPE)</div>
                                                <div className="text-sm font-black text-zinc-900 dark:text-white">{property.dpe_value || 0} kWh/m²/year</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <div className="w-24 h-24 rounded-3xl bg-purple-500 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-purple-500/20">
                                                {property.ges_rating || 'N/A'}
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">GHG Emissions (GES)</div>
                                                <div className="text-sm font-black text-zinc-900 dark:text-white">{property.ges_value || 0} kgCO₂/m²/year</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Transaction Center */}
                            <div className="lg:col-span-4 space-y-10">
                                <div className="glass-card !p-12 sticky top-32 shadow-[0_60px_120px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_60px_120px_-20px_rgba(0,0,0,0.5)] border-zinc-100 dark:border-zinc-800/50 rounded-[3.5rem] relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-500 to-indigo-500" />
                                    
                                    <div className="text-center mb-12">
                                        <div className="flex items-baseline justify-center gap-2 mb-2">
                                            <span className="text-7xl font-black text-zinc-900 dark:text-white tracking-tighter">€{property.monthly_rent}</span>
                                            <span className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em]">{t('search.property.mo', undefined, '/ Month')}</span>
                                        </div>
                                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                                            <div className="w-2 h-2 rounded-full bg-teal-500" />
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                                {property.charges_included ? t('property.price.included', undefined, 'All-Inclusive') : t('property.price.excluded', undefined, 'Rent + Charges')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-6 mb-12">
                                        {[
                                            { label: 'Security Deposit', value: `€${property.deposit || 0}` },
                                            { label: 'Monthly Charges', value: `€${property.charges || 0}` },
                                            { label: 'Guarantor Protocol', value: property.guarantor_required ? 'Required' : 'Flexible' },
                                            { label: 'Available From', value: property.available_from ? new Date(property.available_from).toLocaleDateString() : 'Immediate' }
                                        ].map((item, i) => (
                                            <div key={i} className="flex justify-between items-center pb-4 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 last:pb-0">
                                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.label}</span>
                                                <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tighter">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {!isOwner ? (
                                        <div className="space-y-4">
                                            <button 
                                                onClick={() => setIsApplying(true)}
                                                className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all group overflow-hidden relative"
                                            >
                                                <div className="absolute inset-0 bg-teal-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                                <span className="relative z-10">{t('property.actions.apply', undefined, 'Initialize Application')}</span>
                                            </button>
                                            <button className="w-full py-6 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
                                                {t('property.actions.message', undefined, 'Open Channel')}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="p-6 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-700/30 text-center">
                                                <div className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter mb-1">{property.views_count}</div>
                                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Global Views</div>
                                            </div>
                                            <button 
                                                onClick={() => router.push(`/properties/${propertyId}/edit`)}
                                                className="w-full py-5 border-2 border-zinc-200 dark:border-zinc-800 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] hover:border-zinc-900 dark:hover:border-white transition-all"
                                            >
                                                Update Protocol
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Integrated Tools */}
                                <div className="glass-card !p-12 rounded-[3.5rem] border-zinc-100 dark:border-zinc-800/50">
                                    <h3 className="text-xl font-black uppercase tracking-tighter mb-8 italic">Management Suite</h3>
                                    {isOwner ? (
                                        <div className="space-y-10">
                                            <VisitScheduler
                                                propertyId={property.id}
                                                rooms={(property.room_details || []).map((_: any, i: number) => ({
                                                    label: `${t('property.bedroom', undefined, 'Bedroom')} ${i + 1}`,
                                                    index: i,
                                                }))}
                                            />
                                            <div className="pt-10 border-t border-zinc-100 dark:border-zinc-800/50">
                                                <LeaseManager propertyId={property.id} monthlyRent={property.monthly_rent} />
                                            </div>
                                        </div>
                                    ) : (
                                        <VisitBookingWizard
                                            propertyId={property.id}
                                            rooms={(property.room_details || []).map((_: any, i: number) => ({
                                                label: `${t('property.bedroom', undefined, 'Bedroom')} ${i + 1}`,
                                                index: i,
                                            }))}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </main>

                    {/* Application Modal - Ultra High Fidelity */}
                    {isApplying && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                onClick={() => setIsApplying(false)}
                                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-2xl"
                            />
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: 40 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="max-w-2xl w-full glass-card !p-12 sm:!p-16 rounded-[4rem] border-white/20 relative z-10 shadow-2xl overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-500 to-indigo-500" />
                                <h2 className="text-4xl font-black tracking-tighter uppercase mb-6 leading-none">
                                    {t('property.apply.title', undefined, 'Application Protocol')}
                                </h2>
                                <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mb-12">
                                    {t('property.apply.desc', undefined, 'Introduce yourself to the landlord. A personalized cover letter increases your chances by 60%.')}
                                </p>
                                
                                <textarea
                                    value={coverLetter}
                                    onChange={(e) => setCoverLetter(e.target.value)}
                                    placeholder={t('property.apply.placeholder', undefined, 'Describe your profile, lifestyle, and rental duration...')}
                                    className="w-full h-48 px-8 py-6 rounded-[2.5rem] bg-zinc-100 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-teal-500/30 text-lg font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 transition-all resize-none mb-12 shadow-inner"
                                />

                                <div className="flex gap-6">
                                    <button 
                                        onClick={() => setIsApplying(false)}
                                        className="flex-1 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
                                    >
                                        {t('property.apply.cancel', undefined, 'Abort')}
                                    </button>
                                    <button
                                        onClick={handleApply}
                                        disabled={submittingApp}
                                        className="flex-[2] py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {submittingApp ? 'TRANSMITTING...' : t('property.apply.send', undefined, 'Submit Application')}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
