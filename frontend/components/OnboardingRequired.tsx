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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // If user hasn't completed onboarding, show a brief message while redirecting
    if (user && !user.onboarding_completed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md">
                    <div className="text-5xl mb-4">👋</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Profile</h2>
                    <p className="text-gray-600 mb-6">
                        Please complete your onboarding to access the marketplace and get matched with the best properties.
                    </p>
                    <button
                        onClick={() => router.push('/onboarding')}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                    >
                        Complete Onboarding →
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
