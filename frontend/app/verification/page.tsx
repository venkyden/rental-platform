'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import VerificationUpload from '@/components/VerificationUpload';
import { motion, Variants } from 'framer-motion';
import { CheckCircle2, Clock, ShieldCheck, Briefcase, UserCheck, ChevronLeft, TrendingUp, Home } from 'lucide-react';

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

export default function VerificationPage() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'identity' | 'employment' | 'property'>('identity');
    const [refreshKey, setRefreshKey] = useState(0);

    if (!user) return null;

    const handleSuccess = () => {
        setRefreshKey(prev => prev + 1);
        setTimeout(() => {
            router.push('/dashboard');
        }, 2000);
    };

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

                    {/* Progress Overview - Premium Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <motion.div variants={containerVariants} className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Email Card */}
                            <motion.div variants={itemVariants} className="glass-card !p-10 flex flex-col items-center text-center group">
                                <div className="w-16 h-16 bg-zinc-900 text-white rounded-[1.5rem] flex items-center justify-center mb-8 shadow-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">
                                    {t('dashboard.verification.verification.progress.email', undefined, 'Email')}
                                </h3>
                                <p className="text-lg font-black text-zinc-900 uppercase tracking-tight">
                                    {t('dashboard.verification.verification.verified', undefined, 'Verified')}
                                </p>
                            </motion.div>

                            {/* Identity Card */}
                            <motion.div variants={itemVariants} className={`glass-card !p-10 flex flex-col items-center text-center group ${user.identity_verified ? 'border-zinc-900/30' : ''}`}>
                                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6 ${user.identity_verified ? 'bg-zinc-900 text-white shadow-2xl' : 'bg-zinc-100 text-zinc-400'}`}>
                                    {user.identity_verified ? (
                                        <UserCheck className="w-8 h-8" />
                                    ) : (
                                        <Clock className="w-8 h-8" />
                                    )}
                                </div>
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">
                                    {t('dashboard.verification.verification.progress.identity', undefined, 'Identity')}
                                </h3>
                                <p className={`text-lg font-black uppercase tracking-tight ${user.identity_verified ? 'text-zinc-900' : 'text-zinc-400'}`}>
                                    {user.identity_verified ? t('dashboard.verification.verification.verified', undefined, 'Verified') : t('dashboard.verification.verification.pending', undefined, 'Pending')}
                                </p>
                            </motion.div>

                            {/* Professional/Ownership Card */}
                            {(() => {
                                const isLandlord = user.role === 'landlord' || user.role === 'property_manager';
                                const isVerified = isLandlord ? user.ownership_verified : user.employment_verified;
                                const label = isLandlord 
                                    ? t('dashboard.verification.verification.progress.ownership', undefined, 'Ownership') 
                                    : t('dashboard.verification.verification.progress.employment', undefined, 'Employment');
                                
                                return (
                                    <motion.div variants={itemVariants} className={`glass-card !p-10 flex flex-col items-center text-center group ${isVerified ? 'border-zinc-900/30' : ''}`}>
                                        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 ${isVerified ? 'bg-zinc-900 text-white shadow-2xl' : 'bg-zinc-100 text-zinc-400'}`}>
                                            {isVerified ? (
                                                isLandlord ? <Home className="w-8 h-8" /> : <Briefcase className="w-8 h-8" />
                                            ) : (
                                                <Clock className="w-8 h-8" />
                                            )}
                                        </div>
                                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-3">
                                            {label}
                                        </h3>
                                        <p className={`text-lg font-black uppercase tracking-tight ${isVerified ? 'text-zinc-900' : 'text-zinc-400'}`}>
                                            {isVerified ? t('dashboard.verification.verification.verified', undefined, 'Verified') : t('dashboard.verification.verification.pending', undefined, 'Pending')}
                                        </p>
                                    </motion.div>
                                );
                            })()}
                        </motion.div>

                        {/* Trust Score Card - Ultra Premium */}
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
                                            animate={{ strokeDasharray: `${(user.trust_score / 100) * 552.92} 560` }}
                                            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
                                            cx="96" cy="96" r="88" stroke="url(#scoreGradient)" strokeWidth="16" fill="none" strokeLinecap="round" 
                                        />
                                        <defs>
                                            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#ffffff" />
                                                <stop offset="100%" stopColor="#d4d4d8" />
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
                                <p className="mt-8 text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                    {user.trust_score < 100 
                                        ? t('dashboard.verification.verification.progress.boost', undefined, 'Complete verification to boost score') 
                                        : t('dashboard.verification.verification.progress.max', undefined, 'Maximum Trust Score Achieved')}
                                </p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Main Verification Container */}
                    <motion.div variants={itemVariants} className="glass-card !p-0 rounded-[3rem] overflow-hidden shadow-2xl">
                        {/* Tab Selectors - Premium Pill */}
                        <div className="p-6 bg-zinc-50/50 border-b border-zinc-100">
                            <div className="flex flex-wrap gap-4">
                                {[
                                    { id: 'identity', label: t('dashboard.verification.verification.tabs.identity', undefined, 'Identity Verification') },
                                    (user.role === 'landlord' || user.role === 'property_manager')
                                        ? { id: 'property', label: t('dashboard.verification.verification.tabs.property', undefined, 'Ownership Verification') }
                                        : { id: 'employment', label: t('dashboard.verification.verification.tabs.employment', undefined, 'Employment Verification') }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === tab.id
                                            ? 'bg-zinc-900 text-white shadow-2xl scale-105'
                                            : 'text-zinc-400 hover:text-zinc-900'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Verification Content Area */}
                        <div className="p-12 sm:p-20">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            >
                                {activeTab === 'identity' && (
                                    !user.identity_verified ? (
                                        <VerificationUpload
                                            key={`identity-${refreshKey}`}
                                            verificationType="identity"
                                            onSuccessAction={handleSuccess}
                                            user={user}
                                        />
                                    ) : (
                                        <div className="text-center py-20">
                                            <div className="w-24 h-24 bg-zinc-900 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl">
                                                <UserCheck className="w-12 h-12" />
                                            </div>
                                            <h3 className="text-4xl font-black text-zinc-900 mb-4 tracking-tighter uppercase">
                                                {t('dashboard.verification.verification.success.identity', undefined, 'Identity Verified!')}
                                            </h3>
                                            <p className="text-zinc-500 font-bold max-w-sm mx-auto text-lg leading-relaxed">
                                                {t('dashboard.verification.verification.success.identityMsg', undefined, 'Your identity has been successfully verified. You now have full access to high-trust rental listings.')}
                                            </p>
                                        </div>
                                    )
                                )}

                                {activeTab === 'employment' && (
                                    !user.employment_verified ? (
                                        <VerificationUpload
                                            key={`employment-${refreshKey}`}
                                            verificationType="employment"
                                            onSuccessAction={handleSuccess}
                                            user={user}
                                        />
                                    ) : (
                                        <div className="text-center py-20">
                                            <div className="w-24 h-24 bg-zinc-900 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl">
                                                <Briefcase className="w-12 h-12" />
                                            </div>
                                            <h3 className="text-4xl font-black text-zinc-900 mb-4 tracking-tighter uppercase">
                                                {t('dashboard.verification.verification.success.employment', undefined, 'Employment Verified!')}
                                            </h3>
                                            <p className="text-zinc-500 font-bold max-w-sm mx-auto text-lg leading-relaxed">
                                                {t('dashboard.verification.verification.success.employmentMsg', undefined, 'Your employment has been successfully verified. This significantly improves your profile standing.')}
                                            </p>
                                        </div>
                                    )
                                )}

                                {activeTab === 'property' && (
                                    <VerificationUpload
                                        key={`property-${refreshKey}`}
                                        verificationType="property"
                                        onSuccessAction={handleSuccess}
                                        user={user}
                                    />
                                )}
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
