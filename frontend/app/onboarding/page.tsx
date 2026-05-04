'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, Home, Building, Check } from 'lucide-react';
import OnboardingQuestionnaire from '@/components/OnboardingQuestionnaire';
import { apiClient } from '@/lib/api';
import RoomivoBrand from '@/components/RoomivoBrand';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';

export default function OnboardingPage() {
    const [step, setStep] = useState<'welcome' | 'questionnaire'>('welcome');
    const { user, loading, checkAuth, switchRole } = useAuth();
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
            setError(t('onboarding.error.acceptTerms'));
            return;
        }

        setIsProcessing(true);
        try {
            // If the user selected a different role than what's currently in their profile
            if (selectedRole !== user?.role) {
                await switchRole(selectedRole);
            }
            setStep('questionnaire');
        } catch (err) {
            setError(t('onboarding.error.savingName')); // Reuse error or add role-specific one
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>;

    if (step === 'welcome') {
        return (
            <PremiumLayout withNavbar={false}>
                <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-50 dark:bg-zinc-950">
                    {/* Background Effects */}
                    <div className="absolute inset-0 z-0">
                        <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white dark:from-teal-900/20 dark:via-zinc-950 dark:to-zinc-950"></div>
                        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10"></div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="max-w-3xl w-full text-center relative z-10"
                    >
                        <div className="mb-16 flex justify-center">
                            <motion.div 
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                className="w-28 h-28 rounded-[2.5rem] bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-2xl shadow-teal-500/30"
                            >
                                <span className="text-5xl font-black text-white italic">R</span>
                            </motion.div>
                        </div>

                        <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-500 uppercase leading-[0.9]">
                            {t('onboarding.welcome')}
                        </h1>

                        <div className="mb-12 max-w-2xl mx-auto">
                            <p className="text-zinc-400 dark:text-zinc-500 font-black text-[10px] uppercase tracking-[0.4em] mb-8 text-center">{t('onboarding.roleSelection')}</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                                {[
                                    { id: 'tenant', label: t('dashboard.roleSwitcher.roles.tenant'), icon: <UserIcon className="w-6 h-6" /> },
                                    { id: 'landlord', label: t('dashboard.roleSwitcher.roles.landlord'), icon: <Home className="w-6 h-6" /> },
                                    { id: 'property_manager', label: t('dashboard.roleSwitcher.roles.property_manager'), icon: <Building className="w-6 h-6" /> },
                                ].map((role) => (
                                    <button
                                        key={role.id}
                                        onClick={() => { setSelectedRole(role.id); setError(''); }}
                                        className={`group relative flex flex-col items-center justify-center p-6 rounded-[2rem] border-2 transition-all duration-500 ${
                                            selectedRole === role.id
                                                ? 'border-teal-500 bg-teal-500/5 text-teal-600 shadow-xl shadow-teal-500/10 scale-105'
                                                : 'border-zinc-100 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/30 text-zinc-400 hover:border-teal-200'
                                        }`}
                                    >
                                        {selectedRole === role.id && (
                                            <motion.div 
                                                layoutId="selected-check"
                                                className="absolute -top-2 -right-2 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center text-white shadow-lg"
                                            >
                                                <Check className="w-3 h-3 stroke-[4]" />
                                            </motion.div>
                                        )}
                                        <div className={`mb-4 p-4 rounded-2xl transition-colors ${selectedRole === role.id ? 'bg-teal-500 text-white' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400'}`}>
                                            {role.icon}
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{role.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center justify-center gap-4 group cursor-pointer" onClick={() => { setAcceptedTerms(!acceptedTerms); setError(''); }}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${acceptedTerms ? 'bg-teal-500 border-teal-500 shadow-lg shadow-teal-500/30' : 'border-zinc-200 dark:border-zinc-800 group-hover:border-teal-300'}`}>
                                    {acceptedTerms && <Check className="w-4 h-4 text-white stroke-[4]" />}
                                </div>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-left">
                                    {t('onboarding.termsLabel')}{' '}
                                    <a href="/legal/privacy" target="_blank" className="text-teal-500 hover:underline">{t('onboarding.privacyPolicy')}</a>{' '}
                                    {t('onboarding.and')}{' '}
                                    <a href="/legal/terms" target="_blank" className="text-teal-500 hover:underline">{t('onboarding.termsOfService')}</a>
                                    <span className="text-red-500 ml-1">*</span>
                                </p>
                            </div>
                            
                            {error && (
                                <motion.p 
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-500 text-[10px] font-black mt-6 uppercase tracking-widest text-center"
                                >
                                    {error}
                                </motion.p>
                            )}
                        </div>


                        <div className="flex flex-col items-center gap-10">
                            <button
                                onClick={handleStart}
                                disabled={isProcessing || !acceptedTerms}
                                className="px-20 py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl shadow-zinc-900/30 dark:shadow-white/10 hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
                            >
                                {isProcessing ? t('onboarding.saving') : t('onboarding.getStarted')}
                            </button>
                            
                            {user?.full_name && (
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-black text-[10px] uppercase tracking-[0.4em] transition-all"
                                >
                                    {t('onboarding.skip')}
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            </PremiumLayout>
        );
    }

    if (step === 'questionnaire') {
        return <OnboardingQuestionnaire userType={userType} onComplete={handleComplete} />;
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto glass-card !p-8 border-teal-500/20 shadow-2xl relative overflow-hidden"
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-teal-500" />
            
            <h3 className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-[0.3em] mb-8 flex items-center justify-center gap-3">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                {t('onboarding.pendingInvites')}
            </h3>
            
            <div className="space-y-4">
                {invites.map(invite => (
                    <div key={invite.id} className="flex items-center justify-between gap-6 p-5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[1.5rem] border border-white/40 dark:border-zinc-800/50 shadow-sm hover:shadow-md transition-all group">
                        <div className="text-left">
                            <p className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-tight">{invite.landlord_name}</p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1">{t('onboarding.teamInvite')}</p>
                        </div>
                        <button
                            onClick={() => router.push(`/invite/${invite.token}`)}
                            className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl hover:scale-110 active:scale-95 transition-all shadow-xl shadow-zinc-900/20 dark:shadow-white/5"
                        >
                            {t('onboarding.view')}
                        </button>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
