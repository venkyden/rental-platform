'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { ChevronDown, UserCircle, Building, Home, Plus, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

interface RoleSwitcherProps {
    currentRole: string;
    availableRoles: string[];
    onSwitch?: () => void;
}

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string; dashboardPath: string }> = {
    tenant: {
        icon: <Home className="w-4 h-4" />,
        color: 'text-teal-600 dark:text-teal-400',
        bgColor: 'bg-teal-50 dark:bg-teal-900/30',
        dashboardPath: '/dashboard',
    },
    landlord: {
        icon: <UserCircle className="w-4 h-4" />,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/30',
        dashboardPath: '/dashboard/landlord',
    },
    property_manager: {
        icon: <Building className="w-4 h-4" />,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/30',
        dashboardPath: '/dashboard/agency',
    },
};

const UNLOCKABLE_ROLES = ['tenant', 'landlord', 'property_manager'];

export default function RoleSwitcher({ currentRole, availableRoles, onSwitch }: RoleSwitcherProps) {
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState<string | null>(null);
    const [unlocking, setUnlocking] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { t } = useLanguage();

    const currentConfig = ROLE_CONFIG[currentRole] || ROLE_CONFIG.tenant;
    const otherRoles = availableRoles.filter((r) => r !== currentRole && ROLE_CONFIG[r]);
    const lockableRoles = UNLOCKABLE_ROLES.filter((r) => !availableRoles.includes(r));

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function handleSwitch(targetRole: string) {
        if (switching) return;
        setSwitching(targetRole);
        try {
            const data = await apiClient.switchRole(targetRole);
            setOpen(false);
            onSwitch?.();
            if (data.redirect_path) {
                router.push(data.redirect_path);
            }
        } catch (err) {
            console.error('Role switch failed:', err);
        } finally {
            setSwitching(null);
        }
    }

    async function handleUnlock(targetRole: string) {
        if (unlocking) return;
        setUnlocking(true);
        try {
            const data = await apiClient.switchRole(targetRole);
            setOpen(false);
            onSwitch?.();
            if (data.redirect_path) {
                router.push(data.redirect_path);
            }
        } catch (err: any) {
            console.error('Role unlock failed:', err);
            alert('To unlock this role, please sign up again using the role selector on the registration page.');
        } finally {
            setUnlocking(false);
        }
    }

    if (availableRoles.length <= 1 && lockableRoles.length === 0) {
        return null;
    }

    return (
        <div ref={dropdownRef} className="relative">
            {/* Trigger Button - Apple Style Pill */}
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-3 px-4 py-2 bg-zinc-900/5 dark:bg-white/5 hover:bg-zinc-900/10 dark:hover:bg-white/10 rounded-full transition-all duration-300 border border-zinc-900/5 dark:border-white/5 group active:scale-95 shadow-sm"
                id="role-switcher-trigger"
            >
                <div className={`p-1.5 rounded-full bg-white dark:bg-zinc-700 shadow-sm ${currentConfig.color}`}>
                    {currentConfig.icon}
                </div>
                <span className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest hidden sm:inline">
                    {t(`dashboard.roleSwitcher.roles.${currentRole}`)}
                </span>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {open && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute right-0 top-full mt-4 w-72 glass-card !p-2 z-[60] shadow-2xl origin-top-right border-zinc-200/50 dark:border-zinc-700/50"
                    >
                        {/* Current Role */}
                        <div className="px-4 py-3 mb-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">
                                    {t('dashboard.roleSwitcher.currentSession')}
                                </span>
                                <div className={`flex items-center gap-2 ${currentConfig.color}`}>
                                    <span className="font-black text-sm uppercase tracking-wider">
                                        {t(`dashboard.roleSwitcher.roles.${currentRole}`)}
                                    </span>
                                </div>
                            </div>
                            <div className="w-6 h-6 rounded-full bg-teal-500 text-white flex items-center justify-center">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                        </div>

                        {/* Switch Options */}
                        {otherRoles.length > 0 && (
                            <div className="space-y-1 mb-2">
                                <p className="px-4 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                    {t('dashboard.roleSwitcher.switchTo')}
                                </p>
                                {otherRoles.map((role) => {
                                    const config = ROLE_CONFIG[role];
                                    const isSwitching = switching === role;
                                    return (
                                        <button
                                            key={role}
                                            onClick={() => handleSwitch(role)}
                                            disabled={!!switching}
                                            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group disabled:opacity-50"
                                        >
                                            <div className={`p-2 rounded-lg bg-zinc-100 dark:bg-zinc-700 group-hover:bg-white dark:group-hover:bg-zinc-600 transition-colors ${config.color}`}>
                                                {isSwitching ? <Loader2 className="w-4 h-4 animate-spin" /> : config.icon}
                                            </div>
                                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">
                                                {t(`dashboard.roleSwitcher.roles.${role}`)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Unlockable */}
                        {lockableRoles.length > 0 && (
                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                                <p className="px-4 py-2 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                    {t('dashboard.roleSwitcher.unlockNew')}
                                </p>
                                {lockableRoles.map((role) => {
                                    const config = ROLE_CONFIG[role];
                                    return (
                                        <button
                                            key={role}
                                            onClick={() => handleUnlock(role)}
                                            disabled={unlocking}
                                            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all group disabled:opacity-50"
                                        >
                                            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700 transition-colors text-zinc-400 group-hover:text-teal-600">
                                                {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 group-hover:text-teal-700 dark:group-hover:text-teal-400">
                                                    {t(`dashboard.roleSwitcher.roles.${role}`)}
                                                </span>
                                                <span className="text-[10px] text-zinc-400">
                                                    {t('dashboard.roleSwitcher.unlockWorkspace')}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
