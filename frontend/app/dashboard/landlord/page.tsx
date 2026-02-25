'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSegment, QuickActions, SegmentBadge, FeatureGate } from '@/lib/SegmentContext';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function LandlordDashboard() {
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-[var(--background)]">
                <Navbar />

                {/* Welcome Banner */}
                <div className="max-w-7xl mx-auto px-4 pt-2 pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Welcome, {user?.full_name || 'Landlord'}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <SegmentBadge />
                                <span className="text-sm text-gray-500">Landlord Dashboard</span>
                            </div>
                        </div>
                    </div>
                </div>

                <main className="max-w-7xl mx-auto px-4 py-8">
                    {/* Onboarding tips for S1 */}
                    {config?.settings.show_onboarding_tips && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">💡</span>
                                <div>
                                    <h3 className="font-medium text-blue-800">Getting Started</h3>
                                    <p className="text-sm text-blue-700">
                                        Add your first property to start receiving applications
                                    </p>
                                </div>
                                <button
                                    onClick={() => router.push('/properties/new')}
                                    className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                                >
                                    Add a Property
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Quick Actions */}
                    <section className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                        <QuickActions />
                    </section>

                    {/* Portfolio Stats */}
                    <section className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Portfolio</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm">
                                <div className="text-2xl font-bold text-green-600">0</div>
                                <div className="text-sm text-gray-500">Active Properties</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm">
                                <div className="text-2xl font-bold text-blue-600">0</div>
                                <div className="text-sm text-gray-500">Applications</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm">
                                <div className="text-2xl font-bold text-orange-600">0</div>
                                <div className="text-sm text-gray-500">Scheduled Visits</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm">
                                <div className="text-2xl font-bold text-purple-600">0</div>
                                <div className="text-sm text-gray-500">Messages</div>
                            </div>
                        </div>
                    </section>

                    {/* Analytics for S2 */}
                    <FeatureGate feature="analytics">
                        <section className="mb-8">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Analytics</h2>
                            <div className="bg-white rounded-xl shadow-sm p-6">
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-gray-900">0</div>
                                        <div className="text-sm text-gray-500">Views This Month</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-gray-900">0%</div>
                                        <div className="text-sm text-gray-500">Occupancy Rate</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-gray-900">0€</div>
                                        <div className="text-sm text-gray-500">Monthly Revenue</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push('/analytics')}
                                    className="mt-4 w-full py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                                >
                                    View detailed analytics
                                </button>
                            </div>
                        </section>
                    </FeatureGate>

                    {/* Team for S2 */}
                    <FeatureGate feature="team">
                        <section className="mb-8">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">My Team</h2>
                                <button
                                    onClick={() => router.push('/team')}
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                    Manage →
                                </button>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
                                <p>Invite collaborators to manage your properties</p>
                                <button
                                    onClick={() => router.push('/team')}
                                    className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg"
                                >
                                    Invite a Member
                                </button>
                            </div>
                        </section>
                    </FeatureGate>

                    {/* Inbox for S2 */}
                    <FeatureGate feature="inbox">
                        <section>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">Recent Messages</h2>
                                <button
                                    onClick={() => router.push('/inbox')}
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                    View all →
                                </button>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
                                <p>No messages</p>
                            </div>
                        </section>
                    </FeatureGate>
                </main>
            </div>
        </ProtectedRoute>
    );
}
