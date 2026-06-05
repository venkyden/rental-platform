'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle, XCircle, User, Mail, Award, FileText, Check, AlertCircle, ArrowRight } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';

interface TenantSummary {
    id: string;
    full_name?: string;
    email: string;
    profile_picture_url?: string;
    trust_score: number;
    identity_verified: boolean;
    employment_verified: boolean;
    income_verified: boolean;
    guarantor_type?: string;
}

interface PropertySummary {
    id: string;
    title: string;
    city: string;
    monthly_rent?: number;
}

interface Application {
    id: string;
    property_id: string;
    tenant_id: string;
    status: string;
    cover_letter: string;
    created_at: string;
    tenant?: TenantSummary;
    property?: PropertySummary;
}

export default function ReceivedApplicationsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const toast = useToast();
    const { t, language } = useLanguage();

    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [verificationRequired, setVerificationRequired] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('all');

    // Confirm dialog states
    const [confirmAction, setConfirmAction] = useState<{ id: string; status: string } | null>(null);
    const [actioning, setActioning] = useState(false);

    useEffect(() => {
        document.title = "Received Applications | Roomivo";
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', 'Review and manage rental applications received for your properties, screen candidates, and initiate lease creation.');

        if (user && !user.identity_verified) {
            setVerificationRequired(true);
            setLoading(false);
        } else if (user) {
            loadApplications();
        }
    }, [user]);

    const loadApplications = async () => {
        try {
            const response = await apiClient.client.get('/applications/received');
            setApplications(response.data);
        } catch (error: any) {
            console.error(error);
            if (error.response?.status === 403) {
                setVerificationRequired(true);
            } else {
                toast.error('Error loading received applications');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmStatusUpdate = async () => {
        if (!confirmAction) return;
        setActioning(true);
        const { id, status } = confirmAction;

        try {
            await apiClient.client.patch(`/applications/${id}`, { status });
            toast.success(t(status === 'approved' ? 'applications.approveSuccess' : 'applications.rejectSuccess'));
            setConfirmAction(null);
            await loadApplications();
        } catch (error) {
            console.error(error);
            toast.error('Error updating application status');
        } finally {
            setActioning(false);
        }
    };

    const handleSetReviewing = async (id: string) => {
        setActioning(true);
        try {
            await apiClient.client.patch(`/applications/${id}`, { status: 'reviewing' });
            toast.success(language === 'fr' ? "Candidature mise à l'étude" : "Application marked as reviewing");
            await loadApplications();
        } catch (error) {
            console.error(error);
            toast.error('Error updating application status');
        } finally {
            setActioning(false);
        }
    };

    const filteredApplications = applications.filter((app) => {
        if (activeTab === 'all') return true;
        return app.status.toLowerCase() === activeTab;
    });

    const getStatusStyles = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return 'bg-amber-500/10 border-amber-500/20 text-amber-500';
            case 'reviewing':
                return 'bg-blue-500/10 border-blue-500/20 text-blue-500';
            case 'approved':
            case 'lease_created':
                return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500';
            case 'rejected':
                return 'bg-rose-500/10 border-rose-500/20 text-rose-500';
            case 'withdrawn':
            default:
                return 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400';
        }
    };

    if (verificationRequired) {
        return (
            <ProtectedRoute>
                <PremiumLayout withNavbar={true}>
                    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[2rem] shadow-2xl max-w-md w-full p-10 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-900/5 dark:bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            <div className="w-20 h-20 bg-zinc-900 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
                                <Shield className="w-10 h-10 text-white" />
                            </div>
                            <h2 className="text-3xl font-black text-zinc-900 dark:text-white mb-4 uppercase tracking-tight">
                                Identity Protocol
                            </h2>
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8 leading-relaxed text-sm">
                                Tenants only share their verified profiles with verified landlords.
                                Complete ID verification to unlock applications.
                            </p>

                            <div className="bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl p-6 mb-8 text-left border border-zinc-100 dark:border-zinc-850">
                                <ul className="space-y-4">
                                    {[
                                        'Access full tenant profiles and documents',
                                        'Get a "Verified Landlord" badge on your listings',
                                        'Build trust with prospective tenants'
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-400 mt-2" />
                                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button
                                onClick={() => router.push('/verification')}
                                className="w-full py-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                            >
                                Execute Verification
                            </button>
                        </div>
                    </div>
                </PremiumLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <header className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <button
                                onClick={() => router.back()}
                                className="text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-2 mb-3"
                            >
                                <span>←</span> {t('onboarding.back')}
                            </button>
                            <h1 className="text-4xl font-black text-zinc-950 dark:text-white uppercase tracking-tight">
                                {t('applications.receivedApplications')}
                            </h1>
                        </div>
                    </header>

                    {/* Filter Tabs */}
                    <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-8 overflow-x-auto gap-2">
                        {['all', 'pending', 'approved', 'rejected'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-5 py-3 border-b-2 font-bold uppercase tracking-wider text-xs whitespace-nowrap transition-all ${
                                    activeTab === tab
                                        ? 'border-zinc-950 dark:border-white text-zinc-950 dark:text-white font-black'
                                        : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                }`}
                            >
                                {t(`applications.status.${tab}`) || t(`applications.${tab}`) || tab}
                            </button>
                        ))}
                    </div>

                    <main>
                        {loading ? (
                            <div className="space-y-6">
                                {[1, 2].map((i) => (
                                    <div key={i} className="bg-white dark:bg-zinc-900/50 rounded-3xl p-8 border border-zinc-150 dark:border-zinc-800/80 shadow-sm animate-pulse space-y-4">
                                        <div className="h-6 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                                        <div className="h-4 w-1/4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                                        <div className="h-24 w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl"></div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredApplications.length === 0 ? (
                            <div className="text-center bg-white dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800/80 rounded-3xl p-16 shadow-xl max-w-xl mx-auto">
                                <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-zinc-100 dark:border-zinc-850 shadow-inner">
                                    <FileText className="w-8 h-8 text-zinc-400" />
                                </div>
                                <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">
                                    {t('dashboard.inbox.status.noConversations')}
                                </h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                                    {t('dashboard.inbox.status.noConversationsDesc')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {filteredApplications.map((app) => {
                                    const tenant = app.tenant;
                                    const property = app.property;
                                    const isPending = app.status.toLowerCase() === 'pending';
                                    const isApproved = app.status.toLowerCase() === 'approved';
                                    const isReviewing = app.status.toLowerCase() === 'reviewing';

                                    return (
                                        <motion.div
                                            key={app.id}
                                            layout
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-white dark:bg-zinc-900/60 rounded-3xl shadow-sm p-8 border border-zinc-150 dark:border-zinc-800/80 relative overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                                        >
                                            <div className="flex flex-col xl:flex-row gap-8 xl:items-center justify-between">
                                                <div className="flex-1">
                                                    {/* Property Link & Status */}
                                                    <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                                                        <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                                                            {property?.title || 'Unknown Property'}
                                                            {property?.city && <span className="text-zinc-400 font-medium"> • {property.city}</span>}
                                                        </h4>
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusStyles(app.status)}`}>
                                                            {t(`applications.status.${app.status.toLowerCase()}`)}
                                                        </span>
                                                    </div>

                                                    {/* Tenant Card */}
                                                    <div className="flex items-start gap-4 mb-6 bg-zinc-50 dark:bg-zinc-950/40 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                                                        <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex items-center justify-center border border-zinc-300 dark:border-zinc-700 shrink-0">
                                                            {tenant?.profile_picture_url ? (
                                                                <img
                                                                    src={tenant.profile_picture_url}
                                                                    alt={tenant.full_name || 'Tenant'}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <User className="w-6 h-6 text-zinc-400" />
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <h5 className="font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                                                                    {tenant?.full_name || 'Applicant'}
                                                                </h5>
                                                                {tenant && (
                                                                    <span className="inline-flex items-center gap-1 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">
                                                                        <Award className="w-3.5 h-3.5" />
                                                                        {t('applications.trustScore')}: {tenant.trust_score}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                                                                <Mail className="w-3.5 h-3.5 text-zinc-400" />
                                                                {tenant?.email || 'N/A'}
                                                            </p>

                                                            {/* Verification Badges */}
                                                            {tenant && (
                                                                <div className="flex flex-wrap gap-2.5 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${tenant.identity_verified ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                                                        <CheckCircle className="w-3.5 h-3.5" /> {t('applications.identity')}
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${tenant.employment_verified ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                                                        <CheckCircle className="w-3.5 h-3.5" /> {t('applications.employment')}
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${tenant.income_verified ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                                                        <CheckCircle className="w-3.5 h-3.5" /> {t('applications.resources')}
                                                                    </span>
                                                                    {tenant.guarantor_type && (
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                                                                            • {tenant.guarantor_type}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {tenant?.id && (
                                                            <button
                                                                onClick={() => router.push(`/tenants/${tenant.id}`)} // Dossier route or profile verification
                                                                className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest hover:underline hover:scale-105 transition-transform"
                                                            >
                                                                {t('applications.viewDossier')}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Cover Letter */}
                                                    {app.cover_letter && (
                                                        <div className="bg-zinc-50 dark:bg-zinc-950/20 p-5 rounded-2xl text-zinc-700 dark:text-zinc-300 text-sm border border-zinc-100 dark:border-zinc-850 italic">
                                                            {"\""}{app.cover_letter}{"\""}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex flex-col sm:flex-row xl:flex-col gap-3 justify-end items-center shrink-0 w-full xl:w-auto border-t xl:border-t-0 pt-4 xl:pt-0 border-zinc-150 dark:border-zinc-800">
                                                    {(isPending || isReviewing) && (
                                                        <>
                                                            <button
                                                                onClick={() => setConfirmAction({ id: app.id, status: 'approved' })}
                                                                disabled={actioning}
                                                                className="flex-1 xl:flex-none w-full xl:w-48 px-6 py-3.5 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold uppercase tracking-widest rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                                                                aria-label={`${t('applications.approve')} - ${tenant?.full_name || ''}`}
                                                            >
                                                                {t('applications.approve')}
                                                            </button>
                                                            {isPending && (
                                                                <button
                                                                    onClick={() => handleSetReviewing(app.id)}
                                                                    disabled={actioning}
                                                                    className="flex-1 xl:flex-none w-full xl:w-48 px-6 py-3.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest rounded-xl hover:shadow-md hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                                                                    aria-label={`${t('applications.status.reviewing')} - ${tenant?.full_name || ''}`}
                                                                >
                                                                    {t('applications.status.reviewing')}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setConfirmAction({ id: app.id, status: 'rejected' })}
                                                                disabled={actioning}
                                                                className="flex-1 xl:flex-none w-full xl:w-48 px-6 py-3.5 bg-white border border-zinc-200 text-zinc-900 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white dark:hover:bg-zinc-800/50 disabled:opacity-50 transition-colors"
                                                                aria-label={`${t('applications.reject')} - ${tenant?.full_name || ''}`}
                                                            >
                                                                {t('applications.reject')}
                                                            </button>
                                                        </>
                                                    )}
                                                    {isApproved && (
                                                        <button
                                                            onClick={() => router.push(`/applications/${app.id}/lease`)}
                                                            className="w-full xl:w-48 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
                                                            aria-label={`${t('applications.createLease')} - ${tenant?.full_name || ''}`}
                                                        >
                                                            {t('applications.createLease')} <ArrowRight className="w-4 h-4" />
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

                    {/* Action Confirmation Modal */}
                    <AnimatePresence>
                        {confirmAction && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setConfirmAction(null)}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                />
                                <motion.div
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.95, opacity: 0 }}
                                    className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative z-10 text-center"
                                >
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${confirmAction.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'}`}>
                                        {confirmAction.status === 'approved' ? <Check className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                                    </div>
                                    <h3 className="text-xl font-black text-zinc-950 dark:text-white uppercase tracking-tight mb-4">
                                        {confirmAction.status === 'approved' ? t('applications.approve') : t('applications.reject')}
                                    </h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">
                                        {confirmAction.status === 'approved' ? t('applications.approveConfirm') : t('applications.rejectConfirm')}
                                    </p>
                                    <div className="flex gap-4">
                                        <button
                                            disabled={actioning}
                                            onClick={() => setConfirmAction(null)}
                                            className="flex-1 px-5 py-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                        >
                                            {t('onboarding.back')}
                                        </button>
                                        <button
                                            disabled={actioning}
                                            onClick={handleConfirmStatusUpdate}
                                            className={`flex-1 px-5 py-4 rounded-xl text-white text-xs font-bold uppercase tracking-wider hover:shadow-lg disabled:opacity-50 transition-all ${
                                                confirmAction.status === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                                            }`}
                                        >
                                            {actioning ? t('applications.processing') : t('onboarding.continue')}
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
