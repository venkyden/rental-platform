'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import OnboardingQuestionnaire from '@/components/OnboardingQuestionnaire';
import { apiClient } from '@/lib/api';
import RoomivoBrand from '@/components/RoomivoBrand';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';

export default function OnboardingPage() {
    const [step, setStep] = useState<'welcome' | 'questionnaire'>('welcome');
    const { user, loading } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
    const [fullName, setFullName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);
    const [error, setError] = useState('');

    const userType = (user?.role === 'landlord' || user?.role === 'property_manager') ? 'landlord' : 'tenant';

    const handleComplete = async (responses: Record<string, any>) => {
        try {
            await apiClient.client.post('/onboarding/complete', { responses });
            router.push('/dashboard');
        } catch (error) {
            console.error('Failed to complete onboarding:', error);
        }
    };

    const handleStart = async () => {
        if (!user?.full_name && !fullName.trim()) {
            setError(t('onboarding.error.enterName'));
            return;
        }

        if (!user?.full_name && fullName.trim()) {
            setIsSavingName(true);
            try {
                await apiClient.client.patch('/users/me', { full_name: fullName.trim() });
            } catch (err) {
                setError(t('onboarding.error.savingName'));
                setIsSavingName(false);
                return;
            }
        }
        
        setStep('questionnaire');
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" /></div>;

    if (step === 'welcome') {
        return (
            <PremiumLayout withNavbar={false}>
                <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-3xl w-full text-center"
                    >
                        <div className="mb-12 flex justify-center">
                            <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-2xl shadow-teal-500/20">
                                <span className="text-4xl font-black text-white italic">R</span>
                            </div>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-500">
                            {t('onboarding.welcome')}
                        </h1>

                        {!user?.full_name ? (
                            <div className="mb-12 max-w-sm mx-auto">
                                <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm uppercase tracking-widest mb-6">{t('onboarding.letsStart')}</p>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder={t('common.placeholders.fullName')}
                                        value={fullName}
                                        onChange={(e) => { setFullName(e.target.value); setError(''); }}
                                        className="w-full px-8 py-5 rounded-3xl border-none bg-zinc-100 dark:bg-zinc-800/50 text-xl font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/50 transition-all text-center"
                                    />
                                    {error && <p className="text-red-500 text-xs font-bold mt-4 uppercase tracking-widest">{error}</p>}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-12">
                                <p className="text-xl md:text-2xl text-zinc-500 dark:text-zinc-400 font-medium max-w-xl mx-auto leading-relaxed">
                                    {t('onboarding.ready')}
                                </p>
                                <div className="mt-8">
                                    <PendingInvitesSection />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col items-center gap-6">
                            <button
                                onClick={handleStart}
                                disabled={isSavingName}
                                className="btn-primary !px-16 !py-5 !text-lg !rounded-[2rem] shadow-2xl shadow-teal-500/20 active:scale-95 transition-all"
                            >
                                {isSavingName ? t('onboarding.saving') : t('onboarding.getStarted')}
                            </button>
                            
                            {user?.full_name && (
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-black text-xs uppercase tracking-[0.2em] transition-all"
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto glass-card !p-6 border-teal-100 dark:border-teal-900/30"
        >
            <h3 className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                {t('onboarding.pendingInvites')}
            </h3>
            <div className="space-y-4">
                {invites.map(invite => (
                    <div key={invite.id} className="flex items-center justify-between gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                        <div className="text-left">
                            <p className="text-sm font-black text-zinc-900 dark:text-white">{invite.landlord_name}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{t('onboarding.teamInvite')}</p>
                        </div>
                        <button
                            onClick={() => router.push(`/invite/${invite.token}`)}
                            className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all"
                        >
                            {t('onboarding.view')}
                        </button>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}
