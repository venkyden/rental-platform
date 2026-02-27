'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieConsent() {
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        // Check if user has already consented
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) {
            // Delay showing banner for better UX
            setTimeout(() => setShowBanner(true), 1000);
        }
    }, []);

    const handleAcceptAll = () => {
        localStorage.setItem('cookieConsent', JSON.stringify({
            necessary: true,
            analytics: true,
            marketing: true,
            timestamp: new Date().toISOString(),
        }));
        setShowBanner(false);
    };

    const handleAcceptNecessary = () => {
        localStorage.setItem('cookieConsent', JSON.stringify({
            necessary: true,
            analytics: false,
            marketing: false,
            timestamp: new Date().toISOString(),
        }));
        setShowBanner(false);
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 p-4 sm:p-6">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        🍪 We use cookies
                    </h3>
                    <p className="text-sm text-gray-600">
                        We use cookies to improve your experience. By continuing to use this site,
                        you agree to our use of cookies in accordance with our{' '}
                        <Link href="/legal/privacy" className="text-blue-600 hover:underline">
                            Privacy Policy
                        </Link>.
                    </p>
                </div>
                <div className="flex gap-3 shrink-0">
                    <button
                        onClick={handleAcceptNecessary}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Necessary Only
                    </button>
                    <button
                        onClick={handleAcceptAll}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Accept All
                    </button>
                </div>
            </div>
        </div>
    );
}
