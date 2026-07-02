"use client";

import { useState, useEffect } from 'react';
import { FeatureGate } from '@/lib/SegmentContext';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import { Zap, Calendar, FileText, Crown, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';

export default function TenantFeatures() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [stats, setStats] = useState({ applications: 0, visits: 0, disputes: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            if (!user || user.role !== 'tenant') {
                return;
            }

            try {
                const statsRes = await apiClient.client.get('/stats/tenant/overview');
                setStats({
                    applications: statsRes.data.total_applications,
                    visits: statsRes.data.scheduled_visits,
                    disputes: statsRes.data.active_disputes
                });
            } catch (error) {
                console.error('Failed to fetch tenant data:', error);
            }
        };

        if (user) {
            fetchStats();
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

            </section>

            <FeatureGate feature="history">
                <section className="space-y-10">
                    <div className="glass-card !p-12 space-y-12 rounded-[3rem] border-zinc-100 shadow-xl overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-zinc-100 rounded-full blur-[60px] opacity-20 -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
                        
                        <div className="flex items-center justify-between relative z-10">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-3">
                                <Zap className="w-4 h-4 text-zinc-900" /> {t('tenant.features.activity.title', undefined, 'Activity Hub')}
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-8 relative z-10">
                            {[
                                { label: t('tenant.features.activity.tours', undefined, 'Tours'), value: stats.visits, icon: <Calendar className="w-5 h-5 text-zinc-900" />, sub: t('tenant.features.activity.upcoming', undefined, 'Upcoming') },
                                { label: t('tenant.features.activity.apps', undefined, 'Applications'), value: stats.applications, icon: <FileText className="w-5 h-5 text-zinc-900" />, sub: t('tenant.features.activity.review', undefined, 'In Review') },
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

        </div>
    );
}
