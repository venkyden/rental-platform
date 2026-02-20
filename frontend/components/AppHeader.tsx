'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import NotificationBell from './NotificationBell';

interface AppHeaderProps {
    title?: string;
    showBack?: boolean;
    showNotifications?: boolean;
}

/**
 * Reusable app header with notification bell.
 * Use this in pages that need notifications.
 * 
 * Usage:
 * <AppHeader title="Dashboard" showNotifications />
 */
export default function AppHeader({
    title,
    showBack = false,
    showNotifications = true
}: AppHeaderProps) {
    const router = useRouter();
    const { user, logout } = useAuth();

    return (
        <header className="glass-card sticky top-0 z-40 border-b border-[var(--card-border)]">
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Left side */}
                    <div className="flex items-center gap-4">
                        {showBack && (
                            <button
                                onClick={() => router.back()}
                                className="text-[var(--gray-500)] hover:text-[var(--foreground)] transition-colors"
                            >
                                ← Back
                            </button>
                        )}
                        {title && (
                            <h1 className="text-xl font-bold text-[var(--foreground)]">{title}</h1>
                        )}
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {showNotifications && user && (
                            <NotificationBell />
                        )}

                        {user && (
                            <div className="flex items-center gap-3">
                                {/* User avatar/name */}
                                <div className="hidden sm:flex items-center gap-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] rounded-full flex items-center justify-center text-white text-sm font-bold">
                                        {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-[var(--gray-700)] max-w-[120px] truncate">
                                        {user.full_name?.split(' ')[0] || user.email.split('@')[0]}
                                    </span>
                                </div>

                                {/* Dropdown menu trigger - simplified for now */}
                                <button
                                    onClick={() => router.push('/settings')}
                                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                                    title="Settings"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
