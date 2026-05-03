'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import EmptyState from '@/components/EmptyState';
import { apiClient } from '@/lib/api';
import { DashboardCardSkeleton } from '@/components/SkeletonLoaders';
import { useToast } from '@/lib/ToastContext';
import { motion, Variants } from 'framer-motion';
import { Home, Search, ShieldCheck, Mail, UserCircle, LogOut, CheckCircle2, Clock, Building, Users, BarChart3, FileCheck } from 'lucide-react';
import TenantFeatures from '@/components/dashboard/TenantFeatures';
import RoleSwitcher from '@/components/dashboard/RoleSwitcher';

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

import PremiumLayout from '@/components/PremiumLayout';

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
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
            toast.success(t('dashboard.verification.toast.success', undefined, 'Verification email sent! Check your inbox.'));
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to send email');
        } finally {
            setResendingEmail(false);
        }
    }

    const quickActions = [
        {
            icon: <Home className="w-8 h-8 text-teal-600 dark:text-teal-400" />,
            title: t('dashboard.quickActions.newProperty.title', undefined, undefined),
            description: t('dashboard.quickActions.newProperty.desc', undefined, undefined),
            action: () => router.push('/properties/new'),
            show: user.role === 'landlord',
        },
        {
            icon: <Search className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />,
            title: t('dashboard.quickActions.browse.title', undefined, undefined),
            description: t('dashboard.quickActions.browse.desc', undefined, undefined),
            action: () => router.push(user.role === 'tenant' ? '/search' : '/properties'),
            show: true,
        },
        {
            icon: <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />,
            title: t('dashboard.quickActions.verify.title', undefined, undefined),
            description: t('dashboard.quickActions.verify.desc', undefined, undefined),
            action: () => router.push('/verification'),
            show: !user.identity_verified || !user.employment_verified,
        },
        {
            icon: <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
            title: t('dashboard.quickActions.messages.title', undefined, undefined),
            description: unreadCount > 0 ? `${unreadCount} ${t('dashboard.inbox.unread', undefined, 'unread')}` : t('dashboard.quickActions.messages.desc', undefined, undefined),
            action: () => router.push('/inbox'),
            show: true,
            badge: unreadCount > 0 ? unreadCount : null,
        },
        {
            icon: <UserCircle className="w-8 h-8 text-purple-600 dark:text-purple-400" />,
            title: t('dashboard.quickActions.onboarding.title', undefined, undefined),
            description: t('dashboard.quickActions.onboarding.desc', undefined, undefined),
            action: () => router.push('/onboarding'),
            show: !user.onboarding_completed,
        },
        {
            icon: <Users className="w-8 h-8 text-orange-600 dark:text-orange-400" />,
            title: t('dashboard.quickActions.team.title', undefined, undefined),
            description: t('dashboard.quickActions.team.desc', undefined, undefined),
            action: () => router.push('/team'),
            show: user.role === 'landlord' || user.role === 'property_manager',
        },
        {
            icon: <BarChart3 className="w-8 h-8 text-amber-600 dark:text-amber-400" />,
            title: t('dashboard.quickActions.analytics.title', undefined, undefined),
            description: t('dashboard.quickActions.analytics.desc', undefined, undefined),
            action: () => router.push('/analytics'),
            show: user.role === 'landlord' || user.role === 'property_manager',
        },
        {
            icon: <FileCheck className="w-8 h-8 text-teal-600 dark:text-teal-400" />,
            title: t('dashboard.quickActions.gli.title', undefined, undefined),
            description: t('dashboard.quickActions.gli.desc', undefined, undefined),
            action: () => router.push('/gli'),
            show: user.role === 'landlord' || user.role === 'property_manager',
        },
        {
            icon: <ShieldCheck className="w-8 h-8 text-red-600 dark:text-red-400" />,
            title: t('disputes.report', undefined, 'Report Incident'),
            description: t('disputes.desc', undefined, 'Log property issues'),
            action: () => router.push('/disputes'),
            show: true,
        },
    ];

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="space-y-12"
                >
                    {/* Welcome Section */}
                    <motion.div variants={itemVariants} className="relative group">
                        <div className="glass-card !p-0 overflow-hidden border-none shadow-2xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-indigo-500/10 group-hover:opacity-100 opacity-50 transition-opacity duration-700" />
                            <div className="relative z-10 px-10 py-16 sm:px-16 sm:py-20 flex flex-col sm:flex-row items-center gap-10">
                                <div className="w-32 h-32 bg-zinc-900 dark:bg-white rounded-[2.5rem] flex items-center justify-center text-5xl text-white dark:text-zinc-900 font-black shadow-2xl active:scale-95 transition-transform cursor-default">
                                    {user.full_name?.charAt(0) || 'U'}
                                </div>
                                <div className="text-center sm:text-left">
                                    <h2 className="text-5xl sm:text-6xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">
                                        {t('dashboard.landlord.welcome', { name: user.full_name.split(' ')[0] }, undefined)}
                                    </h2>
                                    <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium max-w-2xl leading-relaxed">
                                        {t('dashboard.welcome_desc', undefined, "Here's what's happening with your rental journey today.")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Stats Grid - Landlords */}
                    {user.role === 'landlord' && (
                        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {loadingStats ? (
                                <>
                                    <DashboardCardSkeleton />
                                    <DashboardCardSkeleton />
                                    <DashboardCardSkeleton />
                                    <DashboardCardSkeleton />
                                </>
                            ) : stats ? (
                                <>
                                    {[
                                        { label: t('dashboard.stats.properties', undefined, undefined), value: stats.total, color: 'text-zinc-900 dark:text-white', sub: t('dashboard.stats.propertiesDesc', undefined, undefined) },
                                        { label: t('dashboard.stats.activeListings', undefined, undefined), value: stats.active, color: 'text-teal-600 dark:text-teal-400', sub: t('dashboard.stats.activeDesc', undefined, undefined) },
                                        { label: t('dashboard.stats.drafts', undefined, undefined), value: stats.draft, color: 'text-amber-600 dark:text-amber-400', sub: t('dashboard.stats.draftsDesc', undefined, undefined) },
                                        { label: t('dashboard.stats.views', undefined, undefined), value: stats.total_views, color: 'text-indigo-600 dark:text-indigo-400', sub: t('dashboard.stats.viewsDesc', undefined, undefined) }
                                    ].map((stat, i) => (
                                        <motion.div key={i} variants={itemVariants} className="glass-card hover:translate-y-[-4px] transition-all duration-300">
                                            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">{stat.label}</h3>
                                            <p className={`text-4xl font-black ${stat.color} mb-2 tracking-tighter`}>{stat.value}</p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-500 font-medium">{stat.sub}</p>
                                        </motion.div>
                                    ))}
                                </>
                            ) : null}
                        </motion.div>
                    )}

                    {/* Quick Actions */}
                    <motion.div variants={itemVariants} className="space-y-8">
                        <h2 className="text-2xl font-black tracking-tighter uppercase ml-2 text-zinc-400 dark:text-zinc-500">Quick Actions</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {quickActions.filter(action => action.show).map((action, idx) => (
                                <motion.button
                                    whileHover={{ y: -8, scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    key={idx}
                                    onClick={action.action}
                                    className="glass-card !p-8 flex flex-col items-start text-left group border-zinc-200/50 dark:border-zinc-800/50 hover:border-teal-500/50 dark:hover:border-teal-400/50 transition-all duration-500 relative"
                                >
                                    <div className="mb-6 p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 group-hover:bg-teal-600 group-hover:text-white transition-all duration-500 shadow-lg">
                                        {action.icon}
                                    </div>
                                    <h4 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{action.title}</h4>
                                    <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">{action.description}</p>
                                    {action.badge && (
                                        <div className="absolute top-8 right-8 w-12 h-12 glass flex items-center justify-center text-teal-600 font-black rounded-2xl shadow-xl border-teal-500/20">
                                            {action.badge}
                                        </div>
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Inbox & Sidebar */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                                    <Mail className="w-6 h-6 text-teal-600" /> {t('dashboard.inbox.title', undefined, undefined)}
                                </h3>
                                <button
                                    onClick={() => router.push('/inbox')}
                                    className="btn-secondary !py-2 !px-4 text-xs !rounded-full uppercase tracking-widest"
                                >
                                    {t('dashboard.inbox.viewAll', undefined, undefined)}
                                </button>
                            </div>

                            <div className="glass rounded-[2.5rem] overflow-hidden shadow-2xl border-white/40 dark:border-zinc-800/50">
                                {recentConversations.length > 0 ? (
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {recentConversations.map((conv) => (
                                            <button
                                                key={conv.id}
                                                onClick={() => router.push('/inbox')}
                                                className="w-full p-8 text-left hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-all flex items-center gap-6 group"
                                            >
                                                <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center text-xl font-black shadow-lg group-hover:scale-110 transition-transform">
                                                    {conv.other_party_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-black text-lg text-zinc-900 dark:text-white truncate">
                                                            {conv.other_party_name}
                                                        </span>
                                                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                                            {new Date(conv.last_message_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-teal-600 dark:text-teal-400 font-bold mb-2 uppercase tracking-tight">
                                                         {conv.property_title}
                                                    </p>
                                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm truncate font-medium">
                                                        {conv.last_message_preview || conv.subject}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-20 text-center">
                                        <EmptyState
                                            icon=""
                                            title={t('dashboard.inbox.empty', undefined, undefined)}
                                            description={t('dashboard.inbox.emptyDesc', undefined, undefined)}
                                            layout="transparent"
                                        />
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Sidebar */}
                        <motion.div variants={itemVariants} className="space-y-8">
                            {/* Verification Progress */}
                            <div className="glass-card shadow-2xl border-white/40 dark:border-zinc-800/50">
                                <h3 className="text-lg font-black uppercase tracking-widest text-zinc-400 mb-8 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-teal-500" /> Progress
                                </h3>
                                <div className="space-y-8">
                                    {[
                                        { label: t('dashboard.verification.email', undefined, undefined), verified: user.email_verified, resend: !user.email_verified },
                                        { label: t('dashboard.verification.identity', undefined, undefined), verified: user.identity_verified, start: !user.identity_verified },
                                        { label: t('dashboard.verification.employment', undefined, undefined), verified: user.employment_verified, start: !user.employment_verified }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.verified ? 'bg-teal-500/10 text-teal-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                    {item.verified ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">{item.label}</p>
                                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.verified ? 'Complete' : 'Pending'}</p>
                                                </div>
                                            </div>
                                            {item.resend && (
                                                <button onClick={handleResendVerification} disabled={resendingEmail} className="text-[10px] font-black text-teal-600 hover:underline uppercase tracking-widest">
                                                    {resendingEmail ? 'Sending...' : 'Resend'}
                                                </button>
                                            )}
                                            {item.start && (
                                                <button onClick={() => router.push('/verification')} className="text-[10px] font-black text-teal-600 hover:underline uppercase tracking-widest">
                                                    Start
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Trust Score */}
                            <div className="glass-card shadow-2xl bg-zinc-900 dark:bg-zinc-800 text-white border-none">
                                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-8">{t('dashboard.stats.trustScore', undefined, undefined)}</h3>
                                <div className="flex flex-col items-center">
                                    <div className="relative w-40 h-40">
                                        <svg className="transform -rotate-90 w-full h-full">
                                            <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.1)" strokeWidth="12" fill="none" />
                                            <motion.circle 
                                                initial={{ strokeDasharray: "0 440" }}
                                                animate={{ strokeDasharray: `${(user.trust_score / 100) * 440} 440` }}
                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                                cx="80" cy="80" r="70" stroke="#14b8a6" strokeWidth="12" fill="none" strokeLinecap="round" 
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-5xl font-black tracking-tighter">{user.trust_score}</span>
                                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Points</span>
                                        </div>
                                    </div>
                                    <p className="mt-8 text-center text-xs font-bold text-zinc-400 leading-relaxed px-4">
                                        {user.trust_score < 100 ? t('dashboard.stats.complete', undefined, undefined) : t('dashboard.stats.verified', undefined, undefined)}
                                    </p>
                                    {user.trust_score < 100 && (
                                        <button
                                            onClick={() => router.push('/verification')}
                                            className="mt-8 w-full btn-primary !py-3 !rounded-2xl shadow-teal-500/20"
                                        >
                                            {t('dashboard.stats.improve', undefined, undefined)}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {user.role === 'tenant' && (
                        <motion.div variants={itemVariants} className="pt-8">
                            <TenantFeatures />
                        </motion.div>
                    )}
                </motion.div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
