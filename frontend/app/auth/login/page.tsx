'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { motion, Variants } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { useGoogleSignIn } from '@/lib/useGoogleSignIn';

/* ----------------------------------------------------------------
   Framer-motion variants
   ---------------------------------------------------------------- */
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

/* ================================================================
   LOGIN PAGE
   ================================================================ */
export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { t } = useLanguage();
    const router = useRouter();

    /* ---------- Auto-redirect if already logged in ---------- */
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        // Only redirect if there's no "expired" query param
        if (token && !window.location.search.includes('expired=1')) {
            router.push('/dashboard');
        }
    }, [router]);

    /* ---------- Google callback ---------- */
    const handleGoogleResponse = useCallback(
        async (credential: string) => {
            setError('');
            setGoogleLoading(true);

            try {
                const result = await apiClient.googleLogin(credential);
                const redirectPath = result.redirect_path || '/dashboard';
                router.push(redirectPath);
            } catch (err: unknown) {
                const axiosErr = err as { response?: { data?: { detail?: string } } };
                const detail = axiosErr?.response?.data?.detail;
                setError(
                    typeof detail === 'string'
                        ? detail
                        : t('auth.login.error.googleFail', undefined, undefined),
                );
            } finally {
                setGoogleLoading(false);
            }
        },
        [router, t],
    );

    /* ---------- Setup Google Sign-In ---------- */
    useGoogleSignIn({
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        buttonId: 'google-signin-btn',
        buttonText: 'signin_with',
        onSuccess: handleGoogleResponse,
        onError: (msg: string) => {
            // Only show error if it's not just a script loading issue (could be adblock)
            if (msg.includes('script')) {
                 console.warn(msg);
            } else {
                 setError(msg);
            }
        },
    });

    /* ---------- Email/password submit ---------- */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await apiClient.login(email, password);
            router.push(response.redirect_path || '/dashboard');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string | Array<{ msg?: string; message?: string }> | { msg?: string; message?: string } } } };
            const detail = axiosErr?.response?.data?.detail;
            let errorMessage = t('auth.login.error.loginFail', undefined, undefined);
            if (typeof detail === 'string') errorMessage = detail;
            else if (Array.isArray(detail))
                errorMessage = detail.map((d) => d.msg || d.message).join(', ');
            else if (detail && typeof detail === 'object')
                errorMessage = detail.msg || detail.message || errorMessage;
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    /* ---------- Render ---------- */
    return (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full">
            <motion.div variants={itemVariants} className="text-center sm:text-left mb-8">
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                    {t('auth.login.title', undefined, undefined)}
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {t('auth.login.noAccount', undefined, undefined)}{' '}
                    <Link
                        href="/auth/register"
                        className="font-semibold text-teal-600 hover:text-teal-500 transition-colors"
                    >
                        {t('auth.login.signUp', undefined, undefined)}
                    </Link>
                </p>
            </motion.div>

            {error && (
                <motion.div
                    variants={itemVariants}
                    className="mb-6 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-4"
                >
                    <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
                </motion.div>
            )}

            {/* Google Sign-In button */}
            <motion.div variants={itemVariants} className="mb-6">
                <div className="flex justify-center w-full">
                    <div id="google-signin-btn" className="flex justify-center" />
                </div>
                {googleLoading && (
                    <p className="text-sm text-zinc-600 mt-3 text-center animate-pulse">
                        {t('auth.login.connectingGoogle', undefined, undefined)}
                    </p>
                )}
            </motion.div>

            {/* Divider */}
            <motion.div variants={itemVariants} className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-500 dark:text-zinc-400">
                        {t('auth.login.divider', undefined, undefined)}
                    </span>
                </div>
            </motion.div>

            <motion.form variants={containerVariants} className="space-y-5" onSubmit={handleSubmit}>
                <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-1.5">
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-zinc-800 dark:text-zinc-300"
                        >
                            {t('auth.login.email', undefined, undefined)}
                        </label>
                        <Link
                            href="/auth/forgot-email"
                            className="text-sm font-semibold text-teal-600 hover:text-teal-500 transition-colors"
                        >
                            {t('auth.login.forgotEmail', undefined, undefined)}
                        </Link>
                    </div>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                        placeholder={t('common.placeholders.email')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </motion.div>

                <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-1.5">
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-zinc-800 dark:text-zinc-300"
                        >
                            {t('auth.login.password', undefined, undefined)}
                        </label>
                        <Link
                            href="/auth/forgot-password"
                            className="text-sm font-semibold text-teal-600 hover:text-teal-500 transition-colors"
                        >
                            {t('auth.login.forgotPassword', undefined, undefined)}
                        </Link>
                    </div>
                    <div className="relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            required
                            className="block w-full px-4 py-3 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                            placeholder={t('common.placeholders.password')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-teal-600 hover:bg-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('auth.login.signingIn', undefined, undefined)}
                            </span>
                        ) : (
                            t('auth.login.signIn', undefined, undefined)
                        )}
                    </button>
                </motion.div>
            </motion.form>
        </motion.div>
    );
}
