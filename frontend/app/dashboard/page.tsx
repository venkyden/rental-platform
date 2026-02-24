'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import EmptyState from '@/components/EmptyState';
import { apiClient } from '@/lib/api';
import { DashboardCardSkeleton } from '@/components/SkeletonLoaders';
import { useToast } from '@/lib/ToastContext';
import { motion, Variants } from 'framer-motion';
import { Home, Search, ShieldCheck, Mail, UserCircle, LogOut, CheckCircle2, Clock } from 'lucide-react';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

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
            icon: <Home className="w-8 h-8 text-teal-600 dark:text-teal-400" />,
            title: 'New Property',
            description: 'List a new property',
            action: () => router.push('/properties/new'),
            show: user.role === 'landlord',
        },
        {
            icon: <Search className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />,
            title: 'Browse Properties',
            description: 'Find your next home',
            action: () => router.push(user.role === 'tenant' ? '/search' : '/properties'),
            show: true,
        },
        {
            icon: <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />,
            title: 'Complete Verification',
            description: 'Verify your identity',
            action: () => router.push('/verification'),
            show: !user.identity_verified || !user.employment_verified,
        },
        {
            icon: <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
            title: 'Messages',
            description: unreadCount > 0 ? `${unreadCount} unread` : 'View inbox',
            action: () => router.push('/inbox'),
            show: true,
            badge: unreadCount > 0 ? unreadCount : null,
        },
        {
            icon: <UserCircle className="w-8 h-8 text-purple-600 dark:text-purple-400" />,
            title: 'Onboarding',
            description: 'Complete your profile',
            action: () => router.push('/onboarding'),
            show: !user.onboarding_completed,
        },
    ];

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-teal-500/30">
                {/* Header */}
                <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Dashboard</h1>
                            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                {user.role.charAt(0).toUpperCase() + user.role.slice(1)} Mode
                            </span>
                        </div>
                        <button
                            onClick={logout}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Sign out</span>
                        </button>
                    </div>
                </header>

                {/* Main content */}
                <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="space-y-8"
                    >
                        {/* Welcome card */}
                        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800">
                            <div className="absolute top-0 right-0 p-8 opacity-10 dark:opacity-5">
                                <UserCircle className="w-48 h-48 rotate-12 text-teal-600" />
                            </div>
                            <div className="relative z-10 px-8 py-10 sm:p-12 mix-blend-normal">
                                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
                                    Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-indigo-500">{user.full_name.split(' ')[0]}</span>
                                </h2>
                                <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl">
                                    Here's what's happening with your rental journey today.
                                </p>
                            </div>
                        </motion.div>

                        {/* Property Stats (Landlords only) */}
                        {user.role === 'landlord' && (
                            <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                                {loadingStats ? (
                                    <>
                                        <DashboardCardSkeleton />
                                        <DashboardCardSkeleton />
                                        <DashboardCardSkeleton />
                                        <DashboardCardSkeleton />
                                    </>
                                ) : stats ? (
                                    <>
                                        <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-gray-600 text-sm font-medium">Total Properties</h3>
                                                <span className="text-2xl">🏢</span>
                                            </div>
                                            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                                            <p className="text-xs text-gray-500 mt-1">All your listings</p>
                                        </motion.div>

                                        <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-gray-600 text-sm font-medium">Active Listings</h3>
                                                <span className="text-2xl">✅</span>
                                            </div>
                                            <p className="text-3xl font-bold text-green-600">{stats.active}</p>
                                            <p className="text-xs text-gray-500 mt-1">Live on platform</p>
                                        </motion.div>

                                        <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-gray-600 text-sm font-medium">Draft Properties</h3>
                                                <span className="text-2xl">📝</span>
                                            </div>
                                            <p className="text-3xl font-bold text-yellow-600">{stats.draft}</p>
                                            <p className="text-xs text-gray-500 mt-1">Pending publication</p>
                                        </motion.div>

                                        <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-gray-600 text-sm font-medium">Total Views</h3>
                                                <span className="text-2xl">👁️</span>
                                            </div>
                                            <p className="text-3xl font-bold text-blue-600">{stats.total_views}</p>
                                            <p className="text-xs text-gray-500 mt-1">All time</p>
                                        </motion.div>
                                    </>
                                ) : null}
                            </motion.div>
                        )}

                        {/* Quick Actions */}
                        <motion.div variants={itemVariants}>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">Quick Actions</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {quickActions.filter(action => action.show).map((action, idx) => (
                                    <motion.button
                                        whileHover={{ scale: 1.02, y: -4 }}
                                        whileTap={{ scale: 0.98 }}
                                        key={idx}
                                        onClick={action.action}
                                        className="group relative flex flex-col items-start bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:shadow-lg hover:border-teal-500/30 dark:hover:border-teal-500/50 transition-all text-left overflow-hidden"
                                    >
                                        <div className="mb-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 group-hover:bg-teal-50 dark:group-hover:bg-teal-900/20 transition-colors">
                                            {action.icon}
                                        </div>
                                        <h4 className="font-bold text-zinc-900 dark:text-white mb-1.5 text-lg">{action.title}</h4>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{action.description}</p>

                                        {action.badge && (
                                            <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse ring-4 ring-red-500/20" />
                                        )}
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>

                        {/* Inbox Preview Widget */}
                        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                        <Mail className="w-5 h-5 text-zinc-500" /> Recent Messages
                                    </h3>
                                    <button
                                        onClick={() => router.push('/inbox')}
                                        className="text-sm font-medium text-teal-600 hover:text-teal-500 dark:text-teal-400 transition-colors flex items-center gap-1"
                                    >
                                        View all <span aria-hidden="true">&rarr;</span>
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
                                    <div className="py-8">
                                        <EmptyState
                                            icon="📭"
                                            title="No messages yet"
                                            description="Your conversation history with tenants and landlords will appear here."
                                            layout="transparent"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Sidebar Column (Verification & Trust Score) */}
                            <div className="space-y-6">
                                {/* Verification status sidebar */}
                                <div className="bg-white dark:bg-zinc-900 overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                    <div className="px-6 py-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                            <ShieldCheck className="w-5 h-5 text-emerald-500" /> Validations
                                        </h3>
                                    </div>
                                    <div className="p-6 space-y-5">
                                        {/* Email Verification */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    {user.email_verified ? (
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                    ) : (
                                                        <Clock className="w-5 h-5 text-amber-500" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">Email Address</p>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
                                                        {user.email_verified ? 'Verified securely' : 'Pending verification'}
                                                    </p>
                                                </div>
                                            </div>
                                            {!user.email_verified && (
                                                <button
                                                    onClick={handleResendVerification}
                                                    disabled={resendingEmail}
                                                    className="text-xs font-medium text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 dark:text-teal-400 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                                                >
                                                    {resendingEmail ? 'Sending...' : 'Resend link'}
                                                </button>
                                            )}
                                        </div>

                                        {/* Identity Verification */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    {user.identity_verified ? (
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                    ) : (
                                                        <Clock className="w-5 h-5 text-amber-500" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">Gov. Identity</p>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
                                                        {user.identity_verified ? 'Identity confirmed' : 'Required for leasing'}
                                                    </p>
                                                </div>
                                            </div>
                                            {!user.identity_verified && (
                                                <button
                                                    onClick={() => router.push('/verification')}
                                                    className="text-xs font-medium text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 dark:text-teal-400 px-3 py-1.5 rounded-full transition-colors"
                                                >
                                                    Start
                                                </button>
                                            )}
                                        </div>

                                        {/* Employment Verification */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    {user.employment_verified ? (
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                    ) : (
                                                        <Clock className="w-5 h-5 text-amber-500" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">Employment</p>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
                                                        {user.employment_verified ? 'Documents approved' : 'Strengthens application'}
                                                    </p>
                                                </div>
                                            </div>
                                            {!user.employment_verified && (
                                                <button
                                                    onClick={() => router.push('/verification')}
                                                    className="text-xs font-medium text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 dark:text-teal-400 px-3 py-1.5 rounded-full transition-colors"
                                                >
                                                    Upload
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Trust score */}
                                <div className="bg-white dark:bg-zinc-900 overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                    <div className="px-6 py-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                            Trust Score
                                        </h3>
                                    </div>
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
                                                    className="dark:stroke-zinc-800"
                                                />
                                                <circle
                                                    cx="64"
                                                    cy="64"
                                                    r="56"
                                                    stroke="#14b8a6"
                                                    strokeWidth="8"
                                                    fill="none"
                                                    strokeDasharray={`${(user.trust_score / 100) * 351.858} 351.858`}
                                                    strokeLinecap="round"
                                                    className="transition-all duration-1000 ease-out"
                                                />
                                            </svg>
                                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                                <div className="text-4xl font-bold text-teal-600 dark:text-teal-500">
                                                    {user.trust_score}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-sm text-center text-zinc-500 dark:text-zinc-400 px-6">
                                            {user.trust_score < 100 ? 'Complete verifications to boost your score' : 'Your trust score is perfect!'}
                                        </p>
                                        {user.trust_score < 100 && (
                                            <button
                                                onClick={() => router.push('/verification')}
                                                className="mt-6 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                                            >
                                                Improve Score &rarr;
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
