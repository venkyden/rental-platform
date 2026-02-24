'use client';

import React from 'react';
import { motion } from 'framer-motion';
import RoomivoBrand from '@/components/RoomivoBrand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-zinc-950">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white dark:from-teal-900/20 dark:via-zinc-950 dark:to-zinc-950"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-400/10 dark:bg-teal-500/5 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>
            </div>

            {/* Brand Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="z-10 mb-8"
            >
                <RoomivoBrand variant="wordmark" size="lg" />
            </motion.div>

            {/* Auth Card Content */}
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="z-10 w-full max-w-[440px] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 p-8 sm:p-10"
            >
                {children}
            </motion.div>

            {/* Footer Elements */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="z-10 mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400 max-w-sm"
            >
                <p>Find your perfect home with confidence.</p>
                <div className="flex items-center justify-center gap-4 mt-2">
                    <span className="flex items-center gap-1"><span className="text-teal-500">✓</span> Verified</span>
                    <span className="flex items-center gap-1"><span className="text-teal-500">✓</span> Secure</span>
                    <span className="flex items-center gap-1"><span className="text-teal-500">✓</span> Compliant</span>
                </div>
            </motion.div>
        </div>
    );
}
