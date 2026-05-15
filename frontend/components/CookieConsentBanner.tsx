'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { Shield, Cookie, ChevronRight, X, Check } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'roomivo_cookie_consent';

type ConsentState = {
    essential: true;
    analytics: boolean;
    preferences: boolean;
};

function getStoredConsent(): ConsentState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        return null;
    }
    return null;
}

function storeConsent(consent: ConsentState) {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
}

export default function CookieConsentBanner() {
    const { t, language } = useLanguage();
    const [visible, setVisible] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [analytics, setAnalytics] = useState(false);
    const [preferences, setPreferences] = useState(true);

    useEffect(() => {
        const stored = getStoredConsent();
        if (!stored) {
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    // Listen for custom event to reopen settings
    useEffect(() => {
        const handleOpen = () => {
            const stored = getStoredConsent();
            if (stored) {
                setAnalytics(stored.analytics);
                setPreferences(stored.preferences);
            }
            setShowDetails(true);
            setVisible(true);
        };
        window.addEventListener('open-cookie-settings', handleOpen);
        return () => window.removeEventListener('open-cookie-settings', handleOpen);
    }, []);

    const acceptAll = () => {
        const consent: ConsentState = { essential: true, analytics: true, preferences: true };
        storeConsent(consent);
        setVisible(false);
    };

    const rejectOptional = () => {
        const consent: ConsentState = { essential: true, analytics: false, preferences: false };
        storeConsent(consent);
        setVisible(false);
    };

    const saveCustom = () => {
        const consent: ConsentState = { essential: true, analytics, preferences };
        storeConsent(consent);
        setVisible(false);
    };

    const privacyLink = (
        <Link 
            href="/legal/privacy" 
            className="text-zinc-900 font-medium hover:underline decoration-zinc-900/30 underline-offset-4"
        >
            {t('cookies.privacyPolicy')}
        </Link>
    );

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed bottom-6 left-6 right-6 z-[100] pointer-events-none flex justify-center"
                >
                    <div className="w-full max-w-2xl pointer-events-auto overflow-hidden">
                        <div className="bg-white/80 backdrop-blur-xl border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.1)]_20px_50px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden">
                            <div className="p-6 sm:p-8">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-zinc-100 rounded-2xl">
                                        <Cookie className="w-6 h-6 text-zinc-900" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-xl font-semibold text-zinc-900">
                                                {t('cookies.title')}
                                            </h3>
                                            {!showDetails && (
                                                <button 
                                                    onClick={() => setVisible(false)}
                                                    className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-zinc-600 leading-relaxed text-sm sm:text-base">
                                            {t('cookies.description').split('{{privacyLink}}').map((part, i, arr) => (
                                                <span key={i}>
                                                    {part}
                                                    {i < arr.length - 1 && privacyLink}
                                                </span>
                                            ))}
                                        </p>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {showDetails && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-8 space-y-4 pt-6 border-t border-zinc-100">
                                                {/* Essential */}
                                                <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                    <div>
                                                        <span className="block text-sm font-semibold text-zinc-900">{t('cookies.essential.title')}</span>
                                                        <p className="text-xs text-zinc-500">{t('cookies.essential.description')}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
                                                        <Check className="w-3 h-3" />
                                                        {t('common.requiredByLaw')}
                                                    </div>
                                                </div>

                                                {/* Analytics */}
                                                <label className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl transition-colors cursor-pointer group">
                                                    <div>
                                                        <span className="block text-sm font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors">{t('cookies.analytics.title')}</span>
                                                        <p className="text-xs text-zinc-500">{t('cookies.analytics.description')}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={analytics}
                                                        onClick={() => setAnalytics(!analytics)}
                                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 ${analytics ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                                                    >
                                                        <span
                                                            aria-hidden="true"
                                                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${analytics ? 'translate-x-5' : 'translate-x-0'}`}
                                                        />
                                                    </button>
                                                </label>

                                                {/* Preferences */}
                                                <label className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl transition-colors cursor-pointer group">
                                                    <div>
                                                        <span className="block text-sm font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors">{t('cookies.preferences.title')}</span>
                                                        <p className="text-xs text-zinc-500">{t('cookies.preferences.description')}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={preferences}
                                                        onClick={() => setPreferences(!preferences)}
                                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 ${preferences ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                                                    >
                                                        <span
                                                            aria-hidden="true"
                                                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${preferences ? 'translate-x-5' : 'translate-x-0'}`}
                                                        />
                                                    </button>
                                                </label>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
                                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                        <button
                                            onClick={acceptAll}
                                            className="flex-1 sm:flex-none px-6 py-3 bg-zinc-900 text-white text-sm font-bold rounded-2xl hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-900/10"
                                        >
                                            {t('cookies.actions.acceptAll')}
                                        </button>
                                        <button
                                            onClick={showDetails ? saveCustom : rejectOptional}
                                            className="flex-1 sm:flex-none px-6 py-3 bg-white text-zinc-900 text-sm font-semibold rounded-2xl border border-zinc-200 hover:bg-zinc-50 transition-all active:scale-95"
                                        >
                                            {showDetails ? t('cookies.actions.savePreferences') : t('cookies.actions.essentialOnly')}
                                        </button>
                                    </div>
                                    {!showDetails && (
                                        <button
                                            onClick={() => setShowDetails(true)}
                                            className="w-full sm:w-auto px-4 py-2 text-zinc-500 text-sm font-medium hover:text-zinc-900 transition-colors flex items-center justify-center gap-1 group"
                                        >
                                            {t('cookies.actions.customize')}
                                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
