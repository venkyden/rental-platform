'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';
import { motion } from 'framer-motion';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

function VerifyEmailContent() {
    const { t } = useLanguage();
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage(t('auth.verifyEmail.errors.noToken', undefined, 'No verification token found in URL'));
            return;
        }

        let cancelled = false;

        apiClient.client.get('/auth/verify-email', { params: { token } })
            .then((response) => {
                if (cancelled) return;
                setStatus('success');
                setMessage(response.data.message || t('auth.verifyEmail.success', undefined, 'Email verified successfully!'));

                setTimeout(() => {
                    if (cancelled) return;
                    const accessToken = apiClient.getToken();
                    router.push(accessToken ? '/dashboard' : '/auth/login');
                }, 3000);
            })
            .catch((error) => {
                if (cancelled) return;
                setStatus('error');
                setMessage(
                    error.response?.data?.detail ||
                    t('auth.verifyEmail.errors.default', undefined, 'Failed to verify email. The link may have expired.')
                );
            });

        return () => { cancelled = true; };
    }, [token, router, t]);

    return (
        <div className="w-full text-center space-y-6" role={status === 'error' ? 'alert' : 'status'} aria-live={status === 'error' ? 'assertive' : 'polite'}>
            <div>
                <h2 className="text-2xl font-black tracking-tighter text-zinc-900 uppercase">
                    {t('auth.verifyEmail.title', undefined, 'Email Verification')}
                </h2>
                <p className="mt-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    {status === 'verifying'
                        ? t('auth.verifyEmail.verifyingSub', undefined, 'Authenticating your request')
                        : status === 'success'
                            ? t('auth.verifyEmail.successSub', undefined, 'Account fully activated')
                            : t('auth.verifyEmail.errorSub', undefined, 'Activation failed')}
                </p>
            </div>

            <div className="py-4">
                {status === 'verifying' && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center justify-center space-y-4"
                    >
                        <Loader2 className="animate-spin text-zinc-900 w-12 h-12" strokeWidth={2.5} />
                        <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest animate-pulse">
                            {t('auth.verifyEmail.verifying', undefined, 'Verifying your email...')}
                        </p>
                    </motion.div>
                )}

                {status === 'success' && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center justify-center space-y-4"
                    >
                        <div className="w-16 h-16 rounded-full bg-zinc-950 flex items-center justify-center shadow-xl shadow-zinc-950/10">
                            <Check className="text-white w-8 h-8" strokeWidth={3} />
                        </div>
                        <h3 className="text-lg font-black tracking-tight text-zinc-900 uppercase">
                            {t('auth.verifyEmail.success', undefined, 'Success!')}
                        </h3>
                        <p className="text-xs text-zinc-500 font-medium max-w-sm px-4">{message}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 animate-pulse pt-2">
                            {t('auth.verifyEmail.redirecting', undefined, 'Redirecting you...')}
                        </p>
                    </motion.div>
                )}

                {status === 'error' && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center justify-center space-y-4"
                    >
                        <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center">
                            <AlertCircle className="text-zinc-900 w-8 h-8" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-lg font-black tracking-tight text-zinc-900 uppercase">
                            {t('auth.verifyEmail.failed', undefined, 'Verification Failed')}
                        </h3>
                        <p className="text-xs text-zinc-500 font-medium max-w-sm px-4">{message}</p>

                        <div className="w-full pt-6 space-y-3">
                            <Link
                                href="/auth/login"
                                className="block w-full text-center py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-800 hover:shadow-xl hover:shadow-zinc-900/10 active:scale-[0.98] transition-all"
                            >
                                {t('auth.verifyEmail.goToLogin', undefined, 'Go to Login')}
                            </Link>
                            <Link
                                href="/auth/register"
                                className="block w-full text-center py-4 border-2 border-zinc-100 text-[10px] font-black uppercase tracking-widest rounded-2xl text-zinc-900 bg-white hover:bg-zinc-50 active:scale-[0.98] transition-all"
                            >
                                {t('auth.verifyEmail.createNewAccount', undefined, 'Create New Account')}
                            </Link>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

function LoadingFallback() {
    const { t } = useLanguage();
    return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="animate-spin text-zinc-900 w-12 h-12" strokeWidth={2.5} />
            <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest">{t('common.loading', undefined, 'Loading...')}</p>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <VerifyEmailContent />
        </Suspense>
    );
}
