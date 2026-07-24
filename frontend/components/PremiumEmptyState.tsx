'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface PremiumEmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    actionIcon?: LucideIcon;
}

export default function PremiumEmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    actionIcon: ActionIcon
}: PremiumEmptyStateProps) {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full py-16 px-6 glass-card !p-12 rounded-[3rem] border border-zinc-200/50 flex flex-col items-center justify-center text-center bg-white/50 backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.05)]"
        >
            <div className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center mb-8 shadow-inner ring-1 ring-zinc-900/5">
                <Icon className="w-10 h-10 text-zinc-400" strokeWidth={1.5} />
            </div>
            
            <h3 className="text-2xl font-black tracking-tight text-zinc-900 uppercase mb-3">
                {title}
            </h3>
            
            <p className="text-zinc-500 max-w-sm mb-10 text-sm font-medium leading-relaxed">
                {description}
            </p>
            
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-8 py-4 bg-zinc-900 text-white rounded-full font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl hover:shadow-2xl flex items-center gap-3"
                >
                    {ActionIcon && <ActionIcon className="w-4 h-4" />}
                    {actionLabel}
                </button>
            )}
        </motion.div>
    );
}
