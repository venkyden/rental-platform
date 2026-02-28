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

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        role: 'tenant' as 'tenant' | 'landlord' | 'property_manager',
        gdprConsent: false,
        marketingConsent: false,
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({ valid: false, message: '' });
    const [googleLoading, setGoogleLoading] = useState(false);
    const router = useRouter();

    const handleGoogleResponse = useCallback(async (response: any) => {
        setError('');
        setGoogleLoading(true);
        try {
            const roleToUse = formData.role || 'tenant';
            const result = await apiClient.googleLogin(response.credential, roleToUse);
            router.push(result.redirect_path || '/dashboard');
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Google sign-up failed. Please try again.');
        } finally {
            setGoogleLoading(false);
        }
    }, [formData.role, router]);

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
                const buttonDiv = document.getElementById('google-signup-btn');
                if (buttonDiv) {
                    window.google.accounts.id.renderButton(buttonDiv, {
                        theme: 'outline',
                        size: 'large',
                        width: 400,
                        text: 'signup_with',
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

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const target = e.target;
        const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
        const name = target.name;

        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'password') validatePassword(value as string);
    }

    function validatePassword(password: string) {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
        };

        const allValid = Object.values(checks).every(Boolean);
        const messages = [];
        if (!checks.length) messages.push('8+ chars');
        if (!checks.uppercase) messages.push('uppercase');
        if (!checks.lowercase) messages.push('lowercase');
        if (!checks.number) messages.push('number');
        if (!checks.special) messages.push('special');

        setPasswordStrength({
            valid: allValid,
            message: allValid ? 'Strong password ✓' : `Missing: ${messages.join(', ')}`,
        });

        return allValid;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (!formData.gdprConsent) {
            setError('You must accept the Privacy Policy to create an account');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (!validatePassword(formData.password)) {
            setError('Password does not meet security requirements');
            return;
        }

        setLoading(true);

        try {
            await apiClient.register({
                email: formData.email,
                password: formData.password,
                full_name: formData.full_name,
                role: formData.role,
                marketing_consent: formData.marketingConsent,
            });
            await apiClient.login(formData.email, formData.password);
            router.push('/dashboard');
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            let errorMessage = 'Registration failed. Please try again.';
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
            className="w-full pb-12"
        >
            <motion.div variants={itemVariants} className="text-center sm:text-left mb-8">
                <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
                    Create your account
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                    Already have an account?{' '}
                    <Link href="/auth/login" className="font-semibold text-teal-600 hover:text-teal-500 transition-colors">
                        Sign in
                    </Link>
                </p>
            </motion.div>

            {error && (
                <motion.div variants={itemVariants} className="mb-6 rounded-xl bg-red-50/50 border border-red-200 p-4">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                </motion.div>
            )}

            <motion.div variants={itemVariants} className="mb-6">
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-3 text-center sm:text-left">
                    I am a
                </label>
                <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                        { id: 'tenant', label: 'Tenant', icon: '👤' },
                        { id: 'landlord', label: 'Landlord', icon: '🏠' }
                    ].map((role) => (
                        <button
                            key={role.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, role: role.id as any })}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${formData.role === role.id
                                ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                                : 'border-zinc-200 dark:border-zinc-800 hover:border-teal-200 dark:hover:border-teal-800 text-zinc-700 dark:text-zinc-400'
                                }`}
                        >
                            <span className="text-2xl mb-2">{role.icon}</span>
                            <span className="text-sm font-medium">{role.label}</span>
                        </button>
                    ))}
                </div>

                <div id="google-signup-btn" className="flex justify-center sm:justify-start" />
                {googleLoading && (
                    <p className="text-sm text-zinc-600 mt-3 text-center sm:text-left animate-pulse">
                        Creating account with Google...
                    </p>
                )}
            </motion.div>

            <motion.form variants={containerVariants} className="space-y-5" method="POST" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                    <motion.div variants={itemVariants} className="col-span-1 sm:col-span-2">
                        <label htmlFor="full_name" className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                            Full Name
                        </label>
                        <input
                            id="full_name"
                            name="full_name"
                            type="text"
                            required
                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                            placeholder="Jean Dupont"
                            value={formData.full_name}
                            onChange={handleChange}
                        />
                    </motion.div>

                    <motion.div variants={itemVariants} className="col-span-1 sm:col-span-2">
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
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </motion.div>

                    <motion.div variants={itemVariants} className="col-span-1">
                        <label htmlFor="password" className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            required
                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                        />
                        {formData.password && (
                            <p className={`mt-2 text-xs font-medium ${passwordStrength.valid ? 'text-teal-600' : 'text-amber-500'}`}>
                                {passwordStrength.message}
                            </p>
                        )}
                    </motion.div>

                    <motion.div variants={itemVariants} className="col-span-1">
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                            Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                            placeholder="••••••••"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                        />
                    </motion.div>
                </div>

                <motion.div variants={itemVariants} className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                    <div className="flex items-start">
                        <div className="flex items-center h-5 mt-0.5">
                            <input
                                id="gdprConsent"
                                name="gdprConsent"
                                type="checkbox"
                                required
                                checked={formData.gdprConsent}
                                onChange={handleChange}
                                className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-600"
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="gdprConsent" className="font-medium text-zinc-800 dark:text-zinc-300">
                                I accept the{' '}
                                <Link href="/legal/privacy" className="text-teal-600 hover:text-teal-500 underline">Privacy Policy</Link>
                                {' '}and{' '}
                                <Link href="/legal/terms" className="text-teal-600 hover:text-teal-500 underline">Terms of Service</Link>
                                <span className="text-red-500"> *</span>
                            </label>
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="pt-2">
                    <button
                        type="submit"
                        disabled={loading || !formData.gdprConsent}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-teal-600 hover:bg-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Creating account...
                            </span>
                        ) : (
                            'Create account'
                        )}
                    </button>
                </motion.div>
            </motion.form>
        </motion.div>
    );
}
