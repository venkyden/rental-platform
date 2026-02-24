'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import OnboardingQuestionnaire from '@/components/OnboardingQuestionnaire';
import { apiClient } from '@/lib/api';
import RoomivoBrand from '@/components/RoomivoBrand';

export default function OnboardingPage() {
    const [step, setStep] = useState<'welcome' | 'role-select' | 'questionnaire'>('welcome');
    const [userType, setUserType] = useState<'tenant' | 'landlord' | null>(null);
    const router = useRouter();

    const handleRoleSelect = (role: 'tenant' | 'landlord') => {
        setUserType(role);
        setStep('questionnaire');
    };

    const handleComplete = async (responses: Record<string, any>) => {
        try {
            await apiClient.client.post('/onboarding/complete', { responses });
            router.push('/dashboard');
        } catch (error) {
            console.error('Failed to complete onboarding:', error);
        }
    };

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
                    <div className="text-6xl mb-6">🏠</div>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                        Welcome to Roomivo!
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-zinc-400 mb-8">
                        We'll ask you a few quick questions to personalize your experience.
                        <br />
                        <span className="text-sm text-gray-500 dark:text-zinc-500 mt-2 block">This takes about 2 minutes.</span>
                    </p>
                    <button
                        onClick={() => setStep('role-select')}
                        className="w-full sm:w-auto px-12 py-4 bg-teal-600 hover:bg-teal-700 text-white text-lg font-medium rounded-2xl shadow-lg hover:shadow-teal-500/25 transition-all transform hover:-translate-y-0.5"
                    >
                        Let's get started →
                    </button>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="block w-full mt-6 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 text-sm transition-colors"
                    >
                        Skip for now
                    </button>
                </motion.div>
            </div>
        );
    }

    if (step === 'role-select') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-zinc-950">
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white dark:from-teal-900/20 dark:via-zinc-950 dark:to-zinc-950"></div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="z-10 w-full max-w-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 p-10 md:p-12"
                >
                    <div className="text-center mb-10">
                        <div className="text-6xl mb-4">👋</div>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                            What brings you here today?
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={() => handleRoleSelect('landlord')}
                            className="w-full text-left px-8 py-8 bg-zinc-50 hover:bg-teal-50 dark:bg-zinc-800/50 dark:hover:bg-teal-900/20 rounded-2xl border-2 border-transparent hover:border-teal-500 transition-all transform hover:-translate-y-1 hover:shadow-lg group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="text-5xl transform transition-transform group-hover:scale-110">🏠</div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
                                        I want to list my property
                                    </div>
                                    <div className="text-gray-600 dark:text-zinc-400 mt-1">Find reliable tenants quickly</div>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => handleRoleSelect('tenant')}
                            className="w-full text-left px-8 py-8 bg-zinc-50 hover:bg-teal-50 dark:bg-zinc-800/50 dark:hover:bg-teal-900/20 rounded-2xl border-2 border-transparent hover:border-teal-500 transition-all transform hover:-translate-y-1 hover:shadow-lg group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="text-5xl transform transition-transform group-hover:scale-110">🔍</div>
                                <div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
                                        I'm looking for a place to rent
                                    </div>
                                    <div className="text-gray-600 dark:text-zinc-400 mt-1">Find your perfect home</div>
                                </div>
                            </div>
                        </button>
                    </div>

                    <button
                        onClick={() => router.push('/dashboard')}
                        className="block w-full mt-8 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 text-sm text-center transition-colors"
                    >
                        Skip for now
                    </button>
                </motion.div>
            </div>
        );
    }

    if (step === 'questionnaire' && userType) {
        return <OnboardingQuestionnaire userType={userType} onComplete={handleComplete} />;
    }

    return null;
}
