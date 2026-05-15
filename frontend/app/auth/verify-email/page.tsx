'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { useLanguage } from '@/lib/LanguageContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

        verifyEmail();
    }, [token]);

    async function verifyEmail() {
        try {
            const response = await axios.get(`${API_URL}/auth/verify-email`, {
                params: { token }
            });

            setStatus('success');
            setMessage(response.data.message || t('auth.verifyEmail.success', undefined, 'Email verified successfully!'));

            // Redirect based on login status after 3 seconds
            setTimeout(() => {
                const accessToken = localStorage.getItem('access_token');
                if (accessToken) {
                    router.push('/dashboard');
                } else {
                    router.push('/auth/login');
                }
            }, 3000);
        } catch (error: any) {
            setStatus('error');
            setMessage(
                error.response?.data?.detail ||
                t('auth.verifyEmail.errors.default', undefined, 'Failed to verify email. The link may have expired.')
            );
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-black tracking-tighter text-zinc-900 uppercase">
                        {t('auth.verifyEmail.title', undefined, 'Email Verification')}
                    </h2>
                </div>

                <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {status === 'verifying' && (
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
                            <p className="mt-4 text-zinc-600 font-medium">{t('auth.verifyEmail.verifying', undefined, 'Verifying your email...')}</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-zinc-900">
                                <svg
                                    className="h-6 w-6 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <h3 className="mt-4 text-lg font-black tracking-tight text-zinc-900 uppercase">
                                {t('auth.verifyEmail.success', undefined, 'Success!')}
                            </h3>
                            <p className="mt-2 text-sm text-zinc-600">{message}</p>
                            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                {t('auth.verifyEmail.redirecting', undefined, 'Redirecting you...')}
                            </p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full border-2 border-zinc-900">
                                <svg
                                    className="h-6 w-6 text-zinc-900"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </div>
                            <h3 className="mt-4 text-lg font-black tracking-tight text-zinc-900 uppercase">
                                {t('auth.verifyEmail.failed', undefined, 'Verification Failed')}
                            </h3>
                            <p className="mt-2 text-sm text-zinc-600">{message}</p>
                            <div className="mt-6 space-y-2">
                                <Link
                                    href="/auth/login"
                                    className="block w-full text-center px-4 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:shadow-sm transition-all"
                                >
                                    {t('auth.verifyEmail.goToLogin', undefined, 'Go to Login')}
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className="block w-full text-center px-4 py-3 border border-zinc-200 text-sm font-bold rounded-xl text-zinc-900 bg-white hover:bg-zinc-50 transition-all"
                                >
                                    {t('auth.verifyEmail.createNewAccount', undefined, 'Create New Account')}
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function LoadingFallback() {
    const { t } = useLanguage();
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
                <p className="mt-4 text-zinc-600 font-medium">{t('common.loading', undefined, 'Loading...')}</p>
            </div>
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
