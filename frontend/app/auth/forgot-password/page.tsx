'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence, Variants, useReducedMotion } from 'framer-motion';
import { isValidEmail } from '@/app/lib/utils/validation';

const makeContainerVariants = (reduce: boolean): Variants => ({
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: reduce ? { duration: 0 } : { staggerChildren: 0.1 },
    },
});

const makeItemVariants = (reduce: boolean): Variants => ({
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 15 },
    show: {
        opacity: 1, y: 0,
        transition: reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 24 },
    },
});

export default function ForgotPasswordPage() {
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const reduceMotion = useReducedMotion() ?? false;
    const containerVariants = makeContainerVariants(reduceMotion);
    const itemVariants = makeItemVariants(reduceMotion);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (!isValidEmail(email)) {
            setError(t('auth.register.error.emailInvalid', undefined, 'Please enter a valid email'));
            return;
        }

        setLoading(true);
        try {
            await apiClient.forgotPassword(email);
            setSubmitted(true);
        } catch (err: any) {
            setError(err.response?.data?.detail || t('auth.forgotPassword.errors.default', undefined, 'Failed to send reset email. Please try again.'));
        } finally {
            setLoading(false);
        }
    }

    if (submitted) {
        return (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full">
                <motion.div variants={itemVariants} className="text-center mb-10">
                    <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Mail className="w-7 h-7 text-zinc-900" strokeWidth={2} />
                    </div>
                    <h2 className="text-4xl font-black text-zinc-900 tracking-tighter mb-2">
                        {t('auth.forgotPassword.successTitle', undefined, 'Check your email')}
                    </h2>
                    <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">
                        {t('auth.forgotPassword.successDesc', { email }, `We've sent reset instructions to ${email}`)}
                    </p>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Link
                        href="/auth/login"
                        className="w-full py-5 rounded-full bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-zinc-900/10"
                    >
                        <ArrowLeft size={14} strokeWidth={3} />
                        {t('auth.forgotPassword.backToSignIn', undefined, 'Back to sign in')}
                    </Link>
                </motion.div>
            </motion.div>
        );
    }

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full">
            <motion.div variants={itemVariants} className="text-center mb-10">
                <h2 className="text-4xl font-black text-zinc-900 tracking-tighter mb-2">
                    {t('auth.forgotPassword.title', undefined, 'Reset password')}
                </h2>
                <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">
                    {t('auth.forgotPassword.subtitle', undefined, "Enter your email — we'll send a reset link")}
                </p>
            </motion.div>

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

            <form onSubmit={handleSubmit} className="space-y-6">
                <motion.div variants={itemVariants}>
                    <label htmlFor="email" className="text-xs font-bold text-zinc-500 tracking-wide ml-1 mb-2 block">
                        {t('auth.forgotPassword.emailLabel', undefined, 'Email address')}
                    </label>
                    <div className="relative group">
                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-zinc-900 transition-colors" strokeWidth={2.5} />
                        <input
                            id="email"
                            name="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            required
                            className="w-full pl-16 pr-6 py-5 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900 placeholder:text-zinc-300"
                            placeholder={t('common.placeholders.email', undefined, 'name@example.com')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 rounded-full bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-zinc-900/10 group"
                    >
                        {loading ? (
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                {t('auth.forgotPassword.sending', undefined, 'Sending...')}
                            </div>
                        ) : (
                            <>
                                {t('auth.forgotPassword.submit', undefined, 'Send reset link')}
                                <ChevronRight size={16} strokeWidth={4} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </motion.div>
            </form>

            <motion.div variants={itemVariants} className="mt-10 text-center">
                <Link
                    href="/auth/login"
                    className="inline-flex items-center gap-2 text-xs font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-colors"
                >
                    <ArrowLeft size={12} strokeWidth={3} />
                    {t('auth.forgotPassword.backToSignIn', undefined, 'Back to sign in')}
                </Link>
            </motion.div>
        </motion.div>
    );
}
