"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Key, Mail, Camera, Loader2, CheckCircle2, Bell, Settings } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';



export default function AccountSettingsPage() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();

    // Tab State for internal account sections
    const [activeTab, setActiveTab] = useState('profile');

    // Profile State
    const [fullName, setFullName] = useState(user?.full_name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState({ text: '', type: '' });

    // Avatar State
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    // Security State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ text: '', type: '' });

    // Email State
    const [newEmail, setNewEmail] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    const [isChangingEmail, setIsChangingEmail] = useState(false);
    const [emailMessage, setEmailMessage] = useState({ text: '', type: '' });
    
    // Resend Verification State
    const [isResending, setIsResending] = useState(false);
    const [resendMessage, setResendMessage] = useState('');

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingProfile(true);
        setProfileMessage({ text: '', type: '' });

        try {
            await apiClient.client.put('/auth/me', { full_name: fullName, bio });
            setProfileMessage({ text: t('settings.account.messages.profileSuccess', undefined, 'Profile updated successfully!'), type: 'success' });
            setTimeout(() => window.location.reload(), 1000);
        } catch (error: any) {
            let errorMsg = error.response?.data?.detail || t('settings.account.messages.profileError', undefined, 'Failed to update profile');
            if (Array.isArray(errorMsg)) errorMsg = errorMsg[0].msg;
            setProfileMessage({ text: errorMsg, type: 'error' });
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingAvatar(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await apiClient.client.post('/auth/me/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            window.location.reload();
        } catch (error) {
            console.error("Avatar upload failed:", error);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordMessage({ text: t('settings.account.messages.passwordMatchError', undefined, 'New passwords do not match'), type: 'error' });
            return;
        }

        setIsChangingPassword(true);
        setPasswordMessage({ text: '', type: '' });

        try {
            await apiClient.client.post('/auth/change-password', {
                old_password: oldPassword,
                new_password: newPassword,
            });
            setPasswordMessage({ text: t('settings.account.messages.passwordSuccess', undefined, 'Password updated successfully'), type: 'success' });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            let errorMsg = error.response?.data?.detail || t('settings.account.security.errors.default', undefined, 'Failed to change password');
            if (Array.isArray(errorMsg)) errorMsg = errorMsg[0].msg;
            setPasswordMessage({ text: errorMsg, type: 'error' });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleRequestEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsChangingEmail(true);
        setEmailMessage({ text: '', type: '' });

        try {
            await apiClient.client.post('/auth/request-email-change', {
                new_email: newEmail,
                password: emailPassword,
            });
            setEmailMessage({ text: t('settings.account.messages.emailLinkSent', { email: newEmail }, `Verification link sent to ${newEmail}`), type: 'success' });
            setNewEmail('');
            setEmailPassword('');
        } catch (error: any) {
            let errorMsg = error.response?.data?.detail || t('settings.account.messages.emailError', undefined, 'Failed to request email change');
            if (Array.isArray(errorMsg)) errorMsg = errorMsg[0].msg;
            setEmailMessage({ text: errorMsg, type: 'error' });
        } finally {
            setIsChangingEmail(false);
        }
    };

    const handleResendVerification = async () => {
        setIsResending(true);
        setResendMessage('');
        try {
            await apiClient.client.post('/auth/resend-verification');
            setResendMessage(t('settings.account.messages.emailSent', undefined, 'Verification email sent!'));
        } catch (error: any) {
            let errorMsg = error.response?.data?.detail || t('common.errors.failed', undefined, 'Failed to resend');
            if (Array.isArray(errorMsg)) errorMsg = errorMsg[0].msg;
            setResendMessage(errorMsg);
        } finally {
            setIsResending(false);
        }
    };

    if (!user) return <PremiumLayout><div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div></PremiumLayout>;

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
                                            tab.id === 'account' 
                                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xl scale-100' 
                                            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                        }`}
                                    >
                                        <tab.icon className={`w-4 h-4 ${tab.id === 'account' ? 'text-teal-500' : ''}`} />
                                        {tab.label}
                                    </button>
                                    
                                    {tab.id === 'account' && (
                                        <div className="px-6 py-4 flex flex-col gap-4">
                                            <button 
                                                onClick={() => setActiveTab('profile')}
                                                className={`text-[10px] font-black uppercase tracking-widest text-left transition-all ${activeTab === 'profile' ? 'text-teal-500' : 'text-zinc-400 hover:text-zinc-500'}`}
                                            >
                                                {t('settings.account.general', undefined, 'General')}
                                            </button>
                                            <button 
                                                onClick={() => setActiveTab('security')}
                                                className={`text-[10px] font-black uppercase tracking-widest text-left transition-all ${activeTab === 'security' ? 'text-teal-500' : 'text-zinc-400 hover:text-zinc-500'}`}
                                            >
                                                {t('settings.account.security', undefined, 'Security')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 max-w-2xl">
                        {!user.email_verified && (
                            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 glass-card border-amber-200 dark:border-amber-900/30 !bg-amber-50/30 dark:!bg-amber-900/10 flex flex-col sm:flex-row items-center justify-between gap-6 p-8">
                                <div className="flex items-center gap-4 text-center sm:text-left">
                                    <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-2xl">
                                        <Mail className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-amber-900 dark:text-amber-300 uppercase tracking-widest">{t('settings.account.verifyEmail', undefined, 'Verify Email')}</h3>
                                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-1">{t('settings.account.verifyEmailDesc', undefined, 'Unlock full platform access by verifying your email.')}</p>
                                    </div>
                                </div>
                                <button onClick={handleResendVerification} disabled={isResending} className="px-6 py-3 bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:scale-105 transition-all">
                                    {isResending ? t('settings.account.sending', undefined, 'Sending...') : t('settings.account.resendLink', undefined, 'Resend link')}
                                </button>
                            </motion.div>
                        )}

                        <AnimatePresence mode="wait">
                            {activeTab === 'profile' && (
                                <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-12">
                                    <div className="glass-card !p-10">
                                        <h3 className="text-2xl font-black tracking-tight mb-8">{t('settings.account.profileDetails', undefined, 'Profile Details')}</h3>
                                        
                                        <div className="flex flex-col sm:flex-row items-center gap-10 mb-12">
                                            <div className="relative group shrink-0">
                                                <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-zinc-800 shadow-2xl relative">
                                                    {user.profile_picture_url ? (
                                                        <img src={user.profile_picture_url} alt="Profile" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                    ) : (
                                                        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-3xl font-black text-zinc-300">
                                                            {user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    {isUploadingAvatar && <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>}
                                                </div>
                                                <label className="absolute -bottom-2 -right-2 p-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl shadow-xl cursor-pointer hover:scale-110 transition-all">
                                                    <Camera className="w-4 h-4" />
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                                </label>
                                            </div>
                                            <div className="flex-1 text-center sm:text-left">
                                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">{t('settings.account.avatarFormat', undefined, 'Avatar Format')}</p>
                                                <p className="text-xs font-bold text-zinc-500">{t('settings.account.avatarDesc', undefined, 'Allowed: JPG, PNG, WEBP. Max size: 2MB.')}</p>
                                            </div>
                                        </div>

                                        <form onSubmit={handleProfileUpdate} className="space-y-8">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{t('settings.account.fullName', undefined, 'Full Name')}</label>
                                                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800/50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 transition-all" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{t('settings.account.bio', undefined, 'Bio')}</label>
                                                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full bg-zinc-50 dark:bg-zinc-800/50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 transition-all resize-none" />
                                            </div>

                                            {profileMessage.text && <p className={`text-[10px] font-black uppercase tracking-widest ${profileMessage.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>{profileMessage.text}</p>}

                                            <button type="submit" disabled={isUpdatingProfile} className="btn-primary !w-full !py-4 !rounded-2xl !text-xs uppercase tracking-[0.2em] shadow-xl shadow-teal-500/10">
                                                {isUpdatingProfile ? t('settings.account.saving', undefined, 'Saving...') : t('settings.account.saveChanges', undefined, 'Save Changes')}
                                            </button>
                                        </form>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'security' && (
                                <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-12">
                                    <div className="glass-card !p-10">
                                        <h3 className="text-2xl font-black tracking-tight mb-8">{t('settings.account.security', undefined, 'Security')}</h3>
                                        
                                        <form onSubmit={handleChangePassword} className="space-y-8 mb-16">
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{t('settings.account.currentPassword', undefined, 'Current Password')}</label>
                                                    <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800/50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 transition-all" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{t('settings.account.newPassword', undefined, 'New')}</label>
                                                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800/50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 transition-all" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{t('settings.account.confirmPassword', undefined, 'Confirm')}</label>
                                                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800/50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 transition-all" />
                                                    </div>
                                                </div>
                                            </div>
                                            {passwordMessage.text && <p className={`text-[10px] font-black uppercase tracking-widest ${passwordMessage.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>{passwordMessage.text}</p>}
                                            <button type="submit" disabled={isChangingPassword} className="btn-primary !w-full !py-4 !rounded-2xl !text-xs uppercase tracking-[0.2em] shadow-xl shadow-teal-500/10">{t('settings.account.updatePassword', undefined, 'Update Password')}</button>
                                        </form>

                                        <div className="pt-12 border-t border-zinc-100 dark:border-zinc-800">
                                            <h4 className="text-sm font-black uppercase tracking-widest mb-8">{t('settings.account.emailAddress', undefined, 'Email Address')}</h4>
                                            <form onSubmit={handleRequestEmailChange} className="space-y-8">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{t('settings.account.newEmail', undefined, 'New Email')}</label>
                                                        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800/50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 transition-all" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{t('settings.account.confirmPassword', undefined, 'Password')}</label>
                                                        <input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800/50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 transition-all" />
                                                    </div>
                                                </div>
                                                {emailMessage.text && <p className={`text-[10px] font-black uppercase tracking-widest ${emailMessage.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>{emailMessage.text}</p>}
                                                <button type="submit" disabled={isChangingEmail} className="py-4 px-8 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all w-full">{t('settings.account.requestEmailChange', undefined, 'Request Email Change')}</button>
                                            </form>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </PremiumLayout>
    );
}
