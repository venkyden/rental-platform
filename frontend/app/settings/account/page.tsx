"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Key, Mail, Camera, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import PremiumLayout from '@/components/PremiumLayout';



export default function AccountSettingsPage() {
    const { user } = useAuth();

    // Tab State
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

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingProfile(true);
        setProfileMessage({ text: '', type: '' });

        try {
            await apiClient.client.put('/auth/me', { full_name: fullName, bio });
            // Refresh user data (would normally call mutate here)
            window.location.reload();
            setProfileMessage({ text: 'Profile updated successfully!', type: 'success' });
        } catch (error: any) {
            let errorMsg = error.response?.data?.detail || 'Failed to update profile';
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
            // Refresh user data to show new avatar
            window.location.reload();
        } catch (error) {
            console.error("Avatar upload failed:", error);
            alert("Failed to upload avatar. Please try again.");
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordMessage({ text: 'New passwords do not match', type: 'error' });
            return;
        }

        setIsChangingPassword(true);
        setPasswordMessage({ text: '', type: '' });

        try {
            await apiClient.client.post('/auth/change-password', {
                old_password: oldPassword,
                new_password: newPassword,
            });
            setPasswordMessage({ text: 'Password changed successfully', type: 'success' });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            let errorMsg = error.response?.data?.detail || 'Failed to change password';
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
            setEmailMessage({ text: `Verification link sent to ${newEmail}. Please check your inbox.`, type: 'success' });
            setNewEmail('');
            setEmailPassword('');
        } catch (error: any) {
            let errorMsg = error.response?.data?.detail || 'Failed to request email change';
            if (Array.isArray(errorMsg)) errorMsg = errorMsg[0].msg;
            setEmailMessage({ text: errorMsg, type: 'error' });
        } finally {
            setIsChangingEmail(false);
        }
    };

    if (!user) {
        return (
            <PremiumLayout>
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </PremiumLayout>
        );
    }

    return (
        <PremiumLayout>
            <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                            Account Settings
                        </h1>
                        <p className="text-gray-500 mt-2">Manage your profile, security, and preferences.</p>
                    </div>

                    {/* Custom Tabs */}
                    <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-md p-1 flex gap-2 rounded-xl mb-8">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'profile' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-gray-700/40'}`}
                        >
                            <User className="w-4 h-4 mr-2" />
                            Profile
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'security' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-gray-700/40'}`}
                        >
                            <Shield className="w-4 h-4 mr-2" />
                            Security
                        </button>
                    </div>

                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 rounded-2xl overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl">
                                <div className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 px-6 py-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Details</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">This information will be displayed publicly on your profile.</p>
                                </div>
                                <div className="p-6">
                                    <div className="flex flex-col md:flex-row gap-8">
                                        {/* Avatar Section */}
                                        <div className="flex flex-col items-center space-y-4">
                                            <div className="relative group rounded-full overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg w-32 h-32">
                                                {user.profile_picture_url ? (
                                                    <img src={user.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 flex items-center justify-center text-indigo-500 text-4xl font-semibold">
                                                        {user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                                    {isUploadingAvatar ? (
                                                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Camera className="w-6 h-6 text-white mb-1" />
                                                            <span className="text-white text-xs font-medium">Change</span>
                                                        </>
                                                    )}
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                                                </label>
                                            </div>
                                            <p className="text-xs text-center text-gray-500 max-w-[120px]">Allowed: JPG, PNG, WEBP. Max size: 2MB.</p>
                                        </div>

                                        {/* Form Section */}
                                        <div className="flex-1">
                                            <form onSubmit={handleProfileUpdate} className="space-y-4">
                                                <div className="space-y-2">
                                                    <label htmlFor="fullName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                                    <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className="flex h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:focus:ring-zinc-400 dark:focus:ring-offset-zinc-900 bg-white dark:bg-gray-900" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="bio" className="text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
                                                    <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A bit about yourself..." rows={4} className="flex min-h-[80px] w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:focus:ring-zinc-400 dark:focus:ring-offset-zinc-900 bg-white dark:bg-gray-900 resize-none" />
                                                </div>

                                                {profileMessage.text && (
                                                    <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${profileMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                        {profileMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                                                        {profileMessage.text}
                                                    </div>
                                                )}

                                                <div className="flex justify-end pt-2">
                                                    <button type="submit" disabled={isUpdatingProfile} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20">
                                                        {isUpdatingProfile ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECURITY TAB */}
                    {activeTab === 'security' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Password Section */}
                            <div className="border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 rounded-2xl overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl">
                                <div className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Key className="w-5 h-5 text-indigo-500" />
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h3>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ensure your account is using a long, random password to stay secure.</p>
                                </div>
                                <div className="p-6">
                                    <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
                                            <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required className="flex h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:focus:ring-zinc-400 dark:focus:ring-offset-zinc-900 bg-white dark:bg-gray-900" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                                                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="flex h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:focus:ring-zinc-400 dark:focus:ring-offset-zinc-900 bg-white dark:bg-gray-900" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                                                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="flex h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:focus:ring-zinc-400 dark:focus:ring-offset-zinc-900 bg-white dark:bg-gray-900" />
                                            </div>
                                        </div>

                                        {passwordMessage.text && (
                                            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                {passwordMessage.text}
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <button type="submit" disabled={isChangingPassword || !oldPassword || !newPassword} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20">
                                                {isChangingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                Update Password
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>

                            {/* Email Section */}
                            <div className="border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 rounded-2xl overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl">
                                <div className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-5 h-5 text-indigo-500" />
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Change Email Address</h3>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">We will send a verification link to the new email address.</p>
                                </div>
                                <div className="p-6">
                                    <form onSubmit={handleRequestEmailChange} className="space-y-4 max-w-xl">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New Email Address</label>
                                                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required placeholder="new@example.com" className="flex h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:focus:ring-zinc-400 dark:focus:ring-offset-zinc-900 bg-white dark:bg-gray-900" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
                                                <input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} required placeholder="Required for security" className="flex h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50 dark:focus:ring-zinc-400 dark:focus:ring-offset-zinc-900 bg-white dark:bg-gray-900" />
                                            </div>
                                        </div>

                                        {emailMessage.text && (
                                            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${emailMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                {emailMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                                                {emailMessage.text}
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <button type="submit" disabled={isChangingEmail || !newEmail || !emailPassword} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 shadow-sm border border-zinc-200 dark:border-zinc-700">
                                                {isChangingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                Request Verification Link
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </PremiumLayout>
    );
}
