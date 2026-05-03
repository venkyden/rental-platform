'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import EmptyState from '@/components/EmptyState';
import { apiClient } from '@/lib/api';
import { motion, Variants } from 'framer-motion';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import VerificationUpload from '@/components/VerificationUpload';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'react-hot-toast';
import { PropertyCardSkeleton } from '@/components/SkeletonLoaders';

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
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

interface Property {
    id: string;
    title: string;
    city: string;
    monthly_rent: number;
    bedrooms: number;
    status: string;
    photos: any[];
    created_at: string;
    ownership_verified?: boolean;
}

export default function PropertiesPage() {
    const { user, isAuthenticated } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'active'>('all');
    
    // Verification State
    const [verifyingProperty, setVerifyingProperty] = useState<string | null>(null);

    useEffect(() => {
        if (user && user.role !== 'landlord') {
            router.replace('/dashboard');
            return;
        }
        loadProperties();
    }, [filter, user, router]);

    const loadProperties = async () => {
        if (!user || user.role !== 'landlord') return;

        try {
            const response = await apiClient.client.get('/properties', {
                params: {
                    landlord_id: user.id,
                    status: filter === 'all' ? undefined : filter
                }
            });
            setProperties(response.data);
        } catch (error) {
            console.error('Error loading properties:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('property.landlord.deleteConfirm', undefined, 'Are you sure you want to delete this property?'))) return;

        try {
            await apiClient.client.delete(`/properties/${id}`);
            loadProperties();
            toast.success(t('property.error.deleteSuccess', undefined, 'Property deleted successfully'));
        } catch (error) {
            toast.error('Error deleting property');
        }
    };

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                        <div>
                            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">
                                {t('property.landlord.title', undefined, 'Your Portfolio')}
                            </h1>
                            <p className="text-lg text-zinc-500 dark:text-zinc-400 font-medium">
                                Manage your properties and tracking listing performance.
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push('/properties/new')}
                                className="btn-primary !py-4 !px-10 !rounded-2xl !text-sm uppercase tracking-widest shadow-2xl shadow-teal-500/20"
                            >
                                + {t('property.landlord.add', undefined, 'Add Property')}
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center justify-between mb-12">
                        <div className="flex p-1.5 bg-zinc-100 dark:bg-zinc-800/50 backdrop-blur-xl rounded-[1.5rem] border border-zinc-200/50 dark:border-zinc-700/30">
                            {['all', 'draft', 'active'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilter(status as any)}
                                    className={`px-8 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-500 ${
                                        filter === status 
                                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xl scale-100' 
                                        : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {[1, 2, 3, 4, 5, 6].map(i => <PropertyCardSkeleton key={i} />)}
                        </div>
                    ) : properties.length === 0 ? (
                        <div className="py-32 text-center glass-card border-none">
                            <h3 className="text-2xl font-black mb-2">{t('property.landlord.emptyTitle', undefined, 'No properties yet')}</h3>
                            <p className="text-zinc-500 font-medium">{t('property.landlord.emptyDesc', undefined, 'Start by adding your first listing to the platform.')}</p>
                            <button onClick={() => router.push('/properties/new')} className="mt-8 text-teal-600 font-black uppercase tracking-widest text-xs">Create Listing →</button>
                        </div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden" animate="show"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
                        >
                            {properties.map((property) => (
                                <motion.div 
                                    variants={itemVariants} 
                                    key={property.id} 
                                    className="group glass-card !p-0 overflow-hidden flex flex-col border-white/40 dark:border-zinc-800/50 hover:shadow-2xl transition-all duration-500"
                                >
                                    <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                                        {property.photos?.[0] ? (
                                            <img src={resolveMediaUrl(property.photos[0].url)} alt={property.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-300 font-black italic">NO PHOTO</div>
                                        )}
                                        <div className="absolute top-4 right-4">
                                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${property.status === 'active' ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>
                                                {property.status}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 flex flex-col flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white truncate tracking-tight pr-4">{property.title}</h3>
                                            <div className="text-right">
                                                <p className="text-xl font-black text-teal-600 dark:text-teal-400 leading-none">€{property.monthly_rent}</p>
                                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">/ Month</p>
                                            </div>
                                        </div>
                                        
                                        <p className="text-zinc-500 dark:text-zinc-400 font-bold text-xs uppercase tracking-wider mb-8">{property.city} • {property.bedrooms} Bedrooms</p>
                                        
                                        {/* Verification Status */}
                                        <div className="mb-8">
                                            {property.ownership_verified ? (
                                                <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30 uppercase tracking-widest">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    Verified Listing
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setVerifyingProperty(property.id)}
                                                    className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 px-4 py-2 rounded-xl border border-amber-100 dark:border-amber-900/30 uppercase tracking-widest hover:bg-amber-100 transition-all"
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                    Verify Ownership
                                                </button>
                                            )}
                                        </div>

                                        <div className="mt-auto grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => router.push(`/properties/${property.id}/edit`)}
                                                className="py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => router.push(`/properties/${property.id}`)}
                                                className="py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 transition-all"
                                            >
                                                Preview
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>

                {/* Verification Modal */}
                <AnimatePresence>
                    {verifyingProperty && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setVerifyingProperty(null)}
                                className="absolute inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-md"
                            />
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden"
                            >
                                <div className="p-12">
                                    <VerificationUpload 
                                        verificationType="property"
                                        propertyId={verifyingProperty}
                                        onSuccess={() => {
                                            setVerifyingProperty(null);
                                            loadProperties();
                                        }}
                                    />
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
