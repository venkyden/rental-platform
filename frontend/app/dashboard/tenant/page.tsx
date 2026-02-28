'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSegment, QuickActions, SegmentBadge, FeatureGate } from '@/lib/SegmentContext';

export default function TenantDashboard() {
    const { user, loading: authLoading } = useAuth();
    const { config, loading: segmentLoading } = useSegment();
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
                            Welcome, {user?.full_name || 'Tenant'}
                        </h1>
                        <div className="flex items-center gap-3 mt-2">
                            <SegmentBadge />
                            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Tenant Dashboard</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Verification prompt for D1 */}
            {/* Contextual Verification Prompts (v3) */}
            <FeatureGate feature="verification">
                {!user?.identity_verified && (
                    <>
                        {/* D1: Guarantor Focus */}
                        {config?.settings.verification_flow === 'guarantor' && (
                            <div className="bg-indigo-50/80 dark:bg-indigo-900/20 backdrop-blur-xl rounded-3xl shadow-sm border border-indigo-200/50 dark:border-indigo-800/30 p-6 mb-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
                                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl text-2xl">
                                        🤝
                                    </div>
                                    <div className="flex-grow text-left">
                                        <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">Add a Guarantor</h3>
                                        <p className="text-sm text-indigo-800/80 dark:text-indigo-200/80 mt-1">
                                            Multiply your chances by 3x with a complete dossier.
                                            <span className="block font-semibold mt-1">Compatible with Visale & Garantme</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => router.push('/verify/guarantor')}
                                        className="mt-4 sm:mt-0 w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-sm focus:ring-4 focus:ring-indigo-500/20 active:scale-95 whitespace-nowrap"
                                    >
                                        Add Guarantor
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* D2: Income Focus */}
                        {config?.settings.verification_flow === 'income' && (
                            <div className="bg-emerald-50/80 dark:bg-emerald-900/20 backdrop-blur-xl rounded-3xl shadow-sm border border-emerald-200/50 dark:border-emerald-800/30 p-6 mb-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
                                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl text-2xl">
                                        💼
                                    </div>
                                    <div className="flex-grow text-left">
                                        <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">Income Proof</h3>
                                        <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80 mt-1">
                                            Prove your financial stability to reassure landlords.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => router.push('/verify/income')}
                                        className="mt-4 sm:mt-0 w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors shadow-sm focus:ring-4 focus:ring-emerald-500/20 active:scale-95 whitespace-nowrap"
                                    >
                                        Upload Proof
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* D3: Identity Focus */}
                        {config?.settings.verification_flow === 'identity' && (
                            <div className="bg-purple-50/80 dark:bg-purple-900/20 backdrop-blur-xl rounded-3xl shadow-sm border border-purple-200/50 dark:border-purple-800/30 p-6 mb-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
                                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-purple-100 dark:bg-purple-900/50 rounded-2xl text-2xl">
                                        🛂
                                    </div>
                                    <div className="flex-grow text-left">
                                        <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100">Identity & Visa</h3>
                                        <p className="text-sm text-purple-800/80 dark:text-purple-200/80 mt-1">
                                            Validate your residency status to access rentals.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => router.push('/verify/identity')}
                                        className="mt-4 sm:mt-0 w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors shadow-sm focus:ring-4 focus:ring-purple-500/20 active:scale-95 whitespace-nowrap"
                                    >
                                        Verify Identity
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Fallback for legacy D1 logic if settings are missing */}
                        {config?.settings.show_verification_prompt && !config?.settings.verification_flow && (
                            <div className="bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur-xl rounded-3xl shadow-sm border border-amber-200/50 dark:border-amber-800/30 p-6 mb-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
                                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-amber-100 dark:bg-amber-900/50 rounded-2xl text-2xl">
                                        ⚠️
                                    </div>
                                    <div className="flex-grow text-left">
                                        <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">Complete your profile</h3>
                                        <p className="text-sm text-amber-800/80 dark:text-amber-200/80 mt-1">
                                            Verify your identity to access more properties.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => router.push('/verify')}
                                        className="mt-4 sm:mt-0 w-full sm:w-auto px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-colors shadow-sm focus:ring-4 focus:ring-amber-500/20 active:scale-95 whitespace-nowrap"
                                    >
                                        Verify Now
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </FeatureGate>

            {/* Quick Actions */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 pl-2 tracking-tight">Quick Actions</h2>
                <QuickActions />
            </section>

            {/* Stats for experienced tenants */}
            <FeatureGate feature="history">
                <section className="mb-8">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 pl-2 tracking-tight">My Activity</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white dark:hover:bg-zinc-900 transition-colors">
                            <div className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Applications</div>
                        </div>
                        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white dark:hover:bg-zinc-900 transition-colors">
                            <div className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Scheduled Visits</div>
                        </div>
                        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white/50 dark:border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white dark:hover:bg-zinc-900 transition-colors">
                            <div className="text-4xl font-extrabold text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">0</div>
                            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Favorites</div>
                        </div>
                    </div>
                </section>
            </FeatureGate>

            {/* Premium badge for D3 */}
            <FeatureGate feature="relocation">
                <section className="mb-8">
                    <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 rounded-3xl p-8 sm:p-10 text-white shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                            <div>
                                <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                                    <span className="text-3xl filter drop-shadow-md">✨</span>
                                    <h2 className="text-2xl font-extrabold tracking-tight">Premium Services</h2>
                                </div>
                                <p className="text-purple-100 font-medium">
                                    Take advantage of our relocation services for your professional mobility
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/relocation')}
                                className="w-full sm:w-auto px-8 py-3.5 bg-white text-purple-700 hover:bg-purple-50 font-bold rounded-xl transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-white/30 active:scale-95 whitespace-nowrap"
                            >
                                Discover
                            </button>
                        </div>
                    </div>
                </section>
            </FeatureGate>

            {/* Recent searches */}
            <section className="mb-8">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 pl-2 tracking-tight">Recent Searches</h2>
                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/50 dark:border-white/10 p-8 text-center py-12 flex flex-col items-center justify-center">
                    <div className="text-4xl mb-3 opacity-50">🔍</div>
                    <p className="text-base font-medium text-zinc-500 dark:text-zinc-400 mb-4">You haven't made any searches yet.</p>
                    <button
                        onClick={() => router.push('/search')}
                        className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-colors shadow-sm focus:ring-4 focus:ring-teal-500/20 active:scale-95"
                    >
                        Search for a property
                    </button>
                </div>
            </section>
        </div>
    );
}
