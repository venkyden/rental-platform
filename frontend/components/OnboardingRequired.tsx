'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

interface OnboardingRequiredProps {
    children: React.ReactNode;
}

/**
 * Wrapper component that ensures user has completed onboarding.
 * Redirects to /onboarding if not completed.
 * Should be used inside ProtectedRoute.
 */
export default function OnboardingRequired({ children }: OnboardingRequiredProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user && !user.onboarding_completed) {
            router.push('/onboarding');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 mx-auto"></div>
                    <p className="mt-4 text-xs font-black uppercase tracking-widest text-zinc-400">Loading...</p>
                </div>
            </div>
        );
    }

    // If user hasn't completed onboarding, show a brief message while redirecting
    if (user && !user.onboarding_completed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <div className="text-center bg-white p-8 rounded-2xl shadow-sm max-w-md">
                    <div className="text-5xl mb-4"></div>
                    <h2 className="text-2xl font-black uppercase tracking-widest text-zinc-900 mb-2">Complete Your Profile</h2>
                    <p className="text-xs font-bold text-zinc-500 mb-8 leading-relaxed">
                        Please complete your onboarding to access the marketplace and get matched with the best properties.
                    </p>
                    <button
                        onClick={() => router.push('/onboarding')}
                        className="w-full py-4 bg-zinc-900 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-zinc-800 transition-all active:scale-95 shadow-lg"
                    >
                        Complete Onboarding →
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
