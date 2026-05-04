'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getTenantQuestions, getLandlordQuestions, getAgencyQuestions } from './onboarding/onboardingQuestions';
import QuestionRenderer from './onboarding/QuestionRenderer';
import { useLanguage } from '@/lib/LanguageContext';

interface QuestionnaireProps {
    userType: 'tenant' | 'landlord' | 'agency';
    initialResponses?: Record<string, any>;
    onComplete: (responses: Record<string, any>) => void;
}

export default function OnboardingQuestionnaire({ userType, initialResponses, onComplete }: QuestionnaireProps) {
    const { t } = useLanguage();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [responses, setResponses] = useState<Record<string, any>>(initialResponses || {});
    const [multiSelectValues, setMultiSelectValues] = useState<string[]>(() => {
        const initialQuestions = userType === 'tenant' ? getTenantQuestions() : (userType === 'agency' ? getAgencyQuestions() : getLandlordQuestions());
        if (initialQuestions[0]?.type === 'multiselect') {
            return (initialResponses || {})[initialQuestions[0].id] || [];
        }
        return [];
    });
    const [loading, setLoading] = useState(false);

    // Get the base set of questions
    const allQuestions = useMemo(() => {
        if (userType === 'tenant') return getTenantQuestions();
        if (userType === 'agency') return getAgencyQuestions();
        return getLandlordQuestions();
    }, [userType]);

    const getNextQuestionIndex = (startIndex: number, currentResponses: Record<string, any>) => {
        for (let i = startIndex; i < allQuestions.length; i++) {
            const q = allQuestions[i];
            if (!q.showIf || q.showIf(currentResponses)) {
                return i;
            }
        }
        return -1; // No more questions
    };

    const getPreviousQuestionIndex = (startIndex: number, currentResponses: Record<string, any>) => {
        for (let i = startIndex; i >= 0; i--) {
            const q = allQuestions[i];
            if (!q.showIf || q.showIf(currentResponses)) {
                return i;
            }
        }
        return 0; // Fallback to first question
    };

    // Calculate actual active steps to show progress accurately
    const totalVisibleQuestions = useMemo(() => {
        let count = 0;
        for (const q of allQuestions) {
            if (!q.showIf || q.showIf(responses)) {
                count++;
            }
        }
        return count;
    }, [allQuestions, responses]);

    const currentVisibleStepCount = useMemo(() => {
        let count = 0;
        for (let i = 0; i <= currentStepIndex; i++) {
            const q = allQuestions[i];
            if (!q.showIf || q.showIf(responses)) {
                count++;
            }
        }
        return count;
    }, [allQuestions, responses, currentStepIndex]);

    const progress = (currentVisibleStepCount / totalVisibleQuestions) * 100;
    const currentQuestion = allQuestions[currentStepIndex];

    const handleAnswer = (value: any) => {
        const newResponses = { ...responses, [currentQuestion.id]: value };
        setResponses(newResponses);

        // Calculate next index
        const nextIndex = getNextQuestionIndex(currentStepIndex + 1, newResponses);

        setTimeout(() => {
            if (nextIndex !== -1) {
                setCurrentStepIndex(nextIndex);
                if (allQuestions[nextIndex].type === 'multiselect') {
                    setMultiSelectValues(newResponses[allQuestions[nextIndex].id] || []);
                }
            } else {
                handleComplete(newResponses);
            }
        }, 150); // Shorter delay for snappier feel
    };

    const handleRangeUpdate = (id: string, value: number) => {
        setResponses(prev => ({ ...prev, [id]: value }));
    };

    const handleMultiSelectToggle = (value: string, max: number) => {
        setMultiSelectValues(prev => {
            if (prev.includes(value)) {
                return prev.filter(v => v !== value);
            } else if (prev.length < max) {
                return [...prev, value];
            }
            return prev;
        });
    };

    const sanitizeInput = (input: string) => {
        return input.replace(/<[^>]*>?/gm, ''); // Basic XSS protection
    };

    const handleComplete = async (finalResponses: Record<string, any>) => {
        setLoading(true);
        try {
            await onComplete({ ...finalResponses, user_type: userType });
        } catch (error) {
            console.error('Failed to complete onboarding:', error);
            setLoading(false);
        }
    };

    const handleBack = () => {
        const prevIndex = getPreviousQuestionIndex(currentStepIndex - 1, responses);
        setCurrentStepIndex(prevIndex);
        if (allQuestions[prevIndex].type === 'multiselect') {
            setMultiSelectValues(responses[allQuestions[prevIndex].id] || []);
        }
    };

    const handleSkip = () => {
        const nextIndex = getNextQuestionIndex(currentStepIndex + 1, responses);
        if (nextIndex !== -1) {
            setCurrentStepIndex(nextIndex);
            if (allQuestions[nextIndex].type === 'multiselect') {
                setMultiSelectValues(responses[allQuestions[nextIndex].id] || []);
            }
        } else {
            handleComplete(responses);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-zinc-950">
                <div className="text-center z-10">
                    <div className="inline-block animate-spin rounded-full h-24 w-24 border-b-4 border-zinc-900 dark:border-white"></div>
                    <p className="mt-8 text-lg font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white">{t('onboarding.processing', undefined, 'Optimizing your profile...')}</p>
                </div>
            </div>
        );
    }

    if (!currentQuestion) return null;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-zinc-950">
            {/* Background Effects matching AuthLayout */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white dark:from-teal-900/20 dark:via-zinc-950 dark:to-zinc-950"></div>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10"></div>
            </div>

            <div className="z-10 max-w-2xl w-full relative">
                {/* Progress Bar - Premium Style */}
                <div className="mb-12 px-4">
                    <div className="h-3 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden shadow-inner border border-white/40 dark:border-zinc-800/50">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-teal-400 to-teal-500 shadow-[0_0_15px_rgba(45,212,191,0.5)]"
                        />
                    </div>
                    <div className="flex justify-between items-center mt-4">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">
                            {t('onboarding.stepLabel', undefined, 'Progress')}
                        </p>
                        <p className="text-[10px] font-black text-teal-500 uppercase tracking-[0.3em]">
                            {Math.round(progress)}%
                        </p>
                    </div>
                </div>

                {/* Question Card - High Fidelity */}
                <div className="relative">
                    <AnimatePresence mode="wait">
                        {allQuestions.map((q, index) => {
                            if (index !== currentStepIndex) return null;
                            return (
                                <motion.div
                                    key={q.id}
                                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -40, scale: 0.95 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-3xl rounded-[3rem] shadow-2xl border border-white/40 dark:border-zinc-800/50 p-10 md:p-16 relative overflow-hidden"
                                >
                                    {/* Subheader */}
                                    <div className="flex justify-center mb-8">
                                        <div className="px-6 py-2 rounded-full bg-zinc-900/5 dark:bg-white/5 text-zinc-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] border border-zinc-100 dark:border-zinc-800">
                                            {t('onboarding.step', { current: currentVisibleStepCount, total: totalVisibleQuestions }, `Question ${currentVisibleStepCount} / ${totalVisibleQuestions}`)}
                                        </div>
                                    </div>

                                    <div className="text-center mb-12">
                                        <div className="text-7xl mb-8 transform hover:scale-110 transition-transform duration-500">{q.emoji}</div>
                                        <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white mb-4 tracking-tighter leading-tight uppercase">
                                            {t(q.question, undefined, q.question)}
                                        </h2>
                                        {q.description && (
                                            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-lg leading-relaxed max-w-md mx-auto">
                                                {t(q.description, undefined, q.description)}
                                            </p>
                                        )}
                                    </div>

                                    {/* Rendering the Question */}
                                    <div className="relative z-10">
                                        <QuestionRenderer
                                            question={q}
                                            responses={responses}
                                            onAnswer={handleAnswer}
                                            onRangeUpdate={handleRangeUpdate}
                                            multiSelectValues={multiSelectValues}
                                            onMultiSelectToggle={handleMultiSelectToggle}
                                            sanitizeInput={sanitizeInput}
                                        />
                                    </div>

                                    {/* Navigation */}
                                    <div className="mt-12 pt-10 border-t border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center">
                                        {currentStepIndex > 0 ? (
                                            <button
                                                onClick={handleBack}
                                                className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:scale-110 active:scale-95 transition-all group"
                                            >
                                                <span className="text-xl group-hover:translate-x-[-2px] transition-transform">←</span>
                                            </button>
                                        ) : (
                                            <div />
                                        )}
                                        <button
                                            onClick={handleSkip}
                                            className="text-[10px] font-black text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 uppercase tracking-[0.3em] transition-all"
                                        >
                                            {t('onboarding.skip')}
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
