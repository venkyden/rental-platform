'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, FileText, Cookie, Scale, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import RoomivoBrand from '@/components/RoomivoBrand';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { t } = useLanguage();

    const navItems = [
        { name: t('landing.footer.privacy', undefined, 'Privacy Policy'), path: '/legal/privacy', icon: Shield },
        { name: t('landing.footer.terms', undefined, 'Terms of Service'), path: '/legal/terms', icon: FileText },
        { name: t('cookies.title', undefined, 'Cookie Policy'), path: '/legal/cookies', icon: Cookie },
        { name: t('legal.gdpr.title', undefined, 'GDPR Rights'), path: '/legal/gdpr', icon: Scale },
    ];

    return (
        <div className="min-h-screen bg-zinc-50 font-sans selection:bg-zinc-900 selection:text-white">
            {/* Minimal Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link href="/" className="hover:opacity-80 transition-opacity">
                        <RoomivoBrand variant="wordmark" size="sm" animate={false} />
                    </Link>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        {t('dashboard.verification.verification.backToDashboard', undefined, 'Back to Dashboard')}
                    </Link>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex flex-col lg:flex-row gap-12">

                    {/* Sidebar Navigation */}
                    <aside className="lg:w-64 shrink-0">
                        <div className="sticky top-28 space-y-1">
                            <div className="mb-6 px-3">
                                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                    {t('landing.footer.legal', undefined, 'Legal Hub')}
                                </h3>
                            </div>
                            {navItems.map((item) => {
                                const isActive = pathname === item.path;
                                const Icon = item.icon;

                                return (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        className={`relative flex items-center px-3 py-2.5 text-sm font-black rounded-lg transition-colors overflow-hidden uppercase tracking-tighter ${isActive
                                                ? 'text-white'
                                                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                                            }`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="active-legal-nav"
                                                className="absolute inset-0 bg-zinc-900 rounded-lg -z-10 shadow-lg"
                                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                            />
                                        )}
                                        <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 min-w-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 p-8 sm:p-12 overflow-hidden relative">
                            {/* Decorative gradient blur */}
                            <div className="absolute top-0 right-0 -mx-8 -my-8 w-64 h-64 bg-zinc-900/5 rounded-full blur-3xl pointer-events-none" />

                            <motion.div
                                key={pathname}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, ease: 'easeOut' }}
                                className="relative z-10"
                            >
                                {children}
                            </motion.div>
                        </div>
                    </main>

                </div>
            </div>
        </div>
    );
}
