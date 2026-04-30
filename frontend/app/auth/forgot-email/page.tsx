'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { ArrowLeft, UserSearch, CheckCircle2 } from 'lucide-react';
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
                <div className="mx-auto w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-teal-200 dark:border-teal-800">
                    {status === 'success' ? (
                        <CheckCircle2 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                    ) : (
                        <UserSearch className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                    )}
                </div>
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-3 tracking-tight">
                    {status === 'success' ? 'Account Found' : 'Find your email'}
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">
                    {status === 'success'
                        ? 'We found an account matching your details.'
                        : "Enter your registered full name and phone number and we'll help you find your email address."}
                </p>
            </motion.div>

            {status === 'success' ? (
                <motion.div variants={itemVariants} className="space-y-6">
                    <div className="bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/30 rounded-xl p-6 text-center">
                        <p className="text-sm text-teal-800 dark:text-teal-300 mb-2">Your email address is</p>
                        <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">{maskedEmail}</p>
                    </div>
                    <Link
                        href="/auth/login"
                        className="flex w-full justify-center px-4 py-3 rounded-xl border border-transparent text-sm font-semibold text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 focus:outline-none focus:ring-4 focus:ring-zinc-500/20 transition-all shadow-sm"
                    >
                        Return to login
                    </Link>
                </motion.div>
            ) : (
                <motion.form variants={itemVariants} className="space-y-5" onSubmit={handleSubmit}>
                    {error && (
                        <div className="rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-4">
                            <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="fullName"
                            className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5"
                        >
                            Full Name
                        </label>
                        <input
                            id="fullName"
                            type="text"
                            required
                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                            placeholder="e.g. Jean Dupont"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="phone"
                            className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5"
                        >
                            Phone Number
                        </label>
                        <input
                            id="phone"
                            type="tel"
                            required
                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                            placeholder="+33 6 12 34 56 78"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading' || !fullName || !phone}
                        className="flex w-full justify-center px-4 py-3 rounded-xl border border-transparent text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-500/20 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {status === 'loading' ? 'Searching...' : 'Find Email'}
                    </button>
                    
                    <div className="flex justify-center mt-6">
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to login
                        </Link>
                    </div>
                </motion.form>
            )}
        </motion.div>
    );
}
