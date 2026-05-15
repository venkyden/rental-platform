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
    const [maskedEmail, setMaskedEmail] = useState('');
    const { t } = useLanguage();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setStatus('loading');

        try {
            const response = await apiClient.client.post('/auth/forgot-email', {
                full_name: fullName,
                phone: phone,
            });
            setMaskedEmail(response.data.masked_email);
            setStatus('success');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'No account found matching this name and phone number.');
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
                <h2 className="text-3xl font-extrabold text-zinc-900 mb-3 tracking-tight">
                    {status === 'success' ? t('auth.forgotEmail.successTitle', undefined, 'Account Found') : t('auth.login.forgotEmail', undefined, 'Find your email')}
                </h2>
                <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
                    {status === 'success'
                        ? t('auth.forgotEmail.successDesc', undefined, 'We found an account matching your details.')
                        : t('auth.forgotEmail.desc', undefined, "Enter your registered full name and phone number and we'll help you find your email address.")}
                </p>
            </motion.div>

            {status === 'success' ? (
                <motion.div variants={itemVariants} className="space-y-6">
                    <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-6 text-center">
                        <p className="text-sm text-zinc-500 mb-2">{t('auth.forgotEmail.resultLabel', undefined, 'Your email address is')}</p>
                        <p className="text-2xl font-bold text-zinc-900">{maskedEmail}</p>
                    </div>
                    <Link
                        href="/auth/login"
                        className="flex w-full justify-center px-4 py-3 rounded-xl border border-transparent text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-500/20 transition-all shadow-sm"
                    >
                        {t('common.back', undefined, 'Return to login')}
                    </Link>
                </motion.div>
            ) : (
                <motion.form variants={itemVariants} className="space-y-5" onSubmit={handleSubmit}>
                    {error && (
                        <div className="rounded-xl bg-zinc-900 border border-zinc-900 p-4 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">{error}</p>
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="fullName"
                            className="block text-sm font-medium text-zinc-800 mb-1.5"
                        >
                            Full Name
                        </label>
                        <input
                            id="fullName"
                            type="text"
                            required
                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-500 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5 transition-all shadow-sm"
                            placeholder={t('common.placeholders.fullName')}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="phone"
                            className="block text-sm font-medium text-zinc-800 mb-1.5"
                        >
                            Phone Number
                        </label>
                        <input
                            id="phone"
                            type="tel"
                            required
                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-500 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5 transition-all shadow-sm"
                            placeholder={t('common.placeholders.phone')}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading' || !fullName || !phone}
                        className="flex w-full justify-center px-4 py-3 rounded-xl border border-transparent text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/20 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {status === 'loading' ? t('common.loading') : t('auth.login.forgotEmail', undefined, 'Find Email')}
                    </button>
                    
                    <div className="flex justify-center mt-6">
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            {t('common.back', undefined, 'Back to login')}
                        </Link>
                    </div>
                </motion.form>
            )}
        </motion.div>
    );
}
