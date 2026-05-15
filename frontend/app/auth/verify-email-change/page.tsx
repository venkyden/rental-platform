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
                className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-sm  dark: text-center border border-gray-100"
            >
                {status === 'loading' && (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-16 h-16 text-zinc-900 animate-spin mb-6" />
                        <h2 className="text-xl font-black tracking-tight text-zinc-900 mb-2 uppercase">Verifying...</h2>
                        <p className="text-zinc-500 font-medium">{message}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                            <CheckCircle2 className="w-16 h-16 text-zinc-900 mb-6" />
                        </motion.div>
                        <h2 className="text-xl font-black tracking-tight text-zinc-900 mb-2 uppercase">Email Updated</h2>
                        <p className="text-zinc-600 mb-6 font-medium">{message}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Redirecting you to your profile...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                            <XCircle className="w-16 h-16 text-zinc-900 mb-6" />
                        </motion.div>
                        <h2 className="text-xl font-black tracking-tight text-zinc-900 mb-2 uppercase">Verification Failed</h2>
                        <p className="text-zinc-600 mb-6 font-medium">{message}</p>
                        <button
                            onClick={() => router.push('/settings/account')}
                            className="px-8 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:shadow-sm transition-all"
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
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
                </div>
            }>
                <VerifyEmailChangeContent />
            </Suspense>
        </PremiumLayout>
    );
}
