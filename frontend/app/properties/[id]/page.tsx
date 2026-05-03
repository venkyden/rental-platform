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
            <PremiumLayout withNavbar>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Header */}
                    <header className="mb-6 p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex justify-between items-center">
                        <button
                            onClick={() => router.push('/properties')}
                            className="text-teal-600 hover:text-teal-500 font-medium transition-colors"
                        >
                            ← {t('property.actions.back', undefined, undefined)}
                        </button>
                        {isOwner && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => router.push(`/properties/${propertyId}/edit`)}
                                    className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-colors"
                                >
                                    ️ {t('property.actions.edit', undefined, undefined)}
                                </button>
                                {property.status === 'draft' && (
                                    <button
                                        onClick={handlePublish}
                                        disabled={publishing}
                                        className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl hover:shadow-sm font-medium disabled:opacity-50 transition-all"
                                    >
                                        {publishing ? t('property.actions.publishing', undefined, undefined) : t('property.actions.publish', undefined, undefined)}
                                    </button>
                                )}
                                <button
                                    onClick={handleDelete}
                                    className="px-4 py-2 bg-red-50/50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20 font-medium transition-colors border border-red-200 dark:border-red-900/30"
                                >
                                    ️ {t('property.actions.delete', undefined, undefined)}
                                </button>
                            </div>
                        )}
                    </header>

                    <main>
                        {/* Status Badge */}
                        <div className="mb-4">
                            <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md shadow-sm ${property.status === 'active' ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>
                                {property.status === 'active' ? t('property.status.published', undefined, undefined) : t('property.status.draft', undefined, undefined)}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column - Photos & Info */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Photo Gallery */}
                                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 overflow-hidden">
                                    {photos && photos.length > 0 && activePhoto ? (
                                        <div className="relative w-full h-96 group">
                                            {activePhoto.media_type === 'video' ? (
                                                <video src={resolveMediaUrl(activePhoto.url || activePhoto)} controls className="w-full h-full object-cover" />
                                            ) : (
                                                <img
                                                    src={resolveMediaUrl(activePhoto.url || activePhoto)}
                                                    alt={`${property.title} - ${activePhoto.room_label || 'Photo'}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}

                                            {/* Room Label Badge */}
                                            {activePhoto.room_label && (
                                                <div className="absolute top-4 left-4 bg-teal-600/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm border border-teal-500/50 flex items-center gap-2">
                                                    ️ {activePhoto.room_label}
                                                </div>
                                            )}

                                            {/* Navigation Controls */}
                                            {photos.length > 1 && (
                                                <>
                                                    <button
                                                        onClick={() => setActivePhotoIdx(i => i === 0 ? photos.length - 1 : i - 1)}
                                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                                    >
                                                        
                                                    </button>
                                                    <button
                                                        onClick={() => setActivePhotoIdx(i => i === photos.length - 1 ? 0 : i + 1)}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                                    >
                                                        
                                                    </button>

                                                    <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold">
                                                        {activePhotoIdx + 1} / {photos.length}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="h-96 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                            <span className="text-8xl"></span>
                                        </div>
                                    )}
                                </div>

                                {/* Title & Description */}
                                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-6">
                                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3">{property.title}</h1>
                                    <div className="flex items-center gap-4 text-zinc-600 dark:text-zinc-400 mb-4">
                                        <span className="flex items-center gap-1">
                                             {property.city}
                                        </span>
                                        <span>•</span>
                                        <span className="capitalize">{property.property_type}</span>
                                    </div>
                                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{property.description}</p>
                                </div>

                                {/* Property Details */}
                                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-6">
                                    <h2 className="text-xl font-bold mb-4">{t('property.detailsTitle', undefined, undefined)}</h2>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">️</span>
                                            <div>
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400">{t('property.bedrooms', undefined, undefined)}</div>
                                                <div className="font-semibold">{property.bedrooms}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl"></span>
                                            <div>
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400">{t('property.bathrooms', undefined, undefined)}</div>
                                                <div className="font-semibold">{property.bathrooms}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl"></span>
                                            <div>
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400">{t('property.size', undefined, undefined)}</div>
                                                <div translate="no" className="notranslate font-semibold">{property.size_sqm}m²</div>
                                            </div>
                                        </div>
                                        {property.floor_number !== null && property.floor_number !== undefined && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl"></span>
                                                <div>
                                                    <div className="text-sm text-zinc-600 dark:text-zinc-400">{t('property.floor', undefined, undefined)}</div>
                                                    <div className="font-semibold">{property.floor_number}</div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">️</span>
                                            <div>
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400">{t('property.furnished', undefined, undefined)}</div>
                                                <div className="font-semibold">{property.furnished ? t('property.yes', undefined, undefined) : t('property.no', undefined, undefined)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* DPE / GES Energy Ratings */}
                                    {property.dpe_rating && (
                                        <div className="mt-6 pt-6 border-t">
                                            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3"> {t('property.energyTitle', undefined, undefined)}</h3>
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">DPE</div>
                                                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-lg ${property.dpe_rating === 'A' ? 'bg-green-500' :
                                                        property.dpe_rating === 'B' ? 'bg-lime-500' :
                                                            property.dpe_rating === 'C' ? 'bg-yellow-400 text-zinc-800 dark:text-zinc-200' :
                                                                property.dpe_rating === 'D' ? 'bg-amber-400 text-zinc-800 dark:text-zinc-200' :
                                                                    property.dpe_rating === 'E' ? 'bg-orange-500' :
                                                                        property.dpe_rating === 'F' ? 'bg-red-500' :
                                                                            'bg-red-700'
                                                        }`}>{property.dpe_rating}</div>
                                                    {property.dpe_value && <div translate="no" className="notranslate text-xs text-zinc-500 dark:text-zinc-400 mt-1">{property.dpe_value} kWh/m²/an</div>}
                                                </div>
                                                {property.ges_rating && (
                                                    <div className="flex-1">
                                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">GES</div>
                                                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-lg ${property.ges_rating === 'A' ? 'bg-purple-300' :
                                                            property.ges_rating === 'B' ? 'bg-purple-400' :
                                                                property.ges_rating === 'C' ? 'bg-purple-500' :
                                                                    property.ges_rating === 'D' ? 'bg-purple-600' :
                                                                        property.ges_rating === 'E' ? 'bg-purple-700' :
                                                                            property.ges_rating === 'F' ? 'bg-purple-800' :
                                                                                'bg-purple-900'
                                                            }`}>{property.ges_rating}</div>
                                                        {property.ges_value && <div translate="no" className="notranslate text-xs text-zinc-500 dark:text-zinc-400 mt-1">{property.ges_value} kgCO₂/m²/an</div>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Utilities & CAF Eligibility */}
                                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-6">
                                    <h2 className="text-xl font-bold mb-4"> {t('property.utilitiesTitle', undefined, undefined)}</h2>
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t('property.includedInRent', undefined, undefined)}</h3>
                                            <div className="flex gap-4">
                                                <div className={`text-center p-2 rounded-xl ${property.utilities_included?.includes('electricity') ? 'bg-yellow-50 text-yellow-700' : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 opacity-50'}`}>
                                                    <div className="text-2xl"></div>
                                                    <div className="text-xs font-medium">{t('property.utilities.elec', undefined, 'Elec')}</div>
                                                </div>
                                                <div className={`text-center p-2 rounded-xl ${property.utilities_included?.includes('gas') ? 'bg-orange-50 text-orange-700' : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 opacity-50'}`}>
                                                    <div className="text-2xl"></div>
                                                    <div className="text-xs font-medium">{t('property.utilities.gas', undefined, 'Gas')}</div>
                                                </div>
                                                <div className={`text-center p-2 rounded-xl ${property.utilities_included?.includes('water') ? 'bg-teal-50/50 dark:bg-teal-900/10 text-teal-700' : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 opacity-50'}`}>
                                                    <div className="text-2xl"></div>
                                                    <div className="text-xs font-medium">{t('property.utilities.water', undefined, 'Water')}</div>
                                                </div>
                                                <div className={`text-center p-2 rounded-xl ${property.utilities_included?.includes('internet') ? 'bg-purple-50 text-purple-700' : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 opacity-50'}`}>
                                                    <div className="text-2xl"></div>
                                                    <div className="text-xs font-medium">{t('property.utilities.wifi', undefined, undefined)}</div>
                                                </div>
                                            </div>
                                            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                                {property.utilities_included?.length ? t('property.utilities.includedDesc', undefined, undefined) : t('property.utilities.notIncludedDesc', undefined, undefined)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Amenities */}
                                {(amenities.length > 0 || customAmenities.length > 0) && (
                                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-6">
                                        <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">{t('property.amenities', undefined, undefined)}</h2>
                                        <div className="flex flex-wrap gap-2">
                                            {[...amenities, ...customAmenities].map((amenity: string, idx: number) => (
                                                <span key={idx} className="px-3 py-1 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-full text-sm font-medium">
                                                    {amenity}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Rooms & Layout */}
                                {property.room_details && property.room_details.length > 0 && (
                                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-6">
                                        <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">️ {t('property.layout', undefined, undefined)}</h2>
                                        <div className="space-y-4">
                                            {property.room_details.map((room: any, index: number) => (
                                                <div key={index} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700/50">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h3 className="font-semibold text-zinc-900 dark:text-white">{t('property.bedroom', undefined, undefined)} {index + 1}</h3>
                                                        <div className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                                            {room.surface && <span translate="no" className="notranslate">{room.surface}m²</span>}
                                                            {room.capacity && <span>• {t(room.capacity > 1 ? 'property.persons' : 'property.person', { count: room.capacity }, undefined)}</span>}
                                                            {room.bedding && room.bedding !== 'None' && <span>• {t('property.bed', { count: 1 }, undefined)}</span>}
                                                        </div>
                                                    </div>
                                                    {room.description && (
                                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">{room.description}</p>
                                                    )}
                                                    {room.custom_amenities && room.custom_amenities.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {room.custom_amenities.map((amenity: string, ai: number) => (
                                                                <span key={ai} className="px-2.5 py-1 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-full text-xs font-medium">
                                                                    {amenity}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Location & Transport */}
                                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-6">
                                    <h2 className="text-xl font-bold mb-4"> {t('property.location', undefined, undefined)}</h2>
                                    <p className="text-zinc-700 dark:text-zinc-300 mb-4">{fullAddress}</p>
                                    {publicTransport.length > 0 && (
                                        <div className="mb-4">
                                            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2"> {t('property.transport', undefined, undefined)}</h3>
                                            <ul className="space-y-1">
                                                {publicTransport.slice(0, 10).map((transport: string, idx: number) => (
                                                    <li key={idx} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                                                        <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">→</span>
                                                        <span>{transport}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {nearbyLandmarks.length > 0 && (
                                        <div>
                                            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2"> {t('property.landmarks', undefined, undefined)}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                                {nearbyLandmarks.slice(0, 12).map((landmark: string, idx: number) => (
                                                    <div key={idx} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                                                        <span className="text-teal-600 dark:text-teal-400 mt-0.5">•</span>
                                                        <span>{landmark}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Column - Price & Contact */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-6 sticky top-6">
                                    <div className="text-center mb-6">
                                        <div translate="no" className="notranslate text-4xl font-bold text-teal-600 dark:text-teal-400 mb-1">€{property.monthly_rent}</div>
                                        <div className="text-zinc-600 dark:text-zinc-400">
                                            {t('property.price.perMonth', undefined, undefined)} {property.charges_included ? (
                                                <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold ml-1">CC</span>
                                            ) : (
                                                <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold ml-1">HC</span>
                                            )}
                                        </div>
                                        {!property.charges_included && property.charges && (
                                            <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                                {t('property.price.total', undefined, undefined)} <span translate="no" className="notranslate font-semibold text-zinc-800 dark:text-zinc-200">€{(Number(property.monthly_rent) + Number(property.charges)).toFixed(0)}/{t('property.price.perMonth', undefined, undefined)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3 mb-6 text-sm">
                                        {property.deposit && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-600 dark:text-zinc-400">{t('property.price.deposit', undefined, undefined)}</span>
                                                <span translate="no" className="notranslate font-semibold">€{property.deposit}</span>
                                            </div>
                                        )}
                                        {property.charges && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-600 dark:text-zinc-400">{t('property.price.charges', undefined, undefined)}</span>
                                                <span translate="no" className="notranslate font-semibold">€{property.charges}/{t('property.price.perMonth', undefined, undefined)} {property.charges_included ? t('property.price.included', undefined, undefined) : t('property.price.excluded', undefined, undefined)}</span>
                                            </div>
                                        )}
                                        {property.charges_description && (
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded p-2 mt-1">
                                                 {property.charges_description}
                                            </div>
                                        )}
                                        {property.available_from && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-600 dark:text-zinc-400">{t('property.status.available', undefined, undefined)}</span>
                                                <span className="font-semibold">{new Date(property.available_from).toLocaleDateString(t('landing.lang', undefined, undefined) === 'fr' ? 'fr-FR' : 'en-GB')}</span>
                                            </div>
                                        )}
                                        {/* Guarantor Info */}
                                        <div className="flex justify-between">
                                            <span className="text-zinc-600 dark:text-zinc-400">{t('property.guarantor.title', undefined, undefined)}</span>
                                            <span className="font-semibold">{property.guarantor_required ? t('property.guarantor.required', undefined, undefined) : t('property.guarantor.notRequired', undefined, undefined)}</span>
                                        </div>
                                        {property.guarantor_required && property.accepted_guarantor_types && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {(Array.isArray(property.accepted_guarantor_types) ? property.accepted_guarantor_types : []).map((type: string) => (
                                                    <span key={type} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">
                                                        {type === 'visale' ? t('property.guarantor.visale', undefined, undefined) : type === 'garantme' ? t('property.guarantor.garantme', undefined, undefined) : type === 'physical' ? t('property.guarantor.physical', undefined, undefined) : type === 'organisation' ? t('property.guarantor.organisation', undefined, undefined) : type}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* CAF Eligibility */}
                                        <div className="flex justify-between">
                                            <span className="text-zinc-600 dark:text-zinc-400 font-medium flex items-center gap-1">
                                                🏦 {t('property.pricing.cafEligible', undefined, 'CAF Eligible')}
                                            </span>
                                            <span className={`font-semibold ${property.caf_eligible ? 'text-teal-600 dark:text-teal-400' : 'text-zinc-500'}`}>
                                                {property.caf_eligible ? t('common.yes', undefined, 'Yes') : t('common.no', undefined, 'No')}
                                            </span>
                                        </div>
                                    </div>
                                    {!isOwner && (
                                        <div className="space-y-3">
                                            <button onClick={() => setIsApplying(true)} className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-white font-bold rounded-xl hover:shadow-sm transition-all hover:scale-[1.02]">
                                                 {t('property.actions.apply', undefined, undefined)}
                                            </button>
                                            <button className="w-full py-3 bg-white border-2 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-zinc-50 dark:bg-zinc-800/50 transition-all">
                                                 {t('property.actions.message', undefined, undefined)}
                                            </button>
                                        </div>
                                    )}
                                    {isOwner && property.status === 'draft' && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                                            <p className="text-sm text-yellow-800 mb-2">
                                                ️ {t('property.status.notPublishedNotice', undefined, undefined)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-6">
                                    {isOwner ? (
                                        <>
                                            <VisitScheduler
                                                propertyId={property.id}
                                                rooms={(property.room_details || []).map((_: any, i: number) => ({
                                                    label: `${t('property.bedroom', undefined, 'Bedroom')} ${i + 1}`,
                                                    index: i,
                                                }))}
                                            />
                                            <LeaseManager propertyId={property.id} monthlyRent={property.monthly_rent} />
                                        </>
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
                                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 p-6">
                                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">{t('property.status.stats', undefined, undefined)}</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-600 dark:text-zinc-400">{t('property.status.views', undefined, undefined)}</span>
                                            <span className="font-semibold">{property.views_count}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-600 dark:text-zinc-400">{t('property.status.listed', undefined, undefined)}</span>
                                            <span className="font-semibold">{new Date(property.created_at).toLocaleDateString(t('landing.lang', undefined, undefined) === 'fr' ? 'fr-FR' : 'en-GB')}</span>
                                        </div>
                                        {property.published_at && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-600 dark:text-zinc-400">{t('property.status.publishedAt', undefined, undefined)}</span>
                                                <span className="font-semibold">{new Date(property.published_at).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>

                    {isApplying && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                            <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)] max-w-lg w-full p-8 border border-white/50 dark:border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('property.apply.title', undefined, undefined)} </h2>
                                    <button onClick={() => setIsApplying(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"></button>
                                </div>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                                    {t('property.apply.desc', undefined, undefined)}
                                </p>
                                <textarea
                                    value={coverLetter}
                                    onChange={(e) => setCoverLetter(e.target.value)}
                                    placeholder={t('property.apply.placeholder', undefined, undefined)}
                                    className="w-full h-32 px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 mb-6 resize-none transition-all"
                                />
                                <div className="flex gap-3">
                                    <button onClick={() => setIsApplying(false)} className="flex-1 py-3 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl font-medium transition-colors">
                                        {t('property.apply.cancel', undefined, undefined)}
                                    </button>
                                    <button
                                        onClick={handleApply}
                                        disabled={submittingApp}
                                        className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-white rounded-xl font-bold hover:shadow-sm hover: transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                                    >
                                        {submittingApp ? (
                                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('property.apply.sending', undefined, undefined)}</>
                                        ) : (
                                            <><span></span> {t('property.apply.send', undefined, undefined)}</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}

