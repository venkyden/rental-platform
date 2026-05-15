'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, User, Home, Building, ChevronRight, ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { useGoogleSignIn } from '@/lib/useGoogleSignIn';

/* ----------------------------------------------------------------
   Framer-motion variants
   ---------------------------------------------------------------- */
const containerVariants: Variants = {
    hidden: { opacity: 0, x: 20 },
    show: { opacity: 1, x: 0, transition: { staggerChildren: 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

/* ================================================================
   REGISTER PAGE
   ================================================================ */
export default function RegisterPage() {
    const [step, setStep] = useState(1);
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
    const [googleLoading, setGoogleLoading] = useState(false);
    const { t } = useLanguage();
    const router = useRouter();

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
                setError(typeof detail === 'string' ? detail : t('auth.login.error.googleFail', undefined, 'Google authentication failed'));
            } finally {
                setGoogleLoading(false);
            }
        },
        [router, t],
    );

    useGoogleSignIn({
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        buttonId: 'google-signup-btn',
        buttonText: 'signup_with',
        onSuccess: handleGoogleResponse,
        onError: (msg: string) => {
            if (!msg.includes('script')) setError(msg);
        },
    });

    /* ---------- Helpers ---------- */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const formatPhone = (val: string) => {
        const cleaned = val.replace(/\D/g, '');
        if (cleaned.startsWith('33')) {
            const part = cleaned.slice(2, 11);
            const matches = part.match(/.{1,2}/g);
            return `+33 ${matches ? matches.join(' ') : ''}`.trim();
        }
        return cleaned;
    };

    const getPasswordStrength = () => {
        const p = formData.password;
        if (!p) return 0;
        let score = 0;
        if (p.length >= 8) score += 20;
        if (/[A-Z]/.test(p)) score += 20;
        if (/[a-z]/.test(p)) score += 20;
        if (/[0-9]/.test(p)) score += 20;
        if (/[^A-Za-z0-9]/.test(p)) score += 20;
        return score;
    };

    const strength = getPasswordStrength();
    const strengthColor = strength < 40 ? 'bg-zinc-200' : strength < 80 ? 'bg-zinc-500' : 'bg-zinc-900';

    const nextStep = () => {
        setError('');
        if (step === 2) {
            if (!formData.full_name || !formData.email) {
                setError(t('auth.register.error.required', undefined, 'Name and Email are required'));
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                setError(t('auth.register.error.emailInvalid', undefined, 'Please enter a valid email'));
                return;
            }
        }
        setStep(s => s + 1);
    };

    const prevStep = () => setStep(s => s - 1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError(t('auth.register.error.mismatch', undefined, 'Passwords do not match'));
            return;
        }
        if (strength < 80) {
            setError(t('auth.register.error.security', undefined, 'Please use a stronger password'));
            return;
        }
        if (!formData.gdprConsent) {
            setError(t('auth.register.error.privacy', undefined, 'You must accept the privacy policy'));
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
            const loginRes = await apiClient.login(formData.email, formData.password);
            router.push(loginRes.redirect_path || '/dashboard');
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : t('auth.register.error.fail', undefined, 'Registration failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            {/* Header */}
            <div className="text-center mb-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        <h2 className="text-4xl font-black text-zinc-900 tracking-tighter mb-2">
                            {step === 1 ? t('auth.register.title.step1', undefined, 'Who are you?') :
                             step === 2 ? t('auth.register.title.step2', undefined, 'Basics First') :
                             t('auth.register.title.step3', undefined, 'Security')}
                        </h2>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                            {t('auth.register.step', undefined, 'Step')} {step} / 3
                        </p>
                    </motion.div>
                </AnimatePresence>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-8 rounded-3xl bg-zinc-900 p-4 flex items-center gap-3 shadow-xl shadow-zinc-900/20"
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-white">{error}</p>
                </motion.div>
            )}

            <form onSubmit={handleSubmit}>
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { id: 'tenant', label: t('auth.register.role.tenant', undefined, 'Tenant'), icon: <User />, desc: 'Finding a dream home' },
                                    { id: 'landlord', label: t('auth.register.role.landlord', undefined, 'Landlord'), icon: <Home />, desc: 'Rent out properties' },
                                    { id: 'property_manager', label: t('auth.register.role.agency', undefined, 'Agency'), icon: <Building />, desc: 'Manage portfolios' },
                                ].map((role) => (
                                    <button
                                        key={role.id}
                                        type="button"
                                        onClick={() => {
                                            setFormData(p => ({ ...p, role: role.id as any }));
                                            setTimeout(nextStep, 300);
                                        }}
                                        className={`group relative flex items-center gap-5 p-6 rounded-[2rem] border-2 transition-all duration-500 text-left ${
                                            formData.role === role.id
                                                ? 'border-zinc-900 bg-zinc-900/5 shadow-2xl shadow-zinc-900/10'
                                                : 'border-zinc-50 bg-zinc-50/50 hover:border-zinc-200'
                                        }`}
                                    >
                                        <div className={`p-4 rounded-2xl transition-all duration-500 ${
                                            formData.role === role.id ? 'bg-zinc-900 text-white rotate-12 scale-110' : 'bg-white text-zinc-400 group-hover:scale-110'
                                        }`}>
                                            {React.cloneElement(role.icon as React.ReactElement<any>, { size: 24, strokeWidth: 2.5 })}
                                        </div>
                                        <div>
                                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${formData.role === role.id ? 'text-zinc-900' : 'text-zinc-900'}`}>
                                                {role.label}
                                            </p>
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight opacity-70">{role.desc}</p>
                                        </div>
                                        {formData.role === role.id && (
                                            <motion.div layoutId="active-role" className="absolute right-6">
                                                <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center">
                                                    <Check className="text-white w-3 h-3" strokeWidth={4} />
                                                </div>
                                            </motion.div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="pt-6">
                                <div id="google-signup-btn" className="flex justify-center transform scale-110" />
                                {googleLoading && <p className="text-[9px] font-black text-zinc-900 text-center mt-4 animate-pulse uppercase tracking-widest">Verifying Google...</p>}
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="space-y-6"
                        >
                            <div className="space-y-4">
                                <motion.div variants={itemVariants}>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
                                        {t('auth.register.fullName', undefined, 'Full Name')}
                                    </label>
                                    <input
                                        name="full_name"
                                        type="text"
                                        required
                                        value={formData.full_name}
                                        onChange={handleChange}
                                        placeholder={t('common.placeholders.fullName', undefined, 'John Doe')}
                                        className="w-full px-6 py-5 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900"
                                    />
                                </motion.div>

                                <motion.div variants={itemVariants}>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
                                        {t('auth.register.email', undefined, 'Email')}
                                    </label>
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder={t('common.placeholders.email', undefined, 'name@example.com')}
                                        className="w-full px-6 py-5 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900"
                                    />
                                </motion.div>

                                <motion.div variants={itemVariants}>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
                                        {t('auth.register.phone', undefined, 'Phone Number')}
                                    </label>
                                    <input
                                        name="phone"
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                                        placeholder="+33 6 12 34 56 78"
                                        className="w-full px-6 py-5 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900"
                                    />
                                </motion.div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={prevStep} className="p-5 rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors">
                                    <ArrowLeft size={20} strokeWidth={3} />
                                </button>
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="flex-1 py-5 rounded-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 group"
                                >
                                    {t('common.continue', undefined, 'Continue')}
                                    <ChevronRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step3"
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="space-y-6"
                        >
                            <div className="space-y-4">
                                <motion.div variants={itemVariants}>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
                                        {t('auth.register.password', undefined, 'Security Lock')}
                                    </label>
                                    <div className="relative">
                                        <input
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={formData.password}
                                            onChange={handleChange}
                                            placeholder="••••••••"
                                            className="w-full px-6 py-5 pr-14 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900"
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 inset-y-0 text-zinc-300 hover:text-zinc-900 transition-colors">
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    {/* Strength Bar */}
                                    <div className="mt-3 px-1">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Security Strength</p>
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${strengthColor.replace('bg-', 'text-')}`}>
                                                {strength === 100 ? 'Industrial Grade' : strength >= 60 ? 'Secure' : 'Weak'}
                                            </p>
                                        </div>
                                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${strength}%` }}
                                                className={`h-full ${strengthColor} transition-colors duration-500`}
                                            />
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div variants={itemVariants}>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
                                        {t('auth.register.confirmPassword', undefined, 'Confirm Lock')}
                                    </label>
                                    <div className="relative">
                                        <input
                                            name="confirmPassword"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            required
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            placeholder="••••••••"
                                            className="w-full px-6 py-5 pr-14 rounded-2xl bg-zinc-50 border-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-zinc-900"
                                        />
                                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-5 inset-y-0 text-zinc-300 hover:text-zinc-900 transition-colors">
                                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </motion.div>

                                <motion.div variants={itemVariants} className="pt-4 space-y-4">
                                    <label className="flex items-start gap-4 cursor-pointer group">
                                        <div className="relative flex items-center h-6 mt-0.5">
                                            <input
                                                name="gdprConsent"
                                                type="checkbox"
                                                required
                                                checked={formData.gdprConsent}
                                                onChange={handleChange}
                                                className="peer sr-only"
                                            />
                                            <div className="w-5 h-5 rounded-lg border-2 border-zinc-200 peer-checked:border-zinc-900 peer-checked:bg-zinc-900 transition-all flex items-center justify-center">
                                                <Check className="text-white w-3 h-3 opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={4} />
                                            </div>
                                        </div>
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight leading-relaxed group-hover:text-zinc-600 transition-colors">
                                            {t('auth.register.accept', undefined, 'I agree to the')}{' '}
                                            <Link href="/legal/privacy" className="text-zinc-900 underline underline-offset-4">{t('auth.register.privacy', undefined, 'Privacy Policy')}</Link>
                                        </p>
                                    </label>
                                </motion.div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={prevStep} className="p-5 rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors">
                                    <ArrowLeft size={20} strokeWidth={3} />
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !formData.gdprConsent}
                                    className="flex-1 py-5 rounded-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 relative overflow-hidden"
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            {t('auth.register.signingUp', undefined, 'Securing Account')}
                                        </div>
                                    ) : (
                                        <>
                                            <ShieldCheck size={16} strokeWidth={3} />
                                            {t('auth.register.signUp', undefined, 'Finalize Account')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </form>

            <motion.div variants={itemVariants} className="mt-12 text-center">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    {t('auth.register.hasAccount', undefined, 'Already part of Roomivo?')}{' '}
                    <Link href="/auth/login" className="text-zinc-900 hover:text-zinc-800 transition-colors underline underline-offset-4">
                        {t('auth.register.signIn', undefined, 'Sign In')}
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
