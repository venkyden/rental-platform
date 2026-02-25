'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSegment, QuickActions, SegmentBadge } from '@/lib/SegmentContext';

export default function AgencyDashboard() {
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
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header - Dark theme for enterprise */}
            <header className="bg-gray-800 shadow-lg border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">
                                {user?.full_name || 'Agency'}
                            </h1>
                            <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
                                Enterprise ⭐
                            </span>
                        </div>
                        <span className="text-sm text-gray-400">Admin Console</span>
                    </div>
                    <button
                        onClick={() => router.push('/auth/logout')}
                        className="text-gray-400 hover:text-white"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Enterprise Quick Actions */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">Enterprise Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button
                            onClick={() => router.push('/bulk')}
                            className="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-purple-500 transition-colors"
                        >
                            <span className="text-3xl mb-2">📤</span>
                            <span className="text-white font-medium">Bulk Import</span>
                            <span className="text-xs text-gray-400">CSV / XML</span>
                        </button>
                        <button
                            onClick={() => router.push('/gli')}
                            className="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-green-500 transition-colors"
                        >
                            <span className="text-3xl mb-2">🛡️</span>
                            <span className="text-white font-medium">GLI Quote</span>
                            <span className="text-xs text-gray-400">Rent Guarantee Insurance</span>
                        </button>
                        <button
                            onClick={() => router.push('/webhooks')}
                            className="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors"
                        >
                            <span className="text-3xl mb-2">🔗</span>
                            <span className="text-white font-medium">ERP Integration</span>
                            <span className="text-xs text-gray-400">Webhooks API</span>
                        </button>
                        <button
                            onClick={() => router.push('/team')}
                            className="flex flex-col items-center p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-orange-500 transition-colors"
                        >
                            <span className="text-3xl mb-2">👥</span>
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
                            <div className="text-sm text-gray-400">Managed Properties</div>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                            <div className="text-3xl font-bold text-green-400">0</div>
                            <div className="text-sm text-gray-400">Active</div>
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
                                <div className="text-xs text-gray-400">Monthly Revenue</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Recent Activity */}
                <section>
                    <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center text-gray-400">
                        <p>No recent activity</p>
                    </div>
                </section>
            </main>
        </div>
    );
}
