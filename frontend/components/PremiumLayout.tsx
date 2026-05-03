"use client";

import React from 'react';
import Navbar from './Navbar';
import { motion, AnimatePresence } from 'framer-motion';

interface PremiumLayoutProps {
    children: React.ReactNode;
    withNavbar?: boolean;
    className?: string;
}

export default function PremiumLayout({ 
    children, 
    withNavbar = true,
    className = ""
}: PremiumLayoutProps) {
    return (
        <div className={`min-h-screen relative overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-500 ${className}`}>
            {/* Apple-style background mesh */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-100/40 via-zinc-50 to-white dark:from-teal-950/30 dark:via-zinc-950 dark:to-black"></div>
                <div className="absolute top-[-10%] right-[-10%] w-[70vw] h-[70vw] bg-teal-200/20 dark:bg-teal-500/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-200/10 dark:bg-indigo-500/5 rounded-full blur-[100px]"></div>
            </div>

            <AnimatePresence mode="wait">
                <div className="relative z-10 flex flex-col min-h-screen">
                    {withNavbar && <Navbar />}
                    <motion.main 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className={`flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${withNavbar ? 'pt-24 pb-12' : 'py-12'}`}
                    >
                        {children}
                    </motion.main>
                </div>
            </AnimatePresence>
        </div>
    );
}
