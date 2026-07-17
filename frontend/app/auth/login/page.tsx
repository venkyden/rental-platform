'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, ChevronRight, Gavel } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence, Variants, useReducedMotion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { useGoogleSignIn } from '@/lib/useGoogleSignIn';
import { useAuth } from '@/lib/useAuth';
import { isValidEmail } from '@/app/lib/utils/validation';
import { safeRedirectPath } from '@/lib/safeRedirect';

/* ----------------------------------------------------------------
   Framer-motion variants (factories so they can honour reduced-motion)
   ---------------------------------------------------------------- */
const makeContainerVariants = (reduce: boolean): Variants => ({
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: reduce
            ? { duration: 0 }
            : { staggerChildren: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
});

const makeItemVariants = (reduce: boolean): Variants => ({
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 20 },
    show: {
        opacity: 1,
        y: 0,
        transition: reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 24 },
    },
});

const makeShakeVariants = (reduce: boolean): Variants => ({
    show: {},
    error: reduce
        ? {}
        : { x: [0, -10, 10, -10, 10, 0], transition: { duration: 0.4 } },
});

/* ================================================================
   LOGIN PAGE
   ================================================================ */
function LoginContent() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { checkAuth } = useAuth();
    // Respect the OS "reduce motion" setting. framer-motion animates via JS
    // transforms, so the global CSS reduced-motion rule does not cover it; we
    // gate the variants manually.
    const reduceMotion = useReducedMotion() ?? false;
    const containerVariants = makeContainerVariants(reduceMotion);
    const itemVariants = makeItemVariants(reduceMotion);
    const shakeVariants = makeShakeVariants(reduceMotion);

    const getSafeRedirectUrl = useCallback((url: string | null) => {
        if (!url) return null;
        try {
            const decoded = decodeURIComponent(url);
            if (decoded.startsWith('/') && !decoded.startsWith('//')) {
                return decoded;
            }
        } catch (e) {
            // Ignore
        }
        return null;
    }, []);

    /* ---------- Auto-redirect if already logged in ---------- */
    useEffect(() => {
        const token = apiClient.getToken();
        if (token && !window.location.search.includes('expired=1')) {
            const safeRedirect = getSafeRedirectUrl(searchParams.get('returnUrl'));
            router.push(safeRedirect || '/dashboard');
        }
    }, [router, searchParams, getSafeRedirectUrl]);

    /* ---------- Google callback ---------- */
    const handleGoogleResponse = useCallback(
        async (credential: string) => {
            setError('');
            setIsError(false);
            setGoogleLoading(true);
            try {
                const result = await apiClient.googleLogin(credential);
                await checkAuth();
                const safeRedirect = getSafeRedirectUrl(searchParams.get('returnUrl'));
                router.push(safeRedirect || safeRedirectPath(result.redirect_path));
            } catch (err: any) {
                const detail = err.response?.data?.detail;
                setError(typeof detail === 'string' ? detail : t('auth.login.error.googleFail', undefined, 'Google login failed'));
                setIsError(true);
            } finally {
                setGoogleLoading(false);
            }
        },
        [router, t, searchParams, getSafeRedirectUrl, checkAuth],
    );

    /* ---------- Setup Google Sign-In ---------- */
    useGoogleSignIn({
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        buttonId: 'google-signin-btn',
        buttonText: 'signin_with',
        onSuccess: handleGoogleResponse,
        onError: (msg: string) => {
            if (!msg.includes('script')) {
                setError(msg);
                setIsError(true);
            }
        },
    });

    /* ---------- Email/password submit ---------- */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        // In-flight guard: prevents button-mashing from firing parallel logins
        // (each failed attempt counts against the server-side per-account lockout).
        if (loading) return;
        setError('');
        setIsError(false);

        // Client-side input validation (UX layer; backend re-validates).
        if (!isValidEmail(email)) {
            setError(t('auth.register.error.emailInvalid', undefined, 'Please enter a valid email'));
            setIsError(true);
            setTimeout(() => setIsError(false), 500);
            return;
        }
        if (!password) {
            setError(t('auth.login.error.passwordRequired', undefined, 'Please enter your password'));
            setIsError(true);
            setTimeout(() => setIsError(false), 500);
            return;
        }

        setLoading(true);

        try {
            const response = await apiClient.login(email, password);
            await checkAuth();
            const safeRedirect = getSafeRedirectUrl(searchParams.get('returnUrl'));
            router.push(safeRedirect || safeRedirectPath(response.redirect_path));
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            let msg = t('auth.login.error.loginFail', undefined, 'Login failed');
            if (typeof detail === 'string') msg = detail;
            else if (Array.isArray(detail)) msg = detail.map((d: any) => d.msg || d.message).join(', ');
            
            setError(msg);
            setIsError(true);
            // Reset error animation after a bit
            setTimeout(() => setIsError(false), 500);
        } finally {
            setLoading(false);
        }
    }

    return (
        <motion.div 
            variants={containerVariants} 
            initial="hidden" 
            animate="show" 
            className="w-full"
        >
            {/* Title Section */}
            <motion.div variants={itemVariants} className="text-center mb-10">
                <h2 className="text-4xl font-black text-zinc-900 tracking-tighter mb-2">
                    {t('auth.login.title', undefined, 'Welcome Back')}
                </h2>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                    {t('auth.login.subtitle', undefined, 'Enter your credentials')}
                </p>
            </motion.div>

            {/* Error Message — announced to assistive tech */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        role="alert"
                        aria-live="assertive"
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -10 }}
                        className="mb-8 rounded-3xl bg-zinc-900 p-5 flex items-center gap-4 shadow-xl shadow-zinc-900/20"
                    >
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <p className="text-xs font-bold tracking-wide text-white">{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div animate={isError ? "error" : "show"} variants={shakeVariants}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <motion.div variants={itemVariants}>
                        <div className="flex justify-between mb-2 px-1">
                            <label htmlFor="email" className="text-xs font-bold text-zinc-500 tracking-wide">
                                {t('auth.login.email', undefined, 'Email address')}
                            </label>
                        </div>
                        <div className="relative group">
                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" strokeWidth={2.5} />
                            <input
                                type="email"
                                name="email"
                                id="email"
                                inputMode="email"
                                autoComplete="username"
                                required
                                aria-invalid={isError}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t('common.placeholders.email', undefined, 'name@example.com')}
                                className="w-full pl-16 pr-6 py-5 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900 placeholder:text-zinc-300"
                            />
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <div className="flex justify-between mb-2 px-1">
                            <label htmlFor="password" className="text-xs font-bold text-zinc-500 tracking-wide">
                                {t('auth.login.password', undefined, 'Password')}
                            </label>
                            <Link href="/auth/forgot-password" className="text-xs font-bold text-zinc-900 tracking-wide hover:text-zinc-600 transition-colors">
                                {t('auth.login.forgotPassword', undefined, 'Forgot password?')}
                            </Link>
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" strokeWidth={2.5} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                id="password"
                                autoComplete="current-password"
                                required
                                aria-invalid={isError}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-16 pr-14 py-5 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900 placeholder:text-zinc-300"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword
                                    ? t('auth.common.hidePassword', undefined, 'Hide password')
                                    : t('auth.common.showPassword', undefined, 'Show password')}
                                aria-pressed={showPassword}
                                className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-900 transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} strokeWidth={2.5} /> : <Eye size={20} strokeWidth={2.5} />}
                            </button>
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 rounded-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-zinc-900/10 group"
                        >
                            {loading ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    {t('auth.login.signingIn', undefined, 'Authenticating')}
                                </div>
                            ) : (
                                <>
                                    {t('auth.login.signIn', undefined, 'Sign In')}
                                    <ChevronRight size={16} strokeWidth={4} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </motion.div>
                </form>
            </motion.div>

            {/* Google Divider */}
            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                <motion.div variants={itemVariants} className="relative my-12">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-100" />
                    </div>
                    <div className="relative flex justify-center text-xs font-semibold">
                        <span className="bg-white px-6 text-zinc-400">{t('auth.login.divider', undefined, 'or continue with')}</span>
                    </div>
                </motion.div>
            )}

            {/* Google Button */}
            <motion.div variants={itemVariants} className="space-y-6">
                {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                    <div className="flex justify-center transform scale-110">
                        <div id="google-signin-btn" />
                    </div>
                )}

                {googleLoading && (
                    <p className="text-[9px] font-black text-zinc-900 text-center animate-pulse uppercase tracking-widest">
                        {t('auth.login.connectingGoogle', undefined, 'Connecting to Google…')}
                    </p>
                )}

                <div className="text-center pt-8">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        {t('auth.login.noAccount', undefined, "Don't have an account?")}{' '}
                        <Link href="/auth/register" className="text-zinc-900 hover:text-zinc-800 transition-colors underline underline-offset-4 decoration-2">
                            {t('auth.login.signUp', undefined, 'Join Roomivo')}
                        </Link>
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}

function LoginFallback() {
    const { t } = useLanguage();
    return (
        <div className="flex flex-col items-center justify-center p-8 min-h-[400px] space-y-4" role="status" aria-live="polite">
            <div className="w-8 h-8 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
            <p className="text-zinc-400 font-bold text-xs tracking-wide">
                {t('auth.login.loading', undefined, 'Loading…')}
            </p>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginFallback />}>
            <LoginContent />
        </Suspense>
    );
}
