'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
            // In dev, SW can interfere with HMR, but for testing offline mode we might want it.
            // For now, enabled in production or if manually uncommented.
            // actually, let's enable it always for this "Offline Mode" demo context, 
            // but usually we check environment.
            // Let's rely on standard registration.

            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        } else if ('serviceWorker' in navigator) {
            // Enable in dev too for testing the features I just built
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('SW registered (Dev) scope:', registration.scope);
                })
                .catch((err) => console.log('SW Reg Failed', err));
        }
    }, []);

    return null;
}
