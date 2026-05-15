"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FeatureGate } from '@/lib/SegmentContext';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Home, Zap, Calendar, FileText, Crown } from 'lucide-react';
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
    const [stats, setStats] = useState({ applications: 0, visits: 0, disputes: 0 });

    useEffect(() => {
        const fetchMatches = async () => {
            if (!user || user.role !== 'tenant') {
                setLoading(false);
                return;
            }

            try {
                const [matchRes, statsRes] = await Promise.all([
                    apiClient.client.get('/properties/recommendations?limit=3'),
                    apiClient.client.get('/stats/tenant/overview')
                ]);
                setMatches(matchRes.data);
                setStats({
                    applications: statsRes.data.total_applications,
                    visits: statsRes.data.scheduled_visits,
                    disputes: statsRes.data.active_disputes
                });
            } catch (error) {
                console.error('Failed to fetch tenant data:', error);
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
            <section className="space-y-10">
                <div className="glass-card !p-12 relative overflow-hidden group shadow-2xl rounded-[3rem] border-zinc-100/50">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-100 rounded-full blur-[80px] -mr-32 -mt-32 opacity-20 group-hover:scale-150 transition-transform duration-1000" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="flex-1 space-y-6">
                            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.3em]">
                                <Sparkles className="w-3 h-3 mr-2" />
                                {t('tenant.features.new', undefined, 'Platform Exclusive')}
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-900 uppercase italic">
                                {t('tenant.features.mobility.title', undefined, 'Premium Mobility')}
                            </h2>
                            <p className="text-zinc-500 font-medium text-lg leading-relaxed max-w-xl italic">
                                {t('tenant.features.mobility.desc', undefined, 'Unlock zero-deposit moves and instant property matching with our premium certification.')}
                            </p>
                        </div>
                        <button className="px-12 py-6 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-3xl shadow-2xl shadow-zinc-900/40 hover:scale-105 active:scale-95 transition-all">
                            {t('tenant.features.mobility.cta', undefined, 'Get Certified')}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between px-6 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-zinc-100 rounded-xl">
                                <Sparkles className="w-6 h-6 text-zinc-900" />
                            </div>
                            <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">
                                {t('dashboard.inbox.tenant.smartMatches', undefined, 'Smart Matches')}
                            </h2>
                        </div>
                        <p className="text-lg text-zinc-500 font-medium">
                            {t('dashboard.inbox.tenant.smartMatchesDesc', undefined, 'Top properties perfectly matching your profile')}
                        </p>
                    </div>
                    <button 
                        onClick={() => router.push('/search')}
                        className="group flex items-center gap-4 px-8 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        {t('dashboard.inbox.tenant.discover', undefined, 'Discover More')} 
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="glass-card h-64 animate-pulse bg-zinc-100 rounded-[2.5rem]" />
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
                                className="glass-card !p-0 overflow-hidden group border-zinc-100 hover:border-zinc-900 transition-all duration-700 text-left rounded-[2.5rem] shadow-xl hover:shadow-2xl"
                            >
                                <div className="aspect-[16/10] relative overflow-hidden">
                                    {property.photos?.[0] ? (
                                        <img 
                                            src={resolveMediaUrl(property.photos[0].url)} 
                                            alt={property.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
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
                                    <h4 className="text-xl font-black text-zinc-900 truncate mb-2 uppercase tracking-tight group-hover:text-zinc-900 transition-colors">
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
                    <div className="glass-card !p-20 text-center border-dashed border-2 border-zinc-200 rounded-[3rem]">
                        <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-8">
                            <Sparkles className="w-10 h-10 text-zinc-300" />
                        </div>
                        <p className="text-xl font-medium text-zinc-500 mb-10 max-w-md mx-auto leading-relaxed">
                            {t('dashboard.inbox.tenant.noMatches', undefined, 'Complete your onboarding to see personalized matches perfectly tailored for you.')}
                        </p>
                        <button 
                            onClick={() => router.push('/onboarding')}
                            className="px-12 py-5 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all"
                        >
                            {t('dashboard.quickActions.onboarding.title', undefined, 'Complete Profile')} →
                        </button>
                    </div>
                )}
            </section>

            <FeatureGate feature="history">
                <section className="space-y-10">
                    <div className="glass-card !p-12 space-y-12 rounded-[3rem] border-zinc-100 shadow-xl overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-zinc-100 rounded-full blur-[60px] opacity-20 -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
                        
                        <div className="flex items-center justify-between relative z-10">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-3">
                                <Zap className="w-4 h-4 text-zinc-900" /> {t('tenant.features.activity.title', undefined, 'Activity Hub')}
                            </h3>
                            <div className="flex gap-2">
                                <div className="w-2 h-2 rounded-full bg-zinc-900 animate-ping" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-900">{t('tenant.features.activity.live', undefined, 'Live Updates')}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 relative z-10">
                            {[
                                { label: t('tenant.features.activity.tours', undefined, 'Tours'), value: '02', icon: <Calendar className="w-5 h-5 text-zinc-900" />, sub: t('tenant.features.activity.upcoming', undefined, 'Upcoming') },
                                { label: t('tenant.features.activity.apps', undefined, 'Applications'), value: '01', icon: <FileText className="w-5 h-5 text-zinc-900" />, sub: t('tenant.features.activity.review', undefined, 'In Review') },
                            ].map((stat, i) => (
                                <div key={i} className="p-8 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 hover:border-zinc-900 transition-all duration-500 group/item">
                                    <div className="p-4 rounded-2xl bg-white w-fit mb-6 shadow-md group-hover/item:bg-zinc-900 group-hover/item:text-white transition-all duration-500">
                                        {stat.icon}
                                    </div>
                                    <p className="text-4xl font-black text-zinc-900 tracking-tighter mb-2 italic">{stat.value}</p>
                                    <p className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">{stat.label}</p>
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-2">{stat.sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </FeatureGate>

            <FeatureGate feature="relocation">
                <section>
                    <div className="glass-card !p-12 relative overflow-hidden group shadow-2xl rounded-[3rem] border-zinc-100/50 bg-zinc-900 text-white">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-zinc-800 rounded-full blur-[100px] -mr-48 -mt-48 opacity-40 group-hover:scale-150 transition-transform duration-1000" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                            <div className="flex-1 space-y-8">
                                <div className="inline-flex items-center px-5 py-2 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-black uppercase tracking-[0.4em]">
                                    <Crown className="w-3.5 h-3.5 mr-3 text-zinc-300" />
                                    {t('tenant.features.premium.badge', undefined, 'Roomivo Black')}
                                </div>
                                <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85] uppercase italic">
                                    {t('tenant.features.premium.title', undefined, 'The Future of Renting')}
                                </h2>
                                <p className="text-zinc-400 font-medium text-xl leading-relaxed max-w-2xl italic">
                                    {t('tenant.features.premium.desc', undefined, 'Access off-market listings, priority viewings, and a dedicated rental agent to handle your entire move.')}
                                </p>
                            </div>
                            <button className="px-16 py-8 bg-white text-zinc-900 text-[10px] font-black uppercase tracking-[0.5em] rounded-[2rem] shadow-[0_20px_50px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all">
                                {t('tenant.features.premium.cta', undefined, 'Join the Elite')}
                            </button>
                        </div>
                    </div>
                </section>
            </FeatureGate>

            <section className="space-y-10">
                <div className="flex items-center gap-4 px-6">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
                    <h2 className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-400">
                        {t('dashboard.tenant.recentSearches', undefined, 'Search History')}
                    </h2>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
                </div>
                <div className="glass-card !p-20 text-center border-none rounded-[3rem] shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] pointer-events-none"></div>
                    <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-10 shadow-inner">
                        <span className="text-4xl opacity-50 grayscale">🔍</span>
                    </div>
                    <p className="text-xl font-medium text-zinc-500 mb-10 max-sm mx-auto leading-relaxed">
                        {t('dashboard.tenant.noSearches', undefined, "Your recent property searches will appear here for quick access.")}
                    </p>
                    <button
                        onClick={() => router.push('/search')}
                        className="px-12 py-5 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        {t('dashboard.tenant.searchButton', undefined, 'Start New Search')}
                    </button>
                </div>
            </section>
        </div>
    );
}
