'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { motion, Variants } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';

/* ----------------------------------------------------------------
   Google Identity Services type declaration
   ---------------------------------------------------------------- */
declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: Record<string, unknown>) => void;
                    renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
                    prompt: () => void;
                    cancel: () => void;
                };
            };
        };
    }
}

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

    const scriptLoadedRef = useRef(false);

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
        async (response: { credential?: string }) => {
            if (!response.credential) {
                setError(t('auth.login.error.google', undefined, undefined));
                return;
            }

            setError('');
            setGoogleLoading(true);

            try {
                const result = await apiClient.googleLogin(response.credential);
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
        [router],
    );

    /* ---------- Load Google GSI script ---------- */
    useEffect(() => {
        if (scriptLoadedRef.current) return;
        scriptLoadedRef.current = true;

        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) return;

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;

        script.onload = () => {
            if (!window.google) return;

            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: handleGoogleResponse,
                auto_select: false,
                cancel_on_tap_outside: true,
                ux_mode: 'popup',
                itp_support: true,
            });

            const buttonDiv = document.getElementById('google-signin-btn');
            if (buttonDiv) {
                const containerWidth =
                    buttonDiv.parentElement?.clientWidth || window.innerWidth - 64;
                const buttonWidth = Math.max(200, Math.min(400, Math.floor(containerWidth)));

                window.google.accounts.id.renderButton(buttonDiv, {
                    theme: 'outline',
                    size: 'large',
                    width: buttonWidth,
                    text: 'signin_with',
                    shape: 'pill',
                });
            }
        };

        script.onerror = () => {
            console.warn('Failed to load Google Sign-In script');
            setError(t('auth.login.error.googleScript', undefined, undefined));
        };

        document.body.appendChild(script);
    }, [handleGoogleResponse]);

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
                        placeholder="name@company.com"
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
                            placeholder="••••••••"
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
