'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { User, Shield, Bell, Settings, ArrowLeft, Trash2, ShieldAlert, X, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import PremiumLayout from '@/components/PremiumLayout';
import { useLanguage } from '@/lib/LanguageContext';
import { useGoogleSignIn } from '@/lib/useGoogleSignIn';
import React, { useState } from 'react';

export default function PrivacySettingsPage() {
    return (
        <ProtectedRoute>
            <PrivacySettingsContent />
        </ProtectedRoute>
    );
}

function PrivacySettingsContent() {
    const { t } = useLanguage();
    const router = useRouter();
    const { logout, user } = useAuth();
    const { revoke } = useGoogleSignIn({ clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID });
    const { success, error: showError } = useToast();

    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');

    const deleteTarget = t('common.placeholders.delete');

    const handleDeleteAccount = async () => {
        if (deleteConfirmation.toUpperCase() !== deleteTarget.toUpperCase()) {
            showError(t('auth.register.gdpr.error'));
            return;
        }

        setIsDeleting(true);
        try {
            const userEmail = user?.email;
            await apiClient.client.delete('/gdpr/delete');
            
            // Try to revoke Google session if possible
            if (userEmail) {
                try {
                    await revoke(userEmail);
                } catch (gError) {
                    console.warn('Failed to revoke Google session:', gError);
                }
            }

            success(t('auth.login.error.success'));
            logout();
        } catch (error) {
            console.error('Failed to delete account:', error);
            showError(t('auth.login.error.loginFail'));
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    return (
        <PremiumLayout withNavbar={true}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="flex flex-col md:flex-row gap-16">
                    {/* Sidebar */}
                    <div className="w-full md:w-80 shrink-0">
                        <div className="mb-12">
                            <h1 className="text-4xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">{t('settings.title')}</h1>
                            <p className="text-zinc-500 font-medium">{t('settings.subtitle')}</p>
                        </div>

                        <div className="flex flex-row md:flex-col gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-full md:rounded-[2rem] border border-zinc-200/50 dark:border-zinc-700/30 backdrop-blur-xl overflow-x-auto no-scrollbar scroll-smooth">
                            {[
                                { id: 'account', icon: User, label: t('settings.tabs.profile'), path: '/settings/account' },
                                { id: 'notifications', icon: Bell, label: t('settings.tabs.notifications'), path: '/settings/notifications' },
                                { id: 'privacy', icon: Shield, label: t('settings.tabs.privacy'), path: '/settings/privacy' },
                                { id: 'preferences', icon: Settings, label: t('settings.tabs.preferences'), path: '/settings/preferences' }
                            ].map((tab) => (
                                <div key={tab.id} className="flex flex-row md:flex-col shrink-0">
                                    <button
                                        onClick={() => router.push(tab.path)}
                                        className={`flex items-center gap-3 px-5 md:px-6 py-3 md:py-4 rounded-full md:rounded-[1.5rem] text-[10px] md:text-sm font-black uppercase tracking-widest transition-all duration-500 whitespace-nowrap ${
                                            tab.id === 'privacy' 
                                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl scale-100' 
                                            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                        }`}
                                    >
                                        <tab.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${tab.id === 'privacy' ? 'text-teal-500' : ''}`} />
                                        {tab.label}
                                    </button>
                                    
                                    {tab.id === 'privacy' && (
                                        <div className="hidden md:flex px-6 py-4 flex-col gap-4">
                                            <button 
                                                className="text-[10px] font-black uppercase tracking-widest text-left text-teal-500"
                                            >
                                                {t('settings.privacy.gdprData')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 max-w-2xl">
                        <div className="space-y-12">
                            <div className="glass-card !p-10">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="p-3 bg-teal-500/10 rounded-2xl">
                                        <Shield className="w-6 h-6 text-teal-500" />
                                    </div>
                                    <h2 className="text-2xl font-black tracking-tight">{t('settings.privacy.dataTitle')}</h2>
                                </div>
                                <p className="text-zinc-500 font-bold leading-relaxed mb-12">
                                    {t('settings.privacy.dataDesc')}
                                </p>

                                <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2rem] border border-zinc-100 dark:border-zinc-700/50">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-red-500/10 rounded-xl">
                                            <AlertTriangle className="w-5 h-5 text-red-500" />
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-red-500">{t('settings.privacy.dangerTitle')}</h3>
                                    </div>
                                    <p className="text-xs font-bold text-zinc-500 mb-8 leading-relaxed">
                                        {t('settings.privacy.dangerDesc')}
                                    </p>
                                    <button
                                        onClick={() => setShowDeleteModal(true)}
                                        className="w-full py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 hover:scale-[1.02] transition-all"
                                    >
                                        {t('common.delete')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showDeleteModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-zinc-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6">
                                <button onClick={() => setShowDeleteModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"><X className="w-5 h-5 text-zinc-400" /></button>
                            </div>
                            
                            <div className="mb-8">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-6">
                                    <Trash2 className="w-8 h-8 text-red-500" />
                                </div>
                                <h3 className="text-2xl font-black tracking-tight mb-2">{t('settings.privacy.deleteConfirmTitle')}</h3>
                                <p className="text-zinc-500 font-bold text-sm leading-relaxed">
                                    {t('settings.privacy.deleteConfirmDesc')}
                                </p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
                                        {t('settings.privacy.typeConfirm', { target: deleteTarget }, `Type ${deleteTarget} to confirm`)}
                                    </p>
                                    <input
                                        type="text"
                                        value={deleteConfirmation}
                                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                                        placeholder={deleteTarget}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl px-6 py-4 text-center font-black text-red-500 uppercase tracking-widest focus:ring-2 focus:ring-red-500/20 transition-all"
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-all">
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={deleteConfirmation.toUpperCase() !== deleteTarget.toUpperCase() || isDeleting}
                                        className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-red-500/20 disabled:opacity-50 hover:scale-105 transition-all"
                                    >
                                        {isDeleting ? t('settings.privacy.deleting', undefined, 'Deleting...') : t('common.delete')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </PremiumLayout>
    );
}
