'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { ChevronDown, UserCircle, Building, Home, Plus, Check, Loader2 } from 'lucide-react';

interface RoleSwitcherProps {
    currentRole: string;
    availableRoles: string[];
    onSwitch?: () => void;
}

const ROLE_CONFIG: Record<string, { label: string; labelFr: string; icon: React.ReactNode; color: string; bgColor: string; dashboardPath: string }> = {
    tenant: {
        label: 'Tenant',
        labelFr: 'Locataire',
        icon: <Home className="w-4 h-4" />,
        color: 'text-teal-600 dark:text-teal-400',
        bgColor: 'bg-teal-50 dark:bg-teal-900/30',
        dashboardPath: '/dashboard',
    },
    landlord: {
        label: 'Landlord',
        labelFr: 'Propriétaire',
        icon: <UserCircle className="w-4 h-4" />,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/30',
        dashboardPath: '/dashboard/landlord',
    },
    property_manager: {
        label: 'Agency',
        labelFr: 'Agence',
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
            // Unlock + switch in one call — the backend will add the role to available_roles
            // We use googleLogin-like flow but for email/password users we call switch-role directly
            // First unlock by switching (the backend handles appending to available_roles)
            const data = await apiClient.switchRole(targetRole);
            setOpen(false);
            onSwitch?.();
            if (data.redirect_path) {
                router.push(data.redirect_path);
            }
        } catch (err: any) {
            // If the role isn't unlocked yet, we need to unlock it via a different mechanism
            // For now, show an error — this case is handled by the Google signup flow
            console.error('Role unlock failed:', err);
            alert('To unlock this role, please sign up again using the role selector on the registration page.');
        } finally {
            setUnlocking(false);
        }
    }

    // Don't render if there's only one possible role and no others to unlock
    if (availableRoles.length <= 1 && lockableRoles.length === 0) {
        return null;
    }

    return (
        <div ref={dropdownRef} className="relative inline-block">
            {/* Trigger Button */}
            <button
                onClick={() => setOpen(!open)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-xl border transition-all duration-200 ${currentConfig.color} ${currentConfig.bgColor} border-transparent hover:border-current/20 hover:shadow-sm`}
                id="role-switcher-trigger"
            >
                {currentConfig.icon}
                <span className="hidden sm:inline">{currentConfig.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Current role indicator */}
                    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                            Active Role
                        </p>
                        <div className={`flex items-center gap-2 ${currentConfig.color}`}>
                            {currentConfig.icon}
                            <span className="font-semibold text-sm">{currentConfig.label}</span>
                            <Check className="w-3.5 h-3.5 ml-auto" />
                        </div>
                    </div>

                    {/* Other unlocked roles */}
                    {otherRoles.length > 0 && (
                        <div className="p-2">
                            <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                Switch to
                            </p>
                            {otherRoles.map((role) => {
                                const config = ROLE_CONFIG[role];
                                const isSwitching = switching === role;
                                return (
                                    <button
                                        key={role}
                                        onClick={() => handleSwitch(role)}
                                        disabled={!!switching}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${config.color} hover:${config.bgColor} disabled:opacity-50`}
                                    >
                                        {isSwitching ? <Loader2 className="w-4 h-4 animate-spin" /> : config.icon}
                                        <span className="font-medium">{config.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Unlock new roles */}
                    {lockableRoles.length > 0 && (
                        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800">
                            <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                Unlock Role
                            </p>
                            {lockableRoles.map((role) => {
                                const config = ROLE_CONFIG[role];
                                return (
                                    <button
                                        key={role}
                                        onClick={() => handleUnlock(role)}
                                        disabled={unlocking}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                    >
                                        {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        <span className="font-medium">{config.label}</span>
                                        <span className="ml-auto text-[10px] text-zinc-400">+ Add</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
