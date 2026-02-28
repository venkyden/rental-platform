'use client';

import React from 'react';
import { motion } from 'framer-motion';
import RoomivoBrand from '@/components/RoomivoBrand';
import PremiumLayout from '@/components/PremiumLayout';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <PremiumLayout>
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-2rem)]">
                {/* Brand Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8"
                >
                    <RoomivoBrand variant="wordmark" size="lg" />
                </motion.div>

                {/* Auth Card Content */}
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-full max-w-[440px] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 p-8 sm:p-10"
                >
                    {children}
                </motion.div>

                {/* Footer Elements */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400 max-w-sm"
                >
                    <p>Your first step to settling in.</p>
                    <div className="flex items-center justify-center gap-4 mt-2">
                        <span className="flex items-center gap-1"><span className="text-teal-500">✓</span> Verified</span>
                        <span className="flex items-center gap-1"><span className="text-teal-500">✓</span> Secure</span>
                        <span className="flex items-center gap-1"><span className="text-teal-500">✓</span> Compliant</span>
                    </div>
                </motion.div>
            </div>
        </PremiumLayout>
    );
}

