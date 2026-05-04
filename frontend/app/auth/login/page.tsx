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
    const { revoke } = useGoogleSignIn({
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

    const handleClearGoogleHint = async () => {
        const emailToRevoke = prompt(t('auth.login.promptEmailToForget', undefined, 'Enter your Google email to forget this account on this site:'));
        if (emailToRevoke) {
            await revoke(emailToRevoke);
            window.location.reload(); // Reload to refresh the GSI button
        }
    };

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
            <motion.div variants={itemVariants} className="text-center mb-10">
                <h2 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter mb-3">
                    {t('auth.login.title', undefined, 'Welcome Back')}
                </h2>
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                    {t('auth.login.noAccount', undefined, 'Don\'t have an account?')}{' '}
                    <Link
                        href="/auth/register"
                        className="text-teal-500 hover:text-teal-400 transition-colors"
                    >
                        {t('auth.login.signUp', undefined, 'Join Roomivo')}
                    </Link>
                </p>
            </motion.div>

            {error && (
                <motion.div
                    variants={itemVariants}
                    className="mb-8 rounded-[2rem] bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-5 flex items-center gap-4"
                >
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-800 dark:text-red-400">{error}</p>
                </motion.div>
            )}

            {/* Google Sign-In button */}
            <motion.div variants={itemVariants} className="mb-10">
                <div className="flex justify-center w-full">
                    <div id="google-signin-btn" className="flex justify-center transform scale-110" />
                </div>
                {googleLoading && (
                    <p className="text-[10px] font-black text-teal-500 uppercase tracking-[0.2em] mt-6 text-center animate-pulse">
                        {t('auth.login.connectingGoogle', undefined, 'Authenticating with Google...')}
                    </p>
                )}
                {!googleLoading && (
                    <div className="flex justify-center mt-6">
                        <button 
                            type="button"
                            onClick={handleClearGoogleHint}
                            className="text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-teal-500 transition-colors"
                        >
                            {t('auth.login.forgetGoogle', undefined, 'Not you? Clear Google hint')}
                        </button>
                    </div>
                )}
            </motion.div>

            {/* Divider */}
            <motion.div variants={itemVariants} className="relative mb-10">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-100 dark:border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em]">
                    <span className="bg-white dark:bg-zinc-900 px-6 text-zinc-400">
                        {t('auth.login.divider', undefined, 'OR')}
                    </span>
                </div>
            </motion.div>

            <motion.form variants={containerVariants} className="space-y-6" onSubmit={handleSubmit}>
                <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-2 px-1">
                        <label
                            htmlFor="email"
                            className="text-[10px] font-black text-zinc-400 uppercase tracking-widest"
                        >
                            {t('auth.login.email', undefined, 'Email Address')}
                        </label>
                        <Link
                            href="/auth/forgot-email"
                            className="text-[10px] font-black text-teal-500 uppercase tracking-widest hover:text-teal-400 transition-colors"
                        >
                            {t('auth.login.forgotEmail', undefined, 'Lost Email?')}
                        </Link>
                    </div>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="block w-full px-6 py-5 rounded-2xl border-none bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/50 transition-all font-bold"
                        placeholder={t('common.placeholders.email')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </motion.div>

                <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-2 px-1">
                        <label
                            htmlFor="password"
                            className="text-[10px] font-black text-zinc-400 uppercase tracking-widest"
                        >
                            {t('auth.login.password', undefined, 'Password')}
                        </label>
                        <Link
                            href="/auth/forgot-password"
                            className="text-[10px] font-black text-teal-500 uppercase tracking-widest hover:text-teal-400 transition-colors"
                        >
                            {t('auth.login.forgotPassword', undefined, 'Reset?')}
                        </Link>
                    </div>
                    <div className="relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            required
                            className="block w-full px-6 py-5 pr-14 rounded-2xl border-none bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/50 transition-all font-bold"
                            placeholder={t('common.placeholders.password')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-5 flex items-center text-zinc-400 hover:text-teal-500 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-5 px-6 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-zinc-900/10 dark:shadow-white/5"
                    >
                        {loading ? (
                            <span className="flex items-center gap-3">
                                <span className="w-3 h-3 border-2 border-white/30 dark:border-zinc-900/30 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
                                {t('auth.login.signingIn', undefined, 'Verifying...')}
                            </span>
                        ) : (
                            t('auth.login.signIn', undefined, 'Sign In')
                        )}
                    </button>
                </motion.div>
            </motion.form>
        </motion.div>
    );
}
