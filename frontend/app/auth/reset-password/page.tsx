'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';
import { motion } from 'framer-motion';
import { Key, Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-react';

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
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setError(t('auth.resetPassword.errors.invalidLink', undefined, 'Invalid reset link. Please request a new password reset.'));
        }
    }, [searchParams, t]);

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
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return t('auth.resetPassword.errors.special', undefined, 'Password must contain at least one special character');
        }
        return null;
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

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
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full text-center space-y-6"
            >
                <div className="w-16 h-16 bg-zinc-950 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-zinc-950/10">
                    <Check className="w-8 h-8" strokeWidth={3} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">
                        {t('auth.resetPassword.successTitle', undefined, 'Password Reset Successful!')}
                    </h2>
                    <p className="mt-2 text-xs text-zinc-500 font-medium max-w-sm mx-auto">
                        {t('auth.resetPassword.successDesc', undefined, "Your password has been reset successfully. You'll be redirected to the login page shortly.")}
                    </p>
                </div>
                <div className="pt-4">
                    <Link
                        href="/auth/login"
                        className="block w-full py-4 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-zinc-800 hover:shadow-xl hover:shadow-zinc-900/10 active:scale-[0.98] transition-all"
                    >
                        {t('auth.resetPassword.signInNow', undefined, 'Sign in now')}
                    </Link>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="w-full space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 bg-zinc-50 text-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-100">
                    <Key className="w-6 h-6" strokeWidth={2} />
                </div>
                <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">
                    {t('auth.resetPassword.title', undefined, 'Set new password')}
                </h2>
                <p className="mt-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    {t('auth.resetPassword.subtitle', undefined, 'Enter your new password below')}
                </p>
            </div>

            {!token ? (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-950 rounded-[2rem] p-8 text-center shadow-2xl shadow-zinc-950/20 space-y-4"
                >
                    <p className="text-xs font-bold text-white leading-relaxed">{error}</p>
                    <div className="pt-2">
                        <Link
                            href="/auth/forgot-password"
                            className="inline-block text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-white transition-colors underline underline-offset-4"
                        >
                            {t('auth.resetPassword.requestNew', undefined, 'Request new reset link')}
                        </Link>
                    </div>
                </motion.div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            role="alert"
                            aria-live="assertive"
                            className="bg-zinc-950 rounded-2xl p-4 shadow-xl shadow-zinc-950/10 flex items-start gap-3"
                        >
                            <AlertCircle className="text-white w-5 h-5 shrink-0 mt-0.5" strokeWidth={2} />
                            <p className="text-xs font-bold text-white">{error}</p>
                        </motion.div>
                    )}

                    <div className="space-y-1">
                        <label htmlFor="password" className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1 block">
                            {t('auth.resetPassword.newPasswordLabel', undefined, 'New Password')}
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                autoComplete="new-password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                className="w-full px-6 py-5 pr-14 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900 placeholder-zinc-300"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? t('auth.common.hidePassword', undefined, 'Hide password') : t('auth.common.showPassword', undefined, 'Show password')}
                                aria-pressed={showPassword}
                                className="absolute right-5 inset-y-0 text-zinc-300 hover:text-zinc-900 transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight leading-relaxed ml-1 pt-1 opacity-70">
                            {t('auth.resetPassword.requirements', undefined, 'Must be 8+ characters with uppercase, lowercase, and number')}
                        </p>
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="confirmPassword" className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1 block">
                            {t('auth.resetPassword.confirmPasswordLabel', undefined, 'Confirm Password')}
                        </label>
                        <div className="relative">
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                autoComplete="new-password"
                                type={showConfirmPassword ? 'text' : 'password'}
                                required
                                className="w-full px-6 py-5 pr-14 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900 placeholder-zinc-300"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? t('auth.common.hidePassword', undefined, 'Hide password') : t('auth.common.showPassword', undefined, 'Show password')}
                                aria-pressed={showConfirmPassword}
                                className="absolute right-5 inset-y-0 text-zinc-300 hover:text-zinc-900 transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-zinc-900/10 active:scale-[0.98] mt-2"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="animate-spin h-4 w-4" />
                                {t('auth.resetPassword.resetting', undefined, 'Resetting...')}
                            </span>
                        ) : (
                            t('auth.resetPassword.submit', undefined, 'Reset Password')
                        )}
                    </button>

                    <div className="text-center pt-2">
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

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <ResetPasswordContent />
        </Suspense>
    );
}
