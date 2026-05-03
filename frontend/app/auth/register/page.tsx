'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, User, Home, Building } from 'lucide-react';
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
   REGISTER PAGE
   ================================================================ */
export default function RegisterPage() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        phone: '',
        role: 'tenant' as 'tenant' | 'landlord' | 'property_manager',
        gdprConsent: false,
        marketingConsent: false,
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({ valid: false, message: '' });
    const [googleLoading, setGoogleLoading] = useState(false);
    const { t } = useLanguage();
    const router = useRouter();

    // Use a ref so the GSI callback always reads the latest role
    const roleRef = useRef(formData.role);
    roleRef.current = formData.role;

    /* ---------- Google callback ---------- */
    const handleGoogleResponse = useCallback(
        async (credential: string) => {
            setError('');
            setGoogleLoading(true);

            try {
                const roleToUse = roleRef.current || 'tenant';
                const result = await apiClient.googleLogin(credential, roleToUse);
                router.push(result.redirect_path || '/dashboard');
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
    useGoogleSignIn({
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        buttonId: 'google-signup-btn',
        buttonText: 'signup_with',
        onSuccess: handleGoogleResponse,
        onError: (msg: string) => {
            if (msg.includes('script')) {
                console.warn(msg);
            } else {
                setError(msg);
            }
        },
    });

    /* ---------- Form helpers ---------- */
    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const target = e.target;
        const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
        const name = target.name;
        setFormData((prev) => ({ ...prev, [name]: value }));
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
        const messages: string[] = [];
        if (!checks.length) messages.push('8+ chars');
        if (!checks.uppercase) messages.push('uppercase');
        if (!checks.lowercase) messages.push('lowercase');
        if (!checks.number) messages.push('number');
        if (!checks.special) messages.push('special');

        setPasswordStrength({
            valid: allValid,
            message: allValid ? 'Strong password ' : `Missing: ${messages.join(', ')}`,
        });

        return allValid;
    }

    /* ---------- Email/password submit ---------- */
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (!formData.gdprConsent) {
            setError(t('auth.register.error.privacy', undefined, undefined));
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError(t('auth.register.error.mismatch', undefined, undefined));
            return;
        }
        if (!validatePassword(formData.password)) {
            setError(t('auth.register.error.security', undefined, undefined));
            return;
        }

        setLoading(true);

        try {
            await apiClient.register({
                email: formData.email,
                password: formData.password,
                full_name: formData.full_name,
                phone: formData.phone || undefined,
                role: formData.role,
                marketing_consent: formData.marketingConsent,
            });
            await apiClient.login(formData.email, formData.password);
            router.push('/dashboard');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string | Array<{ msg?: string; message?: string }> | { msg?: string; message?: string } } } };
            const detail = axiosErr?.response?.data?.detail;
            let errorMessage = t('auth.register.error.fail', undefined, undefined);
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
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full pb-12"
        >
            <motion.div variants={itemVariants} className="text-center sm:text-left mb-8">
                <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
                    {t('auth.register.title', undefined, undefined)}
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                    {t('auth.register.hasAccount', undefined, undefined)}{' '}
                    <Link
                        href="/auth/login"
                        className="font-semibold text-teal-600 hover:text-teal-500 transition-colors"
                    >
                        {t('auth.register.signIn', undefined, undefined)}
                    </Link>
                </p>
            </motion.div>

            {error && (
                <motion.div
                    variants={itemVariants}
                    className="mb-6 rounded-xl bg-red-50/50 border border-red-200 p-4"
                >
                    <p className="text-sm font-medium text-red-800">{error}</p>
                </motion.div>
            )}

            {/* Role selector + Google sign-up */}
            <motion.div variants={itemVariants} className="mb-6">
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-3 text-center sm:text-left">
                    {t('auth.register.role.question', undefined, undefined)}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                    {[
                        { id: 'tenant', label: t('auth.register.role.tenant', undefined, undefined), icon: <User className="w-6 h-6" /> },
                        { id: 'landlord', label: t('auth.register.role.landlord', undefined, undefined), icon: <Home className="w-6 h-6" /> },
                        { id: 'property_manager', label: t('auth.register.role.agency', undefined, 'Agency / Property Manager'), icon: <Building className="w-6 h-6" /> },
                    ].map((role) => (
                        <button
                            key={role.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, role: role.id as any })}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                                formData.role === role.id
                                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                                    : 'border-zinc-200 dark:border-zinc-800 hover:border-teal-200 dark:hover:border-teal-800 text-zinc-700 dark:text-zinc-400'
                            }`}
                        >
                            <div className="mb-2 text-zinc-500 dark:text-zinc-400 transition-colors">{role.icon}</div>
                            <span className="text-sm font-medium">{role.label}</span>
                        </button>
                    ))}
                </div>

                <div className="w-full flex justify-center mt-2 mb-2">
                    <div id="google-signup-btn" className="flex justify-center" />
                </div>
                {googleLoading && (
                    <p className="text-sm text-zinc-600 mt-3 text-center animate-pulse">
                        {t('auth.register.connectingGoogle', undefined, undefined)}
                    </p>
                )}
            </motion.div>

            {/* Divider */}
            <motion.div variants={itemVariants} className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-500 dark:text-zinc-400">
                        {t('auth.register.divider', undefined, undefined)}
                    </span>
                </div>
            </motion.div>

            <motion.form
                variants={containerVariants}
                className="space-y-5"
                method="POST"
                onSubmit={handleSubmit}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
                    <motion.div variants={itemVariants} className="col-span-1 sm:col-span-2">
                        <label
                            htmlFor="full_name"
                            className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5"
                        >
                            {t('auth.register.fullName', undefined, undefined)}
                        </label>
                        <input
                            id="full_name"
                            name="full_name"
                            type="text"
                            required
                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                            placeholder={t('common.placeholders.fullName')}
                            value={formData.full_name}
                            onChange={handleChange}
                        />
                    </motion.div>

                    <motion.div variants={itemVariants} className="col-span-1 sm:col-span-2">
                        <label
                            htmlFor="phone"
                            className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5"
                        >
                            {t('auth.register.phone', undefined, undefined)} <span className="text-zinc-400 dark:text-zinc-500 font-normal">{t('auth.register.optional', undefined, undefined)}</span>
                        </label>
                        <input
                            id="phone"
                            name="phone"
                            type="tel"
                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                            placeholder={t('common.placeholders.phone')}
                            value={formData.phone}
                            onChange={handleChange}
                        />
                        <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                            {t('auth.register.phoneDesc', undefined, undefined)}
                        </p>
                    </motion.div>

                    <motion.div variants={itemVariants} className="col-span-1 sm:col-span-2">
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5"
                        >
                            {t('auth.register.email', undefined, undefined)}
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="block w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                            placeholder={t('common.placeholders.email')}
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </motion.div>

                    <motion.div variants={itemVariants} className="col-span-1">
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5"
                        >
                            {t('auth.register.password', undefined, undefined)}
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                required
                                className="block w-full px-4 py-3 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                                placeholder={t('common.placeholders.password')}
                                value={formData.password}
                                onChange={handleChange}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {formData.password && (
                            <p
                                className={`mt-2 text-xs font-medium ${
                                    passwordStrength.valid ? 'text-teal-600' : 'text-amber-500'
                                }`}
                            >
                                {passwordStrength.message}
                            </p>
                        )}
                    </motion.div>

                    <motion.div variants={itemVariants} className="col-span-1">
                        <label
                            htmlFor="confirmPassword"
                            className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5"
                        >
                            {t('auth.register.confirmPassword', undefined, undefined)}
                        </label>
                        <div className="relative">
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                required
                                className="block w-full px-4 py-3 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                                placeholder={t('common.placeholders.password')}
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </motion.div>
                </div>

                <motion.div
                    variants={itemVariants}
                    className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3"
                >
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
                            <label
                                htmlFor="gdprConsent"
                                className="font-medium text-zinc-800 dark:text-zinc-300"
                            >
                                {t('auth.register.accept', undefined, undefined)}{' '}
                                <Link
                                    href="/legal/privacy"
                                    className="text-teal-600 hover:text-teal-500 underline"
                                >
                                    {t('auth.register.privacy', undefined, undefined)}
                                </Link>{' '}
                                {t('auth.register.and', undefined, undefined)}{' '}
                                <Link
                                    href="/legal/terms"
                                    className="text-teal-600 hover:text-teal-500 underline"
                                >
                                    {t('auth.register.terms', undefined, undefined)}
                                </Link>
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
                                {t('auth.register.signingUp', undefined, undefined)}
                            </span>
                        ) : (
                            t('auth.register.signUp', undefined, undefined)
                        )}
                    </button>
                </motion.div>
            </motion.form>
        </motion.div>
    );
}
