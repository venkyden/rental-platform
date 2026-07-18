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
        // Bypass onboarding temporarily as requested by user
        // if (!loading && user && !user.onboarding_completed) {
        //     router.push('/onboarding');
        // }
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

    // Bypassed: always render children
    // if (user && !user.onboarding_completed) {
    //     return ( ... )
    // }

    return <>{children}</>;
}
