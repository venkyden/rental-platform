'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, Home, Building, Check, Sparkles, ChevronRight, Bell, ShieldCheck } from 'lucide-react';
import OnboardingQuestionnaire from '@/components/OnboardingQuestionnaire';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';
import LanguageSwitcher from '@/components/LanguageSwitcher';

/* ----------------------------------------------------------------
   Framer-motion variants
   ---------------------------------------------------------------- */
const containerVariants: any = {
    hidden: { opacity: 0 },
    show: { 
        opacity: 1, 
        transition: { 
            staggerChildren: 0.1, 
            duration: 0.8, 
            ease: [0.16, 1, 0.3, 1] 
        } 
    }
};

const itemVariants: any = {
    hidden: { opacity: 0, y: 40, scale: 0.98 },
    show: { 
        opacity: 1, 
        y: 0, 
        scale: 1, 
        transition: { 
            type: 'spring', 
            stiffness: 150, 
            damping: 20 
        } 
    }
};

export default function OnboardingPage() {
    const [step, setStep] = useState<'welcome' | 'questionnaire'>('welcome');
    const { user, loading, switchRole } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
    const [selectedRole, setSelectedRole] = useState<string>(user?.role || 'tenant');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const userType = useMemo(() => {
        if (!user?.role) return 'tenant';
        const roleStr = String(user.role).toLowerCase();
        if (roleStr === 'property_manager') return 'agency';
        if (roleStr === 'landlord') return 'landlord';
        return 'tenant';
    }, [user]);

    const handleComplete = async (responses: Record<string, any>) => {
        try {
            await apiClient.client.post('/onboarding/complete', { responses });
            router.push('/dashboard');
        } catch (error) {
            console.error('Failed to complete onboarding:', error);
        }
    };

    const handleStart = async () => {
        if (!acceptedTerms) {
            setError(t('onboarding.error.acceptTerms', undefined, 'Please accept the terms to continue'));
            return;
        }

        setIsProcessing(true);
        try {
            if (selectedRole !== user?.role) {
                await switchRole(selectedRole);
            }
            setStep('questionnaire');
        } catch (err) {
            setError(t('onboarding.error.savingName', undefined, 'Unable to save profile preferences'));
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400">Synchronizing</p>
            </div>
        </div>
    );

    if (step === 'welcome') {
        return (
            <PremiumLayout withNavbar={false}>
                <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-white">
                    {/* Premium Background Orbs */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <motion.div 
                            animate={{ scale: [1, 1.3, 1], x: [0, 100, 0], y: [0, 50, 0] }}
                            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -top-[15%] -left-[10%] w-[50%] h-[50%] bg-zinc-900/5 rounded-full blur-[140px]" 
                        />
                        <motion.div 
                            animate={{ scale: [1.3, 1, 1.3], x: [0, -100, 0], y: [0, -50, 0] }}
                            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -bottom-[15%] -right-[10%] w-[60%] h-[60%] bg-zinc-900/5 rounded-full blur-[140px]" 
                        />
                    </div>

                    <div className="absolute top-12 right-12 z-50">
                        <LanguageSwitcher />
                    </div>

                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="max-w-4xl w-full relative z-10 flex flex-col items-center"
                    >
                        {/* Brand Mark */}
                        <motion.div variants={itemVariants} className="mb-16">
                            <div className="w-20 h-20 rounded-[2rem] bg-zinc-900 flex items-center justify-center shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)]">
                                <span className="text-3xl font-black text-white italic">R</span>
                            </div>
                        </motion.div>

                        <motion.h1 
                            variants={itemVariants}
                            className="text-7xl md:text-9xl font-black tracking-tighter mb-6 text-zinc-900 text-center uppercase leading-[0.8] mix-blend-multiply"
                        >
                            {t('onboarding.welcome', undefined, 'Welcome Home')}
                        </motion.h1>

                        <motion.p 
                            variants={itemVariants}
                            className="text-[12px] font-black text-zinc-400 uppercase tracking-[0.6em] mb-20 text-center"
                        >
                            {t('onboarding.roleSelection', undefined, 'Confirm your identity to begin')}
                        </motion.p>

                        {/* Role Selection Grid */}
                        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-8 w-full mb-16">
                            {[
                                { id: 'tenant', label: t('dashboard.roleSwitcher.roles.tenant', undefined, 'Tenant'), icon: <UserIcon />, desc: 'Looking for a home' },
                                { id: 'landlord', label: t('dashboard.roleSwitcher.roles.landlord', undefined, 'Landlord'), icon: <Home />, desc: 'Renting out property' },
                                { id: 'property_manager', label: t('dashboard.roleSwitcher.roles.property_manager', undefined, 'Agency'), icon: <Building />, desc: 'Professional manager' },
                            ].map((role) => (
                                <motion.button
                                    key={role.id}
                                    whileHover={{ scale: 1.05, y: -10 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setSelectedRole(role.id); setError(''); }}
                                    className={`relative flex flex-col items-center p-10 rounded-[3rem] transition-all duration-700 overflow-hidden group ${
                                        selectedRole === role.id
                                            ? 'bg-zinc-900 text-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)]'
                                            : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'
                                    }`}
                                >
                                    <div className={`mb-8 p-5 rounded-[1.5rem] transition-all duration-500 ${
                                        selectedRole === role.id 
                                            ? 'bg-white/20 text-white scale-110' 
                                            : 'bg-white text-zinc-300 shadow-sm group-hover:text-zinc-500'
                                    }`}>
                                        {role.icon}
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-[0.2em] mb-2">{role.label}</span>
                                    <span className={`text-[9px] font-bold uppercase tracking-tight opacity-50 ${selectedRole === role.id ? 'text-zinc-400' : 'text-zinc-300'}`}>{role.desc}</span>
                                    
                                    <AnimatePresence>
                                        {selectedRole === role.id && (
                                            <motion.div 
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                className="absolute top-8 right-8"
                                            >
                                                <div className="w-6 h-6 bg-white text-zinc-900 rounded-full flex items-center justify-center shadow-xl">
                                                    <Check className="w-3.5 h-3.5 stroke-[4]" />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.button>
                            ))}
                        </motion.div>

                        {/* Terms & Consent */}
                        <motion.div variants={itemVariants} className="w-full max-w-xl mb-16">
                            <div 
                                className={`flex items-center gap-6 p-8 rounded-[2.5rem] transition-all duration-500 cursor-pointer group ${
                                    acceptedTerms ? 'bg-zinc-900 text-white shadow-xl' : 'bg-zinc-50 hover:bg-zinc-100'
                                }`}
                                onClick={() => { setAcceptedTerms(!acceptedTerms); setError(''); }}
                            >
                                <div className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 ${
                                    acceptedTerms 
                                        ? 'bg-white border-white text-zinc-900' 
                                        : 'border-zinc-200 group-hover:border-zinc-300'
                                }`}>
                                    {acceptedTerms && <Check className="w-5 h-5 stroke-[4]" />}
                                </div>
                                <p className={`text-[10px] font-black uppercase tracking-widest flex-1 leading-relaxed ${
                                    acceptedTerms ? 'text-white' : 'text-zinc-400'
                                }`}>
                                    {t('onboarding.termsLabel', undefined, 'I accept the')} <a href="/legal/privacy" className={`underline decoration-zinc-300 ${acceptedTerms ? 'text-white' : 'text-zinc-900'}`}>privacy policy</a> {t('onboarding.and', undefined, '&')} <a href="/legal/terms" className={`underline decoration-zinc-300 ${acceptedTerms ? 'text-white' : 'text-zinc-900'}`}>terms</a>
                                </p>
                            </div>
                            
                            <AnimatePresence>
                                {error && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="bg-zinc-900 text-white p-6 rounded-2xl flex items-center justify-center gap-4 mt-8 shadow-2xl"
                                    >
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                                            {error}
                                        </span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        <motion.div variants={itemVariants} className="flex flex-col items-center gap-10 mb-24">
                            <button
                                onClick={handleStart}
                                disabled={isProcessing || !acceptedTerms}
                                className="px-32 py-8 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.5em] rounded-full shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] transition-all duration-500 disabled:opacity-10 flex items-center gap-6 group relative overflow-hidden"
                            >
                                <span className="relative z-10">
                                    {isProcessing ? 'Processing' : t('onboarding.getStarted', undefined, 'Begin Experience')}
                                </span>
                                {!isProcessing && <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform relative z-10" strokeWidth={3} />}
                                
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    </div>
                                )}
                            </button>

                            <div className="flex items-center gap-4 text-zinc-300">
                                <ShieldCheck className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em]">{t('onboarding.timeEstimate', undefined, 'Est. 2 minutes')}</span>
                            </div>
                        </motion.div>

                        {/* Pending Invites as Notifications */}
                        <PendingInvitesSection />
                    </motion.div>
                </div>
            </PremiumLayout>
        );
    }

    if (step === 'questionnaire') {
        return (
            <PremiumLayout withNavbar={false}>
                <div className="fixed top-12 right-12 z-50">
                    <LanguageSwitcher />
                </div>
                <OnboardingQuestionnaire userType={userType} onComplete={handleComplete} />
            </PremiumLayout>
        );
    }

    return null;
}

function PendingInvitesSection() {
    const [invites, setInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { t } = useLanguage();

    useEffect(() => {
        apiClient.client.get('/team/my-invites')
            .then(res => setInvites(res.data))
            .catch(err => console.error('Failed to fetch invites:', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading || invites.length === 0) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg"
        >
            <div className="flex items-center gap-5 mb-8">
                <div className="w-12 h-12 rounded-[1.25rem] bg-zinc-900 flex items-center justify-center text-white shadow-lg">
                    <Bell className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="text-[10px] font-black text-zinc-900 uppercase tracking-[0.4em]">
                    {t('onboarding.pendingInvites', undefined, 'Pending Invitations')}
                </h3>
            </div>
            
            <div className="space-y-6">
                {invites.map(invite => (
                    <div key={invite.id} className="p-8 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 flex items-center justify-between group hover:bg-white hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-500">
                        <div className="text-left">
                            <p className="text-[11px] font-black text-zinc-900 uppercase tracking-tight">{invite.landlord_name}</p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-2">Management Request</p>
                        </div>
                        <button
                            onClick={() => router.push(`/invite/${invite.token}`)}
                            className="w-14 h-14 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-500 shadow-xl"
                        >
                            <ChevronRight className="w-5 h-5" strokeWidth={3} />
                        </button>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
