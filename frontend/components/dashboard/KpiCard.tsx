'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KpiCardProps {
    label: string;
    value: string | number;
    delta?: {
        value: string | number;
        isPositive: boolean;
        timeframe?: string;
    };
    icon: React.ReactNode;
    loading?: boolean;
    className?: string;
}

export default function KpiCard({
    label,
    value,
    delta,
    icon,
    loading = false,
    className = ''
}: KpiCardProps) {
    if (loading) {
        return (
            <div className="glass-card !p-8 rounded-[2.5rem] border-zinc-100 shadow-xl relative overflow-hidden animate-pulse">
                <div className="flex items-center justify-between mb-6">
                    <div className="h-4 w-24 bg-zinc-200 rounded-md"></div>
                    <div className="w-10 h-10 bg-zinc-200 rounded-xl"></div>
                </div>
                <div className="h-10 w-16 bg-zinc-300 rounded-xl mb-3"></div>
                <div className="h-3.5 w-32 bg-zinc-200 rounded-md"></div>
            </div>
        );
    }

    return (
        <motion.div
            whileHover={{ y: -8, scale: 1.01 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`glass-card !p-8 rounded-[2.5rem] hover:translate-y-[-8px] transition-all duration-300 group border-zinc-100 shadow-xl relative overflow-hidden ${className}`}
            aria-live="polite"
        >
            <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em]">{label}</span>
                <div className="p-2.5 rounded-xl bg-zinc-50 text-zinc-900 group-hover:scale-110 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-300 shadow-sm">
                    {icon}
                </div>
            </div>
            
            <p className="text-4xl font-black text-zinc-950 mb-3 tracking-tighter">{value}</p>
            
            {delta ? (
                <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${delta.isPositive ? 'text-zinc-900' : 'text-zinc-400'}`}>
                        {delta.isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                        )}
                        {delta.value}
                    </span>
                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">
                        {delta.timeframe || 'vs prev month'}
                    </span>
                </div>
            ) : (
                <div className="h-4" /> // empty spacer
            )}
        </motion.div>
    );
}
