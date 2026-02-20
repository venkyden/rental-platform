/**
 * Roomivo Brand Component
 * 
 * Official Roomivo brand identity: house outline with two people
 * (one wearing a graduation cap) inside, on a teal gradient background.
 * 
 * Variants:
 *  - "icon"     → logo mark only
 *  - "wordmark" → icon + "Roomivo" text
 *  - "full"     → icon + "Roomivo" + tagline
 */

interface RoomivoBrandProps {
    variant?: 'icon' | 'wordmark' | 'full';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    animate?: boolean;
}

export default function RoomivoBrand({
    variant = 'wordmark',
    size = 'md',
    className = '',
    animate = true,
}: RoomivoBrandProps) {
    const sizes = {
        sm: { icon: 'w-9 h-9', text: 'text-lg', tagline: 'text-xs', svg: 24, radius: 8 },
        md: { icon: 'w-14 h-14', text: 'text-2xl', tagline: 'text-sm', svg: 36, radius: 12 },
        lg: { icon: 'w-20 h-20', text: 'text-4xl', tagline: 'text-base', svg: 52, radius: 16 },
    };

    const s = sizes[size];

    return (
        <div className={`flex flex-col items-center gap-2 ${className}`}>
            {/* Logo Mark — House + People + Graduation Cap */}
            <div
                className={`${s.icon} flex items-center justify-center shadow-lg ${animate ? 'animate-bounce-in' : ''
                    }`}
                style={{ borderRadius: s.radius, background: 'linear-gradient(135deg, #3DD6D0, #22B8B8)' }}
            >
                <svg
                    width={s.svg}
                    height={s.svg}
                    viewBox="0 0 64 64"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="Roomivo logo"
                >
                    {/* House outline — roof */}
                    <path
                        d="M32 10L8 30H14V52H50V30H56L32 10Z"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />

                    {/* Left person (with graduation cap) */}
                    {/* Head */}
                    <circle cx="25" cy="32" r="4.5" fill="white" />
                    {/* Graduation cap */}
                    <path
                        d="M18 28L25 25L32 28L25 31Z"
                        fill="white"
                    />
                    <line x1="25" y1="28" x2="25" y2="25" stroke="white" strokeWidth="1.5" />
                    {/* Body */}
                    <path
                        d="M20 52C20 45 21 40 25 40C29 40 30 45 30 52"
                        fill="white"
                        fillOpacity="0.9"
                    />

                    {/* Right person */}
                    {/* Head */}
                    <circle cx="39" cy="34" r="4" fill="white" fillOpacity="0.85" />
                    {/* Body */}
                    <path
                        d="M34 52C34 46 35 42 39 42C43 42 44 46 44 52"
                        fill="white"
                        fillOpacity="0.75"
                    />
                </svg>
            </div>

            {/* Wordmark */}
            {(variant === 'wordmark' || variant === 'full') && (
                <div className="text-center">
                    <h1 className={`${s.text} font-bold tracking-tight`}>
                        <span style={{ color: '#22B8B8' }}>Roomivo</span>
                    </h1>
                    {variant === 'full' && (
                        <p className={`${s.tagline} text-[var(--gray-500)] mt-0.5`}>
                            Your first step to settling in
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
