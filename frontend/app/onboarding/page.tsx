'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingQuestionnaire from '@/components/OnboardingQuestionnaire';
import { apiClient } from '@/lib/api';

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
            <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full text-center">
                    <div className="bg-white rounded-3xl shadow-2xl p-12">
                        <div className="text-6xl mb-6">🏠</div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                            Welcome to Rental Platform!
                        </h1>
                        <p className="text-xl text-gray-600 mb-8">
                            We'll ask you a few quick questions to personalize your experience.
                            <br />
                            <span className="text-sm text-gray-500">This takes about 2 minutes.</span>
                        </p>
                        <button
                            onClick={() => setStep('role-select')}
                            className="px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:shadow-xl transform hover:scale-105 transition-all"
                        >
                            Let's get started →
                        </button>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="block w-full mt-4 text-gray-500 hover:text-gray-700 text-sm"
                        >
                            Skip for now
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'role-select') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full">
                    <div className="bg-white rounded-3xl shadow-2xl p-12">
                        <div className="text-center mb-8">
                            <div className="text-6xl mb-4">👋</div>
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                                What brings you here today?
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={() => handleRoleSelect('landlord')}
                                className="w-full text-left px-8 py-8 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all transform hover:scale-102 hover:shadow-lg group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="text-5xl">🏠</div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900 group-hover:text-blue-600">
                                            I want to list my property
                                        </div>
                                        <div className="text-gray-600">Find reliable tenants quickly</div>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => handleRoleSelect('tenant')}
                                className="w-full text-left px-8 py-8 bg-gradient-to-r from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 rounded-2xl border-2 border-transparent hover:border-indigo-500 transition-all transform hover:scale-102 hover:shadow-lg group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="text-5xl">🔍</div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900 group-hover:text-indigo-600">
                                            I'm looking for a place to rent
                                        </div>
                                        <div className="text-gray-600">Find your perfect home</div>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => router.push('/dashboard')}
                            className="block w-full mt-6 text-gray-500 hover:text-gray-700"
                        >
                            Skip for now
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'questionnaire' && userType) {
        return <OnboardingQuestionnaire userType={userType} onComplete={handleComplete} />;
    }

    return null;
}
