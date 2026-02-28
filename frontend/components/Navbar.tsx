'use client';

import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/lib/ToastContext';
import NotificationBell from '@/components/NotificationBell';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Link from 'next/link';

export default function Navbar() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useLanguage();

    if (!user) return null;

    const navLinks = [
        { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
        { href: '/properties', label: 'Properties', icon: '🏢' },
        { href: '/inbox', label: 'Inbox', icon: '📬' },
        { href: '/verification', label: 'Verification', icon: '✅' },
    ];

    return (
        <header className="sticky top-0 z-50 mb-6 w-full rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 mt-4">
            <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                {/* Logo & Brand */}
                <div className="flex items-center gap-8">
                    <Link href="/dashboard" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform" style={{ borderRadius: 10, background: 'linear-gradient(135deg, #3DD6D0, #22B8B8)' }}>
                            <svg width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Roomivo logo">
                                <path d="M32 10L8 30H14V52H50V30H56L32 10Z" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                <circle cx="25" cy="32" r="4.5" fill="white" />
                                <path d="M18 28L25 25L32 28L25 31Z" fill="white" />
                                <line x1="25" y1="28" x2="25" y2="25" stroke="white" strokeWidth="1.5" />
                                <path d="M20 52C20 45 21 40 25 40C29 40 30 45 30 52" fill="white" fillOpacity="0.9" />
                                <circle cx="39" cy="34" r="4" fill="white" fillOpacity="0.85" />
                                <path d="M34 52C34 46 35 42 39 42C43 42 44 46 44 52" fill="white" fillOpacity="0.75" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold hidden sm:block" style={{ color: '#22B8B8' }}>Roomivo</h1>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                                        ${isActive
                                            ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 shadow-sm'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white'
                                        }`}
                                >
                                    <span>{link.icon}</span>
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-4">
                    <LanguageSwitcher />
                    <NotificationBell />

                    <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hidden sm:block">
                            {user.full_name?.split(' ')[0]}
                        </span>
                        <button
                            onClick={logout}
                            title={t('dashboard.logout')}
                            className="p-2 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all duration-200 border border-red-200 dark:border-red-900/30"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
