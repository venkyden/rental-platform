'use client';

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    icon: string | ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    layout?: 'card' | 'transparent';
}

export default function EmptyState({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    layout = 'card'
}: EmptyStateProps) {

    // Animation variants
    const float = {
        rest: { y: 0 },
        hover: {
            y: -10,
            transition: {
                duration: 1.5,
                repeat: Infinity,
                repeatType: "reverse" as const
            }
        }
    };

    const containerStyle = layout === 'card'
        ? "bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-12 text-center max-w-2xl mx-auto transition-colors"
        : "py-16 text-center max-w-lg mx-auto";

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={containerStyle}
        >
            <motion.div
                initial="rest"
                whileHover="hover"
                animate="rest"
                className="inline-block cursor-default"
            >
                <motion.div
                    variants={float}
                    className="w-24 h-24 bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-500/10 dark:to-teal-500/5 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-white dark:ring-zinc-900"
                >
                    <div className="text-5xl text-teal-600 dark:text-teal-400 translate-y-1 flex items-center justify-center">
                        {icon}
                    </div>
                </motion.div>
            </motion.div>

            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">
                {title}
            </h3>

            <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-sm mx-auto leading-relaxed">
                {description}
            </p>

            {actionLabel && onAction && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onAction}
                    className="inline-flex items-center justify-center px-8 py-3.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-500/30 transition-all"
                >
                    {actionLabel}
                </motion.button>
            )}
        </motion.div>
    );
}
