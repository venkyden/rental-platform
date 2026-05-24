'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import KpiCard from '@/components/dashboard/KpiCard';
import RevenueChart from '@/components/dashboard/RevenueChart';
import { 
    BarChart3, 
    TrendingUp, 
    Home, 
    ArrowUpRight, 
    Building, 
    FileText 
} from 'lucide-react';

interface AnalyticsStats {
    active_properties: number;
    pending_applications: number;
    total_views: number;
    unread_messages: number;
    revenue: number;
    occupancy_rate: number;
}

interface ChartPoint {
    date: string;
    views: number;
    applications: number;
    revenue: number;
}

interface RevenueChartResponse {
    points: ChartPoint[];
}

export default function AnalyticsPage() {
    const { user, loading: authLoading } = useAuth();
    const { language, t } = useLanguage();
    const router = useRouter();
    const [period, setPeriod] = useState<'7D' | '30D' | '90D' | '1Y'>('30D');

    const fetcher = (url: string) => apiClient.client.get(url, {
        headers: { 'Accept-Language': language }
    }).then(res => res.data);

    // Guard unauthorized direct access
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth/login');
        } else if (!authLoading && user && user.role !== 'landlord' && user.role !== 'property_manager' && user.role !== 'admin') {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    // Fetch Overview Stats
    const { 
        data: stats, 
        isLoading: statsLoading 
    } = useSWR<AnalyticsStats>(
        user ? '/stats/landlord/overview' : null,
        fetcher,
        { refreshInterval: 30000 }
    );

    // Fetch timeseries revenue chart data (dynamic based on period selection)
    const { 
        data: chartData, 
        isLoading: chartLoading 
    } = useSWR<RevenueChartResponse>(
        user ? `/stats/landlord/revenue-chart?period=${period}` : null,
        fetcher,
        { refreshInterval: 30000 }
    );

    // Dynamic trend/delta calculations based on timeseries halves
    const calculateTrendDelta = (points: ChartPoint[] | undefined, metric: 'views' | 'applications' | 'revenue') => {
        if (!points || points.length < 2) return { value: '0%', isPositive: true };

        const half = Math.floor(points.length / 2);
        const prevHalf = points.slice(0, half);
        const currHalf = points.slice(half);

        const prevSum = prevHalf.reduce((sum, p) => sum + p[metric], 0);
        const currSum = currHalf.reduce((sum, p) => sum + p[metric], 0);

        if (prevSum === 0) {
            return {
                value: currSum > 0 ? '+100%' : '0%',
                isPositive: currSum >= 0
            };
        }

        const pct = ((currSum - prevSum) / prevSum) * 100;
        const sign = pct >= 0 ? '+' : '';
        return {
            value: `${sign}${pct.toFixed(1)}%`,
            isPositive: pct >= 0
        };
    };

    if (authLoading || !user) {
        return (
            <ProtectedRoute>
                <PremiumLayout withNavbar={true}>
                    <div className="min-h-[50vh] flex items-center justify-center" aria-live="polite">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-950"></div>
                    </div>
                </PremiumLayout>
            </ProtectedRoute>
        );
    }

    const viewsDelta = calculateTrendDelta(chartData?.points, 'views');
    const revenueDelta = calculateTrendDelta(chartData?.points, 'revenue');
    const appsDelta = calculateTrendDelta(chartData?.points, 'applications');

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="max-w-6xl mx-auto py-12 px-4 space-y-12" role="main">
                    
                    {/* Header Block */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-zinc-900/5 flex items-center justify-center border border-zinc-900/10 shadow-sm">
                                <BarChart3 className="w-8 h-8 text-zinc-900" />
                            </div>
                            <div className="text-left">
                                <h1 className="text-4xl font-black tracking-tight text-zinc-900 uppercase">
                                    {t('dashboard.sections.analytics', undefined, 'Portfolio Analytics')}
                                </h1>
                                <p className="text-zinc-500 font-medium">
                                    {t('analytics.subtitle', undefined, 'Track your property performance and financial growth.')}
                                </p>
                            </div>
                        </div>

                        {/* Period Selector Tabs */}
                        <div 
                            className="flex gap-1.5 bg-zinc-100 p-1.5 rounded-2xl self-start sm:self-auto shadow-inner" 
                            role="group" 
                            aria-label={t('analytics.periodSelection', undefined, 'Select period')}
                        >
                            {[
                                { id: '7D', label: t('analytics.periods.d7', undefined, '7D') },
                                { id: '30D', label: t('analytics.periods.d30', undefined, '30D') },
                                { id: '90D', label: t('analytics.periods.d90', undefined, '90D') },
                                { id: '1Y', label: t('analytics.periods.y1', undefined, '1Y') }
                            ].map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => setPeriod(p.id as any)}
                                    className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all active:scale-95 ${
                                        period === p.id 
                                            ? 'bg-white text-zinc-950 shadow-sm' 
                                            : 'text-zinc-400 hover:text-zinc-600'
                                    }`}
                                    aria-current={period === p.id ? 'step' : undefined}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <KpiCard
                            label={t('analytics.totalViews', undefined, 'Total Views')}
                            value={stats?.total_views.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US') ?? '0'}
                            icon={<TrendingUp className="w-5 h-5" />}
                            loading={statsLoading}
                            delta={{
                                value: viewsDelta.value,
                                isPositive: viewsDelta.isPositive,
                                timeframe: t('analytics.trend.vsPrevPeriod', undefined, 'vs prev period')
                            }}
                        />
                        <KpiCard
                            label={t('analytics.occupancy', undefined, 'Occupancy Rate')}
                            value={stats ? `${stats.occupancy_rate.toFixed(1)}%` : '0.0%'}
                            icon={<Home className="w-5 h-5" />}
                            loading={statsLoading}
                            delta={stats ? {
                                value: stats.occupancy_rate >= 80 ? 'Optimal' : 'Stable',
                                isPositive: stats.occupancy_rate >= 80,
                                timeframe: 'Lease status'
                            } : undefined}
                        />
                        <KpiCard
                            label={t('analytics.potentialRevenue', undefined, 'Potential Revenue')}
                            value={stats ? `${stats.revenue.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}€` : '0€'}
                            icon={<ArrowUpRight className="w-5 h-5" />}
                            loading={statsLoading}
                            delta={{
                                value: revenueDelta.value,
                                isPositive: revenueDelta.isPositive,
                                timeframe: t('analytics.trend.vsPrevPeriod', undefined, 'vs prev period')
                            }}
                        />
                        <KpiCard
                            label={t('analytics.activeListings', undefined, 'Active Listings')}
                            value={stats?.active_properties ?? 0}
                            icon={<Building className="w-5 h-5" />}
                            loading={statsLoading}
                        />
                    </div>

                    {/* Core Interactive Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        
                        {/* Left Main Chart - Views over Time */}
                        <div className="lg:col-span-2 glass-card !p-10 rounded-[2.5rem] border-zinc-100 shadow-xl relative overflow-hidden text-left flex flex-col">
                            <div className="mb-8">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-2">
                                    {t('analytics.viewsOverTime', undefined, 'Views Over Time')}
                                </h3>
                                <h2 className="text-3xl font-black text-zinc-950 tracking-tight">
                                    {t('analytics.trafficGrowth', undefined, 'Traffic & Visibility')}
                                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest ml-3">
                                        {period} Timeline
                                    </span>
                                </h2>
                            </div>
                            
                            <div className="h-64 flex items-end w-full">
                                {chartLoading ? (
                                    <div className="w-full h-full bg-zinc-50 animate-pulse rounded-2xl" />
                                ) : chartData?.points ? (
                                    <RevenueChart points={chartData.points} metric="views" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm font-black uppercase tracking-widest">
                                        No data available
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Secondary Chart - Applications Trend */}
                        <div className="glass-card !p-10 rounded-[2.5rem] border-zinc-100 shadow-xl relative overflow-hidden text-left flex flex-col">
                            <div className="mb-8">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-2">
                                    {t('analytics.applicationsTrend', undefined, 'Applications Trend')}
                                </h3>
                                <h2 className="text-3xl font-black text-zinc-950 tracking-tight">
                                    {t('analytics.conversionRate', undefined, 'Applications')}
                                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest ml-3">
                                        {period} Count
                                    </span>
                                </h2>
                            </div>

                            <div className="h-64 flex items-end w-full">
                                {chartLoading ? (
                                    <div className="w-full h-full bg-zinc-50 animate-pulse rounded-2xl" />
                                ) : chartData?.points ? (
                                    <RevenueChart points={chartData.points} metric="applications" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm font-black uppercase tracking-widest">
                                        No data available
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
