'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import { apiClient } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { useToast } from '@/lib/ToastContext';
import VisitScheduler from '@/components/VisitScheduler';
import VisitBookingWizard from '@/components/VisitBookingWizard';
import LeaseManager from '@/components/LeaseManager';
import { useLanguage } from '@/lib/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import StaticMapView from '@/components/StaticMapView';
import Image from 'next/image';
import {
    MapPin, Share2, Shield, Zap, Wind, Check, LayoutGrid, Info,
    TrendingUp, Heart, Navigation, Building2, Flame, AlertTriangle, Calendar, BadgeCheck
} from 'lucide-react';

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
    landlord_first_name?: string | null;
    landlord_identity_verified?: boolean;
    landlord_bio?: string | null;
    landlord_member_since?: string | null;
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
    loyer_reference?: number;
    loyer_reference_majore?: number;
    complement_de_loyer?: number;
    complement_de_loyer_justification?: string;
    natural_risks_compliant?: boolean;
    is_saved?: boolean;
}

interface PropertyDetailClientProps {
    initialProperty: Property;
}

export default function PropertyDetailClient({ initialProperty }: PropertyDetailClientProps) {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const toast = useToast();
    const { t, language } = useLanguage();
    
    const [property, setProperty] = useState<Property>(initialProperty);
    const [loading, setLoading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const propertyId = (params?.id as string) || initialProperty.id;
    const [isApplying, setIsApplying] = useState(false);
    const [coverLetter, setCoverLetter] = useState('');
    const [submittingApp, setSubmittingApp] = useState(false);
    const [activePhotoIdx, setActivePhotoIdx] = useState(0);

    // Contextual login state
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    const executeWithAuth = useCallback((action: () => void) => {
        if (user) {
            action();
        } else {
            setPendingAction(() => action);
            setShowAuthModal(true);
        }
    }, [user]);

    const loadProperty = async () => {
        try {
            const response = await apiClient.client.get(`/properties/${propertyId}`);
            setProperty(response.data);
        } catch (error: any) {
            console.error('Error loading property on client:', error);
            if (error.response?.status === 404) {
                toast.error(t('property.error.notFound', undefined, 'Property not found'));
                router.push('/properties');
            }
        }
    };

    // Re-load property when user logs in so we can fetch dynamic fields like is_saved
    useEffect(() => {
        if (user) {
            loadProperty();
        }
    }, [user]);

    const handleDelete = async () => {
        if (!confirm(t('property.actions.deleteConfirm', undefined, 'Are you sure you want to delete this property?'))) return;

        try {
            await apiClient.client.delete(`/properties/${propertyId}`);
            toast.success(t('property.error.deleteSuccess', undefined, 'Property deleted successfully'));
            router.push('/properties');
        } catch (error) {
            toast.error(t('property.error.deleteFail', undefined, 'Failed to delete property'));
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            await apiClient.client.post(`/properties/${propertyId}/publish`);
            toast.success(t('property.error.publishSuccess', undefined, 'Property published successfully'));
            loadProperty();
        } catch (error: any) {
            const detail = error.response?.data?.detail;
            if (detail === 'landlord_bio_required') {
                toast.error(t('bio.landlordRequired', undefined, 'Add a short bio to your profile before publishing — tenants need to know who they are dealing with.'));
                router.push('/profile');
            } else {
                toast.error(detail || t('property.error.publishFail', undefined, 'Failed to publish property'));
            }
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
            toast.success(t('property.apply.success', undefined, 'Application submitted successfully'));
            setIsApplying(false);
            setCoverLetter('');
        } catch (error: any) {
            const detail = error.response?.data?.detail;
            if (detail === 'tenant_bio_required') {
                toast.error(t('bio.tenantRequired', undefined, 'Add a short bio to your profile before applying — landlords need to know who they are dealing with.'));
                router.push('/profile');
            } else {
                toast.error(detail || t('property.apply.error', undefined, 'Failed to submit application'));
            }
        } finally {
            setSubmittingApp(false);
        }
    };

    const handleShare = () => {
        const url = window.location.href;
        if (navigator.share) {
            navigator.share({
                title: property?.title,
                text: property?.description,
                url: url,
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(url);
            toast.success(t('property.share.copied', undefined, 'Link copied to clipboard'));
        }
    };

    const handleToggleWishlist = async () => {
        executeWithAuth(async () => {
            try {
                if (property.is_saved) {
                    await apiClient.unsaveProperty(property.id);
                    setProperty(prev => ({ ...prev, is_saved: false }));
                    toast.success(t('property.wishlist.removed', undefined, 'Removed from wishlist'));
                } else {
                    await apiClient.saveProperty(property.id);
                    setProperty(prev => ({ ...prev, is_saved: true }));
                    toast.success(t('property.wishlist.added', undefined, 'Saved to wishlist'));
                }
            } catch (error) {
                toast.error(t('property.wishlist.error', undefined, 'Failed to update wishlist'));
            }
        });
    };

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
        <PremiumLayout withNavbar={true}>
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 relative z-10">
                <header className="mb-16 flex items-center justify-between">
                    <motion.button
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        onClick={() => router.push('/search')}
                        className="w-16 h-16 rounded-2xl bg-white shadow-2xl border border-white/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group overflow-hidden relative"
                        aria-label="Back to search listings"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-transparent opacity-50"></div>
                        <span className="text-2xl font-black relative z-10 group-hover:-translate-x-1 transition-transform">←</span>
                    </motion.button>
                    
                    <motion.div 
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex gap-4"
                    >
                        <button
                            onClick={handleToggleWishlist}
                            className="w-16 h-16 rounded-2xl bg-white shadow-2xl border border-white/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                            aria-label={property.is_saved ? "Remove from wishlist" : "Save to wishlist"}
                        >
                            <Heart className={`w-6 h-6 transition-colors ${property.is_saved ? 'fill-rose-500 text-rose-500' : 'text-zinc-400 hover:text-rose-500'}`} />
                        </button>
                        
                        <button
                            onClick={handleShare}
                            className="w-16 h-16 rounded-2xl bg-white shadow-2xl border border-white/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-zinc-400 hover:text-zinc-900"
                            aria-label="Share property link"
                        >
                            <Share2 className="w-6 h-6" />
                        </button>

                        {isOwner && (
                            <>
                                <button
                                    onClick={() => router.push(`/properties/${propertyId}/edit`)}
                                    className="px-8 py-4 bg-zinc-100 text-zinc-900 rounded-2xl hover:scale-105 active:scale-95 text-xs font-black uppercase tracking-[0.2em] transition-all"
                                >
                                    {t('property.actions.edit', undefined, 'Configure')}
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="px-8 py-4 bg-zinc-100 text-zinc-900 rounded-2xl hover:scale-105 active:scale-95 text-xs font-black uppercase tracking-[0.2em] transition-all border border-zinc-200"
                                >
                                    {t('property.actions.delete', undefined, 'Terminate')}
                                </button>
                            </>
                        )}
                    </motion.div>
                </header>

                <main>
                    {/* Status Grid */}
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="mb-10 flex flex-wrap items-center gap-4"
                    >
                        <div className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-[0.3em] backdrop-blur-3xl shadow-2xl border ${property.status === 'active' ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-600'}`}>
                            {property.status === 'active' ? t('property.status.published', undefined, 'Market Active') : t('property.status.draft', undefined, 'Draft Protocol')}
                        </div>
                        {property.caf_eligible && (
                            <div className="px-6 py-2 rounded-full text-xs font-black uppercase tracking-[0.3em] bg-zinc-100 border border-zinc-200 text-zinc-900 shadow-2xl">
                                {t('property.pricing.cafEligible', undefined, 'CAF Approved')}
                            </div>
                        )}
                        {property.natural_risks_compliant && (
                            <div className="px-6 py-2 rounded-full text-xs font-black uppercase tracking-[0.3em] bg-green-50 border border-green-200 text-green-800 shadow-2xl">
                                ERP/ERNMT Compliant
                            </div>
                        )}
                        <div className="px-6 py-2 rounded-full text-xs font-black uppercase tracking-[0.3em] bg-white/50 backdrop-blur-3xl border border-white/20 text-zinc-400">
                            {t(`properties.new.types.${property.property_type}`, undefined, property.property_type)}
                        </div>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                        {/* Left Column - Deep Tech Details */}
                        <div className="lg:col-span-8 space-y-12">
                            {/* Cinema Gallery */}
                            <motion.div 
                                initial={{ y: 40, opacity: 0 }}
                                whileInView={{ y: 0, opacity: 1 }}
                                viewport={{ once: true }}
                                className="glass-card !p-0 rounded-[3.5rem] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.15)] border-zinc-100 overflow-hidden group relative"
                            >
                                {photos && photos.length > 0 && activePhoto ? (
                                    <div className="relative w-full aspect-[16/9] lg:aspect-[21/9]">
                                        <Image
                                            key={activePhotoIdx}
                                            src={resolveMediaUrl(activePhoto.url || activePhoto)}
                                            alt={`${property.title} - ${activePhoto.room_label || 'View'}`}
                                            fill
                                            priority={activePhotoIdx === 0}
                                            className="object-cover transition-transform duration-700"
                                            sizes="(max-width: 1200px) 100vw, 1200px"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                                        
                                        {activePhoto.room_label && (
                                            <div className="absolute top-8 left-8 px-6 py-3 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl text-xs font-black uppercase tracking-[0.3em] text-white shadow-2xl">
                                                {activePhoto.room_label}
                                            </div>
                                        )}

                                        <div className="absolute bottom-8 right-8 flex gap-3 z-20">
                                            <button
                                                onClick={() => setActivePhotoIdx(i => i === 0 ? photos.length - 1 : i - 1)}
                                                className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-3xl border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all font-bold"
                                                aria-label="Previous photo"
                                            >
                                                ←
                                            </button>
                                            <button
                                                onClick={() => setActivePhotoIdx(i => i === photos.length - 1 ? 0 : i + 1)}
                                                className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-3xl border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all font-bold"
                                                aria-label="Next photo"
                                            >
                                                →
                                            </button>
                                        </div>

                                        <div className="absolute bottom-8 left-8 text-white/60 text-xs font-black uppercase tracking-[0.4em]">
                                            {activePhotoIdx + 1} / {photos.length}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="aspect-[16/9] bg-zinc-100 flex items-center justify-center">
                                        <span className="text-3xl font-black text-zinc-300 italic tracking-tighter uppercase">{t('property.media.noMedia', undefined, 'Visuals Offline')}</span>
                                    </div>
                                )}
                            </motion.div>

                            {/* Core Identity */}
                            <div className="space-y-6">
                                <h1 className="text-6xl sm:text-8xl font-black tracking-tighter text-zinc-900 uppercase leading-[0.85]">
                                    {property.title}
                                </h1>
                                <div className="flex items-center gap-6 text-zinc-400 font-black text-xs uppercase tracking-[0.4em]">
                                    <span>{property.city}</span>
                                    <span className="w-1 h-1 rounded-full bg-zinc-200" />
                                    <span>{property.size_sqm}m²</span>
                                    <span className="w-1 h-1 rounded-full bg-zinc-200" />
                                    <span>{property.bedrooms} {t('property.bedrooms', undefined, 'Bedrooms')}</span>
                                </div>
                                <p className="text-xl text-zinc-500 font-medium leading-relaxed max-w-4xl">
                                    {property.description}
                                </p>
                            </div>

                            {/* Detail Matrix */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                {[
                                    { label: t('search.detail.matrix.surface', undefined, 'Surface Area'), value: `${property.size_sqm}m²`, icon: <LayoutGrid className="w-5 h-5 text-zinc-900" /> },
                                    { label: t('search.detail.matrix.bedrooms', undefined, 'Bedrooms'), value: property.bedrooms, icon: <Wind className="w-5 h-5 text-zinc-900" /> },
                                    { label: t('search.detail.matrix.bathrooms', undefined, 'Bathrooms'), value: property.bathrooms, icon: <Shield className="w-5 h-5 text-zinc-900" /> },
                                    { label: t('search.detail.matrix.floor', undefined, 'Floor Level'), value: property.floor_number || 'GF', icon: <TrendingUp className="w-5 h-5 text-zinc-900" /> }
                                ].map((stat, i) => (
                                    <motion.div 
                                        key={i} 
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.1 }}
                                        className="glass-card !p-8 rounded-[2.5rem] border-zinc-100 hover:shadow-2xl transition-all group"
                                    >
                                        <div className="mb-4 p-3 bg-zinc-50 rounded-2xl w-fit group-hover:scale-110 transition-transform">{stat.icon}</div>
                                        <div className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{stat.label}</div>
                                        <div className="text-xl font-black text-zinc-900 uppercase tracking-tighter">{stat.value}</div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Landlord card (WP3) — who is behind this listing */}
                            {property.landlord_bio && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="glass-card !p-10 rounded-[3rem] border-zinc-100"
                                >
                                    <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.4em] mb-6">
                                        {t('bio.landlordCard.title', undefined, 'Qui propose ce logement')}
                                    </h2>
                                    <div className="flex items-start gap-5">
                                        <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-xl text-white font-black shrink-0">
                                            {(property.landlord_first_name || '?').charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                {property.landlord_first_name && (
                                                    <span className="text-lg font-black text-zinc-900">{property.landlord_first_name}</span>
                                                )}
                                                {property.landlord_identity_verified && (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-zinc-900 text-white text-xs font-black uppercase tracking-widest rounded-full">
                                                        <BadgeCheck className="w-3 h-3" />
                                                        {t('bio.landlordCard.identityVerified', undefined, 'Identité vérifiée')}
                                                    </span>
                                                )}
                                            </div>
                                            {property.landlord_member_since && (
                                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                                                    {t('bio.landlordCard.memberSince', undefined, 'Membre depuis')}{' '}
                                                    {new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(property.landlord_member_since))}
                                                </p>
                                            )}
                                            <p className="text-sm text-zinc-600 leading-relaxed">{property.landlord_bio}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Rent Control breakdown (ALUR / ELAN) */}
                            {property.loyer_reference !== undefined && property.loyer_reference !== null && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="glass-card !p-12 rounded-[3rem] border-zinc-100 relative overflow-hidden"
                                >
                                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 flex items-center gap-4">
                                        <TrendingUp className="w-6 h-6 text-zinc-900" />
                                        Rent Control Compliance
                                    </h2>
                                    <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-8">
                                        This property complies with French rent control laws (Loi ALUR/ELAN) regulating rent amounts in high-demand rental zones (zones tendues).
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div className="p-6 bg-zinc-50 rounded-2xl">
                                            <div className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">
                                                Reference Rent (Base)
                                            </div>
                                            <div className="text-lg font-black text-zinc-900">
                                                €{property.loyer_reference.toFixed(2)}/m²
                                            </div>
                                        </div>
                                        <div className="p-6 bg-zinc-50 rounded-2xl">
                                            <div className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">
                                                Reference Rent (Capped Max)
                                            </div>
                                            <div className="text-lg font-black text-zinc-900">
                                                €{property.loyer_reference_majore?.toFixed(2)}/m²
                                            </div>
                                        </div>
                                        <div className="p-6 bg-zinc-50 rounded-2xl">
                                            <div className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">
                                                Loi ALUR Rent Supplement
                                            </div>
                                            <div className="text-lg font-black text-zinc-900">
                                                €{(property.complement_de_loyer || 0).toFixed(2)}/mo
                                            </div>
                                        </div>
                                    </div>
                                    {property.complement_de_loyer && property.complement_de_loyer > 0 && (
                                        <div className="mt-6 p-6 bg-amber-50/50 border border-amber-200/50 rounded-2xl text-xs font-medium text-amber-800">
                                            <div className="font-black uppercase tracking-wider mb-1 flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                Rent Supplement Justification
                                            </div>
                                            {property.complement_de_loyer_justification || 'No justification provided.'}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Room Details / Habitable Spaces */}
                            {property.room_details && property.room_details.length > 0 && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="glass-card !p-12 rounded-[3rem] border-zinc-100"
                                >
                                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-4">
                                        <Building2 className="w-6 h-6 text-zinc-900" />
                                        Habitable Configuration & Rooms
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {property.room_details.map((room: any, index: number) => (
                                            <div key={index} className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100/50 flex justify-between items-center">
                                                <div>
                                                    <div className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">
                                                        {room.room_type || `Space ${index + 1}`}
                                                    </div>
                                                    <div className="text-sm font-black text-zinc-900 uppercase">
                                                        {room.label || `Bedroom ${index + 1}`}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-zinc-900">
                                                        {room.surface_sqm} m²
                                                    </div>
                                                    <div className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                                                        {room.furnished ? 'Furnished' : 'Unfurnished'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Energy & Compliance */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="glass-card !p-12 rounded-[3rem] border-zinc-100 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-900/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter mb-10 flex items-center gap-4">
                                    <Zap className="w-6 h-6 text-zinc-900" />
                                    {t('property.energyTitle', undefined, 'Energy Intelligence')}
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                                    <div className="flex items-center gap-8">
                                        <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-2xl relative ${
                                            property.dpe_rating === 'A' ? 'bg-green-600 shadow-green-900/20' : 
                                            property.dpe_rating === 'B' ? 'bg-green-500 shadow-green-900/20' : 
                                            property.dpe_rating === 'C' ? 'bg-lime-500 shadow-green-900/20' :
                                            property.dpe_rating === 'D' ? 'bg-yellow-500 shadow-zinc-900/20' :
                                            property.dpe_rating === 'E' ? 'bg-orange-500 shadow-zinc-900/20' :
                                            property.dpe_rating === 'F' ? 'bg-red-500 shadow-zinc-900/20' :
                                            'bg-red-700 shadow-zinc-900/20'
                                        }`}>
                                            {property.dpe_rating || 'N/A'}
                                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full border border-zinc-100 flex items-center justify-center shadow-lg">
                                                <Shield className={`w-4 h-4 ${property.dpe_rating === 'A' || property.dpe_rating === 'B' ? 'text-green-600' : 'text-zinc-400'}`} />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{t('properties.new.details.energyRatingTitle', undefined, 'Energy Performance (DPE)')}</div>
                                            <div className="text-sm font-black text-zinc-900">{property.dpe_value || 0} kWh/m²/year</div>
                                            {property.dpe_rating === 'G' && (
                                                <div className="text-xs font-bold text-red-600 uppercase tracking-wider mt-1">
                                                    Banned from publishing under French Energy Passoire laws
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="w-24 h-24 rounded-3xl bg-zinc-900 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-zinc-900/20">
                                            {property.ges_rating || 'N/A'}
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">{t('properties.new.details.gesLabel', undefined, 'GHG Emissions (GES)')}</div>
                                            <div className="text-sm font-black text-zinc-900">{property.ges_value || 0} kgCO₂/m²/year</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Amenities and Features */}
                            {(amenities.length > 0 || customAmenities.length > 0) && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="glass-card !p-12 rounded-[3rem] border-zinc-100"
                                >
                                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-4">
                                        <LayoutGrid className="w-6 h-6 text-zinc-900" />
                                        {t('property.amenitiesTitle', undefined, 'Amenities & Features')}
                                    </h2>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                        {amenities.map((item: string, i: number) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center">
                                                    <Check className="w-4 h-4 text-zinc-900" />
                                                </div>
                                                <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">{t(`properties.amenity.${item}`, undefined, item)}</span>
                                            </div>
                                        ))}
                                        {customAmenities.map((item: string, i: number) => (
                                            <div key={`custom-${i}`} className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center">
                                                    <Check className="w-4 h-4 text-zinc-900" />
                                                </div>
                                                <span className="text-xs font-black text-zinc-600 uppercase tracking-widest">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Transit & Points of Interest Connectivity */}
                            {(publicTransport.length > 0 || nearbyLandmarks.length > 0) && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="glass-card !p-12 rounded-[3rem] border-zinc-100"
                                >
                                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-4">
                                        <Navigation className="w-6 h-6 text-zinc-900" />
                                        Neighborhood Connectivity
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                                        {publicTransport.length > 0 && (
                                            <div className="space-y-6">
                                                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">{t('property.transport', undefined, 'Public Transit')}</h3>
                                                <div className="space-y-4">
                                                    {publicTransport.map((item: any, i: number) => (
                                                        <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100">
                                                            <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">{item.line || item}</span>
                                                            <span className="text-xs text-zinc-500 font-medium">{item.distance || '5 min walk'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {nearbyLandmarks.length > 0 && (
                                            <div className="space-y-6">
                                                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">{t('property.landmarks', undefined, 'Points of Interest')}</h3>
                                                <div className="space-y-4">
                                                    {nearbyLandmarks.map((item: any, i: number) => (
                                                        <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100">
                                                            <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">{item.name || item}</span>
                                                            <span className="text-xs text-zinc-500 font-medium">{item.distance || '10 min walk'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* Location Intelligence */}
                            {property.latitude && property.longitude && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    whileInView={{ opacity: 1 }}
                                    viewport={{ once: true }}
                                    className="space-y-8"
                                >
                                    <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-4">
                                        <MapPin className="w-6 h-6 text-zinc-900" />
                                        {t('property.locationTitle', undefined, 'Verified Location')}
                                    </h2>
                                    <StaticMapView 
                                        lat={property.latitude} 
                                        lng={property.longitude} 
                                        address={fullAddress} 
                                    />
                                </motion.div>
                            )}
                        </div>

                        {/* Right Column - Transaction Center */}
                        <div className="lg:col-span-4 space-y-10">
                            <motion.div
                                initial={{ y: 40, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="glass-card !p-12 sticky top-32 shadow-[0_60px_120px_-20px_rgba(0,0,0,0.15)] border-zinc-100 rounded-[3.5rem] relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-2 bg-zinc-900" />
                                
                                <div className="text-center mb-12">
                                    <div className="flex items-baseline justify-center gap-2 mb-2">
                                        <span className="text-5xl sm:text-7xl font-black text-zinc-900 tracking-tighter">€{property.monthly_rent}</span>
                                        <span className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em]">{t('search.property.mo', undefined, '/ Month')}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-zinc-100 rounded-full">
                                        <div className="w-2 h-2 rounded-full bg-zinc-900" />
                                        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                                            {property.charges_included ? t('property.price.included', undefined, 'All-Inclusive') : t('property.price.excluded', undefined, 'Rent + Charges')}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-6 mb-12">
                                    {[
                                        { label: t('property.price.deposit', undefined, 'Security Deposit'), value: `€${property.deposit || 0}` },
                                        { label: t('property.price.charges', undefined, 'Monthly Charges'), value: `€${property.charges || 0}` },
                                        { label: t('property.guarantor.title', undefined, 'Guarantor Protocol'), value: property.guarantor_required ? t('property.guarantor.required', undefined, 'Required') : t('property.guarantor.notRequired', undefined, 'Flexible') },
                                        { label: t('property.status.available', undefined, 'Available From'), value: property.available_from ? new Date(property.available_from).toLocaleDateString() : t('common.immediate', undefined, 'Immediate') }
                                    ].map((item, i) => (
                                        <div key={i} className="flex justify-between items-center pb-4 border-b border-zinc-100 last:border-0 last:pb-0">
                                            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">{item.label}</span>
                                            <span className="text-sm font-black text-zinc-900 uppercase tracking-tighter">{item.value}</span>
                                        </div>
                                    ))}
                                </div>

                                {!isOwner ? (
                                    <div className="space-y-4">
                                        <button 
                                            onClick={() => executeWithAuth(() => setIsApplying(true))}
                                            className="w-full py-6 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all group overflow-hidden relative"
                                        >
                                            <div className="absolute inset-0 bg-zinc-800 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                            <span className="relative z-10">{t('property.actions.apply', undefined, 'Initialize Application')}</span>
                                        </button>
                                        <button 
                                            onClick={() => executeWithAuth(() => router.push('/inbox'))}
                                            className="w-full py-6 bg-zinc-100 text-zinc-900 text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] hover:bg-zinc-200 transition-all"
                                        >
                                            {t('property.actions.message', undefined, 'Open Channel')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="p-6 bg-zinc-100/50 rounded-[2.5rem] border border-zinc-200/50 text-center">
                                            <div className="text-4xl font-black text-zinc-900 tracking-tighter mb-1">{property.views_count}</div>
                                            <div className="text-xs font-black text-zinc-400 uppercase tracking-widest">{t('property.status.views', undefined, 'Global Views')}</div>
                                        </div>
                                        <button 
                                            onClick={() => router.push(`/properties/${propertyId}/edit`)}
                                            className="w-full py-5 border-2 border-zinc-200 rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] hover:border-zinc-900 transition-all"
                                        >
                                            {t('property.actions.edit', undefined, 'Update Protocol')}
                                        </button>
                                    </div>
                                )}
                            </motion.div>

                            {/* Integrated Tools */}
                            <div className="glass-card !p-12 rounded-[3.5rem] border-zinc-100">
                                <h3 className="text-xl font-black uppercase tracking-tighter mb-8 italic">{t('dashboard.landlord.sections.portfolio', undefined, 'Management Suite')}</h3>
                                {isOwner ? (
                                    <div className="space-y-10">
                                        <VisitScheduler
                                            propertyId={property.id}
                                            rooms={(property.room_details || []).map((_: any, i: number) => ({
                                                label: `${t('property.bedroom', undefined, 'Bedroom')} ${i + 1}`,
                                                index: i,
                                            }))}
                                        />
                                        <div className="pt-10 border-t border-zinc-100">
                                            <LeaseManager propertyId={property.id} monthlyRent={property.monthly_rent} />
                                        </div>
                                    </div>
                                ) : (
                                    <div 
                                        onClick={(e) => {
                                            if (!user) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                executeWithAuth(() => {});
                                            }
                                        }}
                                        className={!user ? 'cursor-pointer' : ''}
                                    >
                                        <VisitBookingWizard
                                            propertyId={property.id}
                                            rooms={(property.room_details || []).map((_: any, i: number) => ({
                                                label: `${t('property.bedroom', undefined, 'Bedroom')} ${i + 1}`,
                                                index: i,
                                            }))}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                {/* Application Modal */}
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
                            <div className="absolute top-0 left-0 w-full h-2 bg-zinc-900" />
                            <h2 className="text-4xl font-black tracking-tighter uppercase mb-6 leading-none">
                                {t('property.apply.title', undefined, 'Application Protocol')}
                            </h2>
                            <p className="text-xl text-zinc-500 font-medium leading-relaxed mb-12">
                                {t('property.apply.desc', undefined, 'Introduce yourself to the landlord. A personalized cover letter increases your chances by 60%.')}
                            </p>
                            
                            <textarea
                                value={coverLetter}
                                onChange={(e) => setCoverLetter(e.target.value)}
                                placeholder={t('property.apply.placeholder', undefined, 'Describe your profile, lifestyle, and rental duration...')}
                                className="w-full h-48 px-8 py-6 rounded-[2.5rem] bg-zinc-100 border-none focus:ring-2 focus:ring-zinc-900/10 text-lg font-medium text-zinc-900 placeholder:text-zinc-400 transition-all resize-none mb-12 shadow-inner"
                            />

                            <div className="flex gap-6">
                                <button 
                                    onClick={() => setIsApplying(false)}
                                    className="flex-1 py-6 text-xs font-black uppercase tracking-[0.4em] text-zinc-400 hover:text-zinc-900 transition-all"
                                >
                                    {t('property.apply.cancel', undefined, 'Abort')}
                                </button>
                                <button
                                    onClick={handleApply}
                                    disabled={submittingApp}
                                    className="flex-[2] py-6 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {submittingApp ? t('property.apply.sending', undefined, 'TRANSMITTING...') : t('property.apply.send', undefined, 'Submit Application')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>

            {/* Contextual Authentication Modal */}
            {showAuthModal && (
                <ProtectedRoute onClose={() => setShowAuthModal(false)}>
                    <AuthSuccessHandler 
                        onSuccess={() => {
                            setShowAuthModal(false);
                            if (pendingAction) {
                                pendingAction();
                                setPendingAction(null);
                            }
                        }} 
                    />
                </ProtectedRoute>
            )}
        </PremiumLayout>
    );
}

// In-context login success callback wrapper component
function AuthSuccessHandler({ onSuccess }: { onSuccess: () => void }) {
    useEffect(() => {
        onSuccess();
    }, [onSuccess]);
    return null;
}
