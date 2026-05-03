'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { User, Shield, Bell, Settings, Eye, ArrowLeft, Loader2, Mail, MessageSquare, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PremiumLayout from '@/components/PremiumLayout';
import NotificationPreferences from '@/components/NotificationPreferences';
import { useLanguage } from '@/lib/LanguageContext';

export default function NotificationSettingsPage() {
    const { t } = useLanguage();
    const router = useRouter();

    return (
        <PremiumLayout withNavbar={true}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="flex flex-col md:flex-row gap-16">
                    {/* Sidebar */}
                    <div className="w-full md:w-80 shrink-0">
                        <div className="mb-12">
                            <h1 className="text-4xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">{t('settings.title', undefined, 'Settings')}</h1>
                            <p className="text-zinc-500 font-medium">{t('settings.subtitle', undefined, 'Manage your digital identity and security preferences.')}</p>
                        </div>

                        <div className="flex flex-col gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-[2rem] border border-zinc-200/50 dark:border-zinc-700/30 backdrop-blur-xl">
                            {[
                                { id: 'account', icon: User, label: t('settings.tabs.profile', undefined, 'Profile'), path: '/settings/account' },
                                { id: 'notifications', icon: Bell, label: t('settings.tabs.notifications', undefined, 'Notifications'), path: '/settings/notifications' },
                                { id: 'privacy', icon: Shield, label: t('settings.tabs.privacy', undefined, 'Privacy'), path: '/settings/privacy' },
                                { id: 'preferences', icon: Settings, label: t('settings.tabs.preferences', undefined, 'Preferences'), path: '/settings/preferences' }
                            ].map((tab) => (
                                <div key={tab.id} className="flex flex-col">
                                    <button
                                        onClick={() => router.push(tab.path)}
                                        className={`flex items-center gap-4 px-6 py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-widest transition-all duration-500 ${
                                            tab.id === 'notifications' 
                                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xl scale-100' 
                                            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                        }`}
                                    >
                                        <tab.icon className={`w-4 h-4 ${tab.id === 'notifications' ? 'text-teal-500' : ''}`} />
                                        {tab.label}
                                    </button>
                                    
                                    {tab.id === 'notifications' && (
                                        <div className="px-6 py-4 flex flex-col gap-4">
                                            <button 
                                                className="text-[10px] font-black uppercase tracking-widest text-left text-teal-500"
                                            >
                                                {t('settings.tabs.preferences', undefined, 'Preferences')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 max-w-2xl">
                        <NotificationPreferences />
                    </div>
                </div>
            </div>
        </PremiumLayout>
    );
}
