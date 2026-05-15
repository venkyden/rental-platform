'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, ChevronRight, Gavel } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { useGoogleSignIn } from '@/lib/useGoogleSignIn';

/* ----------------------------------------------------------------
   Framer-motion variants
   ---------------------------------------------------------------- */
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

const shakeVariants = {
    error: {
        x: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.4 }
    }
};

/* ================================================================
   LOGIN PAGE
   ================================================================ */
export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isError, setIsError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { t } = useLanguage();
    const router = useRouter();

    /* ---------- Auto-redirect if already logged in ---------- */
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token && !window.location.search.includes('expired=1')) {
            router.push('/dashboard');
        }
    }, [router]);

    /* ---------- Google callback ---------- */
    const handleGoogleResponse = useCallback(
        async (credential: string) => {
            setError('');
            setIsError(false);
            setGoogleLoading(true);
            try {
                const result = await apiClient.googleLogin(credential);
                router.push(result.redirect_path || '/dashboard');
            } catch (err: any) {
                const detail = err.response?.data?.detail;
                setError(typeof detail === 'string' ? detail : t('auth.login.error.googleFail', undefined, 'Google login failed'));
                setIsError(true);
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
            if (!msg.includes('script')) {
                setError(msg);
                setIsError(true);
            }
        },
    });

    const handleClearGoogleHint = async () => {
        const emailToRevoke = prompt(t('auth.login.promptEmailToForget', undefined, 'Enter your Google email to forget:'));
        if (emailToRevoke) {
            await revoke(emailToRevoke);
            window.location.reload();
        }
    };

    /* ---------- Email/password submit ---------- */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setIsError(false);
        setLoading(true);

        try {
            const response = await apiClient.login(email, password);
            router.push(response.redirect_path || '/dashboard');
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

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        className="mb-8 rounded-3xl bg-zinc-900 p-5 flex items-center gap-4 shadow-xl shadow-zinc-900/20"
                    >
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">{error}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div animate={isError ? "error" : "show"} variants={shakeVariants}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <motion.div variants={itemVariants}>
                        <div className="flex justify-between mb-2 px-1">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                {t('auth.login.email', undefined, 'Email Address')}
                            </label>
                        </div>
                        <div className="relative group">
                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" strokeWidth={2.5} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t('common.placeholders.email', undefined, 'name@example.com')}
                                className="w-full pl-16 pr-6 py-5 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900 placeholder:text-zinc-300"
                            />
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <div className="flex justify-between mb-2 px-1">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                {t('auth.login.password', undefined, 'Security Lock')}
                            </label>
                            <Link href="/auth/forgot-password" className="text-[10px] font-black text-zinc-900 uppercase tracking-widest hover:text-zinc-600 transition-colors">
                                {t('auth.login.forgotPassword', undefined, 'Forgot?')}
                            </Link>
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" strokeWidth={2.5} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-16 pr-14 py-5 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900 placeholder:text-zinc-300"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
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
            <motion.div variants={itemVariants} className="relative my-12">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-100" />
                </div>
                <div className="relative flex justify-center text-[9px] font-black uppercase tracking-[0.5em]">
                    <span className="bg-white px-6 text-zinc-300">{t('auth.login.divider', undefined, 'Secured Access')}</span>
                </div>
            </motion.div>

            {/* Google Button */}
            <motion.div variants={itemVariants} className="space-y-6">
                <div className="flex justify-center transform scale-110">
                    <div id="google-signin-btn" />
                </div>
                
                {googleLoading && (
                    <p className="text-[9px] font-black text-zinc-900 text-center animate-pulse uppercase tracking-widest">
                        Handshaking with Google...
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
