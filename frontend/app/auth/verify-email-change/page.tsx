"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import PremiumLayout from '@/components/PremiumLayout';

function VerifyEmailChangeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your new email address...');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Verification token is missing. Please check your email link.');
            return;
        }

        const verifyEmail = async () => {
            try {
                await apiClient.client.post('/auth/confirm-email-change', { token });
                setStatus('success');
                setMessage('Your email address has been successfully updated!');

                // Redirect to profile after 3 seconds
                setTimeout(() => {
                    router.push('/profile');
                }, 3000);

            } catch (error: any) {
                setStatus('error');
                setMessage(error.response?.data?.detail || 'Failed to verify email change. The link may have expired.');
            }
        };

        verifyEmail();
    }, [token, router]);

    return (
        <div className="max-w-md mx-auto py-20 px-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 text-center border border-gray-100 dark:border-gray-700"
            >
                {status === 'loading' && (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mb-6" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Verifying...</h2>
                        <p className="text-gray-500 dark:text-gray-400">{message}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                            <CheckCircle2 className="w-16 h-16 text-green-500 mb-6" />
                        </motion.div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Email Updated</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
                        <p className="text-sm text-gray-400">Redirecting you to your profile...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                            <XCircle className="w-16 h-16 text-red-500 mb-6" />
                        </motion.div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Verification Failed</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
                        <button
                            onClick={() => router.push('/settings/account')}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium shadow-md shadow-indigo-600/20"
                        >
                            Return to Settings
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

export default function VerifyEmailChangePage() {
    return (
        <PremiumLayout>
            <Suspense fallback={
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
            }>
                <VerifyEmailChangeContent />
            </Suspense>
        </PremiumLayout>
    );
}
