'use client';

import React from 'react';
import { motion } from 'framer-motion';
import RoomivoBrand from '@/components/RoomivoBrand';
import PremiumLayout from '@/components/PremiumLayout';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <PremiumLayout>
            <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-6 overflow-hidden bg-white dark:bg-zinc-950">
                {/* Mesh Gradient Background */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-teal-500/10 blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
                    <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-emerald-500/5 blur-[100px]" />
                </div>

                {/* Content Container */}
                <div className="relative z-10 w-full max-w-[1200px] flex flex-col items-center">
                    {/* Brand Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="mb-12"
                    >
                        <RoomivoBrand variant="logo" size="xl" />
                    </motion.div>

                    {/* Auth Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                        className="w-full max-w-[480px]"
                    >
                        <div className="glass-card !p-10 md:!p-14 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border-white/40 dark:border-zinc-800/50 rounded-[3rem]">
                            {children}
                        </div>
                    </motion.div>

                    {/* Footer Elements */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.8 }}
                        className="mt-16 text-center"
                    >
                        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
                            {[
                                { label: 'Bank-Grade Security', icon: 'SHIELD' },
                                { label: 'Verified Profiles', icon: 'CHECK' },
                                { label: 'Privacy Protected', icon: 'LOCK' }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </PremiumLayout>
    );
}
