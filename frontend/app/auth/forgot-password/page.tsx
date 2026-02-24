'use client';

import React, { useState, ChangeEvent } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await apiClient.forgotPassword(email);
            setSubmitted(true);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to send reset email. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    if (submitted) {
        return (
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="w-full"
            >
                <div className="text-center sm:text-left">
                    <motion.div variants={itemVariants} className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center mx-auto sm:mx-0 mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </motion.div>
                    <motion.h2 variants={itemVariants} className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                        Check your email
                    </motion.h2>
                    <motion.p variants={itemVariants} className="mt-3 text-zinc-600 dark:text-zinc-400">
                        If an account exists for <span className="font-semibold text-zinc-900 dark:text-white">{email}</span>, we've sent password reset instructions.
                    </motion.p>
                    <motion.div variants={itemVariants} className="mt-8">
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center text-sm font-semibold text-teal-600 hover:text-teal-500 transition-colors"
                        >
                            <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to sign in
                        </Link>
                    </motion.div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full"
        >
            <motion.div variants={itemVariants} className="text-center sm:text-left mb-8">
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                    Reset your password
                </h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Enter your email address and we'll send you a link to reset your password.
                </p>
            </motion.div>

            <motion.form variants={containerVariants} className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                    <motion.div variants={itemVariants} className="rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-4">
                        <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
                    </motion.div>
                )}

                <motion.div variants={itemVariants}>
                    <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                        Email address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                        placeholder="name@company.com"
                        value={email}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    />
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
                                Sending...
                            </span>
                        ) : (
                            'Send reset link'
                        )}
                    </button>
                </motion.div>

                <motion.div variants={itemVariants} className="text-center sm:text-left mt-6">
                    <Link
                        href="/auth/login"
                        className="inline-flex items-center text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                        <svg className="mr-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to sign in
                    </Link>
                </motion.div>
            </motion.form>
        </motion.div>
    );
}
