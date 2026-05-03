"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FeatureGate } from '@/lib/SegmentContext';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Home } from 'lucide-react';
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
    const [matches, setMatches] = useState<PropertyMatch[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMatches = async () => {
            try {
                const response = await apiClient.client.get('/properties/recommendations?limit=3');
                setMatches(response.data);
            } catch (error) {
                console.error('Failed to fetch smart matches:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();
    }, []);

    return (
        <div className="space-y-12 mt-8">
            {/* Smart Matches Section */}
            <section className="space-y-6">
                <div className="flex items-end justify-between px-2">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black tracking-tighter flex items-center gap-3">
                            <Sparkles className="w-8 h-8 text-amber-500 fill-amber-500/20" />
                            {t('dashboard.inbox.tenant.smartMatches', undefined, 'Smart Matches')}
                        </h2>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                            {t('dashboard.inbox.tenant.smartMatchesDesc', undefined, 'Top properties perfectly matching your profile')}
                        </p>
                    </div>
                    <button 
                        onClick={() => router.push('/search')}
                        className="text-sm font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 flex items-center gap-2 hover:gap-3 transition-all"
                    >
                        {t('dashboard.inbox.tenant.discover', undefined, 'Discover More')} <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="glass-card h-48 animate-pulse bg-zinc-100 dark:bg-zinc-800/50" />
                        ))}
                    </div>
                ) : matches.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {matches.map((property, idx) => (
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                key={property.id}
                                onClick={() => router.push(`/properties/${property.id}`)}
                                className="glass-card !p-0 overflow-hidden group border-white/40 dark:border-zinc-800/50 hover:border-teal-500/50 transition-all duration-500 text-left"
                            >
                                <div className="aspect-[16/9] relative overflow-hidden">
                                    {property.photos?.[0] ? (
                                        <img 
                                            src={resolveMediaUrl(property.photos[0].url)} 
                                            alt={property.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                            <Home className="w-8 h-8 text-zinc-300" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 right-3 px-3 py-1 bg-zinc-900/80 backdrop-blur-md text-white text-[10px] font-black rounded-lg border border-white/10">
                                        {t('dashboard.inbox.tenant.matchScore', { score: property.match_score }, `${property.match_score}% Match`)}
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="absolute bottom-3 left-4">
                                        <p className="text-xl font-black text-white tracking-tighter">
                                            {property.monthly_rent}€<span className="text-[10px] opacity-70 ml-1">/mo</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <h4 className="text-lg font-black text-zinc-900 dark:text-white truncate mb-1">
                                        {property.title}
                                    </h4>
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                                        {property.city} • {property.size_sqm}m²
                                    </p>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                ) : (
                    <div className="glass-card !p-12 text-center border-dashed border-2 border-zinc-200 dark:border-zinc-800">
                        <p className="text-zinc-500 font-medium mb-4">
                            {t('dashboard.inbox.tenant.noMatches', undefined, 'Complete your onboarding to see personalized matches')}
                        </p>
                        <button 
                            onClick={() => router.push('/onboarding')}
                            className="btn-primary !py-2 !px-6 text-xs !rounded-full"
                        >
                            {t('dashboard.quickActions.onboarding.title', undefined, 'Complete Profile')}
                        </button>
                    </div>
                )}
            </section>

            {/* Stats for experienced tenants */}
            <FeatureGate feature="history">
                <section>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 pl-2 tracking-tight">
                        {t('dashboard.tenant.activity', undefined, 'My Activity')}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <div className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
                                {t('dashboard.tenant.applications', undefined, 'Applications')}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
                                {t('dashboard.tenant.visits', undefined, 'Scheduled Visits')}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <div className="text-4xl font-extrabold text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
                                {t('dashboard.tenant.favorites', undefined, 'Favorites')}
                            </div>
                        </div>
                        <div 
                            onClick={() => router.push('/disputes')}
                            className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                            <div className="text-4xl font-extrabold text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
                                {t('dashboard.tenant.activeDisputes', undefined, 'Active Disputes')}
                            </div>
                        </div>
                    </div>
                </section>
            </FeatureGate>

            {/* Premium badge for D3 */}
            <FeatureGate feature="relocation">
                <section>
                    <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-3xl p-8 sm:p-10 text-white shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                            <div>
                                <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                                    <span className="text-3xl filter drop-shadow-md">🚀</span>
                                    <h2 className="text-2xl font-extrabold tracking-tight">
                                        {t('dashboard.tenant.premiumTitle', undefined, 'Premium Services')}
                                    </h2>
                                </div>
                                <p className="text-purple-100 font-medium">
                                    {t('dashboard.tenant.premiumDesc', undefined, 'Take advantage of our relocation services for your professional mobility')}
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/relocation')}
                                className="w-full sm:w-auto px-8 py-3.5 bg-white text-purple-700 hover:bg-purple-50 font-bold rounded-xl transition-all shadow-md hover:shadow-sm focus:ring-4 focus:ring-white/30 active:scale-95 whitespace-nowrap"
                            >
                                {t('dashboard.tenant.discover', undefined, 'Discover')}
                            </button>
                        </div>
                    </div>
                </section>
            </FeatureGate>

            {/* Recent searches */}
            <section>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 pl-2 tracking-tight">
                    {t('dashboard.tenant.recentSearches', undefined, 'Recent Searches')}
                </h2>
                <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 text-center py-12 flex flex-col items-center justify-center">
                    <div className="text-4xl mb-3 opacity-50">🔍</div>
                    <p className="text-base font-medium text-zinc-500 dark:text-zinc-400 mb-4">
                        {t('dashboard.tenant.noSearches', undefined, "You haven't made any searches yet.")}
                    </p>
                    <button
                        onClick={() => router.push('/search')}
                        className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-colors shadow-sm focus:ring-4 focus:ring-teal-500/20 active:scale-95"
                    >
                        {t('dashboard.tenant.searchButton', undefined, 'Search for a property')}
                    </button>
                </div>
            </section>
        </div>
    );
}
