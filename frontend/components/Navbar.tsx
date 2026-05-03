'use client';

import { useState } from 'react';

import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/lib/ToastContext';
import NotificationBell from '@/components/NotificationBell';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import RoleSwitcher from '@/components/dashboard/RoleSwitcher';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Home, Building2, Search, Mail, ShieldCheck, LogOut } from 'lucide-react';

export default function Navbar() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useLanguage();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navLinks = user ? [
        { href: '/dashboard', label: t('dashboard.title', undefined, undefined), icon: <Home className="w-5 h-5" /> },
        ...(user.role === 'landlord'
            ? [{ href: '/properties', label: t('dashboard.stats.properties', undefined, undefined), icon: <Building2 className="w-5 h-5" /> }]
            : [{ href: '/search', label: t('dashboard.quickActions.browse.title', undefined, undefined), icon: <Search className="w-5 h-5" /> }]),
        { href: '/inbox', label: t('dashboard.inbox.title', undefined, undefined), icon: <Mail className="w-5 h-5" /> },
        { href: '/verification', label: t('dashboard.verification.verification.pageTitle', undefined, undefined), icon: <ShieldCheck className="w-5 h-5" /> },
    ] : [];

    return (
        <header className="sticky top-6 z-50 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-none">
            <div className="glass rounded-[2rem] py-3 px-6 flex justify-between items-center shadow-2xl pointer-events-auto border-white/40 dark:border-zinc-800/50">
                {/* Logo & Brand */}
                <div className="flex items-center gap-8">
                    <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-3 group transition-all active:scale-95">
                        <div className="w-11 h-11 flex items-center justify-center shadow-xl group-hover:scale-110 transition-all duration-300 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl">
                            <span className="text-2xl font-black italic tracking-tighter">R</span>
                        </div>
                        <h1 className="text-2xl font-black tracking-tighter hidden lg:block bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">
                            Roomivo
                        </h1>
                    </Link>

                    {/* Desktop Navigation */}
                    {user && (
                        <nav className="hidden md:flex items-center gap-1 ml-4 p-1 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700/50">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2
                                            ${isActive
                                                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-md scale-100'
                                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                            }`}
                                    >
                                        <span className={isActive ? 'text-teal-500' : ''}>{link.icon}</span>
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    )}
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3 sm:gap-6">
                    <div className="hidden sm:flex items-center gap-4">
                        {user && (
                            <>
                                <RoleSwitcher 
                                    currentRole={user.role} 
                                    availableRoles={user.available_roles || ["tenant"]} 
                                />
                                <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800"></div>
                            </>
                        )}
                        <LanguageSwitcher />
                    </div>
                    
                    {user ? (
                        <div className="flex items-center gap-4">
                            <NotificationBell />
                            
                            <Link href="/profile" className="flex items-center gap-3 hover:scale-105 transition-all active:scale-95 group">
                                <div className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-white dark:border-zinc-800 shadow-lg bg-zinc-100 dark:bg-zinc-800 flex justify-center items-center group-hover:border-teal-500 transition-colors">
                                    {user.profile_picture_url ? (
                                        <img src={user.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-zinc-500 font-black text-sm">{user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <span className="text-sm font-black text-zinc-900 dark:text-white hidden xl:block uppercase tracking-widest">
                                    {user.full_name?.split(' ')[0]}
                                </span>
                            </Link>

                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="md:hidden p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-90"
                            >
                                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Link href="/auth/login" className="px-6 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all uppercase tracking-widest">
                                {t('landing.signIn', undefined, 'Sign In')}
                            </Link>
                            <Link
                                href="/auth/register"
                                className="btn-primary !py-2.5 !px-6 text-sm !rounded-2xl shadow-teal-500/10"
                            >
                                {t('landing.getStarted', undefined, 'Get Started')}
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Navigation Menu */}
            {user && (
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden border-t border-zinc-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-b-2xl overflow-hidden"
                        >
                            <nav className="p-4 flex flex-col gap-2">
                                {navLinks.map((link) => {
                                    const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={`px-4 py-3 rounded-xl text-base font-semibold flex items-center gap-3 transition-all
                                                ${isActive
                                                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-lg ${isActive ? 'bg-teal-100 dark:bg-teal-900/40' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                                                {link.icon}
                                            </div>
                                            {link.label}
                                        </Link>
                                    );
                                })}
                                
                                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2 mx-2"></div>
                                
                                <div className="flex flex-col gap-4 p-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-zinc-500">{t('dashboard.role.title', undefined, 'Active Role')}</span>
                                        <RoleSwitcher 
                                            currentRole={user.role} 
                                            availableRoles={user.available_roles || ["tenant"]} 
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-zinc-500">{t('common.language', undefined, 'Language')}</span>
                                        <LanguageSwitcher />
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        logout();
                                    }}
                                    className="mt-2 w-full px-4 py-3 rounded-xl text-base font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 flex items-center gap-3"
                                >
                                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
                                        <LogOut className="w-5 h-5" />
                                    </div>
                                    {t('dashboard.logout', undefined, 'Logout')}
                                </button>
                            </nav>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </header>
    );
}
