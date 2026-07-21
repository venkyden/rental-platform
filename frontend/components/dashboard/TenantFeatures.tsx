"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FeatureGate } from '@/lib/SegmentContext';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import { Zap, Calendar, FileText, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';

export default function TenantFeatures() {
    const router = useRouter();
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
                            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.3em]">
                                <Sparkles className="w-3 h-3 mr-2" />
                                {t('tenant.features.trust.badge', undefined, 'Trust Layer')}
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-900 uppercase italic">
                                {t('tenant.features.trust.title', undefined, 'Verified Profile')}
                            </h2>
                            <p className="text-zinc-500 font-medium text-lg leading-relaxed max-w-xl italic">
                                {t('tenant.features.trust.desc', undefined, 'Verify your identity and solvency once — get a signed, expiring proof any landlord can check, here or on any classifieds site.')}
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/verification')}
                            className="px-12 py-6 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-3xl shadow-2xl shadow-zinc-900/40 hover:scale-105 active:scale-95 transition-all"
                        >
                            {t('tenant.features.trust.cta', undefined, 'Get Verified')}
                        </button>
                    </div>
                </div>

            </section>

            <FeatureGate feature="history">
                <section className="space-y-10">
                    <div className="glass-card !p-12 space-y-12 rounded-[3rem] border-zinc-100 shadow-xl overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-zinc-100 rounded-full blur-[60px] opacity-20 -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
                        
                        <div className="flex items-center justify-between relative z-10">
                            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-3">
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
                                    <p className="text-xs font-black text-zinc-900 uppercase tracking-widest">{stat.label}</p>
                                    <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mt-2">{stat.sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </FeatureGate>

        </div>
    );
}
