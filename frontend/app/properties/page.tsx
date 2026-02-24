'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
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
            <div className="min-h-screen bg-gray-100">
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-gray-900">My Properties</h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-4 py-2 text-gray-700 hover:text-gray-900"
                            >
                                ← Dashboard
                            </button>
                            <button
                                onClick={() => router.push('/properties/new')}
                                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all"
                            >
                                + New Property
                            </button>
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    {/* Filters */}
                    <div className="mb-6 flex gap-2 px-4 sm:px-0">
                        {['all', 'draft', 'active'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status as any)}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Properties List */}
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
                                <motion.div variants={itemVariants} key={property.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow flex flex-col">
                                    {/* Property Image */}
                                    <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-300 relative">
                                        {property.photos && property.photos.length > 0 ? (
                                            <img
                                                src={property.photos[0].url}
                                                alt={property.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-400">
                                                <span className="text-6xl">🏠</span>
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${property.status === 'active'
                                                ? 'bg-green-500 text-white'
                                                : 'bg-yellow-500 text-white'
                                                }`}>
                                                {property.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Property Info */}
                                    <div className="p-5 flex flex-col flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2 truncate">
                                            {property.title}
                                        </h3>
                                        <p className="text-gray-600 text-sm mb-4">
                                            📍 {property.city}
                                        </p>
                                        <div className="flex items-center justify-between mb-5 mt-auto">
                                            <div className="text-2xl font-bold text-blue-600">
                                                €{property.monthly_rent}
                                                <span className="text-sm text-gray-500">/mo</span>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                🛏️ {property.bedrooms} bed{property.bedrooms !== 1 ? 's' : ''}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => router.push(`/properties/${property.id}/edit`)}
                                                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => router.push(`/properties/${property.id}`)}
                                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                            >
                                                View
                                            </button>
                                            <button
                                                onClick={() => handleDelete(property.id)}
                                                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
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
            </div>
        </ProtectedRoute>
    );
}
