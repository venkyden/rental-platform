'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { motion, Variants } from 'framer-motion';

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: any) => void;
                    renderButton: (element: HTMLElement, config: any) => void;
                };
            };
        };
    }
}

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

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const router = useRouter();

    const handleGoogleResponse = useCallback(async (response: any) => {
        setError('');
        setGoogleLoading(true);
        try {
            const result = await apiClient.googleLogin(response.credential);
            const redirectPath = result.redirect_path || '/dashboard';
            router.push(redirectPath);
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Google sign-in failed. Please try again.');
        } finally {
            setGoogleLoading(false);
        }
    }, [router]);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
            if (clientId && window.google) {
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleGoogleResponse,
                });
                const buttonDiv = document.getElementById('google-signin-btn');
                if (buttonDiv) {
                    window.google.accounts.id.renderButton(buttonDiv, {
                        theme: 'outline',
                        size: 'large',
                        width: 400,
                        text: 'signin_with',
                        shape: 'pill',
                    });
                }
            }
        };
        document.body.appendChild(script);
        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, [handleGoogleResponse]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await apiClient.login(email, password);
            router.push(response.redirect_path || '/dashboard');
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            let errorMessage = 'Login failed. Please try again.';
            if (typeof detail === 'string') errorMessage = detail;
            else if (Array.isArray(detail)) errorMessage = detail.map(d => d.msg || d.message).join(', ');
            else if (detail && typeof detail === 'object') errorMessage = detail.msg || detail.message;
            setError(errorMessage);
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
            <motion.div variants={itemVariants} className="text-center sm:text-left mb-8">
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                    Welcome back
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Don't have an account?{' '}
                    <Link href="/auth/register" className="font-semibold text-teal-600 hover:text-teal-500 transition-colors">
                        Create one now
                    </Link>
                </p>
            </motion.div>

            {error && (
                <motion.div variants={itemVariants} className="mb-6 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-4">
                    <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
                </motion.div>
            )}

            <motion.div variants={itemVariants} className="mb-6">
                <div id="google-signin-btn" className="flex justify-center sm:justify-start" />
                {googleLoading && (
                    <p className="text-sm text-zinc-600 mt-3 text-center sm:text-left animate-pulse">
                        Connecting to Google...
                    </p>
                )}
            </motion.div>



            <motion.form variants={containerVariants} className="space-y-5" onSubmit={handleSubmit}>
                <motion.div variants={itemVariants}>
                    <label htmlFor="email" className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                        Email address
                    </label>
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
                        <label htmlFor="password" className="block text-sm font-medium text-zinc-800 dark:text-zinc-300">
                            Password
                        </label>
                        <Link
                            href="/auth/forgot-password"
                            className="text-sm font-semibold text-teal-600 hover:text-teal-500 transition-colors"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                                Signing in...
                            </span>
                        ) : (
                            'Sign in securely'
                        )}
                    </button>
                </motion.div>
            </motion.form>
        </motion.div>
    );
}
