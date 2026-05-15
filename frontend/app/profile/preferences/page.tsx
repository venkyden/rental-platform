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
            <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
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
            <div className="min-h-screen bg-zinc-50 flex flex-col">
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-xl border-b border-zinc-100 sticky top-0 z-50">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-20">
                            <div className="flex items-center gap-6">
                                <button
                                    onClick={() => router.back()}
                                    className="p-3 -ml-2 text-zinc-400 hover:text-zinc-900 rounded-2xl hover:bg-zinc-100 transition-all active:scale-95"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                </button>
                                <h1 className="text-xl font-black text-zinc-900 uppercase tracking-tighter">Edit Rental Preferences</h1>
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
                    <div className="fixed inset-0 bg-white/50 backdrop-blur-md z-[100] flex flex-col justify-center items-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-zinc-900 mb-6"></div>
                        <p className="text-[10px] font-black text-zinc-900 uppercase tracking-[0.4em] animate-pulse">Synchronizing Preferences...</p>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
