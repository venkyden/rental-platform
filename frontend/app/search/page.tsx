'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/lib/SegmentContext';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import PremiumLayout from '@/components/PremiumLayout';
import { useLanguage } from '@/lib/LanguageContext';
import { PropertyCardSkeleton } from '@/components/SkeletonLoaders';
import { Search, Filter, X, ChevronDown, Sparkles, Map as MapIcon, Grid, Check, Heart } from 'lucide-react';
import SearchMap from '@/components/SearchMap';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ListingCard from '@/components/ListingCard';
import type { ListingSummary } from '@/lib/listingDisplay';

type Property = ListingSummary & {
    latitude?: number;
    longitude?: number;
    status?: string;
    deposit?: number;
    guarantor_required?: boolean;
};

function SearchContent() {
    const { config, loading: segmentLoading } = useSegment();
    const { user, loading: authLoading } = useAuth();
    const { t } = useLanguage();
    const isAuthenticated = !!user;
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';
    const initialTypology = searchParams.get('typology') || '';
    const initialFurnishedParam = searchParams.get('furnished'); // 'true' | 'false' | null
    const initialColocation = searchParams.get('colocation') === '1';
    const shouldReduceMotion = useReducedMotion();

    // Data State
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filter States
    const [priceRange, setPriceRange] = useState<number>(3000);
    const [location, setLocation] = useState(initialQuery);
    const [furnishedMode, setFurnishedMode] = useState<'' | 'furnished' | 'unfurnished'>(
        initialFurnishedParam === 'true' ? 'furnished' : initialFurnishedParam === 'false' ? 'unfurnished' : ''
    );
    const [typology, setTypology] = useState<string>(initialTypology);
    const [colocation, setColocation] = useState(initialColocation);
    const [cafOnly, setCafOnly] = useState(false);
    const [propertyType, setPropertyType] = useState<string>('');
    const [sortBy, setSortBy] = useState<string>('created_at');
    const [orderDir, setOrderDir] = useState<string>('desc');
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
    const [savedOnly, setSavedOnly] = useState(false);
    const ITEMS_PER_PAGE = 12;

    useEffect(() => {
        if (!config) return;
        // Deep-link params take precedence over segment defaults
        if (initialTypology || initialFurnishedParam || initialColocation) return;
        const mode = config.settings.default_filter_mode;
        if (mode === 'budget') {
            setPriceRange(800);
        } else if (mode === 'location') {
            setPriceRange(2500);
        } else if (mode === 'term') {
            setFurnishedMode('furnished');
            setPriceRange(3000);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config]);

    const fetchProperties = async (isLoadMore = false, currentCount = 0) => {
        try {
            if (!isLoadMore) {
                setLoading(true);
                setProperties([]);
            }
            setError('');
            const params: any = { 
                status: 'active', 
                max_rent: priceRange,
                skip: isLoadMore ? currentCount : 0,
                limit: ITEMS_PER_PAGE,
                sort_by: sortBy,
                order_direction: orderDir
            };
            if (location.length > 2) params.city = location;
            if (furnishedMode === 'furnished') params.furnished = true;
            if (furnishedMode === 'unfurnished') params.furnished = false;
            if (typology === 'studio') params.property_type = 'studio';
            else if (typology === 't1') params.rooms_count = 1;
            else if (typology === 't2') params.rooms_count = 2;
            else if (typology === 't3plus') params.rooms_count_min = 3;
            if (cafOnly) params.caf_eligible = true;
            if (propertyType && !(typology === 'studio')) params.property_type = propertyType;
            if (colocation) {
                params.colocation = '1';
            }
            
            const response = savedOnly 
                ? await apiClient.getSavedProperties(params)
                : await apiClient.getProperties(params);
            
            if (isLoadMore) {
                setProperties(prev => [...prev, ...response]);
            } else {
                setProperties(response);
            }
        } catch (err) {
            setError(t('search.status.error', undefined, undefined));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => fetchProperties(false), 500);
        return () => clearTimeout(timeoutId);
    }, [priceRange, location, furnishedMode, typology, colocation, cafOnly, propertyType, sortBy, orderDir, savedOnly]);

    const toggleSaveProperty = async (propertyId: string) => {
        if (!isAuthenticated) {
            router.push('/auth/login');
            return;
        }

        // Optimistic UI Update
        setProperties(prev => prev.map(p => 
            p.id === propertyId ? { ...p, is_saved: !p.is_saved } : p
        ));

        try {
            const property = properties.find(p => p.id === propertyId);
            if (property?.is_saved) {
                await apiClient.unsaveProperty(propertyId);
            } else {
                await apiClient.saveProperty(propertyId);
            }
        } catch (err) {
            // Revert on error
            setProperties(prev => prev.map(p => 
                p.id === propertyId ? { ...p, is_saved: !p.is_saved } : p
            ));
        }
    };

    const handleLoadMore = async () => {
        await fetchProperties(true, properties.length);
    };

    if (segmentLoading || authLoading) return <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">{t('search.status.loading', undefined, undefined)}</div>;

    return (
        <PremiumLayout withNavbar={true}>
            {/* Industry Grade Living Background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <motion.div 
                    animate={shouldReduceMotion ? undefined : { 
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                        x: [0, 50, 0],
                        y: [0, 30, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-zinc-900/5 rounded-full blur-[120px]"
                />
                <motion.div 
                    animate={shouldReduceMotion ? undefined : { 
                        scale: [1.2, 1, 1.2],
                        rotate: [0, -90, 0],
                        x: [0, -50, 0],
                        y: [0, -30, 0]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-zinc-900/5 rounded-full blur-[120px]"
                />
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 pointer-events-none"></div>
            </div>

            <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 relative z-10">
                {/* Search Header - Ultra Premium */}
                <div className="mb-20 space-y-8">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.2em] shadow-2xl"
                    >
                        {t('search.discovery', undefined, 'Marketplace Discovery')}
                    </motion.div>
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
                        <div className="max-w-4xl">
                            <motion.h1 
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-4xl sm:text-7xl lg:text-9xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 to-zinc-600 uppercase leading-[0.8]"
                            >
                                {user ? t('search.welcome_user', { name: user.full_name?.split(' ')[0] || 'Adventurer' }, `Your Next Home, ${user.full_name?.split(' ')[0] || 'Adventurer'}`) : t('search.subtitle', undefined, 'Your Next Home')}
                            </motion.h1>
                        </div>
                        <div className="lg:text-right">
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-base sm:text-lg lg:text-xl text-zinc-500 font-medium max-w-sm ml-auto leading-relaxed"
                            >
                                {t('search.resultsCount', { count: properties.length }, `Explore ${properties.length} curated listings tailored to your preferences.`)}
                            </motion.p>
                        </div>
                    </div>
                </div>

                {/* Filter Bar - High Fidelity / God Mode */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card !p-3 mb-24 flex flex-col gap-4 border-zinc-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] rounded-[3rem] sticky top-24 z-50"
                >
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
                        <div className="flex-[2] min-w-[320px] px-5 py-4 lg:px-8 lg:py-5 bg-zinc-100/50 rounded-[2rem] flex items-center gap-6 group border border-transparent focus-within:border-zinc-900 transition-all shadow-inner">
                            <Search className="w-6 h-6 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                            <input
                                type="text"
                                placeholder={t('search.filters.locationPlaceholder', undefined, 'Where would you like to live?')}
                                className="w-full bg-transparent border-none focus:ring-0 text-base md:text-xs font-black uppercase tracking-[0.1em] text-zinc-900 placeholder:text-zinc-400 placeholder:font-black placeholder:tracking-[0.1em]"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 min-w-[200px] px-8 py-4 bg-zinc-100/50 rounded-[2rem] shadow-inner">
                            <div className="flex justify-between mb-2 px-1">
                                <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{t('search.filters.budget', undefined, 'Budget')}</span>
                                <span className="text-xs font-black text-zinc-900 tracking-tighter">€{priceRange}</span>
                            </div>
                            <input
                                type="range" min="300" max="5000" step="100" value={priceRange}
                                onChange={(e) => setPriceRange(Number(e.target.value))}
                                className="w-full h-1 bg-zinc-200 rounded-full appearance-none cursor-pointer accent-zinc-900"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-3 p-1">
                            <select 
                                value={propertyType}
                                onChange={(e) => setPropertyType(e.target.value)}
                                className="px-8 py-4 bg-zinc-100/50 rounded-[1.5rem] text-base md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 border-none focus:ring-0 cursor-pointer hover:bg-zinc-100 transition-colors"
                            >
                                <option value="">{t('search.filters.allTypes', undefined, 'All Types')}</option>
                                <option value="apartment">{t('properties.new.types.apartment')}</option>
                                <option value="house">{t('properties.new.types.house')}</option>
                                <option value="studio">{t('properties.new.types.studio')}</option>
                                <option value="room">{t('properties.new.types.room')}</option>
                            </select>

                            <select 
                                value={`${sortBy}:${orderDir}`}
                                onChange={(e) => {
                                    const [field, dir] = e.target.value.split(':');
                                    setSortBy(field);
                                    setOrderDir(dir);
                                }}
                                className="px-8 py-4 bg-zinc-100/50 rounded-[1.5rem] text-base md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400 border-none focus:ring-0 cursor-pointer hover:bg-zinc-100 transition-colors"
                            >
                                <option value="created_at:desc">{t('search.sort.newest')}</option>
                                <option value="monthly_rent:asc">{t('search.sort.priceAsc')}</option>
                                <option value="monthly_rent:desc">{t('search.sort.priceDesc')}</option>
                                <option value="size_sqm:desc">{t('search.sort.sizeDesc')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 px-4 pb-2">
                        {[
                            { key: 'studio', label: 'Studio' },
                            { key: 't1', label: 'T1' },
                            { key: 't2', label: 'T2' },
                            { key: 't3plus', label: 'T3+' },
                        ].map((c) => (
                            <button
                                key={c.key}
                                onClick={() => setTypology(typology === c.key ? '' : c.key)}
                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all duration-700 ${typology === c.key ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-400 hover:text-zinc-600'}`}
                            >
                                {c.label}
                            </button>
                        ))}

                        <div className="h-6 w-px bg-zinc-200 mx-2 hidden sm:block" />

                        {[
                            { state: furnishedMode === 'furnished', setter: () => setFurnishedMode(furnishedMode === 'furnished' ? '' : 'furnished'), label: t('listing.furnished', undefined, 'Meublé') },
                            { state: furnishedMode === 'unfurnished', setter: () => setFurnishedMode(furnishedMode === 'unfurnished' ? '' : 'unfurnished'), label: t('listing.unfurnished', undefined, 'Vide') },
                            { state: colocation, setter: () => setColocation(!colocation), label: t('search.filters.colocation', undefined, 'Colocation') },
                            { state: cafOnly, setter: () => setCafOnly(!cafOnly), label: t('search.filters.caf', undefined, 'CAF') },
                            { state: savedOnly, setter: () => setSavedOnly(!savedOnly), label: t('search.filters.wishlist', undefined, 'Wishlist'), icon: Heart }
                        ].map((filter, i) => (
                            <button
                                key={i}
                                onClick={() => filter.setter()}
                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all duration-700 ${filter.state ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-400 hover:text-zinc-600'}`}
                            >
                                {filter.icon && <filter.icon className="w-3 h-3" />}
                                {filter.label}
                            </button>
                        ))}
                        
                        <div className="h-6 w-px bg-zinc-200 mx-2 hidden sm:block" />

                        <div className="flex bg-zinc-100 p-1 rounded-2xl ml-auto">
                            <button 
                                onClick={() => { 
                                    setLocation('');
                                    setPriceRange(3000);
                                    setPropertyType('');
                                    setFurnishedMode('');
                                    setTypology('');
                                    setCafOnly(false);
                                    setColocation(false);
                                    setSavedOnly(false);
                                }}
                                className="px-5 py-3 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/50 transition-all flex items-center gap-2 group"
                            >
                                <X className="w-3.5 h-3.5" />
                                <span className="text-xs font-black uppercase tracking-[0.2em]">{t('search.filters.resetExploration', undefined, 'Reset')}</span>
                            </button>
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-zinc-900 shadow-md text-white' : 'text-zinc-400'}`}
                            >
                                <Grid className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setViewMode('map')}
                                className={`p-3 rounded-xl transition-all ${viewMode === 'map' ? 'bg-zinc-900 shadow-md text-white' : 'text-zinc-400'}`}
                            >
                                <MapIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Results - Industry Grade Grid */}
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div 
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16"
                        >
                            {[1, 2, 3, 4, 5, 6].map(i => <PropertyCardSkeleton key={i} />)}
                        </motion.div>
                    ) : properties.length === 0 ? (
                        <motion.div 
                            key="no-results"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="py-40 text-center glass-card border-none rounded-[4rem] shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none"></div>
                            <div className="w-32 h-32 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-12 shadow-inner">
                                <Sparkles className="w-12 h-12 text-zinc-300" />
                            </div>
                            <h3 className="text-4xl font-black mb-6 uppercase tracking-tighter">{t('search.status.noResults', undefined, 'Market Vacant')}</h3>
                            <p className="text-xl text-zinc-500 font-medium max-w-sm mx-auto leading-relaxed mb-12">
                                {user 
                                    ? "No properties match your profile exactly. Try adjusting your preferences to find the perfect fit." 
                                    : t('search.status.noResultsDesc', undefined, 'Try expanding your search parameters to discover hidden gems.')}
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                {!user && (
                                    <button 
                                        onClick={() => router.push('/onboarding')}
                                        className="px-16 py-6 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all"
                                    >
                                        {t('search.filters.setupMatchProfile', undefined, 'Setup Match Profile')}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="results"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-16"
                        >
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-16">
                                    {properties.map((property, idx) => (
                                        <ListingCard
                                            key={property.id}
                                            property={property}
                                            index={idx}
                                            onToggleSave={toggleSaveProperty}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="h-[70vh] min-h-[600px] rounded-[4rem] overflow-hidden shadow-2xl border-8 border-white/50">
                                    <SearchMap 
                                        properties={properties} 
                                        center={properties[0]?.latitude ? [properties[0].latitude, properties[0].longitude!] : undefined}
                                    />
                                </div>
                            )}
                            {properties.length >= ITEMS_PER_PAGE && properties.length % ITEMS_PER_PAGE === 0 && (
                                <div className="mt-20 flex justify-center pb-20">
                                    <button 
                                        onClick={handleLoadMore}
                                        className="px-16 py-6 bg-white text-zinc-900 border border-zinc-200 text-xs font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-xl hover:bg-zinc-50 transition-all hover:scale-105 active:scale-95"
                                    >
                                        {t('search.loadMore', undefined, 'Discover More Listings')}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </PremiumLayout>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">Initializing Discovery...</div>}>
            <SearchContent />
        </Suspense>
    );
}
