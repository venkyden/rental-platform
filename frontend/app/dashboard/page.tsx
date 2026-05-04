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
                    total_views: properties.reduce((sum: number, p: any) => sum + (Number(p.views_count) || 0), 0),
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
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>
                
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="space-y-16 relative z-10"
                >
                    {/* Welcome Section - Ultra Premium */}
                    <motion.div variants={itemVariants} className="relative group">
                        <div className="glass-card !p-0 overflow-hidden border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] rounded-[3rem]">
                            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-indigo-500/10 group-hover:opacity-100 opacity-40 transition-opacity duration-1000" />
                            <div className="relative z-10 px-12 py-20 sm:px-20 sm:py-24 flex flex-col sm:flex-row items-center gap-12">
                                <motion.div 
                                    whileHover={{ scale: 1.05, rotate: 5 }}
                                    className="w-40 h-40 bg-zinc-900 dark:bg-white rounded-[2.5rem] flex items-center justify-center text-6xl text-white dark:text-zinc-900 font-black shadow-2xl active:scale-95 transition-all cursor-default relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                                    {user.full_name?.charAt(0) || 'U'}
                                </motion.div>
                                <div className="text-center sm:text-left flex-1">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                                        <h2 className="text-5xl sm:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-500 uppercase leading-[0.9]">
                                            {t('dashboard.landlord.welcome', { name: user.full_name.split(' ')[0] }, undefined)}
                                        </h2>
                                        <div className="inline-flex items-center self-center sm:self-start px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                            {user.role}
                                        </div>
                                    </div>
                                    <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium max-w-2xl leading-relaxed">
                                        {t('dashboard.welcome_desc', undefined, "Here's what's happening with your rental journey today.")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Stats Grid - Landlords */}
                    {user.role === 'landlord' && (
                        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
                                        { label: t('dashboard.stats.properties', undefined, undefined), value: stats.total, color: 'text-zinc-900 dark:text-white', sub: t('dashboard.stats.propertiesDesc', undefined, undefined), icon: <Building className="w-4 h-4" /> },
                                        { label: t('dashboard.stats.activeListings', undefined, undefined), value: stats.active, color: 'text-teal-500', sub: t('dashboard.stats.activeDesc', undefined, undefined), icon: <CheckCircle2 className="w-4 h-4" /> },
                                        { label: t('dashboard.stats.drafts', undefined, undefined), value: stats.draft, color: 'text-amber-500', sub: t('dashboard.stats.draftsDesc', undefined, undefined), icon: <Clock className="w-4 h-4" /> },
                                        { label: t('dashboard.stats.views', undefined, undefined), value: stats.total_views, color: 'text-indigo-500', sub: t('dashboard.stats.viewsDesc', undefined, undefined), icon: <BarChart3 className="w-4 h-4" /> }
                                    ].map((stat, i) => (
                                        <motion.div key={i} variants={itemVariants} className="glass-card !p-10 rounded-[2.5rem] hover:translate-y-[-8px] transition-all duration-500 group border-zinc-100 dark:border-zinc-800/50 shadow-xl">
                                            <div className="flex items-center justify-between mb-8">
                                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">{stat.label}</h3>
                                                <div className={`p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 ${stat.color} group-hover:scale-110 transition-transform`}>
                                                    {stat.icon}
                                                </div>
                                            </div>
                                            <p className={`text-5xl font-black ${stat.color} mb-4 tracking-tighter`}>{stat.value}</p>
                                            <p className="text-[10px] text-zinc-500 dark:text-zinc-500 font-black uppercase tracking-widest">{stat.sub}</p>
                                        </motion.div>
                                    ))}
                                </>
                            ) : null}
                        </motion.div>
                    )}

                    {/* Quick Actions */}
                    <motion.div variants={itemVariants} className="space-y-10">
                        <div className="flex items-center gap-4 px-4">
                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent" />
                            <h2 className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                                {t('dashboard.quickActions.title', undefined, 'Quick Actions')}
                            </h2>
                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {quickActions.filter(action => action.show).map((action, idx) => (
                                <motion.button
                                    whileHover={{ y: -12, scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    key={idx}
                                    onClick={action.action}
                                    className="glass-card !p-10 flex flex-col items-start text-left group border-zinc-100 dark:border-zinc-800/50 hover:border-teal-500/50 dark:hover:border-teal-400/50 transition-all duration-700 relative overflow-hidden rounded-[2.5rem] shadow-xl"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-500/5 to-transparent rounded-bl-[100%] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                    
                                    <div className="mb-8 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 group-hover:bg-zinc-900 dark:group-hover:bg-white text-zinc-900 dark:text-white group-hover:text-white dark:group-hover:text-zinc-900 transition-all duration-700 shadow-lg group-hover:shadow-teal-500/20 group-hover:-rotate-6">
                                        {action.icon}
                                    </div>
                                    <h4 className="text-3xl font-black text-zinc-900 dark:text-white mb-3 tracking-tighter uppercase group-hover:text-teal-500 transition-colors">{action.title}</h4>
                                    <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed text-lg">{action.description}</p>
                                    {action.badge && (
                                        <div className="absolute top-10 right-10 w-12 h-12 bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 text-xs font-black rounded-2xl shadow-2xl group-hover:scale-110 transition-transform">
                                            {action.badge}
                                        </div>
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Inbox & Sidebar */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-8">
                            <div className="flex items-center justify-between px-6">
                                <h3 className="text-[10px] font-black tracking-[0.4em] uppercase text-zinc-400 flex items-center gap-4">
                                    <Mail className="w-4 h-4" /> {t('dashboard.inbox.title', undefined, undefined)}
                                </h3>
                                <button
                                    onClick={() => router.push('/inbox')}
                                    className="px-6 py-2 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black rounded-full uppercase tracking-[0.2em] hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition-all active:scale-95 shadow-sm"
                                >
                                    {t('dashboard.inbox.viewAll', undefined, undefined)}
                                </button>
                            </div>

                            <div className="glass rounded-[3rem] overflow-hidden shadow-2xl border-white/40 dark:border-zinc-800/50">
                                {recentConversations.length > 0 ? (
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                        {recentConversations.map((conv) => (
                                            <button
                                                key={conv.id}
                                                onClick={() => router.push('/inbox')}
                                                className="w-full p-10 text-left hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-all flex items-center gap-8 group"
                                            >
                                                <div className="w-16 h-16 rounded-[1.5rem] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center text-2xl font-black shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                                                    {conv.other_party_name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-black text-xl text-zinc-900 dark:text-white truncate uppercase tracking-tight">
                                                            {conv.other_party_name}
                                                        </span>
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap ml-4">
                                                            {new Date(conv.last_message_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                                        <p className="text-[10px] text-teal-600 dark:text-teal-400 font-black uppercase tracking-widest truncate">
                                                            {conv.property_title}
                                                        </p>
                                                    </div>
                                                    <p className="text-zinc-500 dark:text-zinc-400 text-base truncate font-medium">
                                                        {conv.last_message_preview || conv.subject}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-24 text-center">
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

                        {/* Sidebar - Premium Column */}
                        <motion.div variants={itemVariants} className="space-y-12">
                            {/* Verification Progress - High Fidelity */}
                            <div className="glass-card !p-10 shadow-2xl border-white/40 dark:border-zinc-800/50 rounded-[2.5rem] relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-teal-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-10 flex items-center gap-3">
                                    <ShieldCheck className="w-4 h-4 text-teal-500" /> {t('dashboard.progress', undefined, 'Compliance')}
                                </h3>
                                <div className="space-y-10">
                                    {[
                                        { label: t('dashboard.verification.email', undefined, undefined), verified: user.email_verified, resend: !user.email_verified },
                                        { label: t('dashboard.verification.identity', undefined, undefined), verified: user.identity_verified, start: !user.identity_verified },
                                        { label: t('dashboard.verification.employment', undefined, undefined), verified: user.employment_verified, start: !user.employment_verified }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-5">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 ${item.verified ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                                                    {item.verified ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">{item.label}</p>
                                                    <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1.5 ${item.verified ? 'text-teal-500' : 'text-zinc-400'}`}>
                                                        {item.verified ? t('dashboard.complete', undefined, 'Verified') : t('dashboard.pending', undefined, 'Awaiting')}
                                                    </p>
                                                </div>
                                            </div>
                                            {item.resend && (
                                                <button onClick={handleResendVerification} disabled={resendingEmail} className="px-4 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[9px] font-black rounded-lg uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                                                    {resendingEmail ? '...' : t('dashboard.verification.resend', undefined, 'Resend')}
                                                </button>
                                            )}
                                            {item.start && (
                                                <button onClick={() => router.push('/verification')} className="px-4 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[9px] font-black rounded-lg uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                                                    {t('dashboard.verification.start', undefined, 'Fix')}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Trust Score - Ultra Visual */}
                            <div className="glass-card !p-12 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-none rounded-[3rem] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />
                                
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-12">{t('dashboard.stats.trustScore', undefined, undefined)}</h3>
                                <div className="flex flex-col items-center">
                                    <div className="relative w-48 h-48">
                                        <svg className="transform -rotate-90 w-full h-full">
                                            <circle cx="96" cy="96" r="88" stroke="rgba(255,255,255,0.05)" dark-stroke="rgba(0,0,0,0.05)" strokeWidth="16" fill="none" />
                                            <motion.circle 
                                                initial={{ strokeDasharray: "0 560" }}
                                                animate={{ strokeDasharray: `${(user.trust_score / 100) * 552.92} 560` }}
                                                transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
                                                cx="96" cy="96" r="88" stroke="url(#gradient)" strokeWidth="16" fill="none" strokeLinecap="round" 
                                            />
                                            <defs>
                                                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                    <stop offset="0%" stopColor="#2dd4bf" />
                                                    <stop offset="100%" stopColor="#14b8a6" />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <motion.span 
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                className="text-7xl font-black tracking-tighter"
                                            >
                                                {user.trust_score}
                                            </motion.span>
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-2">
                                                {t('dashboard.points', undefined, 'Score')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-12 text-center">
                                        <p className="text-xs font-black uppercase tracking-[0.2em] leading-relaxed mb-8 text-zinc-400">
                                            {user.trust_score < 100 ? t('dashboard.stats.complete', undefined, undefined) : t('dashboard.stats.verified', undefined, undefined)}
                                        </p>
                                        {user.trust_score < 100 && (
                                            <button
                                                onClick={() => router.push('/verification')}
                                                className="w-full py-5 bg-teal-500 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-teal-500/40 hover:scale-105 active:scale-95 transition-all"
                                            >
                                                {t('dashboard.stats.improve', undefined, undefined)}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {user.role === 'tenant' && (
                        <motion.div variants={itemVariants} className="pt-12">
                            <TenantFeatures />
                        </motion.div>
                    )}
                </motion.div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
