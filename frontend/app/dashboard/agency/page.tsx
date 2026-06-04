'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSegment, SegmentBadge, FeatureGate } from '@/lib/SegmentContext';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import AgencyKpiRow from '@/components/dashboard/AgencyKpiRow';
import RoleSwitcher from '@/components/dashboard/RoleSwitcher';
import { Building, FileText, ShieldCheck, CheckCircle2, Clock, Plus, BarChart3, Download, Users, Network, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

interface AgencyStats {
    active_mandates: number;
    leased: number;
    applications: number;
    webhook_count: number;
    member_count: number;
    avg_rental_days: number;
    conversion_rate: number;
    managed_revenue: number;
}

interface UserProfile {
    role: string;
    full_name?: string;
    email?: string;
    available_roles: string[];
    kbis_verified?: boolean;
    carte_g_verified?: boolean;
}

export default function AgencyDashboard() {
    const { user, loading: authLoading } = useAuth();
    const { config, loading: segmentLoading } = useSegment();
    const { language, t } = useLanguage();
    const router = useRouter();

    const agencyUser = user as unknown as UserProfile;

    const fetcher = (url: string) => apiClient.client.get(url, {
        headers: { 'Accept-Language': language }
    }).then(res => res.data);

    // Fetch Agency Stats with SWR
    const { data: stats, error: statsError, isLoading: statsLoading } = useSWR<AgencyStats>(
        '/stats/agency/overview',
        fetcher,
        { refreshInterval: 30000 }
    );

    // Guard unauthorized direct access by non-property managers
    React.useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth/login');
        } else if (!authLoading && user && user.role !== 'property_manager' && user.role !== 'admin') {
            router.replace('/dashboard');
        }
    }, [user, authLoading, router]);

    const handleExportCSV = () => {
        if (!stats) return;
        const csvContent = "data:text/csv;charset=utf-8," 
            + "Metric,Value\n"
            + `Active Mandates,${stats.active_mandates}\n`
            + `Leased,${stats.leased}\n`
            + `Pending Applications,${stats.applications}\n`
            + `Average Rental Days,${stats.avg_rental_days}\n`
            + `Occupancy Conversion,${stats.conversion_rate}%\n`
            + `Managed Revenue,${stats.managed_revenue}€\n`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `roomivo_agency_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
            {/* Header & welcome */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight uppercase leading-none">
                        {t('dashboard.agency.welcome', { name: agencyUser.full_name?.split(' ')[0] || agencyUser.email?.split('@')[0] || 'User' }, 'Welcome back')}
                    </h1>
                    <div className="flex items-center gap-3 mt-4">
                        <SegmentBadge />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                            {t('dashboard.agency.title', undefined, 'Agency Portfolio Command Center')}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4 self-end sm:self-auto">
                    <RoleSwitcher currentRole={user.role} availableRoles={user.available_roles || [user.role]} />
                </div>
            </div>

            {/* Enterprise Quick Actions */}
            <section className="space-y-6">
                <h2 className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-400 px-2">
                    {t('dashboard.agency.enterpriseActions', undefined, 'Enterprise Actions')}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <Link
                        href="/bulk"
                        className="glass-card !p-8 flex flex-col items-start text-left hover:translate-y-[-8px] transition-all duration-300 group border-zinc-100 shadow-xl relative overflow-hidden"
                    >
                        <div className="mb-6 p-4 rounded-2xl bg-zinc-50 group-hover:bg-zinc-950 text-zinc-900 group-hover:text-white transition-all duration-300">
                            <Plus className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-black text-zinc-950 tracking-tight uppercase group-hover:text-zinc-950 transition-colors">
                            {t('dashboard.agency.bulkImport', undefined, 'Bulk Import')}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-2">
                            {t('dashboard.agency.csvXml', undefined, 'CSV / XML')}
                        </span>
                    </Link>

                    <Link
                        href="/gli"
                        className="glass-card !p-8 flex flex-col items-start text-left hover:translate-y-[-8px] transition-all duration-300 group border-zinc-100 shadow-xl relative overflow-hidden"
                    >
                        <div className="mb-6 p-4 rounded-2xl bg-zinc-50 group-hover:bg-zinc-950 text-zinc-900 group-hover:text-white transition-all duration-300">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-black text-zinc-950 tracking-tight uppercase group-hover:text-zinc-950 transition-colors">
                            {t('dashboard.agency.gliQuote', undefined, 'GLI Quote')}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-2">
                            {t('dashboard.agency.rentGuarantee', undefined, 'Rent Guarantee Insurance')}
                        </span>
                    </Link>

                    <Link
                        href="/webhooks"
                        className="glass-card !p-8 flex flex-col items-start text-left hover:translate-y-[-8px] transition-all duration-300 group border-zinc-100 shadow-xl relative overflow-hidden"
                    >
                        <div className="mb-6 p-4 rounded-2xl bg-zinc-50 group-hover:bg-zinc-950 text-zinc-900 group-hover:text-white transition-all duration-300">
                            <Network className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-black text-zinc-950 tracking-tight uppercase group-hover:text-zinc-950 transition-colors">
                            {t('dashboard.agency.erpIntegration', undefined, 'ERP Integration')}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-2">
                            {t('dashboard.agency.webhooksApi', undefined, 'Webhooks API')}
                        </span>
                    </Link>

                    <Link
                        href="/team"
                        className="glass-card !p-8 flex flex-col items-start text-left hover:translate-y-[-8px] transition-all duration-300 group border-zinc-100 shadow-xl relative overflow-hidden"
                    >
                        <div className="mb-6 p-4 rounded-2xl bg-zinc-50 group-hover:bg-zinc-950 text-zinc-900 group-hover:text-white transition-all duration-300">
                            <Users className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-black text-zinc-950 tracking-tight uppercase group-hover:text-zinc-950 transition-colors">
                            {t('dashboard.agency.team', undefined, 'Team')}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-2">
                            {t('dashboard.agency.accessManagement', undefined, 'Access Management')}
                        </span>
                    </Link>
                </div>
            </section>

            {/* KPI Performance Section */}
            <section className="space-y-6">
                <div className="flex justify-between items-center px-2">
                    <h2 className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-400">
                        {t('dashboard.agency.overview', undefined, 'Overview')}
                    </h2>
                    {stats && (
                        <button
                            onClick={handleExportCSV}
                            className="px-4 py-2 bg-zinc-50 hover:bg-zinc-950 text-zinc-900 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border border-zinc-100 flex items-center gap-2 shadow-sm"
                        >
                            <Download className="w-3.5 h-3.5" />
                            {t('dashboard.agency.export', undefined, 'Export CSV')}
                        </button>
                    )}
                </div>
                <AgencyKpiRow stats={stats ?? null} loading={statsLoading} />
            </section>

            {/* Mandate Management / GLI Summary & Compliance Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Mandate Management */}
                <div className="lg:col-span-2 space-y-12">
                    <div className="glass-card !p-10 rounded-[2.5rem] border-zinc-100 shadow-xl relative overflow-hidden text-left">
                        <div className="flex justify-between items-center mb-8 px-2">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                {t('dashboard.agency.mandateManagement', undefined, 'Mandate Management')}
                            </h2>
                            <Link href="/properties" className="text-xs font-black uppercase tracking-widest text-zinc-900 hover:text-zinc-500">
                                {t('dashboard.agency.viewAllProperties', undefined, 'View All Properties')} →
                            </Link>
                        </div>
                        <div className="p-8 rounded-[2rem] bg-zinc-50 border border-zinc-200 text-center flex flex-col items-center justify-center">
                            <Building className="w-12 h-12 text-zinc-400 mb-4" />
                            <p className="text-sm font-semibold text-zinc-800">
                                {t('dashboard.agency.activeMandatesCount', { count: stats?.active_mandates ?? 0 }, `Managing ${stats?.active_mandates ?? 0} active mandates`)}
                            </p>
                        </div>
                    </div>

                    {/* GLI Portfolio summary */}
                    <div className="glass-card !p-10 rounded-[2.5rem] border-zinc-100 shadow-xl relative overflow-hidden text-left">
                        <div className="flex justify-between items-center mb-8 px-2">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                                {t('dashboard.agency.rentGuarantee', undefined, 'Rent Guarantee Insurance (GLI)')}
                            </h2>
                            <Link href="/gli" className="text-xs font-black uppercase tracking-widest text-zinc-900 hover:text-zinc-500">
                                {t('dashboard.agency.requestQuote', undefined, 'Request Quote')} →
                            </Link>
                        </div>
                        <div className="p-8 rounded-[2rem] bg-zinc-50 border border-zinc-200 text-center flex flex-col items-center justify-center">
                            <CheckCircle2 className="w-12 h-12 text-zinc-900 mb-4" />
                            <p className="text-sm font-semibold text-zinc-800">
                                {stats ? `${stats.leased} ${t('dashboard.agency.propertiesWithGli', undefined, 'properties active with GLI coverage')}` : t('dashboard.agency.noPropertiesCovered', undefined, '0 properties covered')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Compliance & Verification panel */}
                <div className="space-y-12">
                    <div className="glass-card !p-10 shadow-2xl border-white/40 rounded-[2.5rem] relative overflow-hidden text-left">
                        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-950" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-8 flex items-center gap-3">
                            <ShieldCheck className="w-4 h-4 text-zinc-950" />
                            {t('dashboard.agency.compliance', undefined, 'Company Compliance')}
                        </h3>
                        
                        <div className="space-y-8">
                            {/* Kbis */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 flex-shrink-0">
                                        {agencyUser.kbis_verified ? (
                                            <CheckCircle2 className="w-5 h-5 text-zinc-950" />
                                        ) : (
                                            <Clock className="w-5 h-5 text-zinc-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-wider text-zinc-950">
                                            {t('dashboard.agency.kbisRegistration', undefined, 'Kbis extract')}
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-1 font-medium leading-relaxed">
                                            {agencyUser.kbis_verified 
                                                ? t('dashboard.agency.verifiedStatus', undefined, 'Verified status') 
                                                : t('dashboard.agency.kbisRequired', undefined, 'Extract < 3 months old required')
                                            }
                                        </p>
                                    </div>
                                </div>
                                {!agencyUser.kbis_verified && (
                                    <Link href="/verification" className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white text-[9px] font-black rounded-lg uppercase tracking-widest whitespace-nowrap self-center shadow-sm">
                                        {t('dashboard.agency.uploadKbis', undefined, 'Upload')}
                                    </Link>
                                )}
                            </div>

                            <div className="h-px bg-zinc-100" />

                            {/* Carte G */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 flex-shrink-0">
                                        {agencyUser.carte_g_verified ? (
                                            <CheckCircle2 className="w-5 h-5 text-zinc-950" />
                                        ) : (
                                            <Clock className="w-5 h-5 text-zinc-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-wider text-zinc-950">
                                            {t('dashboard.agency.carteG', undefined, 'Carte G license')}
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-1 font-medium leading-relaxed">
                                            {agencyUser.carte_g_verified 
                                                ? t('dashboard.agency.verifiedLicense', undefined, 'Verified manager license') 
                                                : t('dashboard.agency.carteGRequired', undefined, 'French license required')
                                            }
                                        </p>
                                    </div>
                                </div>
                                {!agencyUser.carte_g_verified && (
                                    <Link href="/verification" className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white text-[9px] font-black rounded-lg uppercase tracking-widest whitespace-nowrap self-center shadow-sm">
                                        {t('dashboard.agency.uploadCarteG', undefined, 'Upload')}
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
