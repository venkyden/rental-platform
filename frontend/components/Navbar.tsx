'use client';

import { useState, useRef, useEffect } from 'react';

import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/lib/ToastContext';
import NotificationBell from '@/components/NotificationBell';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Home, Building2, Search, Mail, ShieldCheck, LogOut, ChevronDown, User, Settings, Building, CreditCard, Shield } from 'lucide-react';

import RoomivoBrand from './RoomivoBrand';

export default function Navbar() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useLanguage();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSwitching, setIsSwitching] = useState<string | null>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleRoleSwitch = async (role: string) => {
        if (isSwitching) return;
        setIsSwitching(role);
        try {
            await switchRole(role);
            setIsProfileOpen(false);
        } catch (error) {
            console.error('Failed to switch role:', error);
        } finally {
            setIsSwitching(null);
        }
    };


    const navLinks = user ? [
        { href: '/dashboard', label: t('dashboard.title', undefined, 'Dashboard'), icon: <Home className="w-4 h-4" /> },
        ...(user.role === 'landlord'
            ? [{ href: '/properties', label: t('dashboard.stats.properties', undefined, 'Properties'), icon: <Building2 className="w-4 h-4" /> }]
            : [{ href: '/search', label: t('dashboard.quickActions.browse.title', undefined, 'Browse'), icon: <Search className="w-4 h-4" /> }]),
        { href: '/inbox', label: t('dashboard.inbox.title', undefined, 'Inbox'), icon: <Mail className="w-4 h-4" /> },
        { href: '/verification', label: t('dashboard.verification.verification.pageTitle', undefined, 'Verification'), icon: <ShieldCheck className="w-4 h-4" /> },
    ] : [];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 w-full px-4 sm:px-6 lg:px-8 pt-6 pointer-events-none">
            <div className="glass !rounded-full py-2 px-5 flex justify-between items-center shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] pointer-events-auto border-white/40 dark:border-zinc-800/50 max-w-7xl mx-auto">
                {/* Logo & Brand */}
                <div className="flex items-center gap-6">
                    <Link href={user ? "/dashboard" : "/"} className="flex items-center pl-2 transition-all active:scale-95">
                        <RoomivoBrand variant="wordmark" size="sm" animate={false} />
                    </Link>

                    {/* Desktop Navigation */}
                    {user && (
                        <nav className="hidden md:flex items-center gap-1 ml-2 p-1 bg-zinc-900/5 dark:bg-white/5 rounded-full border border-zinc-900/5 dark:border-white/5">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-500 flex items-center gap-2
                                            ${isActive
                                                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl scale-100'
                                                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                            }`}
                                    >
                                        <span className={isActive ? 'text-teal-400 dark:text-teal-500' : ''}>{link.icon}</span>
                                        <span className="hidden lg:block">{link.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>
                    )}
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3 sm:gap-6">
                    <div className="hidden sm:flex items-center gap-4">
                        <LanguageSwitcher />
                    </div>

                    
                    {user ? (
                        <div className="flex items-center gap-3 relative" ref={profileRef}>

                            <NotificationBell />
                            
                            <button 
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className={`flex items-center gap-2 p-1 pr-3 rounded-full transition-all active:scale-95 group border-2 ${isProfileOpen ? 'bg-zinc-100 dark:bg-zinc-800 border-teal-500' : 'bg-transparent border-transparent'}`}
                            >
                                <div className="w-8 h-8 rounded-full overflow-hidden shadow-lg bg-zinc-900 dark:bg-white flex justify-center items-center">
                                    {user.profile_picture_url ? (
                                        <img 
                                            src={user.profile_picture_url} 
                                            alt="Profile" 
                                            crossOrigin="anonymous"
                                            className="w-full h-full object-cover" 
                                        />
                                    ) : (
                                        <span className="text-white dark:text-zinc-900 font-black text-xs">{user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <span className="text-[11px] font-black text-zinc-900 dark:text-white hidden xl:block uppercase tracking-[0.2em] ml-1">
                                    {user.full_name?.split(' ')[0]}
                                </span>
                                <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Profile Dropdown */}
                            <AnimatePresence>
                                {isProfileOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 top-full mt-4 w-72 glass-card !p-2 z-[60] shadow-2xl origin-top-right border-zinc-200/50 dark:border-zinc-700/50"
                                    >
                                        {/* User Info */}
                                        <div className="px-4 py-4 mb-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                                            <p className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider truncate">{user.full_name}</p>
                                            <p className="text-[10px] text-zinc-400 truncate mt-0.5">{user.email}</p>
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                                    user.role === 'tenant' ? 'bg-teal-500/10 text-teal-600' :
                                                    user.role === 'landlord' ? 'bg-blue-500/10 text-blue-600' :
                                                    'bg-purple-500/10 text-purple-600'
                                                }`}>
                                                    {t(`dashboard.roleSwitcher.roles.${user.role}`)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Role Switching */}
                                        {user.available_roles && user.available_roles.length > 1 && (
                                            <div className="py-2 border-b border-zinc-100 dark:border-zinc-800 mb-2">
                                                <p className="px-4 py-2 text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                                    {t('dashboard.roleSwitcher.switchTo')}
                                                </p>
                                                {user.available_roles.filter(r => r !== user.role).map(role => (
                                                    <button
                                                        key={role}
                                                        onClick={() => handleRoleSwitch(role)}
                                                        disabled={!!isSwitching}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group"
                                                    >
                                                        <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 group-hover:bg-white dark:group-hover:bg-zinc-600 transition-colors">
                                                            {role === 'tenant' ? <Home className="w-3.5 h-3.5 text-teal-600" /> :
                                                             role === 'landlord' ? <User className="w-3.5 h-3.5 text-blue-600" /> :
                                                             <Building className="w-3.5 h-3.5 text-purple-600" />}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white uppercase tracking-wider">
                                                            {t(`dashboard.roleSwitcher.roles.${role}`)}
                                                        </span>
                                                        {isSwitching === role && (
                                                            <div className="ml-auto w-3 h-3 border-2 border-zinc-300 border-t-zinc-800 animate-spin rounded-full"></div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Links */}
                                        <div className="space-y-1">
                                            <Link 
                                                href="/settings/account" 
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group"
                                            >
                                                <Settings className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                                                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white uppercase tracking-wider">
                                                    {t('settings.title', undefined, 'Settings')}
                                                </span>
                                            </Link>
                                            <Link 
                                                href="/verification" 
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group"
                                            >
                                                <Shield className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
                                                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white uppercase tracking-wider">
                                                    {t('dashboard.verification.title', undefined, 'Verification')}
                                                </span>
                                            </Link>
                                        </div>

                                        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                            <button
                                                onClick={() => {
                                                    setIsProfileOpen(false);
                                                    logout();
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group text-red-600"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                <span className="text-[11px] font-black uppercase tracking-widest">
                                                    {t('dashboard.logout', undefined, 'Logout')}
                                                </span>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>



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
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            className="md:hidden mt-4 glass !rounded-[2rem] overflow-hidden shadow-2xl pointer-events-auto border-white/20 dark:border-zinc-800/50 max-w-lg mx-auto"
                        >
                            <nav className="p-6 flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-3">
                                    {navLinks.map((link) => {
                                        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                                        return (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`p-4 rounded-2xl text-xs font-black uppercase tracking-widest flex flex-col items-center gap-3 transition-all
                                                    ${isActive
                                                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl'
                                                        : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                                    }`}
                                            >
                                                <div className={`${isActive ? 'text-teal-400' : 'text-zinc-400'}`}>
                                                    {link.icon}
                                                </div>
                                                {link.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                                
                                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2"></div>
                                
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('dashboard.role.title', undefined, 'Active Role')}</span>
                                        <RoleSwitcher 
                                            currentRole={user.role} 
                                            availableRoles={user.available_roles || ["tenant"]} 
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('common.language', undefined, 'Language')}</span>
                                        <LanguageSwitcher />
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        logout();
                                    }}
                                    className="w-full p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 flex items-center justify-center gap-3 shadow-sm hover:bg-red-100 transition-all"
                                >
                                    <LogOut className="w-4 h-4" />
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
