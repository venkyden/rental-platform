'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import OnboardingQuestionnaire from '@/components/OnboardingQuestionnaire';

export default function EditPreferencesPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isSaving, setIsSaving] = useState(false);

    // Provide a simple loading state while waiting for auth
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-zinc-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    if (!user) {
        return null; // Protected route handles redirect
    }

    const handleComplete = async (responses: Record<string, any>) => {
        setIsSaving(true);
        try {
            await apiClient.updateOnboardingPreferences(responses);
            router.push('/profile');
            router.refresh(); // Refresh to get the latest user data
        } catch (error) {
            console.error('Failed to update preferences:', error);
            alert('Failed to update preferences. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col">
                {/* Header */}
                <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => router.back()}
                                    className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                </button>
                                <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Edit Rental Preferences</h1>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-grow">
                    {/* The Questionnaire takes the full remaining height via its own min-h-screen, 
                        so we can just mount it here. We add a slight margin negative to pull it up if needed. */}
                    <div className="-mt-16 pt-16 h-full">
                        <OnboardingQuestionnaire
                            userType={user.role === 'tenant' ? 'tenant' : 'landlord'}
                            initialResponses={user.preferences || {}}
                            onComplete={handleComplete}
                        />
                    </div>
                </main>

                {/* Saving Overlay */}
                {isSaving && (
                    <div className="fixed inset-0 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm z-50 flex flex-col justify-center items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
                        <p className="text-zinc-900 dark:text-white font-medium">Saving preferences...</p>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
