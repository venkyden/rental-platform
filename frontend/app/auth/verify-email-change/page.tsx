"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';

function VerifyEmailChangeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const { t } = useLanguage();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState(t('auth.verifyEmailChange.verifyingDesc', undefined, 'Verifying your new email address...'));

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage(t('auth.verifyEmailChange.missingToken', undefined, 'Verification token is missing. Please check your email link.'));
            return;
        }

        let cancelled = false;

        apiClient.client.post('/auth/confirm-email-change', { token })
            .then(() => {
                if (cancelled) return;
                setStatus('success');
                setMessage(t('auth.verifyEmailChange.successDesc', undefined, 'Your email address has been successfully updated!'));
                setTimeout(() => {
                    if (!cancelled) router.push('/profile');
                }, 3000);
            })
            .catch((error: any) => {
                if (cancelled) return;
                setStatus('error');
                setMessage(error.response?.data?.detail || t('auth.verifyEmailChange.failedDesc', undefined, 'Failed to verify email change. The link may have expired.'));
            });

        return () => { cancelled = true; };
    }, [token, router, t]);

    return (
        <div
            className="w-full text-center space-y-6"
            role={status === 'error' ? 'alert' : 'status'}
            aria-live={status === 'error' ? 'assertive' : 'polite'}
        >
            <div>
                <h2 className="text-2xl font-black tracking-tighter text-zinc-900 uppercase">
                    {status === 'loading'
                        ? t('auth.verifyEmailChange.verifying', undefined, 'Verifying...')
                        : status === 'success'
                            ? t('auth.verifyEmailChange.successTitle', undefined, 'Email Updated')
                            : t('auth.verifyEmailChange.failedTitle', undefined, 'Verification Failed')}
                </h2>
                <p className="mt-2 text-xs font-bold text-zinc-400 uppercase tracking-widest max-w-sm mx-auto">
                    {message}
                </p>
            </div>

            <div className="py-4 flex flex-col items-center space-y-4">
                {status === 'loading' && (
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                        <Loader2 className="w-12 h-12 text-zinc-900 animate-spin" strokeWidth={2.5} />
                    </motion.div>
                )}

                {status === 'success' && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                    >
                        <div className="w-16 h-16 rounded-full bg-zinc-950 flex items-center justify-center shadow-xl shadow-zinc-950/10">
                            <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2} />
                        </div>
                    </motion.div>
                )}

                {status === 'error' && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                    >
                        <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
                            <XCircle className="w-8 h-8 text-zinc-900" strokeWidth={2} />
                        </div>
                    </motion.div>
                )}

                {status === 'success' && (
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 animate-pulse pt-2">
                        {t('auth.verifyEmailChange.redirecting', undefined, 'Redirecting you to your profile...')}
                    </p>
                )}

                {status === 'error' && (
                    <button
                        onClick={() => router.push('/settings/account')}
                        className="w-full py-5 bg-zinc-900 text-white font-black uppercase text-xs tracking-widest rounded-2xl hover:bg-zinc-800 hover:shadow-xl hover:shadow-zinc-900/10 active:scale-[0.98] transition-all mt-4"
                    >
                        {t('auth.verifyEmailChange.returnToSettings', undefined, 'Return to Settings')}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailChangePage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-12 space-y-4" role="status" aria-live="polite">
                <Loader2 className="w-12 h-12 animate-spin text-zinc-900" strokeWidth={2.5} />
            </div>
        }>
            <VerifyEmailChangeContent />
        </Suspense>
    );
}
