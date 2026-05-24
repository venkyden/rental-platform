'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, MapPin, Calendar, Clock, AlertTriangle, ArrowRight, HelpCircle } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';

interface Property {
    id: string;
    title: string;
    city: string;
    address_line1?: string;
    monthly_rent?: number;
    surface_area?: number;
    furnished?: boolean;
}

interface Application {
    id: string;
    property_id: string;
    status: string;
    cover_letter: string;
    created_at: string;
    updated_at?: string;
    property?: Property;
}

function getRelativeTimeString(dateString: string, lang: 'en' | 'fr') {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 0) {
        return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US');
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (lang === 'fr') {
        if (diffInSeconds < 60) return "à l'instant";
        if (diffInMinutes < 60) return `il y a ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`;
        if (diffInHours < 24) return `il y a ${diffInHours} heure${diffInHours > 1 ? 's' : ''}`;
        if (diffInDays < 30) return `il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
        return date.toLocaleDateString('fr-FR');
    } else {
        if (diffInSeconds < 60) return "just now";
        if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
        if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
        if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString('en-US');
    }
}

export default function ApplicationsPage() {
    const router = useRouter();
    const toast = useToast();
    const { t, language } = useLanguage();
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);
    const [withdrawing, setWithdrawing] = useState(false);

    useEffect(() => {
        document.title = "My Applications | Roomivo";
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', 'Manage your submitted rental applications, track their status, and communicate with landlords on Roomivo.');

        loadApplications();
    }, []);

    const loadApplications = async () => {
        try {
            const response = await apiClient.client.get('/applications/me');
            setApplications(response.data);
        } catch (error) {
            console.error(error);
            toast.error('Error loading applications');
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async (appId: string) => {
        setWithdrawing(true);
        try {
            await apiClient.client.delete(`/applications/${appId}`);
            toast.success(t('applications.withdrawSuccess'));
            setConfirmWithdrawId(null);
            // Refresh list
            await loadApplications();
        } catch (error) {
            console.error(error);
            toast.error('Failed to withdraw application');
        } finally {
            setWithdrawing(false);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return {
                    bg: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
                    dot: 'bg-amber-500'
                };
            case 'reviewing':
                return {
                    bg: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
                    dot: 'bg-blue-500'
                };
            case 'approved':
            case 'lease_created':
                return {
                    bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
                    dot: 'bg-emerald-500'
                };
            case 'rejected':
                return {
                    bg: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
                    dot: 'bg-rose-500'
                };
            case 'withdrawn':
            default:
                return {
                    bg: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400',
                    dot: 'bg-zinc-400'
                };
        }
    };

    const getTimelineStep = (status: string) => {
        const lower = status.toLowerCase();
        if (lower === 'pending') return 1;
        if (lower === 'reviewing') return 2;
        if (lower === 'approved' || lower === 'lease_created') return 3;
        return 3; // Decision (Rejected/Withdrawn)
    };

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <header className="mb-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div>
                            <button
                                onClick={() => router.back()}
                                className="text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-2 mb-3"
                                aria-label="Go back"
                            >
                                <span>←</span> {t('onboarding.back')}
                            </button>
                            <h1 className="text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                                {t('applications.myApplications')}
                            </h1>
                        </div>
                        <button
                            onClick={() => router.push('/search')}
                            className="btn-primary flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs hover:scale-105 active:scale-95 transition-transform"
                        >
                            + {t('applications.newSearch')}
                        </button>
                    </header>

                    <main>
                        {loading ? (
                            <div className="space-y-6">
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-white dark:bg-zinc-900/50 rounded-3xl p-8 border border-zinc-100 dark:border-zinc-800/80 shadow-sm animate-pulse space-y-4">
                                        <div className="h-6 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                                        <div className="h-4 w-1/4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                                        <div className="h-20 w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl"></div>
                                    </div>
                                ))}
                            </div>
                        ) : applications.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center bg-white dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-900 rounded-3xl p-16 shadow-xl max-w-2xl mx-auto"
                            >
                                <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-zinc-100 dark:border-zinc-800 shadow-inner">
                                    <FileText className="w-10 h-10 text-zinc-400" />
                                </div>
                                <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">
                                    {t('applications.noApplications')}
                                </h2>
                                <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-10">
                                    {t('applications.noApplicationsDesc')}
                                </p>
                                <button
                                    onClick={() => router.push('/search')}
                                    className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-md"
                                >
                                    {t('applications.browseProperties')}
                                </button>
                            </motion.div>
                        ) : (
                            <div className="space-y-6">
                                {applications.map((app) => {
                                    const statusStyle = getStatusStyles(app.status);
                                    const timelineStep = getTimelineStep(app.status);
                                    const isPendingOrReviewing = app.status === 'pending' || app.status === 'reviewing';

                                    return (
                                        <motion.div
                                            key={app.id}
                                            layout
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-white dark:bg-zinc-900/60 rounded-3xl shadow-md p-8 border border-zinc-150 dark:border-zinc-800/80 relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                                        >
                                            <div className="absolute top-0 right-0 w-48 h-48 bg-zinc-900/5 dark:bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-zinc-900/10 dark:group-hover:bg-white/10 transition-colors" />

                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center gap-4 mb-4">
                                                        <h3 className="text-2xl font-black text-zinc-950 dark:text-white uppercase tracking-tight">
                                                            {app.property?.title || `Protocol ${app.id.substring(0, 8)}`}
                                                        </h3>
                                                        <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${statusStyle.bg}`}>
                                                            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                                                            {t(`applications.status.${app.status.toLowerCase()}`)}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-6 text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-6">
                                                        {app.property?.city && (
                                                            <span className="flex items-center gap-1.5">
                                                                <MapPin className="w-4 h-4 text-zinc-400" />
                                                                {app.property.city}
                                                            </span>
                                                        )}
                                                        {app.property?.monthly_rent && (
                                                            <span className="flex items-center gap-1.5">
                                                                <strong>{app.property.monthly_rent} €</strong> / {t('dashboard.landlord.widgets.gli.rent').toLowerCase()}
                                                            </span>
                                                        )}
                                                        {app.property?.surface_area && (
                                                            <span className="flex items-center gap-1.5">
                                                                <strong>{app.property.surface_area} m²</strong>
                                                            </span>
                                                        )}
                                                        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                                                            <Calendar className="w-4 h-4" />
                                                            {t('applications.submittedOn', { date: getRelativeTimeString(app.created_at, language) })}
                                                        </span>
                                                    </div>

                                                    {/* Cover Letter Panel */}
                                                    {app.cover_letter && (
                                                        <div className="bg-zinc-50 dark:bg-zinc-950/40 p-5 rounded-2xl text-zinc-700 dark:text-zinc-300 text-sm border border-zinc-100 dark:border-zinc-800/80 mb-6 italic">
                                                            {"\""}{app.cover_letter}{"\""}
                                                        </div>
                                                    )}

                                                    {/* Application status timeline */}
                                                    <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/60">
                                                        <div className="flex items-center justify-between max-w-md text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                                                            <span className={timelineStep >= 1 ? "text-zinc-900 dark:text-white" : ""}>{t('applications.status.pending')}</span>
                                                            <span className={timelineStep >= 2 ? "text-zinc-900 dark:text-white" : ""}>{t('applications.status.reviewing')}</span>
                                                            <span className={timelineStep >= 3 ? "text-zinc-900 dark:text-white" : ""}>
                                                                {app.status === 'rejected' ? t('applications.status.rejected') : app.status === 'withdrawn' ? t('applications.status.withdrawn') : t('applications.status.approved')}
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 flex overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all duration-500 ${app.status === 'rejected' ? 'bg-rose-500' : app.status === 'withdrawn' ? 'bg-zinc-400' : 'bg-emerald-500'}`} style={{ width: `${timelineStep === 1 ? 15 : timelineStep === 2 ? 60 : 100}%` }} />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-row lg:flex-col items-center justify-end gap-3 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-zinc-100 dark:border-zinc-800">
                                                    {app.property_id && (
                                                        <button
                                                            onClick={() => router.push(`/properties/${app.property_id}`)}
                                                            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                                            aria-label={`${t('applications.viewProperty')} - ${app.property?.title || ''}`}
                                                        >
                                                            {t('applications.viewProperty')} <ArrowRight className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {isPendingOrReviewing && (
                                                        <button
                                                            onClick={() => setConfirmWithdrawId(app.id)}
                                                            className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-rose-200 dark:border-rose-950/40 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                                                            aria-label={`${t('applications.withdraw')} - ${app.property?.title || ''}`}
                                                        >
                                                            {t('applications.withdraw')}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </main>

                    {/* Withdrawal Confirmation Dialog */}
                    <AnimatePresence>
                        {confirmWithdrawId && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setConfirmWithdrawId(null)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.95, opacity: 0 }}
                                    className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative z-10 text-center"
                                >
                                    <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-600 dark:text-rose-400">
                                        <AlertTriangle className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-black text-zinc-950 dark:text-white uppercase tracking-tight mb-4">
                                        {t('applications.withdraw')}
                                    </h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">
                                        {t('applications.withdrawConfirm')}
                                    </p>
                                    <div className="flex gap-4">
                                        <button
                                            disabled={withdrawing}
                                            onClick={() => setConfirmWithdrawId(null)}
                                            className="flex-1 px-5 py-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                        >
                                            {t('onboarding.back')}
                                        </button>
                                        <button
                                            disabled={withdrawing}
                                            onClick={() => handleWithdraw(confirmWithdrawId)}
                                            className="flex-1 px-5 py-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider hover:shadow-lg disabled:opacity-50 transition-all"
                                        >
                                            {withdrawing ? t('dashboard.landlord.widgets.gli.calculating') : t('applications.withdraw')}
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
