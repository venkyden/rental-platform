'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const COOKIE_CONSENT_KEY = 'roomivo_cookie_consent';

type ConsentState = {
    essential: true; // always true
    analytics: boolean;
    preferences: boolean;
};

function getStoredConsent(): ConsentState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        // ignore parse errors
    }
    return null;
}

function storeConsent(consent: ConsentState) {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
}

export default function CookieConsentBanner() {
    const [visible, setVisible] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [analytics, setAnalytics] = useState(false);
    const [preferences, setPreferences] = useState(true);

    useEffect(() => {
        const stored = getStoredConsent();
        if (!stored) {
            setVisible(true);
        }
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

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                {/* Main banner */}
                <div className="p-5">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl" aria-hidden="true">🍪</span>
                        <div className="flex-1">
                            <h3 className="text-base font-semibold text-gray-900 mb-1">
                                Cookie Preferences
                            </h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Roomivo uses cookies to ensure essential functionality and, with your consent,
                                for analytics to improve the platform. See our{' '}
                                <Link href="/privacy" className="text-blue-600 hover:underline">
                                    Privacy Policy
                                </Link>{' '}
                                for details.
                            </p>
                        </div>
                    </div>

                    {/* Expandable details */}
                    {showDetails && (
                        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                            {/* Essential — always on */}
                            <label className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-medium text-gray-900">Essential</span>
                                    <p className="text-xs text-gray-500">Authentication, security, core features</p>
                                </div>
                                <div className="relative">
                                    <input type="checkbox" checked disabled className="sr-only" />
                                    <div className="w-10 h-5 bg-blue-500 rounded-full cursor-not-allowed">
                                        <div className="w-4 h-4 bg-white rounded-full shadow transform translate-x-5 translate-y-0.5" />
                                    </div>
                                </div>
                            </label>

                            {/* Analytics */}
                            <label className="flex items-center justify-between cursor-pointer">
                                <div>
                                    <span className="text-sm font-medium text-gray-900">Analytics</span>
                                    <p className="text-xs text-gray-500">Usage statistics, page performance</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={analytics}
                                    onClick={() => setAnalytics(!analytics)}
                                    className={`w-10 h-5 rounded-full transition-colors ${analytics ? 'bg-blue-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform translate-y-0.5 ${analytics ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </label>

                            {/* Preferences */}
                            <label className="flex items-center justify-between cursor-pointer">
                                <div>
                                    <span className="text-sm font-medium text-gray-900">Preferences</span>
                                    <p className="text-xs text-gray-500">Language, display settings</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={preferences}
                                    onClick={() => setPreferences(!preferences)}
                                    className={`w-10 h-5 rounded-full transition-colors ${preferences ? 'bg-blue-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform translate-y-0.5 ${preferences ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </label>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            onClick={acceptAll}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Accept All
                        </button>
                        <button
                            onClick={rejectOptional}
                            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Essential Only
                        </button>
                        {showDetails ? (
                            <button
                                onClick={saveCustom}
                                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Save Preferences
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowDetails(true)}
                                className="px-4 py-2 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
                            >
                                Customize
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
