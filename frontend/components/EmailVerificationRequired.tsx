'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';

interface EmailVerificationRequiredProps {
    children: React.ReactNode;
}

/**
 * Wrapper component that ensures user has verified their email.
 * Shows verification prompt if not verified, blocks access to protected content.
 * Should be used inside ProtectedRoute, before OnboardingRequired.
 */
export default function EmailVerificationRequired({ children }: EmailVerificationRequiredProps) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [resending, setResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    const handleResendVerification = async () => {
        try {
            setResending(true);
            await apiClient.client.post('/auth/resend-verification');
            setResendSuccess(true);
            setTimeout(() => setResendSuccess(false), 5000);
        } catch (error) {
            console.error('Failed to resend verification:', error);
        } finally {
            setResending(false);
        }
    };

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

    // If user hasn't verified their email, show verification prompt
    if (user && !user.email_verified) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
                <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md mx-4">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center">
                        <span className="text-4xl">📧</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
                    <p className="text-gray-600 mb-6">
                        We've sent a verification link to <span className="font-semibold text-gray-800">{user.email}</span>.
                        Please check your inbox and click the link to continue.
                    </p>

                    <div className="space-y-3">
                        {resendSuccess ? (
                            <div className="py-3 px-4 bg-green-50 text-green-700 rounded-xl font-medium flex items-center justify-center gap-2">
                                <span>✓</span> Verification email sent!
                            </div>
                        ) : (
                            <button
                                onClick={handleResendVerification}
                                disabled={resending}
                                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {resending ? 'Sending...' : 'Resend Verification Email'}
                            </button>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all"
                        >
                            I've verified my email →
                        </button>

                        <button
                            onClick={() => router.push('/auth/login')}
                            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                            Sign in with a different account
                        </button>
                    </div>

                    <p className="mt-6 text-xs text-gray-400">
                        Can't find the email? Check your spam folder or request a new one.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
