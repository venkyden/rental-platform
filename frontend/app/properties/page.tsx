'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import EmptyState from '@/components/EmptyState';
import { apiClient } from '@/lib/api';
import { motion, Variants } from 'framer-motion';

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
}

export default function PropertiesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'active'>('all');

    useEffect(() => {
        loadProperties();
    }, [filter]);

    const loadProperties = async () => {
        try {
            const response = await apiClient.client.get('/properties', {
                params: {
                    landlord_id: user?.id,
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
        if (!confirm('Are you sure you want to delete this property?')) return;

        try {
            await apiClient.client.delete(`/properties/${id}`);
            loadProperties();
        } catch (error) {
            alert('Error deleting property');
        }
    };

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <header className="mb-8 p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Properties</h1>
                    <div className="flex gap-3">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            ← Dashboard
                        </button>
                        <button
                            onClick={() => router.push('/properties/new')}
                            className="px-6 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transform hover:-translate-y-0.5 transition-all"
                        >
                            + New Property
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
                                    ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                                    : 'bg-white/60 dark:bg-zinc-800/60 backdrop-blur-md text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-zinc-800/80 border border-white/20'
                                    }`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
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
                                icon="🏠"
                                title="No properties yet"
                                description="Create your first property listing to get started and manage your rentals."
                                actionLabel="Create Property"
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
                                <motion.div variants={itemVariants} key={property.id} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 flex flex-col group p-2">
                                    {/* Property Image */}
                                    <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 relative rounded-2xl overflow-hidden m-2">
                                        {property.photos && property.photos.length > 0 ? (
                                            <img
                                                src={property.photos[0].url}
                                                alt={property.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-400">
                                                <span className="text-6xl">🏠</span>
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
                                            📍 {property.city}
                                        </p>
                                        <div className="flex items-center justify-between mb-6 mt-auto">
                                            <div className="text-2xl font-black text-teal-600 dark:text-teal-400">
                                                €{property.monthly_rent}
                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">/mo</span>
                                            </div>
                                            <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                                                🛏️ {property.bedrooms} bed{property.bedrooms !== 1 ? 's' : ''}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => router.push(`/properties/${property.id}/edit`)}
                                                className="flex-1 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 font-semibold transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => router.push(`/properties/${property.id}`)}
                                                className="flex-1 py-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 font-semibold transition-colors"
                                            >
                                                View
                                            </button>
                                            <button
                                                onClick={() => handleDelete(property.id)}
                                                className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 font-semibold transition-colors"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </main>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
