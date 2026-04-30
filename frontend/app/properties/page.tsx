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
            alert('Error deleting property');
        }
    };

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <header className="mb-8 p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('property.landlord.title')}</h1>
                    <div className="flex gap-3">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            ← {isAuthenticated ? t('dashboard.title', undefined, 'Dashboard') : t('navbar.home', undefined, 'Home')}
                        </button>
                        <button
                            onClick={() => router.push('/properties/new')}
                            className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-white font-semibold rounded-xl hover:shadow-sm hover: transform hover:-translate-y-0.5 transition-all"
                        >
                            {t('property.landlord.newProperty')}
                        </button>
                    </div>
                </header>

                <main className="">
                    {/* Filters */}
                    <div className="mb-6 flex gap-2">
                        {['all', 'draft', 'active'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status as any)}
                                className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${filter === status
                                    ? 'bg-teal-600 text-white shadow-md '
                                    : 'bg-white/60 dark:bg-zinc-800/60 backdrop-blur-md text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-zinc-800/80 border border-white/20'
                                    }`}
                            >
                                {t(`property.landlord.${status}` as any)}
                            </button>
                        ))}
                    </div>

                    {/* Properties List */}
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
                        </div>
                    ) : properties.length === 0 ? (
                        <div className="py-12">
                            <EmptyState
                                icon=""
                                title={t('property.landlord.emptyTitle')}
                                description={t('property.landlord.emptyDesc')}
                                actionLabel={t('property.landlord.createBtn')}
                                onAction={() => router.push('/properties/new')}
                                layout="transparent"
                            />
                        </div>
                    ) : (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {properties.map((property) => (
                                <motion.div variants={itemVariants} key={property.id} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] overflow-hidden hover:shadow-sm transition-all hover:-translate-y-1 flex flex-col group p-2">
                                    {/* Property Image */}
                                    <div className="h-48 bg-zinc-100 dark:bg-zinc-800 dark:from-zinc-800 dark:to-zinc-700 relative rounded-2xl overflow-hidden m-2">
                                        {property.photos && property.photos.length > 0 ? (
                                            <img
                                                src={resolveMediaUrl(property.photos[0].url)}
                                                alt={property.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-400">
                                                <span className="text-6xl"></span>
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3">
                                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md shadow-sm ${property.status === 'active'
                                                ? 'bg-emerald-500/90 text-white'
                                                : 'bg-amber-500/90 text-white'
                                                }`}>
                                                {property.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Property Info */}
                                    <div className="p-5 pt-3 flex flex-col flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">
                                            {property.title}
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 font-medium">
                                             {property.city}
                                        </p>
                                        <div className="flex items-center justify-between mb-6 mt-auto">
                                            <div translate="no" className="notranslate text-2xl font-black text-teal-600 dark:text-teal-400">
                                                €{property.monthly_rent}
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">/{t('property.price.perMonthShort', undefined, 'mo')}</span>
                                            </div>
                                            <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                                                ️ {property.bedrooms} {t(property.bedrooms !== 1 ? 'property.bedrooms' : 'property.bedroom')}
                                            </div>
                                        </div>

                                        {/* Ownership Verification Badge */}
                                        <div className="mb-4">
                                            {property.ownership_verified ? (
                                                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/30">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    {t('property.landlord.ownershipVerified')}
                                                </div>
                                            ) : (
                                                 <button 
                                                    onClick={() => setVerifyingProperty(property.id)}
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 px-2.5 py-1.5 rounded-lg border border-orange-200 dark:border-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors w-full justify-center"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    {t('property.landlord.verifyPrompt')}
                                                </button>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => router.push(`/properties/${property.id}/edit`)}
                                                className="flex-1 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 font-semibold transition-colors"
                                            >
                                                {t('property.actions.edit')}
                                            </button>
                                            <button
                                                onClick={() => router.push(`/properties/${property.id}`)}
                                                className="flex-1 py-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 font-semibold transition-colors"
                                            >
                                                {t('property.actions.view', undefined, 'View')}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(property.id)}
                                                className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 font-semibold transition-colors"
                                            >
                                                ️
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </main>

                {/* Verification Modal */}
                {verifyingProperty && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-2"
                        >
                            <div className="flex justify-end p-2 pb-0">
                                <button 
                                    onClick={() => setVerifyingProperty(null)}
                                    className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="px-6 pb-8">
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
            </PremiumLayout>
        </ProtectedRoute>
    );
}
