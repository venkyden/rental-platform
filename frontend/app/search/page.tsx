'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/lib/SegmentContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';

// Define property interface based on API response
interface Property {
    id: string;
    title: string;
    city: string;
    monthly_rent: number;
    charges?: number;
    charges_included?: boolean;
    deposit?: number;
    bedrooms: number;
    property_type: string;
    furnished: boolean;
    size_sqm: number;
    photos: { url: string }[];
    amenities: string[];
    status: string;
    is_caf_eligible?: boolean;
    dpe_rating?: string;
    guarantor_required?: boolean;
}

export default function SearchPage() {
    const { config, loading: segmentLoading } = useSegment();
    const router = useRouter();

    // Data State
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filter States (Unified - All available to everyone)
    const [priceRange, setPriceRange] = useState<number>(3000);
    const [location, setLocation] = useState('');
    const [furnished, setFurnished] = useState(false);
    const [colocation, setColocation] = useState(false);

    // Initialize defaults based on Segment Context
    useEffect(() => {
        if (!config) return;

        const mode = config.settings.default_filter_mode;

        if (mode === 'budget') {
            setPriceRange(800);
            setColocation(true);
        } else if (mode === 'location') {
            setPriceRange(2500);
        } else if (mode === 'term') {
            setFurnished(true);
            setPriceRange(3000);
        }
    }, [config]);

    // Fetch Properties whenever filters change
    useEffect(() => {
        const fetchProperties = async () => {
            try {
                setLoading(true);
                setError('');

                const params: any = {
                    status: 'active',
                    max_rent: priceRange,
                };

                if (location.length > 2) {
                    params.city = location;
                }

                if (furnished) {
                    params.furnished = true;
                }

                if (colocation) {
                    // Pass amenity filter based on backend logic
                    params.amenities = ['colocation'];
                }

                const response = await apiClient.client.get('/properties', { params });
                setProperties(response.data);
            } catch (err) {
                console.error('Error fetching properties:', err);
                setError('Impossible de charger les annonces.');
            } finally {
                setLoading(false);
            }
        };

        // Debounce fetch to avoid too many calls while sliding
        const timeoutId = setTimeout(() => {
            fetchProperties();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [priceRange, location, furnished, colocation]);

    if (segmentLoading) return <div className="p-8 text-center">Chargement du profil...</div>;

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-900">
                                ← Dashboard
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">Trouver un logement</h1>
                        </div>
                        <div className="text-sm text-gray-500">
                            Mode: <span className="font-medium text-gray-900 capitalize">{config?.settings.default_filter_mode || 'Standard'}</span>
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    {/* Unified Filter Bar */}
                    <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Localisation</label>
                            <input
                                type="text"
                                placeholder="Paris, Lyon, Bordeaux..."
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>

                        <div className="w-48">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Budget Max: {priceRange}€</label>
                            <input
                                type="range"
                                min="300"
                                max="5000"
                                step="100"
                                value={priceRange}
                                onChange={(e) => setPriceRange(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        {/* Toggles */}
                        <div className="flex items-center gap-4 border-l pl-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={furnished}
                                    onChange={(e) => setFurnished(e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Meublé</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={colocation}
                                    onChange={(e) => setColocation(e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Colocation</span>
                            </label>
                        </div>

                        <button className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium opacity-50 cursor-not-allowed">
                            Recherche Auto...
                        </button>
                    </div>

                    {/* Results Grid */}
                    {loading ? (
                        <div className="text-center py-12 text-gray-500">Chargement des offres...</div>
                    ) : error ? (
                        <div className="text-center py-12 text-red-500">{error}</div>
                    ) : properties.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                            <div className="text-4xl mb-2">🔍</div>
                            <h3 className="text-lg font-medium text-gray-900">Aucun résultat</h3>
                            <p className="text-gray-500">Essayez d'élargir vos critères de recherche.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {properties.map((property) => (
                                <div key={property.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                                    <div className="h-48 bg-gray-200 relative">
                                        {property.photos?.[0] ? (
                                            <img src={property.photos[0].url} alt={property.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">🏠</div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-green-700">
                                            Disponible
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-gray-900 truncate pr-2">{property.title}</h3>
                                            <div className="text-right whitespace-nowrap">
                                                <span className="text-blue-600 font-bold">{property.monthly_rent}€</span>
                                                <span className={`ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${property.charges_included ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {property.charges_included ? 'CC' : 'HC'}
                                                </span>
                                                {!property.charges_included && property.charges && (
                                                    <div className="text-xs text-gray-500">+{property.charges}€ charges</div>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-500 mb-2">{property.city} • {property.size_sqm}m² • {property.bedrooms}ch</p>
                                        {property.deposit && (
                                            <p className="text-xs text-gray-400 mb-2">Dépôt: {property.deposit}€</p>
                                        )}
                                        <div className="flex gap-2 flex-wrap">
                                            {property.dpe_rating && (
                                                <span className={`px-2 py-1 rounded text-xs font-bold text-white ${property.dpe_rating === 'A' ? 'bg-green-500' :
                                                        property.dpe_rating === 'B' ? 'bg-lime-500' :
                                                            property.dpe_rating === 'C' ? 'bg-yellow-400 !text-gray-800' :
                                                                property.dpe_rating === 'D' ? 'bg-amber-400 !text-gray-800' :
                                                                    property.dpe_rating === 'E' ? 'bg-orange-500' :
                                                                        property.dpe_rating === 'F' ? 'bg-red-500' :
                                                                            'bg-red-700'
                                                    }`}>DPE {property.dpe_rating}</span>
                                            )}
                                            {property.furnished && <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">Meublé</span>}
                                            {!property.furnished && <span className="px-2 py-1 bg-gray-50 text-gray-500 rounded text-xs">Non meublé</span>}
                                            {property.amenities?.includes('colocation') && <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">Coloc OK</span>}
                                            {property.is_caf_eligible && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">CAF ✅</span>}
                                            {property.guarantor_required ? (
                                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">🛡️ Garant requis</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs">✅ Sans garant</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </ProtectedRoute>
    );
}
