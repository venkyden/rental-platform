/**
 * Roomivo Brand Component
 * 
 * Official Roomivo brand identity: High-fidelity "R" mark in a circular container.
 * 
 * Variants:
 *  - "icon"     → logo mark only (circular R)
 *  - "wordmark" → icon + "Roomivo" text
 *  - "full"     → icon + "Roomivo" + tagline
 */

import React from 'react';

interface RoomivoBrandProps {
    variant?: 'icon' | 'wordmark' | 'full';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    animate?: boolean;
    theme?: 'light' | 'dark' | 'glass';
}

export default function RoomivoBrand({
    variant = 'wordmark',
    size = 'md',
    className = '',
    animate = true,
    theme = 'dark'
}: RoomivoBrandProps) {
    const sizes = {
        sm: { icon: 'w-8 h-8', text: 'text-lg', tagline: 'text-xs', svg: 18, font: 'font-black' },
        md: { icon: 'w-11 h-11', text: 'text-2xl', tagline: 'text-sm', svg: 24, font: 'font-black' },
        lg: { icon: 'w-16 h-16', text: 'text-4xl', tagline: 'text-base', svg: 32, font: 'font-black' },
        xl: { icon: 'w-24 h-24', text: 'text-6xl', tagline: 'text-lg', svg: 48, font: 'font-black' },
    };

    const s = sizes[size] || sizes.md;

    const themeClasses = {
        dark: {
            container: 'bg-zinc-900 text-white',
            text: 'text-zinc-900 dark:text-white',
            mark: 'text-white'
        },
        light: {
            container: 'bg-white text-zinc-900 shadow-xl',
            text: 'text-zinc-900',
            mark: 'text-zinc-900'
        },
        glass: {
            container: 'bg-white/10 backdrop-blur-md border border-white/20 text-white',
            text: 'text-white',
            mark: 'text-white'
        }
    };

    const t = themeClasses[theme];

    return (
        <div className={`flex items-center gap-4 ${className}`}>
            {/* Logo Mark — The circular R */}
            <div
                className={`${s.icon} flex items-center justify-center rounded-full shadow-2xl transition-transform duration-500 hover:scale-110 active:scale-95 ${
                    theme === 'dark' ? 'bg-zinc-900 dark:bg-white' : 'bg-white dark:bg-zinc-900'
                } ${animate ? 'animate-in zoom-in duration-500' : ''}`}
            >
                <span className={`${s.font} italic tracking-tighter ${
                    theme === 'dark' ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-white'
                }`} style={{ fontSize: s.svg }}>
                    R
                </span>
            </div>

            {/* Wordmark */}
            {(variant === 'wordmark' || variant === 'full') && (
                <div className="flex flex-col">
                    <h1 className={`${s.text} font-black tracking-tighter leading-none ${
                        theme === 'glass' ? 'text-white' : 'bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400'
                    }`}>
                        Roomivo
                    </h1>
                    {variant === 'full' && (
                        <p className={`${s.tagline} font-bold text-zinc-500 dark:text-zinc-400 mt-1 uppercase tracking-[0.2em]`}>
                            Premium Rentals
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
