/**
 * Roomivo Brand Component
 * 
 * Official Roomivo brand identity using the actual brand logo assets.
 * 
 * Variants:
 *  - "icon"     → gold circle R mark only (/images/roomivo-icon.png)
 *  - "wordmark" → icon + "Roomivo" text as single image (/images/roomivo-logo.png)
 *  - "full"     → wordmark + tagline text
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
    /* ── Size presets ── */
    const iconSizes = {
        sm: { h: 40,  w: 40  },
        md: { h: 56,  w: 56  },
        lg: { h: 80,  w: 80  },
        xl: { h: 120, w: 120 },
    };

    /* Logo (icon+text) aspect ratio ≈ 2.8:1  */
    const logoSizes = {
        sm: { h: 44,  w: 123 },
        md: { h: 56,  w: 157 },
        lg: { h: 80,  w: 224 },
        xl: { h: 120, w: 336 },
    };

    const taglineSizes = {
        sm: 'text-[10px]',
        md: 'text-xs',
        lg: 'text-sm',
        xl: 'text-lg',
    };

    const animClass = animate ? 'animate-in zoom-in duration-500' : '';

    /* ── Icon-only variant ── */
    if (variant === 'icon') {
        const s = iconSizes[size] || iconSizes.md;
        return (
            <div className={`flex items-center ${className}`}>
                <div className={`transition-transform duration-500 hover:scale-105 active:scale-95 ${animClass}`}>
                    <Image
                        src="/images/roomivo-icon.png"
                        alt="Roomivo"
                        width={s.w}
                        height={s.h}
                        className="object-contain"
                        priority
                    />
                </div>
            </div>
        );
    }

    /* ── Wordmark / Full variant — use the baked logo image ── */
    const s = logoSizes[size] || logoSizes.md;
    return (
        <div className={`flex flex-col items-start ${className}`}>
            <div className={`transition-transform duration-500 hover:scale-[1.03] active:scale-95 ${animClass}`}>
                <Image
                    src="/images/roomivo-logo.png"
                    alt="Roomivo"
                    width={s.w}
                    height={s.h}
                    className="object-contain object-left"
                    priority
                />
            </div>
            {variant === 'full' && (
                <p className={`${taglineSizes[size] || taglineSizes.md} font-bold text-gold mt-1 uppercase tracking-[0.2em]`}>
                    Where your heart wants to live
                </p>
            )}
        </div>
    );
}
