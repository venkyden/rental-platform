'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PremiumLayout from '@/components/PremiumLayout';
import { apiClient } from '@/lib/api';
import { BarChart3, TrendingUp, Users, Home, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface AnalyticsStats {
    totalProperties: number;
    activeProperties: number;
    totalViews: number;
    occupancyRate: number;
    potentialRevenue: number;
}

export default function AnalyticsPage() {
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [loading, setLoading] = useState(true);
    const { t, language } = useLanguage();

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const response = await apiClient.client.get('/properties');
                const properties = response.data;
                
                const statsData: AnalyticsStats = {
                    totalProperties: properties.length,
                    activeProperties: properties.filter((p: any) => p.status === 'active').length,
                    totalViews: properties.reduce((sum: number, p: any) => sum + (p.views_count || 0), 0),
                    occupancyRate: properties.length > 0 ? (properties.filter((p: any) => p.status === 'active').length / properties.length) * 100 : 0,
                    potentialRevenue: properties.reduce((sum: number, p: any) => sum + (p.monthly_rent || 0), 0)
                };
                
                setStats(statsData);
            } catch (err) {
                console.error('Failed to fetch analytics:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    const cards = [
        {
            title: t('analytics.totalViews', undefined, 'Total Views'),
            value: stats?.totalViews.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US') || '0',
            change: '+12%',
            trend: 'up',
            icon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
            color: 'emerald'
        },
        {
            title: t('analytics.occupancy', undefined, 'Occupancy Rate'),
            value: `${stats?.occupancyRate.toFixed(1)}%`,
            change: '+2.4%',
            trend: 'up',
            icon: <Home className="w-5 h-5 text-blue-500" />,
            color: 'blue'
        },
        {
            title: t('analytics.potentialRevenue', undefined, 'Potential Revenue'),
            value: `${stats?.potentialRevenue.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}€`,
            change: '+5.1%',
            trend: 'up',
            icon: <ArrowUpRight className="w-5 h-5 text-purple-500" />,
            color: 'purple'
        },
        {
            title: t('analytics.activeListings', undefined, 'Active Listings'),
            value: stats?.activeProperties.toString() || '0',
            change: '0%',
            trend: 'neutral',
            icon: <Building className="w-5 h-5 text-amber-500" />,
            color: 'amber'
        }
    ];

    return (
        <PremiumLayout>
            <div className="max-w-6xl mx-auto py-12 px-4">
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                            <BarChart3 className="w-8 h-8 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
                                {t('dashboard.sections.analytics', undefined, 'Portfolio Analytics')}
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                                {t('analytics.subtitle', undefined, 'Track your property performance and financial growth.')}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                        {[
                            { id: '7D', label: t('analytics.periods.d7', undefined, '7D') },
                            { id: '30D', label: t('analytics.periods.d30', undefined, '30D') },
                            { id: '90D', label: t('analytics.periods.d90', undefined, '90D') },
                            { id: '1Y', label: t('analytics.periods.y1', undefined, '1Y') }
                        ].map(period => (
                            <button 
                                key={period.id} 
                                className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${period.id === '30D' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-32 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-3xl" />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            {cards.map((card, i) => (
                                <div key={i} className="glass-card !p-6 group hover:scale-[1.02] transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-2 rounded-lg bg-${card.color}-500/10`}>
                                            {card.icon}
                                        </div>
                                        <div className={`flex items-center gap-1 text-xs font-black ${card.trend === 'up' ? 'text-emerald-500' : 'text-zinc-400'}`}>
                                            {card.trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
                                            {card.change}
                                        </div>
                                    </div>
                                    <div className="text-3xl font-black text-zinc-900 dark:text-white mb-1">
                                        {card.value}
                                    </div>
                                    <div className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                        {card.title}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 glass-card !p-8 h-[400px] flex flex-col items-center justify-center text-center">
                                <BarChart3 className="w-16 h-16 text-zinc-100 dark:text-zinc-800 mb-6" />
                                <h3 className="text-xl font-bold text-zinc-400 dark:text-zinc-600 mb-2">
                                    {t('analytics.viewsOverTime', undefined, 'Views Over Time')}
                                </h3>
                                <p className="text-zinc-400 dark:text-zinc-500 max-w-xs mx-auto text-sm">
                                    {t('analytics.chartNotice', undefined, 'Interactive charts are being generated for your portfolio. Check back in a few hours.')}
                                </p>
                            </div>
                            <div className="glass-card !p-8 flex flex-col items-center justify-center text-center">
                                <Users className="w-16 h-16 text-zinc-100 dark:text-zinc-800 mb-6" />
                                <h3 className="text-xl font-bold text-zinc-400 dark:text-zinc-600 mb-2">
                                    {t('analytics.demographics', undefined, 'Tenant Demographics')}
                                </h3>
                                <p className="text-zinc-400 dark:text-zinc-500 max-w-xs mx-auto text-sm">
                                    {t('analytics.demoNotice', undefined, 'Understand who is looking at your properties to optimize your marketing.')}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </PremiumLayout>
    );
}

import { Building } from 'lucide-react';
