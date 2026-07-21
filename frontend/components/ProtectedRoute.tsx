'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import { useGoogleSignIn } from '@/lib/useGoogleSignIn';
import { 
    Eye, EyeOff, User, Home, Building, ChevronRight, 
    ArrowLeft, Check, ShieldCheck, Mail, Lock, ShieldAlert, X 
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import EmailVerificationRequired from './EmailVerificationRequired';

/* ----------------------------------------------------------------
   Framer-motion animations
   ---------------------------------------------------------------- */
const backdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
};

const modalVariants: Variants = {
    hidden: { opacity: 0, y: 80, scale: 0.95 },
    visible: { 
        opacity: 1, 
        y: 0, 
        scale: 1, 
        transition: { type: 'spring', damping: 25, stiffness: 220 } 
    },
    exit: { 
        opacity: 0, 
        y: 60, 
        scale: 0.95, 
        transition: { duration: 0.2 } 
    }
};

const formStepVariants: Variants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

const shakeVariants = {
    error: {
        x: [0, -8, 8, -8, 8, 0],
        transition: { duration: 0.35 }
    }
};

/* ================================================================
   GOOGLE BUTTON WRAPPER COMPONENT
   ================================================================ */
function GoogleModalButton({ 
    mode, 
    onSuccess, 
    onError 
}: { 
    mode: 'signin' | 'signup'; 
    onSuccess: (cred: string) => void; 
    onError: (err: string) => void; 
}) {
    useGoogleSignIn({
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        buttonId: 'google-modal-btn',
        buttonText: mode === 'signin' ? 'signin_with' : 'signup_with',
        onSuccess,
        onError
    });

    return (
        <div className="relative w-full flex justify-center py-1 bg-white border border-zinc-200/80 rounded-2xl hover:border-zinc-300 transition-all select-none">
            <div id="google-modal-btn" className="w-full flex justify-center" />
        </div>
    );
}

/* ================================================================
   PROTECTED ROUTE CONTEXT-PRESERVING MODAL
   ================================================================ */
export default function ProtectedRoute({
    children,
    onClose,
}: {
    children: React.ReactNode;
    onClose?: () => void;
}) {
    const { user, loading, checkAuth } = useAuth();
    const { t, language, setLanguage } = useLanguage();
    const router = useRouter();

    // Modal view states
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [signupStep, setSignupStep] = useState(1);
    
    // Auth inputs state
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    
    const [signupData, setSignupData] = useState({
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
    const [isError, setIsError] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [hadUser, setHadUser] = useState(false);

    useEffect(() => {
        if (user) {
            setHadUser(true);
        }
    }, [user]);

    useEffect(() => {
        if (!onClose) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Ref to ensure Google login uses correct role
    const roleRef = useRef(signupData.role);
    useEffect(() => {
        roleRef.current = signupData.role;
    }, [signupData.role]);

    /* ---------- Helpers & Formatters ---------- */
    const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSignupData(prev => ({
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
        const p = signupData.password;
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
    const strengthColor = strength < 40 
        ? 'bg-red-500' 
        : strength < 80 
        ? 'bg-amber-500' 
        : 'bg-green-500';

    const triggerShake = (msg: string) => {
        setError(msg);
        setIsError(true);
        setTimeout(() => setIsError(false), 500);
    };

    /* ---------- Submit Handlers ---------- */
    const handleGoogleResponse = async (credential: string) => {
        setError('');
        setAuthLoading(true);
        try {
            const roleToUse = mode === 'signup' ? roleRef.current : undefined;
            const result = await apiClient.googleLogin(credential, roleToUse);
            await checkAuth();
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            triggerShake(typeof detail === 'string' ? detail : t('auth.login.error.googleFail', undefined, 'Google authentication failed'));
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!loginEmail || !loginPassword) {
            triggerShake(t('auth.login.error.required', undefined, 'All fields are required'));
            return;
        }

        setAuthLoading(true);
        try {
            await apiClient.login(loginEmail, loginPassword);
            await checkAuth();
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            let msg = t('auth.login.error.loginFail', undefined, 'Invalid email or password');
            if (typeof detail === 'string') msg = detail;
            triggerShake(msg);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleSignupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (signupData.password !== signupData.confirmPassword) {
            triggerShake(t('auth.register.error.mismatch', undefined, 'Passwords do not match'));
            return;
        }
        if (strength < 80) {
            triggerShake(t('auth.register.error.security', undefined, 'Please use a stronger password'));
            return;
        }
        if (!signupData.gdprConsent) {
            triggerShake(t('auth.register.error.privacy', undefined, 'You must accept the privacy policy'));
            return;
        }

        setAuthLoading(true);
        try {
            await apiClient.register({
                email: signupData.email,
                password: signupData.password,
                full_name: signupData.full_name,
                phone: signupData.phone || undefined,
                role: signupData.role,
                marketing_consent: signupData.marketingConsent,
            });
            await apiClient.login(signupData.email, signupData.password);
            await checkAuth();
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            triggerShake(typeof detail === 'string' ? detail : t('auth.register.error.fail', undefined, 'Registration failed'));
        } finally {
            setAuthLoading(false);
        }
    };

    /* ---------- Navigation Step Checks ---------- */
    const handleNextStep = () => {
        setError('');
        if (signupStep === 1) {
            setSignupStep(2);
            return;
        }
        if (signupStep === 2) {
            if (!signupData.full_name || !signupData.email) {
                triggerShake(t('auth.register.error.required', undefined, 'Name and Email are required'));
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email)) {
                triggerShake(t('auth.register.error.emailInvalid', undefined, 'Please enter a valid email'));
                return;
            }
            setSignupStep(3);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative overflow-hidden">
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-900/5 blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-900/5 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
                </div>
                
                <div className="relative z-10 text-center">
                    <div className="relative w-12 h-12 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-2 border-zinc-200" />
                        <div className="absolute inset-0 rounded-full border-2 border-t-zinc-950 animate-spin" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                        {t('emailVerification.loading', undefined, 'Loading...')}
                    </p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="relative min-h-screen">
                {/* Underneath page rendered completely blurred and unresponsive */}
                <div className="filter blur-md pointer-events-none select-none overflow-hidden h-screen">
                    {hadUser ? children : (
                        <div className="min-h-screen bg-zinc-50 relative overflow-hidden flex flex-col justify-between p-8">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 animate-pulse" />
                            <div className="flex justify-between items-center w-full max-w-7xl mx-auto relative z-10">
                                <div className="w-24 h-8 bg-zinc-200/50 backdrop-blur-sm animate-pulse rounded-lg" />
                                <div className="w-16 h-8 bg-zinc-200/50 backdrop-blur-sm animate-pulse rounded-full" />
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center space-y-4 relative z-10">
                                <div className="w-48 h-12 bg-zinc-200/50 backdrop-blur-sm animate-pulse rounded-2xl" />
                                <div className="w-full max-w-96 h-6 bg-zinc-200/50 backdrop-blur-sm animate-pulse rounded-xl mx-4" />
                            </div>
                            <div className="flex justify-between items-center w-full max-w-7xl mx-auto text-xs text-zinc-400 font-bold uppercase tracking-wider relative z-10">
                                <span>Roomivo &copy; 2026</span>
                                <span>Secured by Roomivo</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Frost-Glass Auth Backdrop Layer */}
                <AnimatePresence>
                    <motion.div 
                        variants={backdropVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={(e) => {
                            if (e.target === e.currentTarget && onClose) {
                                onClose();
                            }
                        }}
                        className="fixed inset-0 bg-zinc-950/45 backdrop-blur-[10px] z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
                    >
                        <motion.div
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full max-w-lg bg-white border border-zinc-200/80 rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl overflow-hidden relative select-none flex flex-col max-h-[92vh] sm:max-h-none"
                        >
                            {/* Modal Header Actions */}
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-zinc-950 flex items-center justify-center">
                                        <ShieldCheck className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="font-extrabold text-sm text-zinc-900 tracking-tight">{t('auth.modal.secure', undefined, 'Roomivo Secure')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        data-testid={language === 'en' ? 'lang-switch-fr' : 'lang-switch-en'}
                                        onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
                                        className="text-xs font-black text-zinc-500 hover:text-zinc-950 bg-zinc-100 py-1.5 px-3 rounded-full transition-all border border-zinc-200/30"
                                    >
                                        {language === 'en' ? 'FR' : 'EN'}
                                    </button>
                                    {onClose && (
                                        <button
                                            onClick={onClose}
                                            aria-label={t('auth.modal.close', undefined, 'Close authentication modal')}
                                            className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 hover:text-zinc-950 transition-all border border-zinc-200/30"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Main Form container */}
                            <div className="overflow-y-auto flex-1 pr-1 -mr-1">
                                <AnimatePresence mode="wait">
                                    {mode === 'signin' ? (
                                        /* ----------------------------------------------------
                                           SIGN IN VIEW
                                           ---------------------------------------------------- */
                                        <motion.div
                                            key="signin"
                                            variants={formStepVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                            className="space-y-6"
                                        >
                                            <div className="text-center sm:text-left">
                                                <h3 className="text-2xl font-black text-zinc-900 tracking-tight">
                                                    {t('auth.login.title', undefined, 'Welcome Back')}
                                                </h3>
                                                <p className="text-xs font-medium text-zinc-400 mt-1">
                                                    {t('auth.login.sub', undefined, 'Sign in in-context to access this action instantly')}
                                                </p>
                                            </div>

                                            {error && (
                                                <motion.div 
                                                    animate={isError ? "error" : ""}
                                                    variants={shakeVariants}
                                                    className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl flex items-center gap-2"
                                                >
                                                    <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                                                    <span>{error}</span>
                                                </motion.div>
                                            )}

                                            <form onSubmit={handleLoginSubmit} className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">
                                                        {t('auth.login.emailLabel', undefined, 'Email Address')}
                                                    </label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                                        <input
                                                            type="email"
                                                            name="email"
                                                            id="modal-email"
                                                            autoComplete="username"
                                                            value={loginEmail}
                                                            onChange={(e) => setLoginEmail(e.target.value)}
                                                            placeholder="name@example.com"
                                                            className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 text-sm rounded-2xl focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all outline-none"
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                                            {t('auth.login.passwordLabel', undefined, 'Password')}
                                                        </label>
                                                    </div>
                                                    <div className="relative">
                                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                                        <input
                                                            type={showPassword ? 'text' : 'password'}
                                                            name="password"
                                                            id="modal-password"
                                                            autoComplete="current-password"
                                                            value={loginPassword}
                                                            onChange={(e) => setLoginPassword(e.target.value)}
                                                            placeholder="••••••••"
                                                            className="w-full pl-11 pr-11 py-3 bg-zinc-50 border border-zinc-200 text-sm rounded-2xl focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all outline-none"
                                                            required
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-950 transition-colors"
                                                        >
                                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={authLoading}
                                                    className="w-full py-3.5 bg-zinc-950 text-white hover:bg-zinc-900 font-bold text-sm rounded-2xl transition-all shadow-md hover:shadow-zinc-950/10 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {authLoading ? (
                                                        <div className="w-5 h-5 rounded-full border-2 border-zinc-300 border-t-white animate-spin" />
                                                    ) : (
                                                        t('auth.login.submit', undefined, 'Sign In')
                                                    )}
                                                </button>
                                            </form>

                                            <div className="relative flex py-2 items-center">
                                                <div className="flex-grow border-t border-zinc-100"></div>
                                                <span className="flex-shrink mx-4 text-zinc-300 text-xs font-black uppercase tracking-widest">
                                                    {t('auth.login.or', undefined, 'or')}
                                                </span>
                                                <div className="flex-grow border-t border-zinc-100"></div>
                                            </div>

                                            <GoogleModalButton 
                                                mode="signin"
                                                onSuccess={handleGoogleResponse}
                                                onError={triggerShake}
                                            />

                                            <div className="text-center pt-2">
                                                <p className="text-xs text-zinc-500 font-medium">
                                                    {t('auth.login.noAccount', undefined, "Don't have an account?")}{' '}
                                                    <button
                                                        data-testid="switch-to-signup"
                                                        onClick={() => {
                                                            setMode('signup');
                                                            setSignupStep(1);
                                                            setError('');
                                                        }}
                                                        className="font-bold text-zinc-950 hover:underline"
                                                    >
                                                        {t('auth.login.createOne', undefined, 'Create one here')}
                                                    </button>
                                                </p>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        /* ----------------------------------------------------
                                           SIGN UP MULTI-STEP VIEW
                                           ---------------------------------------------------- */
                                        <motion.div
                                            key="signup"
                                            variants={formStepVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                            className="space-y-6"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-2xl font-black text-zinc-900 tracking-tight">
                                                        {signupStep === 1 ? t('auth.register.titles.step1', undefined, 'Choose Account Type') :
                                                         signupStep === 2 ? t('auth.register.titles.step2', undefined, 'Basics First') :
                                                         t('auth.register.titles.step3', undefined, 'Secure Account')}
                                                    </h3>
                                                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mt-1">
                                                        {t('auth.register.step', undefined, 'Step')} {signupStep} / 3
                                                    </p>
                                                </div>
                                                {signupStep > 1 && (
                                                    <button
                                                        onClick={() => setSignupStep(s => s - 1)}
                                                        className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors"
                                                    >
                                                        <ArrowLeft className="w-4 h-4 text-zinc-600" />
                                                    </button>
                                                )}
                                            </div>

                                            {error && (
                                                <motion.div 
                                                    animate={isError ? "error" : ""}
                                                    variants={shakeVariants}
                                                    className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl flex items-center gap-2"
                                                >
                                                    <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                                                    <span>{error}</span>
                                                </motion.div>
                                            )}

                                            {signupStep === 1 && (
                                                /* STEP 1: ROLE SELECTION */
                                                <div className="space-y-3">
                                                    {[
                                                        { role: 'tenant' as const, icon: User, label: t('auth.register.role.tenant', undefined, 'Tenant'), desc: t('auth.register.role.tenantDesc', undefined, 'Find your next home & apply securely with legal French ALUR guarantees') },
                                                        { role: 'landlord' as const, icon: Home, label: t('auth.register.role.landlord', undefined, 'Private Landlord'), desc: t('auth.register.role.landlordDesc', undefined, 'Rent out your listings and generate French ALUR compliant leases seamlessly') },
                                                        { role: 'property_manager' as const, icon: Building, label: t('auth.register.role.manager', undefined, 'Agency / Property Manager'), desc: t('auth.register.role.managerDesc', undefined, 'Manage dynamic portfolio and scale verified applicant workflows') }
                                                    ].map(item => (
                                                        <button
                                                            key={item.role}
                                                            type="button"
                                                            onClick={() => setSignupData(prev => ({ ...prev, role: item.role }))}
                                                            className={`w-full p-4 rounded-2xl border text-left flex items-start gap-4 transition-all relative ${
                                                                signupData.role === item.role
                                                                    ? 'border-zinc-950 bg-zinc-50 shadow-md ring-1 ring-zinc-950'
                                                                    : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
                                                            }`}
                                                        >
                                                            <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                                                                signupData.role === item.role ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-600'
                                                            }`}>
                                                                <item.icon className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1 min-w-0 pr-6">
                                                                <h4 className="font-bold text-sm text-zinc-900 leading-tight">{item.label}</h4>
                                                                <p className="text-xs text-zinc-400 mt-1 leading-normal">{item.desc}</p>
                                                            </div>
                                                            {signupData.role === item.role && (
                                                                <div className="w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center absolute right-4 top-4">
                                                                    <Check className="w-3 h-3 text-white" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}

                                                    <button
                                                        type="button"
                                                        onClick={handleNextStep}
                                                        className="w-full mt-4 py-3.5 bg-zinc-950 text-white hover:bg-zinc-900 font-bold text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5"
                                                    >
                                                        {t('auth.register.continue', undefined, 'Continue')} <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}

                                            {signupStep === 2 && (
                                                /* STEP 2: BASIC INFO */
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">
                                                            {t('auth.register.fullNameLabel', undefined, 'Full Name')}
                                                        </label>
                                                        <div className="relative">
                                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                                            <input
                                                                type="text"
                                                                name="full_name"
                                                                value={signupData.full_name}
                                                                onChange={handleSignupChange}
                                                                placeholder="Jean Dupont"
                                                                className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 text-sm rounded-2xl focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all outline-none"
                                                                required
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">
                                                            {t('auth.register.emailLabel', undefined, 'Email Address')}
                                                        </label>
                                                        <div className="relative">
                                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                                            <input
                                                                type="email"
                                                                name="email"
                                                                value={signupData.email}
                                                                onChange={handleSignupChange}
                                                                placeholder="jean.dupont@example.com"
                                                                className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 text-sm rounded-2xl focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all outline-none"
                                                                required
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">
                                                            {t('auth.register.phoneLabel', undefined, 'Phone Number')}
                                                        </label>
                                                        <input
                                                            type="tel"
                                                            name="phone"
                                                            value={signupData.phone}
                                                            onChange={(e) => {
                                                                const formatted = formatPhone(e.target.value);
                                                                setSignupData(prev => ({ ...prev, phone: formatted }));
                                                            }}
                                                            placeholder="+33 6 12 34 56 78"
                                                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 text-sm rounded-2xl focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all outline-none"
                                                        />
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={handleNextStep}
                                                        className="w-full mt-4 py-3.5 bg-zinc-950 text-white hover:bg-zinc-900 font-bold text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-1.5"
                                                    >
                                                        {t('auth.register.continue', undefined, 'Continue')} <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}

                                            {signupStep === 3 && (
                                                /* STEP 3: SECURITY */
                                                <form onSubmit={handleSignupSubmit} className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">
                                                            {t('auth.register.passwordLabel', undefined, 'Password')}
                                                        </label>
                                                        <div className="relative">
                                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                                            <input
                                                                type={showPassword ? 'text' : 'password'}
                                                                name="password"
                                                                value={signupData.password}
                                                                onChange={handleSignupChange}
                                                                placeholder="••••••••"
                                                                className="w-full pl-11 pr-11 py-3 bg-zinc-50 border border-zinc-200 text-sm rounded-2xl focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all outline-none"
                                                                required
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPassword(!showPassword)}
                                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-950"
                                                            >
                                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Password Strength Meter */}
                                                    {signupData.password && (
                                                        <div className="space-y-1.5 px-1">
                                                            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-zinc-400">
                                                                <span>{t('auth.register.strength.label', undefined, 'Strength')}:</span>
                                                                <span className="text-zinc-950">
                                                                    {strength < 40 ? t('auth.register.strength.weak', undefined, 'Weak') :
                                                                     strength < 80 ? t('auth.register.strength.medium', undefined, 'Medium') :
                                                                     t('auth.register.strength.strong', undefined, 'Strong')}
                                                                </span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full ${strengthColor} transition-all duration-300`} 
                                                                    style={{ width: `${strength}%` }}
                                                                />
                                                            </div>
                                                            <p className="text-xs text-zinc-400 leading-normal">
                                                                {t('auth.register.strength.info', undefined, 'Requires at least 8 characters, uppercase, number & symbol')}
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">
                                                            {t('auth.register.confirmPasswordLabel', undefined, 'Confirm Password')}
                                                        </label>
                                                        <div className="relative">
                                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                                            <input
                                                                type={showConfirmPassword ? 'text' : 'password'}
                                                                name="confirmPassword"
                                                                value={signupData.confirmPassword}
                                                                onChange={handleSignupChange}
                                                                placeholder="••••••••"
                                                                className="w-full pl-11 pr-11 py-3 bg-zinc-50 border border-zinc-200 text-sm rounded-2xl focus:bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 transition-all outline-none"
                                                                required
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-950"
                                                            >
                                                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* GDPR checkbox */}
                                                    <div className="space-y-3 pt-2">
                                                        <label className="flex items-start gap-3 cursor-pointer group select-none">
                                                            <div className="relative flex-shrink-0 mt-0.5">
                                                                <input
                                                                    type="checkbox"
                                                                    name="gdprConsent"
                                                                    checked={signupData.gdprConsent}
                                                                    onChange={handleSignupChange}
                                                                    className="sr-only"
                                                                    required
                                                                />
                                                                <div className={`w-4.5 h-4.5 border rounded-md flex items-center justify-center transition-all group-hover:border-zinc-400 ${
                                                                    signupData.gdprConsent ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-zinc-300'
                                                                }`}>
                                                                    <Check className={`w-3.5 h-3.5 text-white transition-transform ${signupData.gdprConsent ? 'scale-100' : 'scale-0'}`} />
                                                                </div>
                                                            </div>
                                                            <span className="text-xs text-zinc-500 leading-snug">
                                                                {t('auth.register.gdpr', undefined, 'I accept the general terms, GDPR & CNIL privacy protection laws.')}
                                                            </span>
                                                        </label>

                                                        <label className="flex items-start gap-3 cursor-pointer group select-none">
                                                            <div className="relative flex-shrink-0 mt-0.5">
                                                                <input
                                                                    type="checkbox"
                                                                    name="marketingConsent"
                                                                    checked={signupData.marketingConsent}
                                                                    onChange={handleSignupChange}
                                                                    className="sr-only"
                                                                />
                                                                <div className={`w-4.5 h-4.5 border rounded-md flex items-center justify-center transition-all group-hover:border-zinc-400 ${
                                                                    signupData.marketingConsent ? 'bg-zinc-950 border-zinc-950' : 'bg-white border-zinc-300'
                                                                }`}>
                                                                    <Check className={`w-3.5 h-3.5 text-white transition-transform ${signupData.marketingConsent ? 'scale-100' : 'scale-0'}`} />
                                                                </div>
                                                            </div>
                                                            <span className="text-xs text-zinc-500 leading-snug">
                                                                {t('auth.register.marketing', undefined, 'Send me regular market updates, legal guidelines and French rental news.')}
                                                            </span>
                                                        </label>
                                                    </div>

                                                    <button
                                                        type="submit"
                                                        disabled={authLoading}
                                                        className="w-full mt-4 py-3.5 bg-zinc-950 text-white hover:bg-zinc-900 font-bold text-sm rounded-2xl transition-all shadow-md active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {authLoading ? (
                                                            <div className="w-5 h-5 rounded-full border-2 border-zinc-300 border-t-white animate-spin" />
                                                        ) : (
                                                            t('auth.register.submit', undefined, 'Create Account')
                                                        )}
                                                    </button>
                                                </form>
                                            )}

                                            <div className="relative flex py-2 items-center">
                                                <div className="flex-grow border-t border-zinc-100"></div>
                                                <span className="flex-shrink mx-4 text-zinc-300 text-xs font-black uppercase tracking-widest">
                                                    {t('auth.login.or', undefined, 'or')}
                                                </span>
                                                <div className="flex-grow border-t border-zinc-100"></div>
                                            </div>

                                            <GoogleModalButton 
                                                mode="signup"
                                                onSuccess={handleGoogleResponse}
                                                onError={triggerShake}
                                            />

                                            <div className="text-center pt-2">
                                                <p className="text-xs text-zinc-500 font-medium">
                                                    {t('auth.register.alreadyHaveAccount', undefined, 'Already have an account?')}{' '}
                                                    <button
                                                        data-testid="switch-to-signin"
                                                        onClick={() => {
                                                            setMode('signin');
                                                            setError('');
                                                        }}
                                                        className="font-bold text-zinc-950 hover:underline"
                                                    >
                                                        {t('auth.register.signIn', undefined, 'Sign in here')}
                                                    </button>
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    // Dynamic hybrid EmailVerificationRequired wrapping
    return (
        <EmailVerificationRequired>
            {children}
        </EmailVerificationRequired>
    );
}
