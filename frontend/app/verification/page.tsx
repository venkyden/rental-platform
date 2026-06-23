'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import VerificationUpload from '@/components/VerificationUpload';
import IntlSolvencyUpload from '@/components/IntlSolvencyUpload';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { 
    CheckCircle2, 
    Clock, 
    ShieldCheck, 
    Briefcase, 
    UserCheck, 
    ChevronLeft, 
    TrendingUp, 
    Home, 
    Lock, 
    FileText, 
    ArrowRight,
    Loader2,
    ShieldAlert,
    Info,
    AlertCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import CredentialSharePanel from '@/components/CredentialSharePanel';

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

interface VerificationStatusData {
    identity_verified: boolean;
    employment_verified: boolean;
    income_verified: boolean;
    income_status: string;
    ownership_verified: boolean;
    kbis_verified?: boolean;
    carte_g_verified?: boolean;
    identity_data: any;
    employment_data: any;
    ownership_data: any;
    income_data: any;
    guarantor_type: string | null;
    guarantor_status: string | null;
    guarantor_assurance: string | null;
    guarantor_data: any;
    visale_id: string | null;
    garantme_ref: string | null;
    trust_score: number;
}

export default function VerificationPage() {
    const { user, checkAuth } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const toast = useToast();
    
    const [activeTab, setActiveTab] = useState<'identity' | 'income' | 'guarantor' | 'property'>('identity');
    const [intlIncome, setIntlIncome] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [statusData, setStatusData] = useState<VerificationStatusData | null>(null);
    const [animatedScore, setAnimatedScore] = useState(0);
    const [credential, setCredential] = useState<{ credentialId: string; expiresAt: string; assuranceSummary?: string; subjectRole: string } | null>(null);
    const [issuingCredential, setIssuingCredential] = useState(false);

    const fetchStatusData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await apiClient.client.get('/verification/status');
            setStatusData(res.data);
            // Trigger animation on load or refresh
            setAnimatedScore(res.data.trust_score);
        } catch (err) {
            console.error('Error fetching verification status details:', err);
            toast.error('Failed to load verification status');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatusData();
    }, [refreshKey]);

    const handleSuccess = async () => {
        toast.success('Document uploaded successfully!');
        setRefreshKey(prev => prev + 1);
        await checkAuth();
        await fetchStatusData(true);
    };

    const handleIssueMine = async () => {
        setIssuingCredential(true);
        try {
            const res = await apiClient.client.post('/credentials/issue-mine');
            setCredential({
                credentialId: res.data.credential_id,
                expiresAt: res.data.expires_at,
                subjectRole: res.data.subject_role,
            });
        } catch {
            toast.error('Impossible d\'émettre l\'attestation. Vérifiez vos étapes de vérification.');
        } finally {
            setIssuingCredential(false);
        }
    };

    if (!user) return null;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 text-zinc-900 animate-spin" />
            </div>
        );
    }

    const isTenant = user.role === 'tenant';
    const hasPropertyTab = user.role === 'landlord' || user.role === 'property_manager';

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="max-w-7xl mx-auto space-y-16 relative z-10"
                >
                    {/* Header Section */}
                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
                        <div className="flex items-center gap-8">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="w-16 h-16 rounded-2xl bg-white shadow-2xl border border-white/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
                            >
                                <ChevronLeft className="w-8 h-8 group-hover:translate-x-[-4px] transition-transform text-zinc-900" />
                            </button>
                            <div>
                                <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-zinc-900 uppercase leading-[0.8] mb-4">
                                    {t('dashboard.verification.verification.pageTitle', undefined, 'Verification')}
                                </h1>
                                <div className="flex items-center gap-3">
                                    <div className="px-4 py-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl">
                                        {t('dashboard.verification.secureSubtitle', undefined, 'Secure Identity & Document Verification')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Progress Overview Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <motion.div variants={containerVariants} className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Identity Progress Card */}
                            <motion.div variants={itemVariants} className={`glass-card !p-10 flex flex-col items-center text-center group ${statusData?.identity_verified ? 'border-emerald-100 bg-emerald-50/10' : ''}`}>
                                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-xl transition-all duration-500 group-hover:scale-110 ${statusData?.identity_verified ? 'bg-emerald-950 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                    {statusData?.identity_verified ? <UserCheck className="w-8 h-8" /> : <Lock className="w-6 h-6" />}
                                </div>
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">
                                    {t('dashboard.verification.verification.progress.identity', undefined, 'Identity')}
                                </h3>
                                <p className={`text-lg font-black uppercase tracking-tight ${statusData?.identity_verified ? 'text-zinc-950' : 'text-zinc-400'}`}>
                                    {statusData?.identity_verified ? t('dashboard.verification.verification.verified', undefined, 'Verified') : 'Unverified'}
                                </p>
                            </motion.div>

                            {/* Income Progress Card */}
                            {isTenant && (
                                <motion.div variants={itemVariants} className={`glass-card !p-10 flex flex-col items-center text-center group ${statusData?.income_verified ? 'border-emerald-100 bg-emerald-50/10' : ''}`}>
                                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-xl transition-all duration-500 group-hover:scale-110 ${statusData?.income_verified ? 'bg-emerald-950 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                        {statusData?.income_verified ? <Briefcase className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
                                    </div>
                                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">
                                        {t('dashboard.verification.verification.tabs.income', undefined, 'Income')}
                                    </h3>
                                    <p className={`text-lg font-black uppercase tracking-tight ${statusData?.income_verified ? 'text-zinc-950' : 'text-zinc-400'}`}>
                                        {statusData?.income_verified ? t('dashboard.verification.verification.verified', undefined, 'Verified') : (statusData?.income_status || 'Unverified')}
                                    </p>
                                </motion.div>
                            )}

                            {/* Guarantor Progress Card */}
                            {isTenant && (
                                <motion.div variants={itemVariants} className={`glass-card !p-10 flex flex-col items-center text-center group ${statusData?.guarantor_status === 'verified' ? 'border-emerald-100 bg-emerald-50/10' : statusData?.guarantor_status === 'submitted' ? 'border-blue-100 bg-blue-50/10' : ''}`}>
                                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-xl transition-all duration-500 group-hover:scale-110 ${statusData?.guarantor_status === 'verified' ? 'bg-emerald-950 text-white' : statusData?.guarantor_status === 'submitted' ? 'bg-blue-950 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                        {(statusData?.guarantor_status === 'verified' || statusData?.guarantor_status === 'submitted') ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
                                    </div>
                                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">
                                        {t('dashboard.verification.verification.tabs.guarantor', undefined, 'Guarantor')}
                                    </h3>
                                    <p className={`text-lg font-black uppercase tracking-tight ${statusData?.guarantor_status === 'verified' ? 'text-zinc-950' : statusData?.guarantor_status === 'submitted' ? 'text-zinc-950' : 'text-zinc-400'}`}>
                                        {statusData?.guarantor_status === 'verified'
                                            ? t('dashboard.verification.verification.verified', undefined, 'Verified')
                                            : statusData?.guarantor_status === 'submitted'
                                                ? t('verify.guarantor.statusSubmitted', undefined, 'Submitted')
                                                : (statusData?.guarantor_status || 'None')}
                                    </p>
                                </motion.div>
                            )}

                            {/* Ownership Progress Card (Landlord Only) */}
                            {hasPropertyTab && (
                                <motion.div variants={itemVariants} className={`glass-card !p-10 flex flex-col items-center text-center group ${statusData?.ownership_verified ? 'border-emerald-100 bg-emerald-50/10' : ''}`}>
                                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-xl transition-all duration-500 group-hover:scale-110 ${statusData?.ownership_verified ? 'bg-emerald-950 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                        {statusData?.ownership_verified ? <Home className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
                                    </div>
                                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">
                                        {t('dashboard.verification.verification.progress.ownership', undefined, 'Ownership')}
                                    </h3>
                                    <p className={`text-lg font-black uppercase tracking-tight ${statusData?.ownership_verified ? 'text-zinc-950' : 'text-zinc-400'}`}>
                                        {statusData?.ownership_verified ? t('dashboard.verification.verification.verified', undefined, 'Verified') : t('dashboard.verification.verification.pending', undefined, 'Pending')}
                                    </p>
                                </motion.div>
                            )}
                        </motion.div>

                        {/* Trust Score Card */}
                        <motion.div variants={itemVariants} className="lg:col-span-4 glass-card !p-12 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] bg-zinc-900 text-white border-none rounded-[3rem] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />
                            
                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-10">
                                {t('dashboard.verification.verification.progress.trustScore', undefined, 'Trust Score')}
                            </h3>
                            
                            <div className="flex flex-col items-center">
                                <div className="relative w-48 h-48">
                                    <svg className="transform -rotate-90 w-full h-full">
                                        <circle cx="96" cy="96" r="88" stroke="rgba(255,255,255,0.05)" strokeWidth="16" fill="none" />
                                        <motion.circle 
                                            initial={{ strokeDasharray: "0 560" }}
                                            animate={{ strokeDasharray: `${(animatedScore / 100) * 552.92} 560` }}
                                            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                                            cx="96" cy="96" r="88" stroke="url(#scoreGradient)" strokeWidth="16" fill="none" strokeLinecap="round" 
                                        />
                                        <defs>
                                            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#ffffff" />
                                                <stop offset="100%" stopColor="#a1a1aa" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-7xl font-black tracking-tighter">
                                            {animatedScore}
                                        </span>
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-2">
                                            {t('dashboard.points', undefined, 'Score')}
                                        </span>
                                    </div>
                                </div>
                                <p className="mt-8 text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                    {animatedScore < 100 
                                        ? t('dashboard.verification.verification.progress.boost', undefined, 'Complete verification to boost score') 
                                        : t('dashboard.verification.verification.progress.max', undefined, 'Maximum Trust Score Achieved')}
                                </p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Main Verification Dashboard Container */}
                    <motion.div variants={itemVariants} className="glass-card !p-0 rounded-[3rem] overflow-hidden shadow-2xl border-zinc-100">
                        {/* Tab Headers */}
                        <div className="p-6 bg-zinc-50/50 border-b border-zinc-100">
                            <div className="flex flex-wrap gap-4">
                                {[
                                    { id: 'identity', label: t('dashboard.verification.verification.tabs.identity', undefined, 'Identity Verification') },
                                    ...(isTenant ? [
                                        { id: 'income', label: t('dashboard.verification.verification.tabs.income', undefined, 'Income Verification') },
                                        { id: 'guarantor', label: t('dashboard.verification.verification.tabs.guarantor', undefined, 'Guarantor Verification') }
                                    ] : []),
                                    ...(hasPropertyTab ? [
                                        { id: 'property', label: t('dashboard.verification.verification.tabs.property', undefined, 'Ownership Verification') }
                                    ] : [])
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-8 py-4.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === tab.id
                                            ? 'bg-zinc-900 text-white shadow-2xl scale-105'
                                            : 'text-zinc-400 hover:text-zinc-950'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-12 sm:p-20">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {/* IDENTITY TAB */}
                                    {activeTab === 'identity' && (
                                        statusData?.identity_verified ? (
                                            <div className="text-center py-16 space-y-6">
                                                <div className="w-24 h-24 bg-zinc-900 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl">
                                                    <UserCheck className="w-12 h-12" />
                                                </div>
                                                <h3 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase">
                                                    {t('dashboard.verification.verification.success.identity', undefined, 'Identity Verified!')}
                                                </h3>
                                                <p className="text-zinc-500 font-bold max-w-sm mx-auto text-lg">
                                                    {t('dashboard.verification.verification.success.identityMsg', undefined, 'Your identity has been successfully verified. You now have full access to high-trust rental listings.')}
                                                </p>
                                            </div>
                                        ) : (
                                            <VerificationUpload
                                                key={`identity-${refreshKey}`}
                                                verificationType="identity"
                                                onSuccessAction={handleSuccess}
                                                user={user}
                                            />
                                        )
                                    )}

                                    {/* INCOME TAB */}
                                    {activeTab === 'income' && (
                                        !statusData?.identity_verified ? (
                                            /* Locked State (Identity Required First) */
                                            <div className="text-center py-16 space-y-6 max-w-md mx-auto">
                                                <div className="w-20 h-20 bg-zinc-100 text-zinc-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                                                    <Lock className="w-8 h-8" />
                                                </div>
                                                <h3 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter">
                                                    Identity Verification Required
                                                </h3>
                                                <p className="text-zinc-500 font-medium">
                                                    To comply with French Loi Alur regulations, resource and income documentation must be tied to a verified identity. Please verify your identity first.
                                                </p>
                                                <button
                                                    onClick={() => setActiveTab('identity')}
                                                    className="inline-flex items-center gap-2 px-6 py-4.5 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all mt-4"
                                                >
                                                    Verify Identity First <ArrowRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : statusData?.income_verified ? (
                                            <div className="text-center py-16 space-y-6">
                                                <div className="w-24 h-24 bg-zinc-900 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl">
                                                    <CheckCircle2 className="w-12 h-12" />
                                                </div>
                                                <h3 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase">
                                                    Income Verified
                                                </h3>
                                                <p className="text-zinc-500 font-bold max-w-sm mx-auto text-lg">
                                                    Your financial resources have been successfully verified. This significantly boosts your standing in dossiers.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {/* Document-origin toggle — same tiers for everyone, self-selected by documents held */}
                                                <div className="flex items-center justify-center gap-2 text-xs">
                                                    <button
                                                        onClick={() => setIntlIncome(false)}
                                                        className={`px-4 py-2 rounded-full font-black uppercase tracking-widest text-[10px] transition-all ${!intlIncome ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'}`}
                                                    >
                                                        French documents
                                                    </button>
                                                    <button
                                                        onClick={() => setIntlIncome(true)}
                                                        className={`px-4 py-2 rounded-full font-black uppercase tracking-widest text-[10px] transition-all ${intlIncome ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'}`}
                                                    >
                                                        International documents
                                                    </button>
                                                </div>
                                                {intlIncome ? (
                                                    <IntlSolvencyUpload
                                                        key={`intl-${refreshKey}`}
                                                        onSuccessAction={handleSuccess}
                                                    />
                                                ) : (
                                                    <VerificationUpload
                                                        key={`income-${refreshKey}`}
                                                        verificationType="employment"
                                                        onSuccessAction={handleSuccess}
                                                        user={user}
                                                    />
                                                )}
                                            </div>
                                        )
                                    )}

                                    {/* GUARANTOR TAB */}
                                    {activeTab === 'guarantor' && (
                                        !statusData?.identity_verified ? (
                                            /* Locked State (Identity Required First) */
                                            <div className="text-center py-16 space-y-6 max-w-md mx-auto">
                                                <div className="w-20 h-20 bg-zinc-100 text-zinc-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                                                    <Lock className="w-8 h-8" />
                                                </div>
                                                <h3 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter">
                                                    Identity Verification Required
                                                </h3>
                                                <p className="text-zinc-500 font-medium">
                                                    Please verify your identity first to lock in your guarantor configuration.
                                                </p>
                                                <button
                                                    onClick={() => setActiveTab('identity')}
                                                    className="inline-flex items-center gap-2 px-6 py-4.5 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all mt-4"
                                                >
                                                    Verify Identity First <ArrowRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-12">
                                                {statusData?.guarantor_type ? (
                                                    <div className="max-w-xl mx-auto space-y-8">
                                                        <div className="p-8 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 space-y-6">
                                                            <div className="flex justify-between items-center pb-4 border-b border-zinc-200/50">
                                                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Registered Guarantor Type</span>
                                                                <span className="font-bold text-zinc-900 capitalize">
                                                                    {statusData.guarantor_type === 'visale' && 'Visale (Action Logement)'}
                                                                    {statusData.guarantor_type === 'garantme' && 'Garantme'}
                                                                    {statusData.guarantor_type === 'physical' && 'Physical Person'}
                                                                    {statusData.guarantor_type === 'none' && 'No Guarantor'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center pb-4 border-b border-zinc-200/50">
                                                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Status</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                                                                        statusData.guarantor_status === 'verified' ? 'bg-emerald-50 text-emerald-700' :
                                                                        statusData.guarantor_status === 'submitted' ? 'bg-blue-50 text-blue-700' :
                                                                        statusData.guarantor_status === 'pending' ? 'bg-amber-50 text-amber-700' :
                                                                        'bg-zinc-100 text-zinc-600'
                                                                    }`}>
                                                                        {statusData.guarantor_status}
                                                                    </span>
                                                                    {statusData.guarantor_assurance === 'MEDIUM' && (
                                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold uppercase tracking-wider">OCR verified</span>
                                                                    )}
                                                                    {statusData.guarantor_assurance === 'DOCUMENT_SUBMITTED' && (
                                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-bold uppercase tracking-wider">Docs on file</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {statusData.guarantor_type === 'visale' && statusData.visale_id && (
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Dossier ID</span>
                                                                    <span className="font-mono font-bold text-zinc-900">{statusData.visale_id}</span>
                                                                </div>
                                                            )}
                                                            {statusData.guarantor_type === 'garantme' && statusData.garantme_ref && (
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Reference Code</span>
                                                                    <span className="font-mono font-bold text-zinc-900">{statusData.garantme_ref}</span>
                                                                </div>
                                                            )}
                                                            {statusData.guarantor_type === 'physical' && statusData.guarantor_data?.files && (
                                                                <div className="space-y-3 pt-2">
                                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Files Verified</span>
                                                                    <div className="grid gap-2">
                                                                        {statusData.guarantor_data.files.map((file: any, index: number) => (
                                                                            <div key={index} className="flex justify-between items-center text-sm py-1 border-b border-zinc-100 last:border-0">
                                                                                <span className="font-medium text-zinc-700 capitalize">{file.document_type.replace('_', ' ')}</span>
                                                                                <span className="text-xs text-zinc-400">{file.filename}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-4">
                                                            <button
                                                                onClick={() => router.push('/verify/guarantor')}
                                                                className="w-full py-5 bg-zinc-950 hover:bg-zinc-900 text-white font-black text-xs uppercase tracking-widest rounded-3xl transition-all"
                                                            >
                                                                Manage / Change Guarantor
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-16 space-y-8 max-w-md mx-auto">
                                                        <div className="w-20 h-20 bg-zinc-100 text-zinc-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                                                            <ShieldAlert className="w-8 h-8" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h3 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter">
                                                                No Guarantor Configured
                                                            </h3>
                                                            <p className="text-zinc-500 font-medium">
                                                                Most French landlords will not consider applications without a guarantor. Configure a guarantee system now to make your dossier competitive.
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => router.push('/verify/guarantor')}
                                                            className="inline-flex items-center gap-2 px-8 py-5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-widest rounded-3xl transition-all active:scale-[0.98]"
                                                        >
                                                            Set Up Guarantor <ArrowRight className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    )}

                                    {/* PROPERTY TAB (LANDLORD ONLY) */}
                                    {activeTab === 'property' && (
                                        <VerificationUpload
                                            key={`property-${refreshKey}`}
                                            verificationType="property"
                                            onSuccessAction={handleSuccess}
                                            user={user}
                                        />
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    {/* Credential issuance */}
                    {statusData?.identity_verified && (
                        <motion.div variants={itemVariants} className="max-w-lg mx-auto">
                            {credential ? (
                                <CredentialSharePanel
                                    credentialId={credential.credentialId}
                                    subjectRole={credential.subjectRole}
                                    expiresAt={credential.expiresAt}
                                />
                            ) : (
                                <div className="text-center space-y-4">
                                    <p className="text-sm text-zinc-500">
                                        Votre profil est suffisamment vérifié pour générer une attestation signée et partageable.
                                    </p>
                                    <button
                                        onClick={handleIssueMine}
                                        disabled={issuingCredential}
                                        className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-3xl transition-all active:scale-[0.98]"
                                    >
                                        {issuingCredential ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <ShieldCheck className="w-4 h-4" />
                                        )}
                                        Générer mon attestation vérifiée
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* CNIL Data notice and retention timeline */}
                    <motion.div variants={itemVariants} className="p-8 rounded-[2.5rem] bg-zinc-900 text-zinc-400 max-w-4xl mx-auto space-y-4 text-left border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="flex gap-4 items-start">
                            <Info className="w-5 h-5 text-white shrink-0 mt-0.5" />
                            <div className="space-y-2">
                                <h4 className="text-xs font-black text-white uppercase tracking-wider">CNIL GDPR Data Retention Policy</h4>
                                <p className="text-xs leading-relaxed font-medium">
                                    All uploaded documents (identity cards, tax assessments, payslips, guarantor proofs) are kept strictly confidential, encrypted at rest, and watermarked to prevent fraud. In compliance with French CNIL regulations, these verification files are permanently and automatically deleted 3 years after the last active contact on Roomivo, or immediately upon user deletion requests.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
