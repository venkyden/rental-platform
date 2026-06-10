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
import Image from 'next/image';

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
        sm: { icon: 32, text: 'text-lg', tagline: 'text-xs' },
        md: { icon: 44, text: 'text-2xl', tagline: 'text-sm' },
        lg: { icon: 64, text: 'text-4xl', tagline: 'text-base' },
        xl: { icon: 96, text: 'text-6xl', tagline: 'text-lg' },
    };

    const s = sizes[size] || sizes.md;

    return (
        <div className={`flex items-center gap-4 ${className}`}>
            {/* Logo Mark — Image based */}
            <div
                className={`flex items-center justify-center transition-transform duration-500 hover:scale-105 active:scale-95 ${animate ? 'animate-in zoom-in duration-500' : ''}`}
            >
                <Image
                    src="/images/roomivo-icon.png"
                    alt="Roomivo Logo"
                    width={s.icon}
                    height={s.icon}
                    className="object-contain"
                />
            </div>

            {/* Wordmark */}
            {(variant === 'wordmark' || variant === 'full') && (
                <div className="flex flex-col justify-center">
                    <span className={`${s.text} font-black tracking-tighter leading-none ${
                        theme === 'glass' ? 'text-white' : 'text-zinc-900 dark:text-white'
                    }`}>
                        Roomivo
                    </span>
                    {variant === 'full' && (
                        <p className={`${s.tagline} font-bold text-gold mt-1 uppercase tracking-[0.2em]`}>
                            Premium Rentals
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
