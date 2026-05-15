'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';

function ResetPasswordContent() {
    const { t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const toast = useToast();
    const [token, setToken] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setError(t('auth.resetPassword.errors.invalidLink', undefined, 'Invalid reset link. Please request a new password reset.'));
        }
    }, [searchParams]);

    const validatePassword = (password: string): string | null => {
        if (password.length < 8) {
            return t('auth.resetPassword.errors.length', undefined, 'Password must be at least 8 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            return t('auth.resetPassword.errors.uppercase', undefined, 'Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            return t('auth.resetPassword.errors.lowercase', undefined, 'Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            return t('auth.resetPassword.errors.number', undefined, 'Password must contain at least one number');
        }
        return null;
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        // Validate password
        const passwordError = validatePassword(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        if (password !== confirmPassword) {
            setError(t('auth.resetPassword.errors.match', undefined, 'Passwords do not match'));
            return;
        }

        setLoading(true);

        try {
            await apiClient.resetPassword(token, password);
            setSuccess(true);
            toast.success(t('auth.resetPassword.successTitle', undefined, 'Password reset successful!'));

            // Redirect to login after 3 seconds
            setTimeout(() => {
                router.push('/auth/login');
            }, 3000);
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || t('auth.resetPassword.errors.default', undefined, 'Failed to reset password. The link may be expired.');
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full">
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <div className="w-16 h-16 bg-zinc-100 text-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight mb-2">
                            {t('auth.resetPassword.successTitle', undefined, 'Password Reset Successful!')}
                        </h2>
                        <p className="text-gray-600 mb-6">
                            {t('auth.resetPassword.successDesc', undefined, "Your password has been reset successfully. You'll be redirected to the login page shortly.")}
                        </p>
                        <Link
                            href="/auth/login"
                            className="inline-block px-8 py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/10"
                        >
                            {t('auth.resetPassword.signInNow', undefined, 'Sign in now')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-sm p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-zinc-100 text-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">
                            {t('auth.resetPassword.title', undefined, 'Set new password')}
                        </h2>
                        <p className="mt-2 text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                            {t('auth.resetPassword.subtitle', undefined, 'Enter your new password below')}
                        </p>
                    </div>

                    {!token ? (
                        <div className="bg-zinc-900 rounded-2xl p-6 text-center shadow-xl shadow-zinc-900/20">
                            <p className="text-sm font-bold text-white mb-4">{error}</p>
                            <Link
                                href="/auth/forgot-password"
                                className="inline-block text-xs font-black uppercase tracking-widest text-zinc-300 hover:text-white transition-colors underline underline-offset-4"
                            >
                                {t('auth.resetPassword.requestNew', undefined, 'Request new reset link')}
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-zinc-900 rounded-xl p-4 shadow-xl shadow-zinc-900/10">
                                    <p className="text-sm font-bold text-white">{error}</p>
                                </div>
                            )}

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('auth.resetPassword.newPasswordLabel', undefined, 'New Password')}
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="block w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all font-bold"
                                    placeholder={t('common.placeholders.newPassword')}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    {t('auth.resetPassword.requirements', undefined, 'Must be 8+ characters with uppercase, lowercase, and number')}
                                </p>
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('auth.resetPassword.confirmPasswordLabel', undefined, 'Confirm Password')}
                                </label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    className="block w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all font-bold"
                                    placeholder={t('common.placeholders.confirmPassword')}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 px-4 bg-zinc-900 text-white font-black uppercase tracking-widest rounded-xl hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-zinc-900/10 active:scale-[0.98]"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        {t('auth.resetPassword.resetting', undefined, 'Resetting...')}
                                    </span>
                                ) : (
                                    t('auth.resetPassword.submit', undefined, 'Reset Password')
                                )}
                            </button>

                            <div className="text-center">
                                <Link
                                    href="/auth/login"
                                    className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors underline underline-offset-4"
                                >
                                    {t('auth.forgotPassword.backToSignIn', undefined, 'Back to sign in')}
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

function LoadingFallback() {
    const { t } = useLanguage();
    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
                <p className="mt-4 text-gray-600">{t('common.loading', undefined, 'Loading...')}</p>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <ResetPasswordContent />
        </Suspense>
    );
}
