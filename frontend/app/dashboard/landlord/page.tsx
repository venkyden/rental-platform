'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSegment, SegmentBadge, FeatureGate } from '@/lib/SegmentContext';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import KpiCard from '@/components/dashboard/KpiCard';
import AlertCenter from '@/components/dashboard/AlertCenter';
import ComplianceWidget from '@/components/dashboard/ComplianceWidget';
import RevenueChart from '@/components/dashboard/RevenueChart';
import RoleSwitcher from '@/components/dashboard/RoleSwitcher';
import { Building, FileText, Calendar, Mail, ArrowUpRight, BarChart3, Users, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

interface OverviewStats {
    active_properties: number;
    total_properties: number;
    pending_applications: number;
    total_views: number;
    unread_messages: number;
    revenue: number;
    occupancy_rate: number;
}

interface VisitsStats {
    total_visits: number;
    upcoming_visits: number;
    pending_requests: number;
}

interface RevenueChartResponse {
    points: { date: string; views: number; applications: number; revenue: number }[];
}

export default function LandlordDashboard() {
    const { user, loading: authLoading } = useAuth();
    const { config, loading: segmentLoading } = useSegment();
    const { language, t } = useLanguage();
    const router = useRouter();

    const fetcher = (url: string) => apiClient.client.get(url, {
        headers: { 'Accept-Language': language }
    }).then(res => res.data);

    // Fetch Overview Stats (30s polling)
    const { data: stats, error: statsError, isLoading: statsLoading } = useSWR<OverviewStats>(
        '/stats/landlord/overview',
        fetcher,
        { refreshInterval: 30000 }
    );

    // Fetch Visits Stats
    const { data: visits, error: visitsError, isLoading: visitsLoading } = useSWR<VisitsStats>(
        '/stats/landlord/visits',
        fetcher,
        { refreshInterval: 30000 }
    );

    // Fetch timeseries revenue chart data (30D)
    const { data: chartData } = useSWR<RevenueChartResponse>(
        '/stats/landlord/revenue-chart?period=30D',
        fetcher,
        { refreshInterval: 30000 }
    );

    // Guard unauthorized direct access by non-landlords
    React.useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth/login');
        } else if (!authLoading && user && user.role !== 'landlord' && user.role !== 'property_manager' && user.role !== 'admin') {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    if (authLoading || segmentLoading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center" aria-live="polite">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-950"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="w-full space-y-12" role="main">
            {/* Header / Welcome Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight uppercase leading-none">
                        {t('dashboard.landlord.welcome', { name: user.full_name?.split(' ')[0] || user.email?.split('@')[0] }, 'Welcome back')}
                    </h1>
                    <div className="flex items-center gap-3 mt-4">
                        <SegmentBadge />
                        <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">
                            {t('dashboard.landlord.title', undefined, 'Landlord Command Center')}
                        </span>
                    </div>
                </div>
                {/* Role Switcher integrates standard header controls */}
                <div className="flex items-center gap-4 self-end sm:self-auto">
                    <RoleSwitcher currentRole={user.role} availableRoles={user.available_roles || [user.role]} />
                </div>
            </div>

            {/* Loi ALUR Onboarding banner for S1 — only while the landlord has no properties yet;
                segment is set once at signup and never recomputed, so without this check it
                would keep telling an active landlord to "add your first property" forever. */}
            {config?.settings.show_onboarding_tips && !statsLoading && (stats?.total_properties ?? 0) === 0 && (
                <div className="bg-zinc-950 text-white rounded-[2.5rem] shadow-2xl p-8 sm:p-12 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000"></div>
                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-white/10 rounded-2xl text-2xl shadow-inner">
                                🏠
                            </div>
                            <div className="text-left">
                                <h3 className="text-xl font-black uppercase tracking-wider">
                                    {t('dashboard.landlord.gettingStarted', undefined, 'Getting Started')}
                                </h3>
                                <p className="text-sm text-zinc-400 mt-2 font-medium max-w-lg leading-relaxed">
                                    {t('dashboard.landlord.gettingStartedDesc', undefined, 'Add your first property to start receiving applications in compliance with the French ALUR law.')}
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/properties/new"
                            className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-950 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-zinc-100 active:scale-95 transition-all text-center shadow-lg whitespace-nowrap"
                        >
                            {t('dashboard.landlord.addProperty', undefined, 'Add a Property')}
                        </Link>
                    </div>
                </div>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <KpiCard
                    label={t('dashboard.stats.properties', undefined, 'Properties')}
                    value={stats?.active_properties ?? 0}
                    icon={<Building className="w-5 h-5" />}
                    loading={statsLoading}
                    delta={stats ? {
                        value: stats.occupancy_rate + '%',
                        isPositive: stats.occupancy_rate >= 80,
                        timeframe: 'Occupancy Rate'
                    } : undefined}
                />
                <KpiCard
                    label={t('dashboard.stats.pendingApplications', undefined, 'Pending Applications')}
                    value={stats?.pending_applications ?? 0}
                    icon={<FileText className="w-5 h-5" />}
                    loading={statsLoading}
                    delta={stats ? {
                        value: stats.pending_applications > 0 ? `${stats.pending_applications} waiting` : 'Clean queue',
                        isPositive: stats.pending_applications === 0,
                        timeframe: 'Applications'
                    } : undefined}
                />
                <KpiCard
                    label={t('dashboard.landlord.visits', undefined, 'Scheduled Visits')}
                    value={visits?.upcoming_visits ?? 0}
                    icon={<Calendar className="w-5 h-5" />}
                    loading={visitsLoading}
                    delta={visits ? {
                        value: `${visits.total_visits} total slots`,
                        isPositive: true,
                        timeframe: 'Visits'
                    } : undefined}
                />
                <KpiCard
                    label={t('dashboard.stats.unread', undefined, 'Unread Messages')}
                    value={stats?.unread_messages ?? 0}
                    icon={<Mail className="w-5 h-5" />}
                    loading={statsLoading}
                    delta={stats ? {
                        value: stats.unread_messages > 0 ? `${stats.unread_messages} unread` : 'No new messages',
                        isPositive: stats.unread_messages === 0,
                        timeframe: 'Inbox'
                    } : undefined}
                />
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Alert Center & Compliance Widget */}
                <div className="lg:col-span-2 space-y-12">
                    <FeatureGate feature="inbox">
                        <AlertCenter />
                    </FeatureGate>

                    {/* Revenue & Trafic Analytics Sparkline Component */}
                    <FeatureGate feature="analytics">
                        <div className="glass-card !p-10 rounded-[2.5rem] border-zinc-100 shadow-xl relative overflow-hidden text-left">
                            <div className="flex justify-between items-center mb-8 px-2">
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400 mb-2">
                                        {t('dashboard.landlord.sections.analytics', undefined, 'Portfolio Traffic')}
                                    </h3>
                                    <h2 className="text-3xl font-black text-zinc-950 tracking-tight">
                                        {stats ? `${stats.revenue}€` : '0€'}
                                        <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest ml-3">
                                            {t('dashboard.landlord.revenue', undefined, 'Monthly Revenue')}
                                        </span>
                                    </h2>
                                </div>
                                <button
                                    onClick={() => router.push('/analytics')}
                                    className="p-3 bg-zinc-50 hover:bg-zinc-900 text-zinc-900 hover:text-white border border-zinc-100 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center justify-center"
                                    aria-label="View detailed analytics"
                                >
                                    <ArrowUpRight className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="h-64 flex items-end">
                                {chartData?.points ? (
                                    <RevenueChart points={chartData.points} metric="views" />
                                ) : (
                                    <div className="w-full h-full bg-zinc-50 animate-pulse rounded-2xl" />
                                )}
                            </div>
                        </div>
                    </FeatureGate>
                </div>

                {/* Right Side French Compliance & Team Panel */}
                <div className="space-y-12">
                    <ComplianceWidget />

                    {/* Team Workspace Gate */}
                    <FeatureGate feature="team">
                        <div className="glass-card !p-10 shadow-2xl border-white/40 rounded-[2.5rem] relative overflow-hidden text-left">
                            <div className="absolute top-0 left-0 w-full h-1 bg-zinc-950" />
                            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400 mb-6 flex items-center gap-3">
                                <Users className="w-4 h-4 text-zinc-950" />
                                {t('dashboard.landlord.myTeam', undefined, 'Collaborators')}
                            </h3>
                            <p className="text-sm font-semibold text-zinc-800 leading-relaxed mb-6">
                                {t('dashboard.landlord.collaborateDesc', undefined, 'Invite collaborators to manage your properties together.')}
                            </p>
                            <button
                                onClick={() => router.push('/team')}
                                className="w-full py-4 bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-md active:scale-95 transition-all"
                            >
                                {t('dashboard.landlord.inviteMember', undefined, 'Manage Team')}
                            </button>
                        </div>
                    </FeatureGate>
                </div>
            </div>
        </div>
    );
}
