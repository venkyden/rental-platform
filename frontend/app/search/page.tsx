'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/lib/SegmentContext';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { BRAND } from '@/lib/constants';
import { motion } from 'framer-motion';
import PremiumLayout from '@/components/PremiumLayout';
import { useLanguage } from '@/lib/LanguageContext';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { PropertyCardSkeleton } from '@/components/SkeletonLoaders';

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
    dpe_rating?: string;
    guarantor_required?: boolean;
}

export default function SearchPage() {
    const { config, loading: segmentLoading } = useSegment();
    const { user, loading: authLoading } = useAuth();
    const { t } = useLanguage();
    const isAuthenticated = !!user;
    const router = useRouter();

    // Data State
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filter States
    const [priceRange, setPriceRange] = useState<number>(3000);
    const [location, setLocation] = useState('');
    const [furnished, setFurnished] = useState(false);
    const [colocation, setColocation] = useState(false);
    const [cafOnly, setCafOnly] = useState(false);

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

    useEffect(() => {
        const fetchProperties = async () => {
            try {
                setLoading(true);
                setError('');
                const params: any = { status: 'active', max_rent: priceRange };
                if (location.length > 2) params.city = location;
                if (furnished) params.furnished = true;
                if (cafOnly) params.caf_eligible = true;
                if (colocation) params.amenities = ['colocation'];
                const response = await apiClient.client.get('/properties', { params });
                setProperties(response.data);
            } catch (err) {
                setError(t('search.status.error', undefined, undefined));
            } finally {
                setLoading(false);
            }
        };
        const timeoutId = setTimeout(() => fetchProperties(), 500);
        return () => clearTimeout(timeoutId);
    }, [priceRange, location, furnished, colocation, cafOnly]);

    if (segmentLoading || authLoading) return <div className="p-8 text-center text-zinc-500">{t('search.status.loading', undefined, undefined)}</div>;

    return (
        <PremiumLayout withNavbar={true}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Search Header */}
                <div className="mb-12">
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">
                        {t('search.subtitle', undefined, 'Find your next home in France')}
                    </h1>
                    <p className="text-lg text-zinc-500 dark:text-zinc-400 font-medium">
                        {t('search.resultsCount', { count: properties.length }, `Explore ${properties.length} curated listings tailored to your preferences.`)}
                    </p>
                </div>

                {/* Filter Bar */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card !p-3 mb-16 flex flex-wrap lg:flex-nowrap items-center gap-2 border-white/40 dark:border-zinc-800/50 shadow-2xl rounded-[2.5rem]"
                >
                    <div className="flex-1 min-w-[240px] px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl flex items-center gap-3 group border border-transparent focus-within:border-teal-500/30 transition-all">
                        <Search className="w-5 h-5 text-zinc-400" />
                        <input
                            type="text"
                            placeholder={t('search.filters.locationPlaceholder', undefined, 'Enter city...')}
                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:font-medium"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 min-w-[200px] px-6 py-2">
                        <div className="flex justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{t('search.filters.budget', undefined, 'Budget')}</span>
                            <span className="text-[10px] font-black uppercase text-teal-600 dark:text-teal-400">{priceRange}€</span>
                        </div>
                        <input
                            type="range" min="300" max="5000" step="100" value={priceRange}
                            onChange={(e) => setPriceRange(Number(e.target.value))}
                            className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full appearance-none cursor-pointer accent-teal-600"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setFurnished(!furnished)}
                            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${furnished ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400'}`}
                        >
                            {t('search.filters.furnished', undefined, 'Furnished')}
                        </button>
                        <button 
                            onClick={() => setColocation(!colocation)}
                            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${colocation ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400'}`}
                        >
                            {t('search.filters.colocation', undefined, 'Colocation')}
                        </button>
                        <button 
                            onClick={() => setCafOnly(!cafOnly)}
                            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${cafOnly ? 'bg-teal-500 text-white shadow-lg' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400'}`}
                        >
                            {t('search.filters.caf', undefined, 'CAF')}
                        </button>
                    </div>

                    <button className="btn-primary !rounded-2xl !py-3 !px-8 text-xs uppercase tracking-widest ml-auto">
                        {t('search.filters.searchButton', undefined, 'Search')}
                    </button>
                </motion.div>

                {/* Results */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {[1, 2, 3, 4, 5, 6].map(i => <PropertyCardSkeleton key={i} />)}
                    </div>
                ) : properties.length === 0 ? (
                    <div className="py-32 text-center glass-card border-none">
                        <h3 className="text-2xl font-black mb-2">{t('search.status.noResults', undefined, 'No matches found')}</h3>
                        <p className="text-zinc-500 font-medium">{t('search.status.noResultsDesc', undefined, 'Try adjusting your filters to see more results.')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {properties.map((property) => (
                            <motion.div 
                                key={property.id} 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="group glass-card !p-0 overflow-hidden flex flex-col border-white/40 dark:border-zinc-800/50 hover:shadow-2xl transition-all duration-500"
                            >
                                <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                                    {property.photos?.[0] ? (
                                        <img src={resolveMediaUrl(property.photos[0].url)} alt={property.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-300 font-black text-2xl italic">ROOMIVO</div>
                                    )}
                                    <div className="absolute top-4 left-4 flex gap-2">
                                        {property.dpe_rating && (
                                            <div className="px-3 py-1 bg-zinc-900/80 backdrop-blur-md text-white text-[10px] font-black rounded-lg">DPE {property.dpe_rating}</div>
                                        )}
                                        {property.furnished && (
                                            <div className="px-3 py-1 bg-white/80 backdrop-blur-md text-zinc-900 text-[10px] font-black rounded-lg">
                                                {t('search.property.furnished', undefined, 'FURNISHED')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="absolute bottom-4 left-6">
                                        <p className="text-3xl font-black text-white tracking-tighter">
                                            {property.monthly_rent}€<span className="text-sm font-medium text-white/70 ml-1">/{t('search.property.mo', undefined, 'mo')}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="p-8 flex flex-col flex-1">
                                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 truncate tracking-tight">{property.title}</h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm uppercase tracking-wider mb-6">
                                        {property.city} • {property.size_sqm}m² • {property.bedrooms} {t('search.property.bed', undefined, 'Bed')}
                                    </p>
                                    
                                    <div className="mt-auto pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                        <div className="flex -space-x-2">
                                            {property.amenities?.slice(0, 3).map((amenity, i) => (
                                                <div key={i} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] text-zinc-400 font-black uppercase">
                                                    {amenity.charAt(0)}
                                                </div>
                                            ))}
                                            {property.amenities?.length > 3 && (
                                                <div className="w-8 h-8 rounded-full bg-teal-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] text-white font-black">
                                                    +{property.amenities.length - 3}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => router.push(`/properties/${property.id}`)}
                                            className="text-xs font-black uppercase tracking-widest text-teal-600 hover:text-teal-500 transition-colors"
                                        >
                                            {t('search.property.viewDetails', undefined, 'View Details')} →
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </PremiumLayout>
    );
}
