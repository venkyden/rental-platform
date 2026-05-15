'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { getTenantQuestions, getLandlordQuestions, getAgencyQuestions } from './onboarding/onboardingQuestions';
import QuestionRenderer from './onboarding/QuestionRenderer';
import { useLanguage } from '@/lib/LanguageContext';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface QuestionnaireProps {
    userType: 'tenant' | 'landlord' | 'agency';
    initialResponses?: Record<string, any>;
    onComplete: (responses: Record<string, any>) => void;
}

/* ----------------------------------------------------------------
   Framer-motion variants
   ---------------------------------------------------------------- */
const cardVariants: Variants = {
    initial: (direction: number) => ({
        opacity: 0,
        x: direction > 0 ? 100 : -100,
        rotateY: direction > 0 ? 15 : -15,
        scale: 0.9,
    }),
    animate: {
        opacity: 1,
        x: 0,
        rotateY: 0,
        scale: 1,
        transition: {
            type: 'spring',
            stiffness: 260,
            damping: 25,
            mass: 0.8
        }
    },
    exit: (direction: number) => ({
        opacity: 0,
        x: direction > 0 ? -100 : 100,
        rotateY: direction > 0 ? -15 : 15,
        scale: 0.9,
        transition: { duration: 0.3 }
    })
};

export default function OnboardingQuestionnaire({ userType, initialResponses, onComplete }: QuestionnaireProps) {
    const { t } = useLanguage();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [direction, setDirection] = useState(1);
    const [responses, setResponses] = useState<Record<string, any>>(initialResponses || {});
    const [multiSelectValues, setMultiSelectValues] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const allQuestions = useMemo(() => {
        if (userType === 'tenant') return getTenantQuestions();
        if (userType === 'agency') return getAgencyQuestions();
        return getLandlordQuestions();
    }, [userType]);

    const getNextQuestionIndex = (startIndex: number, currentResponses: Record<string, any>) => {
        for (let i = startIndex; i < allQuestions.length; i++) {
            const q = allQuestions[i];
            if (!q.showIf || q.showIf(currentResponses)) return i;
        }
        return -1;
    };

    const getPreviousQuestionIndex = (startIndex: number, currentResponses: Record<string, any>) => {
        for (let i = startIndex; i >= 0; i--) {
            const q = allQuestions[i];
            if (!q.showIf || q.showIf(currentResponses)) return i;
        }
        return 0;
    };

    const totalVisibleQuestions = useMemo(() => {
        return allQuestions.filter(q => !q.showIf || q.showIf(responses)).length;
    }, [allQuestions, responses]);

    const currentVisibleIndex = useMemo(() => {
        return allQuestions.slice(0, currentStepIndex).filter(q => !q.showIf || q.showIf(responses)).length + 1;
    }, [allQuestions, responses, currentStepIndex]);

    const progress = (currentVisibleIndex / totalVisibleQuestions) * 100;
    const currentQuestion = allQuestions[currentStepIndex];

    const handleAnswer = (value: any) => {
        const newResponses = { ...responses, [currentQuestion.id]: value };
        setResponses(newResponses);
        setDirection(1);

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
        }, 200);
    };

    const handleRangeUpdate = (id: string, value: number) => {
        setResponses(prev => ({ ...prev, [id]: value }));
    };

    const handleMultiSelectToggle = (value: string, max: number) => {
        setMultiSelectValues(prev => {
            if (prev.includes(value)) return prev.filter(v => v !== value);
            if (prev.length < max) return [...prev, value];
            return prev;
        });
    };

    const handleComplete = async (finalResponses: Record<string, any>) => {
        setLoading(true);
        try {
            await onComplete({ ...finalResponses, user_type: userType });
        } catch (error) {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setDirection(-1);
        const prevIndex = getPreviousQuestionIndex(currentStepIndex - 1, responses);
        setCurrentStepIndex(prevIndex);
        if (allQuestions[prevIndex].type === 'multiselect') {
            setMultiSelectValues(responses[allQuestions[prevIndex].id] || []);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="relative w-24 h-24 mb-12 mx-auto">
                        <div className="absolute inset-0 border-4 border-zinc-100 rounded-full" />
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 border-4 border-zinc-900 border-t-transparent rounded-full"
                        />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-900 animate-pulse">
                        {t('onboarding.processing', undefined, 'Crafting your profile')}
                    </p>
                </motion.div>
            </div>
        );
    }

    if (!currentQuestion) return null;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-50 via-white to-white opacity-50" />
            </div>

            <div className="z-10 max-w-2xl w-full relative">
                {/* Header & Progress */}
                <div className="mb-16">
                    <div className="flex justify-between items-end mb-6 px-4">
                        <div className="flex items-center gap-3">
                            <Sparkles className="w-4 h-4 text-zinc-400" />
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">
                                {t('onboarding.stepLabel', undefined, 'Personalization')}
                            </span>
                        </div>
                        <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">
                            {currentVisibleIndex} / {totalVisibleQuestions}
                        </span>
                    </div>
                    
                    {/* Liquid Progress Bar */}
                    <div className="h-2 bg-zinc-50 rounded-full overflow-hidden relative">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full bg-zinc-900 relative"
                        >
                            <motion.div 
                                animate={{ x: ['-100%', '100%'] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full"
                            />
                        </motion.div>
                    </div>
                </div>

                {/* Question Area */}
                <div className="perspective-1000">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentQuestion.id}
                            custom={direction}
                            variants={cardVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="bg-white rounded-[3.5rem] border border-zinc-100 shadow-[0_80px_160px_-40px_rgba(0,0,0,0.08)] p-12 md:p-16 relative overflow-hidden"
                        >
                            {/* Decorative Blur */}
                            <div className="absolute -top-24 -right-24 w-64 h-64 bg-zinc-50 rounded-full blur-[80px] pointer-events-none" />

                            <div className="text-center mb-12">
                                <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', delay: 0.2 }}
                                    className="text-7xl mb-8 select-none"
                                >
                                    {currentQuestion.emoji}
                                </motion.div>
                                <h2 className="text-4xl md:text-5xl font-black text-zinc-900 mb-6 tracking-tighter leading-tight uppercase">
                                    {t(`onboarding.questions.${userType}.${currentQuestion.id}.question`, undefined, currentQuestion.question)}
                                </h2>
                                {currentQuestion.description && (
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
                                        {t(currentQuestion.description, undefined, currentQuestion.description)}
                                    </p>
                                )}
                            </div>

                            <div className="relative z-10 mb-12">
                                <QuestionRenderer
                                    question={currentQuestion}
                                    responses={responses}
                                    onAnswer={handleAnswer}
                                    onRangeUpdate={handleRangeUpdate}
                                    multiSelectValues={multiSelectValues}
                                    onMultiSelectToggle={handleMultiSelectToggle}
                                    sanitizeInput={(i) => i.replace(/<[^>]*>?/gm, '')}
                                    userType={userType}
                                />
                            </div>

                            {/* Navigation Controls */}
                            <div className="flex items-center justify-between border-t border-zinc-50 pt-10 mt-10">
                                {currentStepIndex > 0 ? (
                                    <button
                                        onClick={handleBack}
                                        className="flex items-center gap-3 text-[10px] font-black text-zinc-400 hover:text-zinc-900 uppercase tracking-widest transition-colors group"
                                    >
                                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                        {t('common.back', undefined, 'Previous')}
                                    </button>
                                ) : <div />}

                                <button
                                    onClick={() => handleAnswer(responses[currentQuestion.id] || null)}
                                    className="flex items-center gap-3 text-[10px] font-black text-zinc-300 hover:text-zinc-500 uppercase tracking-widest transition-colors group"
                                >
                                    {t('onboarding.skip', undefined, 'Skip')}
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
            
            <style jsx global>{`
                .perspective-1000 {
                    perspective: 1000px;
                }
            `}</style>
        </div>
    );
}
