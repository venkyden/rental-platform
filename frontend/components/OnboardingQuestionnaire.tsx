'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

// Question type definition
interface QuestionOption {
    value: string;
    label: string;
    segment?: string;
}

interface Question {
    id: string;
    question: string;
    emoji: string;
    options?: QuestionOption[];
    type?: 'text' | 'range';
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
}

// Question definitions
const QUESTIONS: Record<'tenant' | 'landlord', Question[]> = {
    tenant: [
        {
            id: 'situation',
            question: "What describes your situation best?",
            emoji: "👋",
            options: [
                { value: 'student_budget', label: "I'm a student / Price-sensitive (D1)", segment: 'D1' },
                { value: 'family_stability', label: 'I want long-term stability (Family/Senior) (D2)', segment: 'D2' },
                { value: 'flexibility_relocation', label: "I need flexibility (Remote/Expat) (D3)", segment: 'D3' },
            ],
        },
        {
            id: 'location',
            question: "Where are you looking to rent?",
            emoji: "�",
            type: 'text',
            placeholder: 'e.g., Paris, Lyon, Marseille...',
        },
        {
            id: 'budget',
            question: "What's your monthly budget?",
            emoji: "💰",
            type: 'range',
            min: 300,
            max: 3000,
            step: 50,
        },
        {
            id: 'lease_duration',
            question: "How long do you plan to stay?",
            emoji: "📅",
            options: [
                { value: 'short_term', label: 'Short-term (3-6 months)' },
                { value: 'medium_term', label: 'Medium-term (6-12 months)' },
                { value: 'long_term', label: 'Long-term (1-2 years)' },
                { value: 'very_long_term', label: 'Very long-term (2+ years)' },
            ],
        },
        {
            id: 'move_in_timeline',
            question: "When do you need to move in?",
            emoji: "⏰",
            options: [
                { value: 'asap', label: 'ASAP (within 1 week)' },
                { value: 'soon', label: 'Soon (within 2-4 weeks)' },
                { value: 'flexible', label: 'Flexible (1-3 months)' },
                { value: 'browsing', label: 'Just browsing for now' },
            ],
        },
    ],
    landlord: [
        {
            id: 'property_count',
            question: "How many properties do you own or manage?",
            emoji: "🏠",
            options: [
                { value: '1-4', label: '1-4 properties', segment: 'S1' },
                { value: '5-100', label: '5-100 properties', segment: 'S2' },
                { value: '100+', label: '100+ properties', segment: 'S3' },
            ],
        },
        {
            id: 'challenge',
            question: "What's your biggest challenge right now?",
            emoji: "🎯",
            options: [
                { value: 'finding_tenants', label: 'Finding reliable tenants quickly' },
                { value: 'avoiding_fraud', label: 'Avoiding bad tenants / fraud' },
                { value: 'regulations', label: 'Understanding rental regulations' },
                { value: 'all', label: 'All of the above' },
            ],
        },
        {
            id: 'location',
            question: "Where are your properties located?",
            emoji: "📍",
            type: 'text',
            placeholder: 'e.g., Paris, Lyon, Nationwide...',
        },
        {
            id: 'urgency',
            question: "When do you need to fill your next vacancy?",
            emoji: "⚡",
            options: [
                { value: 'urgent', label: 'Urgently (within 2 weeks)' },
                { value: 'soon', label: 'Soon (within 1 month)' },
                { value: 'planning', label: 'Planning ahead (1-3 months)' },
                { value: 'exploring', label: 'Just exploring for now' },
            ],
        },
    ],
};

interface QuestionnaireProps {
    userType: 'tenant' | 'landlord';
    onComplete: (responses: Record<string, any>) => void;
}

export default function OnboardingQuestionnaire({ userType, onComplete }: QuestionnaireProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);

    const questions = QUESTIONS[userType];
    const currentQuestion = questions[currentStep];
    const progress = ((currentStep + 1) / questions.length) * 100;

    const handleAnswer = (value: any) => {
        const newResponses = { ...responses, [currentQuestion.id]: value };
        setResponses(newResponses);

        // Auto-advance to next question
        setTimeout(() => {
            if (currentStep < questions.length - 1) {
                setCurrentStep(currentStep + 1);
            } else {
                // Last question - complete onboarding
                handleComplete(newResponses);
            }
        }, 300);
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
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                    <p className="mt-4 text-lg text-gray-700">Processing your responses...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="h-2 bg-white rounded-full overflow-hidden shadow-sm">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-sm text-gray-600 mt-2 text-center">
                        Question {currentStep + 1} of {questions.length}
                    </p>
                </div>

                {/* Question Card */}
                <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 transform transition-all duration-300">
                    <div className="text-center mb-8">
                        <div className="text-6xl mb-4 animate-bounce">{currentQuestion.emoji}</div>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                            {currentQuestion.question}
                        </h2>
                    </div>

                    {/* Answer Options */}
                    <div className="space-y-4">
                        {currentQuestion.type === 'text' && (
                            <input
                                type="text"
                                placeholder={currentQuestion.placeholder}
                                className="w-full px-6 py-4 text-lg text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-400"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && e.currentTarget.value) {
                                        handleAnswer(e.currentTarget.value);
                                    }
                                }}
                                onBlur={(e) => {
                                    if (e.currentTarget.value) {
                                        handleAnswer(e.currentTarget.value);
                                    }
                                }}
                            />
                        )}

                        {currentQuestion.type === 'range' && (
                            <div className="py-4">
                                <input
                                    type="range"
                                    min={currentQuestion.min}
                                    max={currentQuestion.max}
                                    step={currentQuestion.step}
                                    defaultValue={responses[currentQuestion.id] || currentQuestion.min}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        setResponses({ ...responses, [currentQuestion.id]: value });
                                    }}
                                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between mt-4">
                                    <span className="text-gray-600">€{currentQuestion.min}</span>
                                    <span className="text-2xl font-bold text-blue-600">
                                        €{responses[currentQuestion.id] || currentQuestion.min}
                                    </span>
                                    <span className="text-gray-600">€{currentQuestion.max}+</span>
                                </div>
                                <button
                                    onClick={() => handleAnswer(responses[currentQuestion.id] || currentQuestion.min)}
                                    className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all"
                                >
                                    Continue →
                                </button>
                            </div>
                        )}

                        {currentQuestion.options?.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleAnswer(option.value)}
                                className="w-full text-left px-6 py-5 bg-gray-50 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-xl border-2 border-gray-200 hover:border-blue-500 transition-all transform hover:scale-102 hover:shadow-md group"
                            >
                                <span className="text-lg font-medium text-gray-800 group-hover:text-blue-600">
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="mt-8 flex justify-between items-center">
                        {currentStep > 0 && (
                            <button
                                onClick={handleBack}
                                className="text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2"
                            >
                                ← Back
                            </button>
                        )}
                        <div className="flex-1" />
                        <button
                            onClick={() => window.location.href = '/dashboard'}
                            className="text-gray-400 hover:text-gray-600 text-sm"
                        >
                            Skip for now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
