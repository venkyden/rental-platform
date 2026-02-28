'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/lib/SegmentContext';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { BRAND } from '@/lib/constants';
import { motion } from 'framer-motion';
import PremiumLayout from '@/components/PremiumLayout';

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
    const { user, loading: authLoading } = useAuth();
    const isAuthenticated = !!user;
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

    if (segmentLoading || authLoading) return <div className="p-8 text-center text-zinc-500">Loading properties...</div>;

    return (
        <PremiumLayout>
            {/* Header */}
            <header className="mb-8 p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push(isAuthenticated ? '/dashboard' : '/')} className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center gap-2 transition-colors">
                        ← {isAuthenticated ? 'Dashboard' : 'Home'}
                    </button>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-zinc-400"
                    >
                        {BRAND.tagline}
                    </motion.h1>
                </div>
                {isAuthenticated && (
                    <div className="text-sm text-zinc-500 hover:text-teal-600 transition-colors">
                        Mode: <span className="font-medium text-slate-900 dark:text-teal-400 capitalize">{config?.settings.default_filter_mode || 'Standard'}</span>
                    </div>
                )}
                {!isAuthenticated && (
                    <div className="flex gap-4">
                        <button onClick={() => router.push('/auth/login')} className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 px-4 py-2 bg-teal-50 dark:bg-teal-900/30 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors">Log In</button>
                        <button onClick={() => router.push('/auth/register')} className="text-sm font-medium px-6 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">Sign Up</button>
                    </div>
                )}
            </header>

            <main className="">
                {/* Unified Filter Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/50 dark:border-white/10 p-6 mb-8 flex flex-wrap gap-6 items-center"
                >
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Location</label>
                        <input
                            type="text"
                            placeholder="Paris, Lyon, Bordeaux..."
                            className="w-full border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 rounded-xl px-4 py-3 shadow-sm focus:ring-teal-500 focus:border-teal-500 text-slate-900 dark:text-white transition-all backdrop-blur-sm"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    <div className="w-64">
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Max Budget: <span className="text-teal-600 dark:text-teal-400">{priceRange}€</span></label>
                        <input
                            type="range"
                            min="300"
                            max="5000"
                            step="100"
                            value={priceRange}
                            onChange={(e) => setPriceRange(Number(e.target.value))}
                            className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-teal-600"
                        />
                    </div>

                    <div className="flex items-center gap-6 border-l border-zinc-200 dark:border-zinc-700 pl-6 h-12">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={furnished}
                                onChange={(e) => setFurnished(e.target.checked)}
                                className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 transition-colors"
                            />
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">Furnished</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={colocation}
                                onChange={(e) => setColocation(e.target.checked)}
                                className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 transition-colors"
                            />
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">Colocation</span>
                        </label>
                    </div>

                    <button className="ml-auto px-8 py-3 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-100 font-bold transition-colors shadow-md">
                        Search
                    </button>
                </motion.div>

                {/* Results Grid */}
                {loading ? (
                    <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">Loading listings...</div>
                ) : error ? (
                    <div className="text-center py-12 text-red-500">{error}</div>
                ) : properties.length === 0 ? (
                    <div className="text-center py-12 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700">
                        <div className="text-4xl mb-2">🔍</div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No results found</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">Try expanding your search criteria.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {properties.map((property) => (
                            <div key={property.id} className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 relative group p-2 flex flex-col">
                                {!isAuthenticated && (
                                    <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[4px] z-10 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl">
                                        <button onClick={() => router.push('/auth/login')} className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-lg transition-transform transform hover:scale-105 mb-2">
                                            Log in to View Details
                                        </button>
                                    </div>
                                )}
                                <div className="h-48 bg-zinc-200 dark:bg-zinc-800 relative rounded-2xl overflow-hidden m-2">
                                    {property.photos?.[0] ? (
                                        <img src={property.photos[0].url} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600 text-4xl">🏠</div>
                                    )}
                                    <div className="absolute top-3 right-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-teal-700 dark:text-teal-400 shadow-sm">
                                        Available
                                    </div>
                                </div>
                                <div className="p-5 pt-3 flex flex-col flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate pr-2">{property.title}</h3>
                                        <div className="text-right whitespace-nowrap">
                                            <span className="text-teal-600 dark:text-teal-400 font-black text-xl">{property.monthly_rent}€</span>
                                            <span className={`ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${property.charges_included ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                                {property.charges_included ? 'CC' : 'HC'}
                                            </span>
                                            {!property.charges_included && property.charges && (
                                                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">+{property.charges}€ charges</div>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">{property.city} • {property.size_sqm}m² • {property.bedrooms} beds</p>
                                    {property.deposit && (
                                        <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-4">Deposit: {property.deposit}€</p>
                                    )}
                                    <div className="flex gap-2 flex-wrap mt-auto pt-2">
                                        {property.dpe_rating && (
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold text-white shadow-sm ${property.dpe_rating === 'A' ? 'bg-teal-500' :
                                                property.dpe_rating === 'B' ? 'bg-emerald-500' :
                                                    property.dpe_rating === 'C' ? 'bg-lime-400 !text-slate-800' :
                                                        property.dpe_rating === 'D' ? 'bg-amber-400 !text-slate-800' :
                                                            property.dpe_rating === 'E' ? 'bg-orange-500' :
                                                                property.dpe_rating === 'F' ? 'bg-red-500' :
                                                                    'bg-red-700'
                                                }`}>DPE {property.dpe_rating}</span>
                                        )}
                                        {property.furnished ? <span className="px-2 py-1 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg text-xs font-semibold shadow-sm border border-purple-100 dark:border-purple-900/50">Furnished</span> : <span className="px-2 py-1 bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 rounded-lg text-xs font-semibold shadow-sm">Unfurnished</span>}
                                        {property.amenities?.includes('colocation') && <span className="px-2 py-1 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 rounded-lg text-xs font-semibold shadow-sm border border-teal-100 dark:border-teal-900/50">Coloc OK</span>}
                                        {property.is_caf_eligible && <span className="px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-xs font-semibold shadow-sm border border-blue-100 dark:border-blue-900/50">CAF ✅</span>}
                                        {property.guarantor_required ? (
                                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg text-xs font-semibold shadow-sm border border-indigo-100 dark:border-indigo-900/50">🛡️ Guarantor Req.</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-lg text-xs font-semibold shadow-sm border border-emerald-100 dark:border-emerald-900/50">✅ No Guarantor</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </PremiumLayout>
    );
}
