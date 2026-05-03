'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSegment, QuickActions, SegmentBadge, FeatureGate } from '@/lib/SegmentContext';
import { useLanguage } from '@/lib/LanguageContext';
import RoleSwitcher from '@/components/dashboard/RoleSwitcher';

export default function LandlordDashboard() {
    const { user, loading: authLoading } = useAuth();
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
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Welcome Banner */}
            <div className="mb-8">
                <div className="flex items-center justify-between bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 p-6 sm:p-8">
                    <div>
                        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                            {t('dashboard.landlord.welcome', { name: user?.full_name || 'Landlord' }, undefined)}
                        </h1>
                        <div className="flex items-center gap-3 mt-2">
                            <SegmentBadge />
                            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                {t('dashboard.landlord.title', undefined, 'Landlord Dashboard')}
                            </span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Onboarding tips for S1 */}
            {config?.settings.show_onboarding_tips && (
                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-blue-200/50 dark:border-blue-900/30 p-6 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 rounded-2xl text-2xl">
                            
                        </div>
                        <div className="flex-grow text-left">
                            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">
                                {t('dashboard.landlord.gettingStarted', undefined, 'Getting Started')}
                            </h3>
                            <p className="text-sm text-blue-800/80 dark:text-blue-200/80 mt-1">
                                {t('dashboard.landlord.gettingStartedDesc', undefined, 'Add your first property to start receiving applications')}
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/properties/new')}
                            className="mt-4 sm:mt-0 w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-sm focus:ring-4 focus:ring-blue-500/20 active:scale-95"
                        >
                            {t('dashboard.landlord.addProperty', undefined, 'Add a Property')}
                        </button>
                    </div>
                </div>
            )}

            <section className="mb-8">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 pl-2 tracking-tight">
                    {t('dashboard.quickActions.title', undefined, 'Quick Actions')}
                </h2>
                <QuickActions />
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 pl-2 tracking-tight">
                    {t('dashboard.landlord.portfolio', undefined, 'My Portfolio')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white dark:hover:bg-zinc-900 transition-colors">
                        <div className="text-4xl font-extrabold text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">0</div>
                        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
                            {t('dashboard.landlord.activeProperties', undefined, 'Active Properties')}
                        </div>
                    </div>
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white dark:hover:bg-zinc-900 transition-colors">
                        <div className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">0</div>
                        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
                            {t('dashboard.landlord.applications', undefined, 'Applications')}
                        </div>
                    </div>
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white dark:hover:bg-zinc-900 transition-colors">
                        <div className="text-4xl font-extrabold text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">0</div>
                        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
                            {t('dashboard.landlord.visits', undefined, 'Scheduled Visits')}
                        </div>
                    </div>
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white dark:hover:bg-zinc-900 transition-colors">
                        <div className="text-4xl font-extrabold text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">0</div>
                        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
                            {t('dashboard.landlord.messages', undefined, 'Messages')}
                        </div>
                    </div>
                    <div 
                        onClick={() => router.push('/disputes')}
                        className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                        <div className="text-4xl font-extrabold text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">0</div>
                        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
                            {t('dashboard.landlord.activeDisputes', undefined, 'Active Disputes')}
                        </div>
                    </div>
                </div>
            </section>

            {/* Analytics for S2 */}
            <FeatureGate feature="analytics">
                <section className="mb-8">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 pl-2 tracking-tight">
                        {t('dashboard.landlord.sections.analytics', undefined, 'Analytics')}
                    </h2>
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/50 dark:border-white/10 p-8">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                            <div className="text-center sm:text-left">
                                <div className="text-4xl font-extrabold text-zinc-900 dark:text-white">0</div>
                                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                                    {t('dashboard.landlord.viewsMonth', undefined, 'Views This Month')}
                                </div>
                            </div>
                            <div className="text-center sm:text-left">
                                <div className="text-4xl font-extrabold text-zinc-900 dark:text-white">0%</div>
                                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                                    {t('dashboard.landlord.occupancyRate', undefined, 'Occupancy Rate')}
                                </div>
                            </div>
                            <div className="text-center sm:text-left">
                                <div className="text-4xl font-extrabold text-zinc-900 dark:text-white">0€</div>
                                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                                    {t('dashboard.landlord.revenue', undefined, 'Monthly Revenue')}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/analytics')}
                            className="mt-8 w-full py-3 px-4 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all focus:ring-4 focus:ring-zinc-200 max-w-sm mx-auto sm:mx-0 block"
                        >
                            {t('dashboard.landlord.viewDetailed', undefined, 'View detailed analytics')}
                        </button>
                    </div>
                </section>
            </FeatureGate>

            {/* Team for S2 */}
            <FeatureGate feature="team">
                <section className="mb-8">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
                            {t('dashboard.landlord.sections.team', undefined, 'My Team')}
                        </h2>
                        <button
                            onClick={() => router.push('/team')}
                            className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-500 transition-colors flex items-center gap-1"
                        >
                            {t('common.manage', undefined, 'Manage')} <span>→</span>
                        </button>
                    </div>
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/50 dark:border-white/10 p-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                {t('dashboard.landlord.collaborate', undefined, 'Collaborate efficiently')}
                            </h3>
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                                {t('dashboard.landlord.collaborateDesc', undefined, 'Invite collaborators to manage your properties together.')}
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/team')}
                            className="w-full sm:w-auto px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-colors shadow-sm focus:ring-4 focus:ring-teal-500/20 active:scale-95 whitespace-nowrap"
                        >
                            {t('dashboard.landlord.inviteMember', undefined, 'Invite a Member')}
                        </button>
                    </div>
                </section>
            </FeatureGate>

            {/* Inbox for S2 */}
            <FeatureGate feature="inbox">
                <section>
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
                            {t('dashboard.landlord.sections.inbox', undefined, 'Recent Messages')}
                        </h2>
                        <button
                            onClick={() => router.push('/inbox')}
                            className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-500 transition-colors flex items-center gap-1"
                        >
                            {t('common.viewAll', undefined, 'View all')} <span>→</span>
                        </button>
                    </div>
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/50 dark:border-white/10 p-8 text-center py-12">
                        <div className="text-4xl mb-3 opacity-50"></div>
                        <p className="text-base font-medium text-zinc-500 dark:text-zinc-400">
                            {t('dashboard.landlord.noMessages', undefined, 'No new messages yet.')}
                        </p>
                    </div>
                </section>
            </FeatureGate>
        </div>
    );
}
