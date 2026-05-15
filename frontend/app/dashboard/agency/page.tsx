'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSegment, QuickActions, SegmentBadge } from '@/lib/SegmentContext';
import { useLanguage } from '@/lib/LanguageContext';
import { CheckCircle2, Clock, ShieldCheck, FileText, Building } from 'lucide-react';

export default function AgencyDashboard() {
    const { user, logout, loading: authLoading } = useAuth();
    const { config, loading: segmentLoading } = useSegment();
    const { t } = useLanguage();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
        }
    }, [user, authLoading, router]);

    if (authLoading || segmentLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50">


            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Enterprise Quick Actions */}
                <section className="mb-8">
                    <h2 className="text-lg font-bold text-zinc-900 mb-4 uppercase tracking-wider">
                        {t('dashboard.agency.enterpriseActions', undefined, 'Enterprise Actions')}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button
                            onClick={() => router.push('/bulk')}
                            className="flex flex-col items-center p-6 bg-white rounded-2xl border border-zinc-200 hover:border-zinc-900 transition-all hover:shadow-lg group"
                        >
                            <span className="text-3xl mb-2"></span>
                            <span className="text-zinc-900 font-bold group-hover:scale-105 transition-transform">{t('dashboard.agency.bulkImport', undefined, 'Bulk Import')}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('dashboard.agency.csvXml', undefined, 'CSV / XML')}</span>
                        </button>
                        <button
                            onClick={() => router.push('/gli')}
                            className="flex flex-col items-center p-6 bg-white rounded-2xl border border-zinc-200 hover:border-zinc-900 transition-all hover:shadow-lg group"
                        >
                            <span className="text-3xl mb-2">️</span>
                            <span className="text-zinc-900 font-bold group-hover:scale-105 transition-transform">{t('dashboard.agency.gliQuote', undefined, 'GLI Quote')}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('dashboard.agency.rentGuarantee', undefined, 'Rent Guarantee Insurance')}</span>
                        </button>
                        <button
                            onClick={() => router.push('/webhooks')}
                            className="flex flex-col items-center p-6 bg-white rounded-2xl border border-zinc-200 hover:border-zinc-900 transition-all hover:shadow-lg group"
                        >
                            <span className="text-3xl mb-2"></span>
                            <span className="text-zinc-900 font-bold group-hover:scale-105 transition-transform">{t('dashboard.agency.erpIntegration', undefined, 'ERP Integration')}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('dashboard.agency.webhooksApi', undefined, 'Webhooks API')}</span>
                        </button>
                        <button
                            onClick={() => router.push('/team')}
                            className="flex flex-col items-center p-6 bg-white rounded-2xl border border-zinc-200 hover:border-zinc-900 transition-all hover:shadow-lg group"
                        >
                            <span className="text-3xl mb-2"></span>
                            <span className="text-zinc-900 font-bold group-hover:scale-105 transition-transform">{t('dashboard.agency.team', undefined, 'Team')}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('dashboard.agency.accessManagement', undefined, 'Access Management')}</span>
                        </button>
                    </div>
                </section>

                {/* Portfolio Overview */}
                <section className="mb-8">
                    <h2 className="text-lg font-bold text-zinc-900 mb-4 uppercase tracking-wider">{t('dashboard.agency.overview', undefined, 'Overview')}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-3xl font-black text-zinc-900">0</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{t('dashboard.agency.activeMandates', undefined, 'Active Mandates')}</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-3xl font-black text-zinc-900">0</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{t('dashboard.agency.leased', undefined, 'Leased')}</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-3xl font-black text-zinc-900">0</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{t('dashboard.agency.applications', undefined, 'Applications')}</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-3xl font-black text-zinc-900">0</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{t('dashboard.agency.webhooks', undefined, 'Webhooks')}</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="text-3xl font-black text-zinc-900">0</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{t('dashboard.agency.members', undefined, 'Members')}</div>
                        </div>
                    </div>
                </section>

                {/* Analytics */}
                <section className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-zinc-900 uppercase tracking-wider">{t('dashboard.agency.analytics', undefined, 'Analytics')}</h2>
                        <button className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900 hover:text-zinc-600 transition-colors">
                            {t('dashboard.agency.export', undefined, 'Export')} →
                        </button>
                    </div>
                    <div className="bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
                        <div className="grid grid-cols-4 gap-6 text-center">
                            <div>
                                <div className="text-2xl font-black text-zinc-900">0</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{t('dashboard.agency.totalViews', undefined, 'Total Views')}</div>
                            </div>
                            <div>
                                <div className="text-2xl font-black text-zinc-900">0%</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{t('dashboard.agency.conversionRate', undefined, 'Conversion Rate')}</div>
                            </div>
                            <div>
                                <div className="text-2xl font-black text-zinc-900">0{t('dashboard.agency.daysSuffix', undefined, 'd')}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{t('dashboard.agency.avgRentalTime', undefined, 'Avg. Rental Time')}</div>
                            </div>
                            <div>
                                <div className="text-2xl font-black text-zinc-900">0€</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{t('dashboard.agency.managedRevenue', undefined, 'Managed Revenue')}</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Recent Activity */}
                <section>
                    <h2 className="text-lg font-bold text-zinc-900 mb-4 uppercase tracking-wider">{t('dashboard.agency.recentActivity', undefined, 'Recent Activity')}</h2>
                    <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-zinc-400 mb-8 shadow-sm">
                        <p className="text-sm font-medium">{t('dashboard.agency.noActivity', undefined, 'No recent activity')}</p>
                    </div>
                </section>

                {/* Compliance & Verification */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="w-5 h-5 text-zinc-900" />
                        <h2 className="text-lg font-bold text-zinc-900 uppercase tracking-wider">{t('dashboard.agency.compliance', undefined, 'Compliance & Verifications')}</h2>
                    </div>
                    <div className="bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
                        <div className="space-y-8">
                            
                            {/* Kbis Verification */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1">
                                        {(user as any)?.kbis_verified ? (
                                            <CheckCircle2 className="w-6 h-6 text-zinc-900" />
                                        ) : (
                                            <Clock className="w-6 h-6 text-zinc-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-base font-bold text-zinc-900">{t('dashboard.agency.kbisRegistration', undefined, 'Kbis Registration')}</p>
                                        <p className="text-sm text-zinc-500 mt-1">
                                            {(user as any)?.kbis_verified ? t('dashboard.agency.verifiedStatus', undefined, 'Verified Company Status') : t('dashboard.agency.kbisRequired', undefined, 'Extract less than 3 months old required')}
                                        </p>
                                    </div>
                                </div>
                                {!(user as any)?.kbis_verified && (
                                    <button
                                        onClick={() => router.push('/verification')}
                                        className="text-[10px] font-black uppercase tracking-widest text-zinc-900 border-2 border-zinc-900 px-6 py-2.5 rounded-xl hover:bg-zinc-900 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        <Building className="w-4 h-4" />
                                        {t('dashboard.agency.uploadKbis', undefined, 'Upload Kbis')}
                                    </button>
                                )}
                            </div>

                            <div className="w-full h-px bg-zinc-100"></div>

                            {/* Carte G Verification */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1">
                                        {(user as any)?.carte_g_verified ? (
                                            <CheckCircle2 className="w-6 h-6 text-zinc-900" />
                                        ) : (
                                            <Clock className="w-6 h-6 text-zinc-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-base font-bold text-zinc-900">{t('dashboard.agency.carteG', undefined, 'Carte G (Professional License)')}</p>
                                        <p className="text-sm text-zinc-500 mt-1">
                                            {(user as any)?.carte_g_verified ? t('dashboard.agency.verifiedLicense', undefined, 'Verified Property Management License') : t('dashboard.agency.carteGRequired', undefined, 'Required for property management in France')}
                                        </p>
                                    </div>
                                </div>
                                {!(user as any)?.carte_g_verified && (
                                    <button
                                        onClick={() => router.push('/verification')}
                                        className="text-[10px] font-black uppercase tracking-widest text-zinc-900 border-2 border-zinc-900 px-6 py-2.5 rounded-xl hover:bg-zinc-900 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        <FileText className="w-4 h-4" />
                                        {t('dashboard.agency.uploadCarteG', undefined, 'Upload Carte G')}
                                    </button>
                                )}
                            </div>

                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
