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
            className="w-full"
        >
            <motion.div variants={itemVariants} className="text-center mb-10">
                <h2 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter mb-3">
                    {t('auth.register.title', undefined, 'Create Account')}
                </h2>
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                    {t('auth.register.hasAccount', undefined, 'Already part of Roomivo?')}{' '}
                    <Link
                        href="/auth/login"
                        className="text-teal-500 hover:text-teal-400 transition-colors"
                    >
                        {t('auth.register.signIn', undefined, 'Sign In')}
                    </Link>
                </p>
            </motion.div>

            {error && (
                <motion.div
                    variants={itemVariants}
                    className="mb-8 rounded-[2rem] bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-5 flex items-center gap-4"
                >
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-800 dark:text-red-400">{error}</p>
                </motion.div>
            )}

            {/* Role selector */}
            <motion.div variants={itemVariants} className="mb-10">
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 text-center">
                    {t('auth.register.role.question', undefined, 'What describes you best?')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                    {[
                        { id: 'tenant', label: t('auth.register.role.tenant', undefined, 'Tenant'), icon: <User className="w-5 h-5" /> },
                        { id: 'landlord', label: t('auth.register.role.landlord', undefined, 'Landlord'), icon: <Home className="w-5 h-5" /> },
                        { id: 'property_manager', label: t('auth.register.role.agency', undefined, 'Agency'), icon: <Building className="w-5 h-5" /> },
                    ].map((role) => (
                        <button
                            key={role.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, role: role.id as any })}
                            className={`flex flex-col items-center justify-center p-5 rounded-3xl border-2 transition-all duration-500 ${
                                formData.role === role.id
                                    ? 'border-teal-500 bg-teal-500/5 text-teal-600 shadow-xl shadow-teal-500/10'
                                    : 'border-zinc-50 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-800/30 text-zinc-400 hover:border-teal-200'
                            }`}
                        >
                            <div className={`mb-3 p-3 rounded-2xl transition-colors ${formData.role === role.id ? 'bg-teal-500 text-white' : 'bg-white dark:bg-zinc-900 text-zinc-400'}`}>
                                {role.icon}
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest">{role.label}</span>
                        </button>
                    ))}
                </div>

                <div className="w-full flex justify-center mt-2 mb-2">
                    <div id="google-signup-btn" className="flex justify-center transform scale-110" />
                </div>
                {googleLoading && (
                    <p className="text-[10px] font-black text-teal-500 uppercase tracking-[0.2em] mt-6 text-center animate-pulse">
                        {t('auth.register.connectingGoogle', undefined, 'Authenticating with Google...')}
                    </p>
                )}
            </motion.div>

            {/* Divider */}
            <motion.div variants={itemVariants} className="relative mb-10">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-100 dark:border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em]">
                    <span className="bg-white dark:bg-zinc-900 px-6 text-zinc-400">
                        {t('auth.register.divider', undefined, 'OR')}
                    </span>
                </div>
            </motion.div>

            <motion.form
                variants={containerVariants}
                className="space-y-6"
                method="POST"
                onSubmit={handleSubmit}
            >
                <div className="space-y-6">
                    <motion.div variants={itemVariants}>
                        <label
                            htmlFor="full_name"
                            className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 px-1"
                        >
                            {t('auth.register.fullName', undefined, 'Full Name')}
                        </label>
                        <input
                            id="full_name"
                            name="full_name"
                            type="text"
                            required
                            className="block w-full px-6 py-5 rounded-2xl border-none bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/50 transition-all font-bold"
                            placeholder={t('common.placeholders.fullName')}
                            value={formData.full_name}
                            onChange={handleChange}
                        />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <label
                            htmlFor="email"
                            className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 px-1"
                        >
                            {t('auth.register.email', undefined, 'Email Address')}
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="block w-full px-6 py-5 rounded-2xl border-none bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/50 transition-all font-bold"
                            placeholder={t('common.placeholders.email')}
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </motion.div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <motion.div variants={itemVariants}>
                            <label
                                htmlFor="password"
                                className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 px-1"
                            >
                                {t('auth.register.password', undefined, 'Password')}
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    required
                                    className="block w-full px-6 py-5 pr-14 rounded-2xl border-none bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/50 transition-all font-bold text-sm"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-zinc-400 hover:text-teal-500 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 px-1"
                            >
                                {t('auth.register.confirmPassword', undefined, 'Confirm')}
                            </label>
                            <div className="relative">
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    required
                                    className="block w-full px-6 py-5 pr-14 rounded-2xl border-none bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500/50 transition-all font-bold text-sm"
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-zinc-400 hover:text-teal-500 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>

                <motion.div
                    variants={itemVariants}
                    className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4"
                >
                    <div className="flex items-start gap-4">
                        <div className="flex items-center h-6 mt-1">
                            <input
                                id="gdprConsent"
                                name="gdprConsent"
                                type="checkbox"
                                required
                                checked={formData.gdprConsent}
                                onChange={handleChange}
                                className="h-5 w-5 rounded-lg border-zinc-200 text-teal-600 focus:ring-teal-500 transition-all cursor-pointer"
                            />
                        </div>
                        <div className="text-xs font-bold text-zinc-400 leading-relaxed">
                            <label
                                htmlFor="gdprConsent"
                                className="cursor-pointer"
                            >
                                {t('auth.register.accept', undefined, 'I agree to the')}{' '}
                                <Link
                                    href="/legal/privacy"
                                    className="text-teal-500 hover:text-teal-400"
                                >
                                    {t('auth.register.privacy', undefined, 'Privacy Policy')}
                                </Link>{' '}
                                {t('auth.register.and', undefined, '&')}{' '}
                                <Link
                                    href="/legal/terms"
                                    className="text-teal-500 hover:text-teal-400"
                                >
                                    {t('auth.register.terms', undefined, 'Terms of Service')}
                                </Link>
                                <span className="text-red-500"> *</span>
                            </label>
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="pt-4">
                    <button
                        type="submit"
                        disabled={loading || !formData.gdprConsent}
                        className="w-full flex justify-center py-5 px-6 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-zinc-900/10 dark:shadow-white/5"
                    >
                        {loading ? (
                            <span className="flex items-center gap-3">
                                <span className="w-3 h-3 border-2 border-white/30 dark:border-zinc-900/30 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
                                {t('auth.register.signingUp', undefined, 'Creating...')}
                            </span>
                        ) : (
                            t('auth.register.signUp', undefined, 'Create Account')
                        )}
                    </button>
                </motion.div>
            </motion.form>
        </motion.div>
    );
}
