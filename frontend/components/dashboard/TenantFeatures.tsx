"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FeatureGate } from '@/lib/SegmentContext';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Home } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { resolveMediaUrl } from '@/lib/mediaUrl';

interface PropertyMatch {
    id: string;
    title: string;
    city: string;
    monthly_rent: number;
    size_sqm: number;
    match_score: number;
    photos: { url: string }[];
}

export default function TenantFeatures() {
    const router = useRouter();
    const { t } = useLanguage();
    const { user } = useAuth();
    const [matches, setMatches] = useState<PropertyMatch[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMatches = async () => {
            if (!user || user.role !== 'tenant') {
                setLoading(false);
                return;
            }

            try {
                const response = await apiClient.client.get('/properties/recommendations?limit=3');
                setMatches(response.data);
            } catch (error) {
                console.error('Failed to fetch smart matches:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchMatches();
        }
    }, [user]);

    return (
        <div className="space-y-20 mt-12">
            {/* Smart Matches Section - Ultra Premium */}
            <section className="space-y-10">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between px-6 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-xl">
                                <Sparkles className="w-6 h-6 text-amber-500 fill-amber-500/20" />
                            </div>
                            <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">
                                {t('dashboard.inbox.tenant.smartMatches', undefined, 'Smart Matches')}
                            </h2>
                        </div>
                        <p className="text-lg text-zinc-500 dark:text-zinc-400 font-medium">
                            {t('dashboard.inbox.tenant.smartMatchesDesc', undefined, 'Top properties perfectly matching your profile')}
                        </p>
                    </div>
                    <button 
                        onClick={() => router.push('/search')}
                        className="group flex items-center gap-4 px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black uppercase tracking-[0.3em] rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        {t('dashboard.inbox.tenant.discover', undefined, 'Discover More')} 
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="glass-card h-64 animate-pulse bg-zinc-100 dark:bg-zinc-800/50 rounded-[2.5rem]" />
                        ))}
                    </div>
                ) : matches.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {matches.map((property, idx) => (
                            <motion.button
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1, type: 'spring', damping: 20 }}
                                key={property.id}
                                onClick={() => router.push(`/properties/${property.id}`)}
                                className="glass-card !p-0 overflow-hidden group border-zinc-100 dark:border-zinc-800/50 hover:border-teal-500/50 transition-all duration-700 text-left rounded-[2.5rem] shadow-xl hover:shadow-2xl"
                            >
                                <div className="aspect-[16/10] relative overflow-hidden">
                                    {property.photos?.[0] ? (
                                        <img 
                                            src={resolveMediaUrl(property.photos[0].url)} 
                                            alt={property.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                            <Home className="w-12 h-12 text-zinc-300" />
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 px-4 py-2 bg-zinc-900/90 backdrop-blur-xl text-white text-[10px] font-black rounded-2xl border border-white/10 shadow-2xl">
                                        {t('dashboard.inbox.tenant.matchScore', { score: property.match_score }, `${property.match_score}% Match`)}
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    <div className="absolute bottom-6 left-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black text-white tracking-tighter">{property.monthly_rent}€</span>
                                            <span className="text-[10px] text-zinc-300 font-black uppercase tracking-widest">/mo</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-8">
                                    <h4 className="text-xl font-black text-zinc-900 dark:text-white truncate mb-2 uppercase tracking-tight group-hover:text-teal-500 transition-colors">
                                        {property.title}
                                    </h4>
                                    <div className="flex items-center gap-3">
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                            {property.city}
                                        </p>
                                        <div className="w-1 h-1 rounded-full bg-zinc-300" />
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                            {property.size_sqm}m²
                                        </p>
                                    </div>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                ) : (
                    <div className="glass-card !p-20 text-center border-dashed border-2 border-zinc-200 dark:border-zinc-800/50 rounded-[3rem]">
                        <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-8">
                            <Sparkles className="w-10 h-10 text-zinc-300" />
                        </div>
                        <p className="text-xl font-medium text-zinc-500 dark:text-zinc-400 mb-10 max-w-md mx-auto leading-relaxed">
                            {t('dashboard.inbox.tenant.noMatches', undefined, 'Complete your onboarding to see personalized matches perfectly tailored for you.')}
                        </p>
                        <button 
                            onClick={() => router.push('/onboarding')}
                            className="px-12 py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all"
                        >
                            {t('dashboard.quickActions.onboarding.title', undefined, 'Complete Profile')} →
                        </button>
                    </div>
                )}
            </section>

            {/* Stats - Premium Activity Cards */}
            <FeatureGate feature="history">
                <section className="space-y-10">
                    <div className="flex items-center gap-4 px-6">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent" />
                        <h2 className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-400 dark:text-zinc-500">
                            {t('dashboard.tenant.activity', undefined, 'Activity Hub')}
                        </h2>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { label: t('dashboard.tenant.applications', undefined, 'Applications'), value: 0, color: 'text-indigo-500', bg: 'bg-indigo-500/5' },
                            { label: t('dashboard.tenant.visits', undefined, 'Scheduled Visits'), value: 0, color: 'text-teal-500', bg: 'bg-teal-500/5' },
                            { label: t('dashboard.tenant.favorites', undefined, 'Favorites'), value: 0, color: 'text-rose-500', bg: 'bg-rose-500/5' },
                            { label: t('dashboard.tenant.activeDisputes', undefined, 'Active Disputes'), value: 0, color: 'text-amber-500', bg: 'bg-amber-500/5', path: '/disputes' }
                        ].map((stat, i) => (
                            <motion.div 
                                key={i}
                                whileHover={{ y: -8 }}
                                onClick={() => stat.path && router.push(stat.path)}
                                className={`glass-card !p-10 rounded-[2.5rem] border-zinc-100 dark:border-zinc-800/50 flex flex-col items-center justify-center text-center group transition-all duration-500 ${stat.path ? 'cursor-pointer' : ''}`}
                            >
                                <div className={`text-6xl font-black ${stat.color} group-hover:scale-110 transition-transform tracking-tighter mb-4`}>
                                    {stat.value}
                                </div>
                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">
                                    {stat.label}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>
            </FeatureGate>

            {/* Premium Relocation Banner - Ultra High Fidelity */}
            <FeatureGate feature="relocation">
                <section>
                    <motion.div 
                        whileHover={{ scale: 1.01 }}
                        className="bg-zinc-900 dark:bg-zinc-800 rounded-[3rem] p-12 sm:p-20 text-white shadow-2xl relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-gradient-to-br from-teal-500/20 to-indigo-500/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:scale-110 transition-transform duration-1000"></div>
                        <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-purple-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                        
                        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12 text-center lg:text-left">
                            <div className="max-w-2xl">
                                <div className="flex items-center justify-center lg:justify-start gap-4 mb-8">
                                    <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-inner backdrop-blur-xl">
                                        🚀
                                    </div>
                                    <h2 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase">
                                        {t('dashboard.tenant.premiumTitle', undefined, 'Premium Mobility')}
                                    </h2>
                                </div>
                                <p className="text-xl text-zinc-400 font-medium leading-relaxed">
                                    {t('dashboard.tenant.premiumDesc', undefined, 'Experience professional relocation services tailored for your next big move.')}
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/relocation')}
                                className="w-full lg:w-auto px-16 py-6 bg-white text-zinc-900 hover:scale-105 active:scale-95 font-black text-xs uppercase tracking-[0.4em] rounded-[2rem] transition-all shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] whitespace-nowrap"
                            >
                                {t('dashboard.tenant.discover', undefined, 'Explore Now')} →
                            </button>
                        </div>
                    </motion.div>
                </section>
            </FeatureGate>

            {/* Recent Searches - Premium Empty State */}
            <section className="space-y-10">
                <div className="flex items-center gap-4 px-6">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent" />
                    <h2 className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-400 dark:text-zinc-500">
                        {t('dashboard.tenant.recentSearches', undefined, 'Search History')}
                    </h2>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent" />
                </div>
                <div className="glass-card !p-20 text-center border-none rounded-[3rem] shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none"></div>
                    <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-10 shadow-inner">
                        <span className="text-4xl opacity-50 grayscale">🔍</span>
                    </div>
                    <p className="text-xl font-medium text-zinc-500 dark:text-zinc-400 mb-10 max-sm mx-auto leading-relaxed">
                        {t('dashboard.tenant.noSearches', undefined, "Your recent property searches will appear here for quick access.")}
                    </p>
                    <button
                        onClick={() => router.push('/search')}
                        className="px-12 py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black uppercase tracking-[0.3em] rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        {t('dashboard.tenant.searchButton', undefined, 'Start New Search')}
                    </button>
                </div>
            </section>
        </div>
    );
}
