'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import { DashboardCardSkeleton } from '@/components/SkeletonLoaders';
import { useToast } from '@/lib/ToastContext';

interface PropertyStats {
    total: number;
    active: number;
    draft: number;
    total_views: number;
}

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const toast = useToast();
    const [resendingEmail, setResendingEmail] = useState(false);
    const [stats, setStats] = useState<PropertyStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [recentConversations, setRecentConversations] = useState<any[]>([]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!user || user.role !== 'landlord') {
                setLoadingStats(false);
                return;
            }

            try {
                const response = await apiClient.client.get('/properties');
                const properties = response.data;

                const statsData: PropertyStats = {
                    total: properties.length,
                    active: properties.filter((p: any) => p.status === 'active').length,
                    draft: properties.filter((p: any) => p.status === 'draft').length,
                    total_views: properties.reduce((sum: number, p: any) => sum + (p.views_count || 0), 0),
                };

                setStats(statsData);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoadingStats(false);
            }
        };

        fetchStats();
        fetchInboxData();
    }, [user]);

    // Fetch inbox data
    const fetchInboxData = async () => {
        try {
            const [countRes, inboxRes] = await Promise.all([
                apiClient.client.get('/inbox/unread-count'),
                apiClient.client.get('/inbox?limit=3')
            ]);
            setUnreadCount(countRes.data.total_unread);
            setRecentConversations(inboxRes.data);
        } catch (error) {
            console.error('Failed to fetch inbox:', error);
        }
    };

    if (!user) return null;

    async function handleResendVerification() {
        setResendingEmail(true);

        try {
            await apiClient.resendVerification();
            toast.success('Verification email sent! Check your inbox.');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to send email');
        } finally {
            setResendingEmail(false);
        }
    }

    const quickActions = [
        {
            icon: '🏠',
            title: 'New Property',
            description: 'List a new property',
            action: () => router.push('/properties/new'),
            show: user.role === 'landlord',
        },
        {
            icon: '🔍',
            title: 'Browse Properties',
            description: 'Find your next home',
            action: () => router.push('/properties'),
            show: true,
        },
        {
            icon: '✅',
            title: 'Complete Verification',
            description: 'Verify your identity',
            action: () => router.push('/verification'),
            show: !user.identity_verified || !user.employment_verified,
        },
        {
            icon: '📬',
            title: 'Messages',
            description: unreadCount > 0 ? `${unreadCount} unread` : 'View inbox',
            action: () => router.push('/inbox'),
            show: true,
            badge: unreadCount > 0 ? unreadCount : null,
        },
        {
            icon: '👤',
            title: 'Onboarding',
            description: 'Complete your profile',
            action: () => router.push('/onboarding'),
            show: !user.onboarding_completed,
        },
    ];

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                {/* Header */}
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                        <button
                            onClick={logout}
                            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                        >
                            Logout
                        </button>
                    </div>
                </header>

                {/* Main content */}
                <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="px-4 py-6 sm:px-0">
                        {/* Welcome card */}
                        <div className="bg-white overflow-hidden shadow-xl rounded-xl mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            <div className="px-6 py-8">
                                <h2 className="text-3xl font-bold mb-2">
                                    Welcome back, {user.full_name}! 👋
                                </h2>
                                <p className="text-blue-100 text-lg">
                                    Role: {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                </p>
                            </div>
                        </div>

                        {/* Property Stats (Landlords only) */}
                        {user.role === 'landlord' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                                {loadingStats ? (
                                    <>
                                        <DashboardCardSkeleton />
                                        <DashboardCardSkeleton />
                                        <DashboardCardSkeleton />
                                        <DashboardCardSkeleton />
                                    </>
                                ) : stats ? (
                                    <>
                                        <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-gray-600 text-sm font-medium">Total Properties</h3>
                                                <span className="text-2xl">🏢</span>
                                            </div>
                                            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                                            <p className="text-xs text-gray-500 mt-1">All your listings</p>
                                        </div>

                                        <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-gray-600 text-sm font-medium">Active Listings</h3>
                                                <span className="text-2xl">✅</span>
                                            </div>
                                            <p className="text-3xl font-bold text-green-600">{stats.active}</p>
                                            <p className="text-xs text-gray-500 mt-1">Live on platform</p>
                                        </div>

                                        <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-gray-600 text-sm font-medium">Draft Properties</h3>
                                                <span className="text-2xl">📝</span>
                                            </div>
                                            <p className="text-3xl font-bold text-yellow-600">{stats.draft}</p>
                                            <p className="text-xs text-gray-500 mt-1">Pending publication</p>
                                        </div>

                                        <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-gray-600 text-sm font-medium">Total Views</h3>
                                                <span className="text-2xl">👁️</span>
                                            </div>
                                            <p className="text-3xl font-bold text-blue-600">{stats.total_views}</p>
                                            <p className="text-xs text-gray-500 mt-1">All time</p>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {quickActions.filter(action => action.show).map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={action.action}
                                        className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl hover:scale-105 transition transform text-left"
                                    >
                                        <div className="text-4xl mb-3">{action.icon}</div>
                                        <h4 className="font-bold text-gray-900 mb-1">{action.title}</h4>
                                        <p className="text-sm text-gray-600">{action.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Inbox Preview Widget */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    📬 Messages
                                    {unreadCount > 0 && (
                                        <span className="px-2 py-0.5 bg-red-500 text-white text-sm rounded-full">
                                            {unreadCount}
                                        </span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => router.push('/inbox')}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                    Voir tout →
                                </button>
                            </div>

                            {recentConversations.length > 0 ? (
                                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                                    {recentConversations.map((conv, idx) => (
                                        <button
                                            key={conv.id}
                                            onClick={() => router.push('/inbox')}
                                            className={`w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-start gap-3 ${idx !== recentConversations.length - 1 ? 'border-b' : ''}`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                                                {conv.other_party_name?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`font-medium truncate ${conv.unread_count > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                                                        {conv.other_party_name}
                                                    </span>
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                                        {new Date(conv.last_message_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 truncate">
                                                    🏠 {conv.property_title}
                                                </p>
                                                <p className={`text-sm truncate mt-1 ${conv.unread_count > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {conv.last_message_preview || conv.subject}
                                                </p>
                                            </div>
                                            {conv.unread_count > 0 && (
                                                <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                                    <span className="text-4xl mb-3 block">📭</span>
                                    <p>Aucun message</p>
                                    <p className="text-sm mt-1">Vos conversations apparaîtront ici</p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Verification status */}
                            <div className="bg-white overflow-hidden shadow-xl rounded-xl">
                                <div className="px-6 py-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                                        Verification Status
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                            <div className="flex items-center">
                                                <span className="mr-3 text-2xl">
                                                    {user.email_verified ? '✅' : '⏳'}
                                                </span>
                                                <div>
                                                    <span className="text-gray-900 font-medium">Email Verification</span>
                                                    <p className="text-xs text-gray-500">
                                                        {user.email_verified ? 'Verified' : 'Pending verification'}
                                                    </p>
                                                </div>
                                            </div>
                                            {!user.email_verified && (
                                                <button
                                                    onClick={handleResendVerification}
                                                    disabled={resendingEmail}
                                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                                                >
                                                    {resendingEmail ? 'Sending...' : 'Resend'}
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                            <div className="flex items-center">
                                                <span className="mr-3 text-2xl">
                                                    {user.identity_verified ? '✅' : '⏳'}
                                                </span>
                                                <div>
                                                    <span className="text-gray-900 font-medium">Identity Verification</span>
                                                    <p className="text-xs text-gray-500">
                                                        {user.identity_verified ? 'Verified' : 'Not started'}
                                                    </p>
                                                </div>
                                            </div>
                                            {!user.identity_verified && (
                                                <button
                                                    onClick={() => router.push('/verification')}
                                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                                >
                                                    Start →
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                            <div className="flex items-center">
                                                <span className="mr-3 text-2xl">
                                                    {user.employment_verified ? '✅' : '⏳'}
                                                </span>
                                                <div>
                                                    <span className="text-gray-900 font-medium">Employment Verification</span>
                                                    <p className="text-xs text-gray-500">
                                                        {user.employment_verified ? 'Verified' : 'Not started'}
                                                    </p>
                                                </div>
                                            </div>
                                            {!user.employment_verified && (
                                                <button
                                                    onClick={() => router.push('/verification')}
                                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                                >
                                                    Start →
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Trust score */}
                            <div className="bg-white overflow-hidden shadow-xl rounded-xl">
                                <div className="px-6 py-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                                        Trust Score
                                    </h3>
                                    <div className="flex flex-col items-center justify-center py-8">
                                        <div className="relative">
                                            <svg className="transform -rotate-90 w-32 h-32">
                                                <circle
                                                    cx="64"
                                                    cy="64"
                                                    r="56"
                                                    stroke="#E5E7EB"
                                                    strokeWidth="8"
                                                    fill="none"
                                                />
                                                <circle
                                                    cx="64"
                                                    cy="64"
                                                    r="56"
                                                    stroke="#3B82F6"
                                                    strokeWidth="8"
                                                    fill="none"
                                                    strokeDasharray={`${(user.trust_score / 100) * 351.858} 351.858`}
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                                <div className="text-4xl font-bold text-blue-600">
                                                    {user.trust_score}
                                                </div>
                                                <div className="text-sm text-gray-500">/100</div>
                                            </div>
                                        </div>
                                        <p className="mt-6 text-center text-gray-600">
                                            Complete verifications to boost your score
                                        </p>
                                        {user.trust_score < 100 && (
                                            <button
                                                onClick={() => router.push('/verification')}
                                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                            >
                                                Improve Score →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
