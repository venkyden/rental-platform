'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

interface OnboardingRequiredProps {
    children: React.ReactNode;
}

/**
 * Wrapper component that ensures user has completed onboarding.
 * Temporarily disabled to allow ID verification testing.
 */
export default function OnboardingRequired({ children }: OnboardingRequiredProps) {
    // TEMPORARY: Bypass onboarding requirement
    return <>{children}</>;
}
