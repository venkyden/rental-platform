'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { ArrowLeft, UserSearch, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1,
        },
    },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

export default function ForgotEmailPage() {
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
    const [error, setError] = useState('');
    const { t } = useLanguage();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (status === 'loading') return;
        setError('');
        setStatus('loading');

        try {
            // Backend always returns a generic 200 (no account enumeration); we
            // show a neutral "if an account exists" confirmation either way.
            await apiClient.client.post('/auth/forgot-email', {
                full_name: fullName,
                phone: phone,
            });
            setStatus('success');
        } catch (err: any) {
            setError(err.response?.data?.detail || t('auth.forgotEmail.errors.default', undefined, 'Something went wrong. Please try again.'));
            setStatus('idle');
        }
    }

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full">
            <motion.div variants={itemVariants} className="text-center mb-8">
                <div className="mx-auto w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-zinc-200">
                    {status === 'success' ? (
                        <CheckCircle2 className="w-6 h-6 text-zinc-900" />
                    ) : (
                        <UserSearch className="w-6 h-6 text-zinc-900" />
                    )}
                </div>
                <h2 className="text-4xl font-black text-zinc-900 tracking-tighter mb-2">
                    {status === 'success' ? t('auth.forgotEmail.successTitle', undefined, 'Check your inbox') : t('auth.forgotEmail.title', undefined, 'Find your email')}
                </h2>
                <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] max-w-sm mx-auto">
                    {status === 'success'
                        ? t('auth.forgotEmail.successDesc', undefined, "If an account matches the details you provided, we've sent a reminder to its email address.")
                        : t('auth.forgotEmail.desc', undefined, "Enter your registered full name and phone number and we'll send a reminder to the matching email address.")}
                </p>
            </motion.div>

            {status === 'success' ? (
                <motion.div variants={itemVariants} className="space-y-6">
                    <Link
                        href="/auth/login"
                        className="w-full py-5 rounded-full bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-zinc-900/10"
                    >
                        {t('common.back', undefined, 'Return to login')}
                    </Link>
                </motion.div>
            ) : (
                <motion.form variants={itemVariants} className="space-y-5" onSubmit={handleSubmit}>
                    {error && (
                        <div role="alert" aria-live="assertive" className="rounded-xl bg-zinc-900 border border-zinc-900 p-4 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <p className="text-xs font-bold tracking-wide text-white">{error}</p>
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="fullName"
                            className="text-xs font-bold text-zinc-500 tracking-wide ml-1 mb-2 block"
                        >
                            {t('auth.forgotEmail.fullName', undefined, 'Full Name')}
                        </label>
                        <input
                            id="fullName"
                            type="text"
                            required
                            className="w-full px-6 py-5 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900 placeholder:text-zinc-300"
                            placeholder={t('common.placeholders.fullName', undefined, 'John Doe')}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="phone"
                            className="text-xs font-bold text-zinc-500 tracking-wide ml-1 mb-2 block"
                        >
                            {t('auth.forgotEmail.phone', undefined, 'Phone Number')}
                        </label>
                        <input
                            id="phone"
                            type="tel"
                            required
                            className="w-full px-6 py-5 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900 placeholder:text-zinc-300"
                            placeholder={t('common.placeholders.phone', undefined, '+33 6 12 34 56 78')}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading' || !fullName || !phone}
                        className="w-full py-5 rounded-full bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-zinc-900/10"
                    >
                        {status === 'loading' ? (
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                {t('common.loading', undefined, 'Loading...')}
                            </div>
                        ) : t('auth.forgotEmail.submit', undefined, 'Find Email')}
                    </button>

                    <div className="flex justify-center mt-6">
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center gap-2 text-xs font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-900 transition-colors"
                        >
                            <ArrowLeft className="w-3 h-3" strokeWidth={3} />
                            {t('common.back', undefined, 'Back to login')}
                        </Link>
                    </div>
                </motion.form>
            )}
        </motion.div>
    );
}
