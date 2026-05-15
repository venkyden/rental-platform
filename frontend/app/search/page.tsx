'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/lib/SegmentContext';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumLayout from '@/components/PremiumLayout';
import { useLanguage } from '@/lib/LanguageContext';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { PropertyCardSkeleton } from '@/components/SkeletonLoaders';
import { Search, MapPin, Maximize, Filter, X, ChevronDown, Sparkles, Map as MapIcon, Grid, Check, ShieldCheck, Heart } from 'lucide-react';
import SearchMap from '@/components/SearchMap';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

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
    latitude?: number;
    longitude?: number;
    photos: { url: string }[];
    amenities: string[];
    status: string;
    dpe_rating?: string;
    guarantor_required?: boolean;
    match_score?: number;
    match_breakdown?: Record<string, any>;
    is_saved?: boolean;
    ownership_verified?: boolean;
}

function SearchContent() {
    const { config, loading: segmentLoading } = useSegment();
    const { user, loading: authLoading } = useAuth();
    const { t } = useLanguage();
    const isAuthenticated = !!user;
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';

    // Data State
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filter States
    const [priceRange, setPriceRange] = useState<number>(3000);
    const [location, setLocation] = useState(initialQuery);
    const [furnished, setFurnished] = useState(false);
    const [colocation, setColocation] = useState(false);
    const [cafOnly, setCafOnly] = useState(false);
    const [propertyType, setPropertyType] = useState<string>('');
    const [sortBy, setSortBy] = useState<string>('created_at');
    const [orderDir, setOrderDir] = useState<string>('desc');
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
    const [savedOnly, setSavedOnly] = useState(false);
    const ITEMS_PER_PAGE = 12;

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
        const fetchProperties = async (isLoadMore = false) => {
            try {
                if (!isLoadMore) {
                    setLoading(true);
                    setProperties([]);
                }
                setError('');
                const params: any = { 
                    status: 'active', 
                    max_rent: priceRange,
                    skip: isLoadMore ? properties.length : 0,
                    limit: ITEMS_PER_PAGE,
                    sort_by: sortBy,
                    order_direction: orderDir
                };
                if (location.length > 2) params.city = location;
                if (furnished) params.furnished = true;
                if (cafOnly) params.caf_eligible = true;
                if (propertyType) params.property_type = propertyType;
                if (colocation) params.amenities = ['colocation'];
                
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
        const timeoutId = setTimeout(() => fetchProperties(), 500);
        return () => clearTimeout(timeoutId);
    }, [priceRange, location, furnished, colocation, cafOnly, propertyType, sortBy, orderDir, savedOnly]);

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
        const params: any = { 
            status: 'active', 
            max_rent: priceRange,
            skip: properties.length,
            limit: ITEMS_PER_PAGE,
            sort_by: sortBy,
            order_direction: orderDir
        };
        if (location.length > 2) params.city = location;
        if (furnished) params.furnished = true;
        if (cafOnly) params.caf_eligible = true;
        if (propertyType) params.property_type = propertyType;
        if (colocation) params.amenities = ['colocation'];

        const response = await apiClient.client.get('/properties', { params });
        setProperties(prev => [...prev, ...response.data]);
    };

    if (segmentLoading || authLoading) return <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">{t('search.status.loading', undefined, undefined)}</div>;

    return (
        <PremiumLayout withNavbar={true}>
            {/* Industry Grade Living Background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                        x: [0, 50, 0],
                        y: [0, 30, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-zinc-900/5 rounded-full blur-[120px]"
                />
                <motion.div 
                    animate={{ 
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
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl"
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
                                className="w-full bg-transparent border-none focus:ring-0 text-xs font-black uppercase tracking-[0.1em] text-zinc-900 placeholder:text-zinc-400 placeholder:font-black placeholder:tracking-[0.1em]"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>

                        <div className="flex-1 min-w-[200px] px-8 py-4 bg-zinc-100/50 rounded-[2rem] shadow-inner">
                            <div className="flex justify-between mb-2 px-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{t('search.filters.budget', undefined, 'Budget')}</span>
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
                                className="px-8 py-4 bg-zinc-100/50 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border-none focus:ring-0 cursor-pointer hover:bg-zinc-100 transition-colors"
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
                                className="px-8 py-4 bg-zinc-100/50 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border-none focus:ring-0 cursor-pointer hover:bg-zinc-100 transition-colors"
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
                            { state: furnished, setter: setFurnished, label: t('search.filters.furnished', undefined, 'Furnished') },
                            { state: colocation, setter: setColocation, label: t('search.filters.colocation', undefined, 'Colocation') },
                            { state: cafOnly, setter: setCafOnly, label: t('search.filters.caf', undefined, 'CAF') },
                            { state: savedOnly, setter: setSavedOnly, label: t('search.filters.wishlist', undefined, 'Wishlist'), icon: Heart }
                        ].map((filter, i) => (
                            <button 
                                key={i}
                                onClick={() => filter.setter(!filter.state)}
                                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all duration-700 ${filter.state ? 'bg-zinc-900 text-white shadow-lg' : 'bg-zinc-50 text-zinc-400 hover:text-zinc-600'}`}
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
                                    setFurnished(false); 
                                    setCafOnly(false); 
                                    setColocation(false); 
                                    setSavedOnly(false);
                                }}
                                className="px-5 py-3 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/50 transition-all flex items-center gap-2 group"
                            >
                                <X className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('search.filters.resetExploration', undefined, 'Reset')}</span>
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
                                        className="px-16 py-6 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all"
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
                                        <motion.div 
                                            key={property.id} 
                                            initial={{ opacity: 0, y: 40 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            whileHover={{ y: -20, rotateX: 2, rotateY: -2 }}
                                            transition={{ 
                                                delay: idx * 0.05,
                                                duration: 0.4,
                                                ease: [0.23, 1, 0.32, 1]
                                            }}
                                            style={{ perspective: 1000 }}
                                            className="group glass-card !p-0 overflow-hidden flex flex-col border-zinc-100 hover:shadow-[0_80px_160px_-20px_rgba(0,0,0,0.3)] transition-all duration-700 rounded-[3.5rem] relative"
                                        >
                                            <div className="aspect-[16/12] bg-zinc-100 relative overflow-hidden">
                                                {property.photos?.[0] ? (
                                                    <img 
                                                        src={resolveMediaUrl(property.photos[0].url)} 
                                                        alt={property.title} 
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-zinc-300 font-black text-3xl italic tracking-tighter">ROOMIVO</div>
                                                )}
                                                
                                                {/* Heart / Save Button */}
                                                <div className="absolute top-8 right-8 z-30">
                                                    <motion.button
                                                        whileHover={{ scale: 1.2 }}
                                                        whileTap={{ scale: 0.8 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleSaveProperty(property.id);
                                                        }}
                                                        className={`p-4 rounded-full backdrop-blur-3xl border transition-all duration-500 shadow-2xl ${
                                                            property.is_saved 
                                                            ? 'bg-white border-white text-zinc-900 shadow-white/40' 
                                                            : 'bg-white/20 border-white/20 text-white hover:bg-white/40'
                                                        }`}
                                                    >
                                                        <Heart className={`w-5 h-5 ${property.is_saved ? 'fill-current' : ''}`} />
                                                    </motion.button>
                                                </div>

                                                {/* Match Score Gamification */}
                                                {isAuthenticated && property.match_score !== undefined && (
                                                    <div className="absolute top-28 right-8 z-20 group/match">
                                                        <motion.div 
                                                            initial={{ scale: 0.5, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            whileHover={{ scale: 1.1 }}
                                                            className={`px-4 py-4 rounded-full backdrop-blur-2xl border flex flex-col items-center justify-center shadow-2xl cursor-help transition-all ${
                                                                property.match_score >= 85 
                                                                ? 'bg-zinc-900 border-zinc-800 text-white shadow-zinc-900/40' 
                                                                : 'bg-white/90 border-white/20 text-zinc-900'
                                                            }`}
                                                        >
                                                            <span className="text-[8px] font-black uppercase tracking-tighter mb-0.5 opacity-80">Match</span>
                                                            <span className="text-xl font-black leading-none">{Math.round(property.match_score)}%</span>
                                                            
                                                            {/* Tooltip on Hover */}
                                                            <div className="absolute bottom-full right-0 mb-4 opacity-0 group-hover/match:opacity-100 transition-opacity pointer-events-none">
                                                                <div className="bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl shadow-2xl whitespace-nowrap border border-zinc-800">
                                                                    {t('search.status.compatibilityIndex', undefined, 'Compatibility Index')}
                                                                    <div className="mt-2 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-white" style={{ width: `${property.match_score}%` }} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    </div>
                                                )}

                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                                                
                                                {/* Top Badges */}
                                                <div className="absolute top-8 left-8 flex flex-col gap-3">
                                                    {property.ownership_verified && (
                                                        <div className="px-5 py-2 bg-zinc-900 text-white text-[10px] font-black rounded-2xl border border-zinc-800 shadow-2xl uppercase tracking-widest flex items-center gap-2">
                                                            <ShieldCheck className="w-3 h-3" />
                                                            {t('search.filters.verified', undefined, 'Verified')}
                                                        </div>
                                                    )}
                                                    {property.dpe_rating && (
                                                        <div className={`px-5 py-2 backdrop-blur-3xl text-white text-[10px] font-black rounded-2xl border border-white/20 shadow-2xl uppercase tracking-widest ${
                                                            property.dpe_rating === 'A' ? 'bg-zinc-900/80' : 
                                                            property.dpe_rating === 'B' ? 'bg-zinc-800/80' : 
                                                            'bg-zinc-950/80'
                                                        }`}>
                                                            DPE {property.dpe_rating}
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
                                                <h3 className="text-3xl font-black text-zinc-900 mb-4 truncate tracking-tighter uppercase group-hover:text-zinc-600 transition-colors duration-500">
                                                    {property.title}
                                                </h3>
                                                
                                                <div className="flex items-center gap-4 mb-12">
                                                    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-100 rounded-2xl border border-zinc-200/50">
                                                        <MapPin className="w-4 h-4 text-zinc-400" />
                                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{property.city}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-100 rounded-2xl border border-zinc-200/50">
                                                        <Maximize className="w-4 h-4 text-zinc-400" />
                                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{property.size_sqm}m²</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-auto pt-10 border-t border-zinc-100 flex items-center justify-between">
                                                    <div className="flex -space-x-4">
                                                        {(property.amenities || []).slice(0, 4).map((amenity: any, i: number) => (
                                                            <div 
                                                                key={i} 
                                                                className="w-12 h-12 rounded-full bg-white border-[3px] border-zinc-50 flex items-center justify-center shadow-xl group-hover:scale-110 transition-all duration-500 cursor-help relative z-[10]"
                                                                title={amenity}
                                                            >
                                                                <div className="w-6 h-6 text-zinc-900 flex items-center justify-center font-black text-[11px] italic">
                                                                    {amenity.charAt(0).toUpperCase()}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(property.amenities || []).length > 4 && (
                                                            <div className="w-12 h-12 rounded-full bg-zinc-900 border-[3px] border-zinc-50 flex items-center justify-center shadow-xl relative z-[5]">
                                                                <span className="text-[10px] font-black text-white">
                                                                    +{(property.amenities || []).length - 4}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => router.push(`/properties/${property.id}`)}
                                                        className="group/btn relative px-10 py-5 bg-zinc-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] transition-all duration-700 hover:scale-105 active:scale-95 shadow-2xl shadow-zinc-900/20 overflow-hidden"
                                                    >
                                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-700" />
                                                        <span className="relative z-10 group-hover/btn:text-white transition-colors">
                                                            {t('search.property.viewDetails', undefined, 'Explore')} →
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
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
                                        className="px-16 py-6 bg-white text-zinc-900 border border-zinc-200 text-[10px] font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-xl hover:bg-zinc-50 transition-all hover:scale-105 active:scale-95"
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
