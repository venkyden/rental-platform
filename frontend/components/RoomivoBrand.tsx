"use client";

import React from 'react';
import Image from 'next/image';
import { useLanguage } from '@/lib/LanguageContext';

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
    const { t } = useLanguage();

    /* ── Size presets ── */
    const sizes = {
        sm: {
            iconSize: 38,
            iconClass: 'w-[38px] h-[38px]',
            textSize: 'text-xl sm:text-2xl',
            taglineSize: 'text-[9px]',
            gap: 'gap-3'
        },
        md: {
            iconSize: 52,
            iconClass: 'w-[52px] h-[52px]',
            textSize: 'text-3xl',
            taglineSize: 'text-xs',
            gap: 'gap-4'
        },
        lg: {
            iconSize: 76,
            iconClass: 'w-[76px] h-[76px]',
            textSize: 'text-4xl',
            taglineSize: 'text-sm',
            gap: 'gap-5'
        },
        xl: {
            iconSize: 112,
            iconClass: 'w-[112px] h-[112px]',
            textSize: 'text-6xl',
            taglineSize: 'text-lg',
            gap: 'gap-6'
        }
    };

    const s = sizes[size] || sizes.md;
    const animClass = animate ? 'animate-in zoom-in duration-500' : '';

    // Adaptive theme class for text color
    // theme === 'dark' means dark text (for light backgrounds)
    // theme === 'light' or 'glass' means light text (for dark/glass backgrounds)
    const textThemeClass = theme === 'dark'
        ? 'bg-clip-text text-transparent bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-700'
        : 'bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-300';

    return (
        <div className={`flex items-center ${s.gap} ${className}`}>
            {/* Logo Mark — Cropped Gold Icon */}
            <div className={`${s.iconClass} flex items-center justify-center shrink-0 transition-transform duration-500 hover:scale-105 active:scale-95 ${animClass}`}>
                <Image
                    src="/images/roomivo-icon.png"
                    alt="Roomivo"
                    width={s.iconSize}
                    height={s.iconSize}
                    className="w-full h-full object-contain"
                    priority
                />
            </div>

            {/* Wordmark and Tagline */}
            {(variant === 'wordmark' || variant === 'full') && (
                <div className="flex flex-col justify-center leading-none">
                    <span className={`${s.textSize} font-black tracking-tighter ${textThemeClass}`}>
                        Roomivo
                    </span>
                    {variant === 'full' && (
                        <p className={`${s.taglineSize} font-bold text-gold mt-1 uppercase tracking-[0.2em]`}>
                            {t('landing.footer.slogan', undefined, 'Where your heart wants to live')}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
