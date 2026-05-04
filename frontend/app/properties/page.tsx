'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import EmptyState from '@/components/EmptyState';
import { apiClient } from '@/lib/api';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import VerificationUpload from '@/components/VerificationUpload';
import { useLanguage } from '@/lib/LanguageContext';
import { toast } from 'react-hot-toast';
import { PropertyCardSkeleton } from '@/components/SkeletonLoaders';
import { Building } from 'lucide-react';

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
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 relative z-10">
                    {/* Header - Ultra Premium */}
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 mb-20">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                {t('property.landlord.portfolio', undefined, 'Portfolio Management')}
                            </div>
                            <h1 className="text-6xl sm:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-500 uppercase leading-[0.9]">
                                {t('property.landlord.title', undefined, 'Your Properties')}
                            </h1>
                            <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium max-w-xl leading-relaxed">
                                Manage your rental assets and track high-performance listing engagement across the platform.
                            </p>
                        </div>
                        
                        <button
                            onClick={() => router.push('/properties/new')}
                            className="group flex items-center gap-4 px-12 py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-zinc-900/30 dark:shadow-white/10 hover:scale-105 active:scale-95 transition-all self-start lg:self-end"
                        >
                            + {t('property.landlord.add', undefined, 'Add Property')}
                        </button>
                    </div>

                    {/* Filters - High Fidelity */}
                    <div className="flex items-center justify-between mb-16 px-2">
                        <div className="flex p-2 bg-zinc-100/50 dark:bg-zinc-800/30 backdrop-blur-2xl rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-700/30 shadow-inner">
                            {['all', 'draft', 'active'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilter(status as any)}
                                    className={`px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-700 ${
                                        filter === status 
                                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xl scale-100' 
                                        : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-teal-500" />
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{properties.length} Listings</span>
                        </div>
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                            {[1, 2, 3, 4, 5, 6].map(i => <PropertyCardSkeleton key={i} />)}
                        </div>
                    ) : properties.length === 0 ? (
                        <div className="py-40 text-center glass-card border-none rounded-[3rem] shadow-2xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none"></div>
                            <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
                                <Building className="w-10 h-10 text-zinc-300" />
                            </div>
                            <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter">{t('property.landlord.emptyTitle', undefined, 'Portfolio Empty')}</h3>
                            <p className="text-lg text-zinc-500 font-medium max-w-sm mx-auto leading-relaxed mb-12">{t('property.landlord.emptyDesc', undefined, 'Start by adding your first listing to the platform to begin your journey.')}</p>
                            <button 
                                onClick={() => router.push('/properties/new')} 
                                className="px-12 py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all"
                            >
                                {t('property.landlord.add', undefined, 'Create Listing')} →
                            </button>
                        </div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden" animate="show"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12"
                        >
                            {properties.map((property) => (
                                <motion.div 
                                    variants={itemVariants} 
                                    key={property.id} 
                                    className="group glass-card !p-0 overflow-hidden flex flex-col border-zinc-100 dark:border-zinc-800/50 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] transition-all duration-1000 rounded-[3rem] relative"
                                >
                                    <div className="aspect-[16/11] bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                                        {property.photos?.[0] ? (
                                            <img src={resolveMediaUrl(property.photos[0].url)} alt={property.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-300 font-black italic uppercase tracking-widest text-xs">No Imagery</div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                        <div className="absolute top-6 right-6">
                                            <div className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl shadow-2xl ${property.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                                                {property.status}
                                            </div>
                                        </div>
                                        <div className="absolute bottom-6 left-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-700">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-white tracking-tighter">€{property.monthly_rent}</span>
                                                <span className="text-[10px] text-zinc-300 font-black uppercase tracking-widest">/mo</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-10 flex flex-col flex-1">
                                        <div className="flex justify-between items-start mb-6">
                                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white truncate tracking-tighter uppercase pr-4 group-hover:text-teal-500 transition-colors duration-500">{property.title}</h3>
                                            <div className="text-right flex flex-col items-end">
                                                <p className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter">€{property.monthly_rent}</p>
                                                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-1">Investment</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 mb-10">
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{property.city}</p>
                                            <div className="w-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{property.bedrooms} Bed</p>
                                        </div>
                                        
                                        {/* Verification Status - Refined */}
                                        <div className="mb-10">
                                            {property.ownership_verified ? (
                                                <div className="flex items-center gap-3 text-[10px] font-black text-teal-600 dark:text-teal-400 bg-teal-500/5 px-5 py-3 rounded-2xl border border-teal-500/20 uppercase tracking-[0.2em] shadow-sm">
                                                    <div className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                                                    Verified Registry
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setVerifyingProperty(property.id)}
                                                    className="w-full flex items-center justify-center gap-3 text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/5 px-5 py-3 rounded-2xl border border-amber-500/20 uppercase tracking-[0.2em] hover:bg-amber-500/10 transition-all group/btn"
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                    Validate Ownership
                                                </button>
                                            )}
                                        </div>

                                        <div className="mt-auto grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => router.push(`/properties/${property.id}/edit`)}
                                                className="py-4 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition-all duration-500 shadow-sm"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => router.push(`/properties/${property.id}`)}
                                                className="py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-zinc-900/20 dark:shadow-white/5"
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

                {/* Verification Modal - High Fidelity */}
                <AnimatePresence>
                    {verifyingProperty && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setVerifyingProperty(null)}
                                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-2xl"
                            />
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 40 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 40 }}
                                className="relative bg-white dark:bg-zinc-900 rounded-[3rem] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.5)] max-w-2xl w-full max-h-[90vh] overflow-hidden border border-white/20 dark:border-zinc-800"
                            >
                                <div className="p-16">
                                    <div className="mb-12 text-center">
                                        <h2 className="text-4xl font-black tracking-tighter uppercase mb-4">Ownership Validation</h2>
                                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">Please upload official property deeds or utility bills to verify this listing.</p>
                                    </div>
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
