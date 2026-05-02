'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSegment, QuickActions, SegmentBadge } from '@/lib/SegmentContext';
import { CheckCircle2, Clock, ShieldCheck, FileText, Building } from 'lucide-react';
import RoleSwitcher from '@/components/dashboard/RoleSwitcher';

export default function AgencyDashboard() {
    const { user, logout, loading: authLoading } = useAuth();
    const { config, loading: segmentLoading } = useSegment();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
        }
    }, [user, authLoading, router]);

    if (authLoading || segmentLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">


            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Enterprise Quick Actions */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">Enterprise Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button
                            onClick={() => router.push('/bulk')}
                            className="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-purple-500 transition-colors"
                        >
                            <span className="text-3xl mb-2"></span>
                            <span className="text-white font-medium">Bulk Import</span>
                            <span className="text-xs text-gray-400">CSV / XML</span>
                        </button>
                        <button
                            onClick={() => router.push('/gli')}
                            className="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-green-500 transition-colors"
                        >
                            <span className="text-3xl mb-2">️</span>
                            <span className="text-white font-medium">GLI Quote</span>
                            <span className="text-xs text-gray-400">Rent Guarantee Insurance</span>
                        </button>
                        <button
                            onClick={() => router.push('/webhooks')}
                            className="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors"
                        >
                            <span className="text-3xl mb-2"></span>
                            <span className="text-white font-medium">ERP Integration</span>
                            <span className="text-xs text-gray-400">Webhooks API</span>
                        </button>
                        <button
                            onClick={() => router.push('/team')}
                            className="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-orange-500 transition-colors"
                        >
                            <span className="text-3xl mb-2"></span>
                            <span className="text-white font-medium">Team</span>
                            <span className="text-xs text-gray-400">Access Management</span>
                        </button>
                    </div>
                </section>

                {/* Portfolio Overview */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">Overview</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                            <div className="text-3xl font-bold text-white">0</div>
                            <div className="text-sm text-gray-400">Active Mandates</div>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                            <div className="text-3xl font-bold text-green-400">0</div>
                            <div className="text-sm text-gray-400">Leased</div>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                            <div className="text-3xl font-bold text-blue-400">0</div>
                            <div className="text-sm text-gray-400">Applications</div>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                            <div className="text-3xl font-bold text-orange-400">0</div>
                            <div className="text-sm text-gray-400">Webhooks</div>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                            <div className="text-3xl font-bold text-purple-400">0</div>
                            <div className="text-sm text-gray-400">Members</div>
                        </div>
                    </div>
                </section>

                {/* Analytics */}
                <section className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-white">Analytics</h2>
                        <button className="text-sm text-purple-400 hover:text-purple-300">
                            Export →
                        </button>
                    </div>
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <div className="grid grid-cols-4 gap-6 text-center">
                            <div>
                                <div className="text-2xl font-bold text-white">0</div>
                                <div className="text-xs text-gray-400">Total Views</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">0%</div>
                                <div className="text-xs text-gray-400">Conversion Rate</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">0j</div>
                                <div className="text-xs text-gray-400">Avg. Rental Time</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">0€</div>
                                <div className="text-xs text-gray-400">Managed Revenue</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Recent Activity */}
                <section>
                    <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center text-gray-400 mb-8">
                        <p>No recent activity</p>
                    </div>
                </section>

                {/* Compliance & Verification */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="w-5 h-5 text-purple-400" />
                        <h2 className="text-lg font-semibold text-white">Compliance & Verifications</h2>
                    </div>
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <div className="space-y-6">
                            
                            {/* Kbis Verification */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {(user as any)?.kbis_verified ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <Clock className="w-5 h-5 text-amber-500" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">Kbis Registration</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {(user as any)?.kbis_verified ? 'Verified Company Status' : 'Extract less than 3 months old required'}
                                        </p>
                                    </div>
                                </div>
                                {!(user as any)?.kbis_verified && (
                                    <button
                                        onClick={() => router.push('/verification')}
                                        className="text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Building className="w-4 h-4" />
                                        Upload Kbis
                                    </button>
                                )}
                            </div>

                            <div className="w-full h-px bg-gray-700"></div>

                            {/* Carte G Verification */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {(user as any)?.carte_g_verified ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <Clock className="w-5 h-5 text-amber-500" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">Carte G (Professional License)</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {(user as any)?.carte_g_verified ? 'Verified Property Management License' : 'Required for property management in France'}
                                        </p>
                                    </div>
                                </div>
                                {!(user as any)?.carte_g_verified && (
                                    <button
                                        onClick={() => router.push('/verification')}
                                        className="text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Upload Carte G
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
