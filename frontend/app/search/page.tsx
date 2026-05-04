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
import { Search, MapPin, Maximize, Filter, X, ChevronDown, Sparkles } from 'lucide-react';

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
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 relative z-10">
                {/* Search Header - Ultra Premium */}
                <div className="mb-20 space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase tracking-[0.2em]">
                        {t('search.discovery', undefined, 'Marketplace Discovery')}
                    </div>
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
                        <div className="max-w-4xl">
                            <h1 className="text-6xl sm:text-9xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-500 uppercase leading-[0.8]">
                                {t('search.subtitle', undefined, 'Your Next Home')}
                            </h1>
                        </div>
                        <div className="lg:text-right">
                            <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium max-w-sm ml-auto leading-relaxed">
                                {t('search.resultsCount', { count: properties.length }, `Explore ${properties.length} curated listings tailored to your preferences.`)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filter Bar - High Fidelity */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card !p-3 mb-24 flex flex-col lg:flex-row items-stretch lg:items-center gap-4 border-zinc-100 dark:border-zinc-800/50 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] rounded-[3rem] sticky top-24 z-50"
                >
                    <div className="flex-[2] min-w-[240px] px-8 py-5 bg-zinc-100/50 dark:bg-zinc-800/30 rounded-[2rem] flex items-center gap-6 group border border-transparent focus-within:border-teal-500/30 transition-all shadow-inner">
                        <Search className="w-6 h-6 text-zinc-400 group-hover:text-teal-500 transition-colors" />
                        <input
                            type="text"
                            placeholder={t('search.filters.locationPlaceholder', undefined, 'Where would you like to live?')}
                            className="w-full bg-transparent border-none focus:ring-0 text-xs font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:font-black placeholder:tracking-[0.2em]"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 min-w-[200px] px-8 py-4 bg-zinc-100/50 dark:bg-zinc-800/30 rounded-[2rem] shadow-inner">
                        <div className="flex justify-between mb-2 px-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{t('search.filters.budget', undefined, 'Budget')}</span>
                            <span className="text-xs font-black text-teal-600 dark:text-teal-400 tracking-tighter">€{priceRange}</span>
                        </div>
                        <input
                            type="range" min="300" max="5000" step="100" value={priceRange}
                            onChange={(e) => setPriceRange(Number(e.target.value))}
                            className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-teal-500"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 p-1">
                        {[
                            { state: furnished, setter: setFurnished, label: t('search.filters.furnished', undefined, 'Furnished') },
                            { state: colocation, setter: setColocation, label: t('search.filters.colocation', undefined, 'Colocation') },
                            { state: cafOnly, setter: setCafOnly, label: t('search.filters.caf', undefined, 'CAF') }
                        ].map((filter, i) => (
                            <button 
                                key={i}
                                onClick={() => filter.setter(!filter.state)}
                                className={`px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-700 ${filter.state ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xl scale-105' : 'bg-zinc-100/50 dark:bg-zinc-800/30 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:scale-105'}`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>

                    <button className="flex items-center justify-center gap-4 px-12 py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all group overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Filter className="w-4 h-4 relative z-10" />
                        <span className="relative z-10">{t('search.filters.searchButton', undefined, 'Find')}</span>
                    </button>
                </motion.div>

                {/* Results - Ultra High Fidelity Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
                        {[1, 2, 3, 4, 5, 6].map(i => <PropertyCardSkeleton key={i} />)}
                    </div>
                ) : properties.length === 0 ? (
                    <div className="py-40 text-center glass-card border-none rounded-[4rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none"></div>
                        <div className="w-32 h-32 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-12 shadow-inner">
                            <Sparkles className="w-12 h-12 text-zinc-300" />
                        </div>
                        <h3 className="text-4xl font-black mb-6 uppercase tracking-tighter">{t('search.status.noResults', undefined, 'Market Vacant')}</h3>
                        <p className="text-xl text-zinc-500 font-medium max-w-sm mx-auto leading-relaxed mb-12">{t('search.status.noResultsDesc', undefined, 'Try expanding your search parameters to discover hidden gems.')}</p>
                        <button 
                            onClick={() => { setLocation(''); setPriceRange(3000); }}
                            className="px-16 py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all"
                        >
                            Reset Exploration
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
                        {properties.map((property, idx) => (
                            <motion.div 
                                key={property.id} 
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="group glass-card !p-0 overflow-hidden flex flex-col border-zinc-100 dark:border-zinc-800/50 hover:shadow-[0_60px_120px_-20px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_60px_120px_-20px_rgba(0,0,0,0.5)] transition-all duration-1000 rounded-[3.5rem] relative"
                            >
                                <div className="aspect-[16/12] bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                                    {property.photos?.[0] ? (
                                        <img 
                                            src={resolveMediaUrl(property.photos[0].url)} 
                                            alt={property.title} 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700 font-black text-3xl italic tracking-tighter">ROOMIVO</div>
                                    )}
                                    
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                                    
                                    {/* Top Badges */}
                                    <div className="absolute top-8 left-8 flex flex-col gap-3">
                                        {property.dpe_rating && (
                                            <div className={`px-5 py-2 backdrop-blur-3xl text-white text-[10px] font-black rounded-2xl border border-white/20 shadow-2xl uppercase tracking-widest ${
                                                property.dpe_rating === 'A' ? 'bg-emerald-500/80' : 
                                                property.dpe_rating === 'B' ? 'bg-lime-500/80' : 
                                                'bg-zinc-900/80'
                                            }`}>
                                                DPE {property.dpe_rating}
                                            </div>
                                        )}
                                        {property.furnished && (
                                            <div className="px-5 py-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-3xl text-zinc-900 dark:text-white text-[10px] font-black rounded-2xl border border-white/20 dark:border-zinc-800/50 shadow-2xl uppercase tracking-widest">
                                                {t('search.property.furnished', undefined, 'Premium Furnished')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Price Tag Overlay */}
                                    <div className="absolute bottom-8 left-10">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-5xl font-black text-white tracking-tighter">€{property.monthly_rent}</span>
                                            <span className="text-xs font-black text-white/60 uppercase tracking-[0.3em] ml-2">{t('search.property.mo', undefined, '/ Month')}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-10 md:p-14 flex flex-col flex-1">
                                    <h3 className="text-3xl font-black text-zinc-900 dark:text-white mb-4 truncate tracking-tighter uppercase group-hover:text-teal-500 transition-colors duration-500">
                                        {property.title}
                                    </h3>
                                    
                                    <div className="flex items-center gap-4 mb-12">
                                        <div className="flex items-center gap-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/30">
                                            <MapPin className="w-4 h-4 text-zinc-400" />
                                            <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{property.city}</span>
                                        </div>
                                        <div className="flex items-center gap-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/30">
                                            <Maximize className="w-4 h-4 text-zinc-400" />
                                            <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{property.size_sqm}m²</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-auto pt-10 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between">
                                        <div className="flex -space-x-4">
                                            {(property.amenities || []).slice(0, 4).map((amenity: any, i: number) => (
                                                <div 
                                                    key={i} 
                                                    className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border-[3px] border-zinc-50 dark:border-zinc-900 flex items-center justify-center shadow-xl group-hover:scale-110 transition-all duration-500 cursor-help relative z-[10]"
                                                    title={amenity}
                                                >
                                                    <div className="w-6 h-6 text-teal-500 flex items-center justify-center font-black text-[11px] italic">
                                                        {amenity.charAt(0).toUpperCase()}
                                                    </div>
                                                </div>
                                            ))}
                                            {(property.amenities || []).length > 4 && (
                                                <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-white border-[3px] border-zinc-50 dark:border-zinc-900 flex items-center justify-center shadow-xl relative z-[5]">
                                                    <span className="text-[10px] font-black text-white dark:text-zinc-900">
                                                        +{(property.amenities || []).length - 4}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <button 
                                            onClick={() => router.push(`/properties/${property.id}`)}
                                            className="group/btn relative px-10 py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] transition-all duration-700 hover:scale-105 active:scale-95 shadow-2xl shadow-zinc-900/20 dark:shadow-white/5 overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-teal-500 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-700" />
                                            <span className="relative z-10 group-hover/btn:text-white transition-colors">
                                                {t('search.property.viewDetails', undefined, 'Explore')} →
                                            </span>
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
