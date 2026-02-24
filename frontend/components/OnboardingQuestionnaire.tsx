'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getTenantQuestions, getLandlordQuestions } from './onboarding/onboardingQuestions';
import QuestionRenderer from './onboarding/QuestionRenderer';

interface QuestionnaireProps {
    userType: 'tenant' | 'landlord';
    onComplete: (responses: Record<string, any>) => void;
}

export default function OnboardingQuestionnaire({ userType, onComplete }: QuestionnaireProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [multiSelectValues, setMultiSelectValues] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Get the base set of questions
    const allQuestions = useMemo(() => {
        return userType === 'tenant' ? getTenantQuestions() : getLandlordQuestions();
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
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600"></div>
                    <p className="mt-4 text-lg text-zinc-700 dark:text-zinc-300">Processing your responses...</p>
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
            </div>

            <div className="z-10 max-w-2xl w-full relative">
                {/* Progress Bar */}
                <div className="mb-8 px-2">
                    <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                        <div
                            className="h-full bg-teal-500 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 text-center font-medium">
                        Question {currentVisibleStepCount} of {totalVisibleQuestions}
                    </p>
                </div>

                {/* Question Card */}
                <div className="relative">
                    <AnimatePresence>
                        {allQuestions.map((q, index) => {
                            if (index !== currentStepIndex) return null;
                            return (
                                <motion.div
                                    key={q.id}
                                    initial={{ opacity: 0, x: 20, position: 'relative' }}
                                    animate={{ opacity: 1, x: 0, position: 'relative' }}
                                    exit={{ opacity: 0, x: -20, position: 'absolute', top: 0, left: 0, width: '100%' }}
                                    transition={{ duration: 0.3 }}
                                    className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 p-8 md:p-12"
                                >
                                    <div className="text-center mb-8">
                                        <div className="text-6xl mb-4 animate-bounce">{q.emoji}</div>
                                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                                            {q.question}
                                        </h2>
                                    </div>

                                    {/* Rendering the Question */}
                                    <QuestionRenderer
                                        question={q}
                                        responses={responses}
                                        onAnswer={handleAnswer}
                                        onRangeUpdate={handleRangeUpdate}
                                        multiSelectValues={multiSelectValues}
                                        onMultiSelectToggle={handleMultiSelectToggle}
                                        sanitizeInput={sanitizeInput}
                                    />

                                    {/* Navigation */}
                                    <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center">
                                        {currentStepIndex > 0 ? (
                                            <button
                                                onClick={handleBack}
                                                className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium flex items-center gap-2 transition-colors"
                                            >
                                                ← Back
                                            </button>
                                        ) : (
                                            <div />
                                        )}
                                        <button
                                            onClick={handleSkip}
                                            className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-400 text-sm transition-colors"
                                        >
                                            Skip Question
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
