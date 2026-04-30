'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import OnboardingQuestionnaire from '@/components/OnboardingQuestionnaire';
import { apiClient } from '@/lib/api';
import RoomivoBrand from '@/components/RoomivoBrand';
import { useAuth } from '@/lib/useAuth';

export default function OnboardingPage() {
    const [step, setStep] = useState<'welcome' | 'questionnaire'>('welcome');
    const { user, loading } = useAuth();
    const router = useRouter();
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
            setError('Please enter your full name to continue.');
            return;
        }

        if (!user?.full_name && fullName.trim()) {
            try {
                setIsSavingName(true);
                await apiClient.client.put('/auth/me', { full_name: fullName.trim() });
                // We don't strictly need to mutate user state here since we just move to the next step,
                // but if there's a mutate() function we could call it.
            } catch (err) {
                setError('Failed to save name. Please try again.');
                setIsSavingName(false);
                return;
            }
        }
        
        setStep('questionnaire');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
                <div className="w-8 h-8 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (step === 'welcome') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-zinc-950">
                {/* Background Effects matching AuthLayout */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white dark:from-teal-900/20 dark:via-zinc-950 dark:to-zinc-950"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-400/10 dark:bg-teal-500/5 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="z-10 w-full max-w-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 p-10 md:p-12 text-center"
                >
                    <div className="flex justify-center mb-8">
                        <RoomivoBrand variant="wordmark" size="lg" />
                    </div>
                    <div className="text-6xl mb-6"></div>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                        Welcome to Roomivo!
                    </h1>
                    
                    {!user?.full_name ? (
                        <div className="mb-8 max-w-sm mx-auto text-left">
                            <p className="text-gray-600 dark:text-zinc-400 mb-4 text-center">
                                Please enter your full name to get started.
                            </p>
                            <input
                                type="text"
                                placeholder="e.g. Jean Dupont"
                                value={fullName}
                                onChange={(e) => { setFullName(e.target.value); setError(''); }}
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                            />
                            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                        </div>
                    ) : (
                        <p className="text-xl text-gray-600 dark:text-zinc-400 mb-8">
                            We'll ask you a few quick questions to personalize your experience.
                            <br />
                            <span className="text-sm text-gray-500 dark:text-zinc-500 mt-2 block">This takes about 2 minutes.</span>
                        </p>
                    )}

                    <button
                        onClick={handleStart}
                        disabled={isSavingName}
                        className="w-full sm:w-auto px-12 py-4 bg-teal-600 hover:bg-teal-700 text-white text-lg font-medium rounded-2xl shadow-sm hover: transition-all transform hover:-translate-y-0.5 disabled:opacity-70"
                    >
                        {isSavingName ? 'Saving...' : 'Let\'s get started →'}
                    </button>
                    
                    {user?.full_name && (
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="block w-full mt-6 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 text-sm transition-colors"
                        >
                            Skip for now
                        </button>
                    )}
                </motion.div>
            </div>
        );
    }

    if (step === 'questionnaire') {
        return <OnboardingQuestionnaire userType={userType} onComplete={handleComplete} />;
    }

    return null;
}
