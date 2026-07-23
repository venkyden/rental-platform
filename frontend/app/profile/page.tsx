"use client";

import { User, Settings, Bell, Shield, LogOut, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';

function BioSection() {
    const { user, checkAuth } = useAuth() as any;
    const { t } = useLanguage();
    const toast = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [firstName, setFirstName] = useState('');
    const [bio, setBio] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setFirstName(user?.first_name || '');
        setBio(user?.bio || '');
    }, [user?.first_name, user?.bio]);

    const bioLength = bio.trim().length;
    const bioValid = bioLength === 0 || (bioLength >= 40 && bioLength <= 300);

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiClient.client.patch('/auth/me', {
                first_name: firstName,
                bio: bio.trim(),
            });
            await checkAuth?.();
            toast.success(t('bio.saved', undefined, 'Profile updated'));
            const returnTo = searchParams?.get('returnTo');
            if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.startsWith('/\\')) {
                router.push(returnTo);
            }
        } catch (e: any) {
            const detail = e.response?.data?.detail;
            const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
            toast.error(
                typeof msg === 'string' && msg.includes('contact details')
                    ? t('bio.noContactDetails', undefined, 'Your bio must not contain an email address or phone number.')
                    : t('bio.saveFailed', undefined, 'Could not save your profile. Bio must be 40–300 characters.')
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card mb-8">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.4em] mb-6">
                {t('bio.sectionTitle', undefined, 'Public presentation')}
            </h3>
            <div className="space-y-5">
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">
                        {t('bio.firstName', undefined, 'First name (shown on your listings and applications)')}
                    </label>
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        maxLength={100}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-zinc-900 outline-none"
                        placeholder={t('bio.firstNamePlaceholder', undefined, 'Marc')}
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">
                        {t('bio.label', undefined, 'Short bio')}
                    </label>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={4}
                        maxLength={300}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-zinc-900 outline-none resize-none"
                        placeholder={t('bio.placeholder', undefined, 'Your situation (student, employed…), your rhythm of life, why this city. 40–300 characters.')}
                    />
                    <div className="flex justify-between mt-2">
                        <p className="text-xs text-zinc-400 max-w-md">
                            {t('bio.guidance', undefined, 'Required to publish a listing or apply. Do not include origin, religion, family status, health, or contact details.')}
                        </p>
                        <span className={`text-xs font-bold shrink-0 ${bioValid ? 'text-zinc-400' : 'text-red-500'}`}>
                            {bioLength}/300
                        </span>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving || !bioValid}
                    className="px-8 py-3 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
                >
                    {saving ? t('common.saving', undefined, 'Saving…') : t('common.save', undefined, 'Save')}
                </button>
            </div>
        </motion.div>
    );
}

export default function ProfilePage() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const { t } = useLanguage();

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="flex items-center gap-4 mb-10">
                    <button onClick={() => router.back()} className="btn-secondary !py-2.5 !px-5 text-sm">
                        ← {t('common.back', undefined, 'Back')}
                    </button>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500">
                        {t('profile.title', undefined, 'My Profile')}
                    </h1>
                </div>

                <div className="max-w-2xl mx-auto">
                    <Suspense fallback={null}>
                        <BioSection />
                    </Suspense>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card mb-8"
                    >
                        <div className="flex items-center gap-6 mb-10">
                             <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] flex items-center justify-center text-3xl text-white font-black shadow-2xl">
                                 {user?.full_name?.charAt(0) || 'U'}
                             </div>
                             <div>
                                 <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter leading-none mb-2">{user?.full_name}</h2>
                                 <p className="text-zinc-400 font-medium tracking-tight mb-3">{user?.email}</p>
                                 <div className="inline-flex items-center px-3 py-1 bg-zinc-900/5 text-zinc-900 text-xs font-black rounded-full border border-zinc-900/10 uppercase tracking-[0.2em]">
                                     {user?.role}
                                 </div>
                             </div>
                        </div>

                        <div className="space-y-6 pt-6 border-t border-zinc-100">
                             <div className="flex justify-between items-center">
                                 <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.4em]">{t('profile.preferences.title', undefined, 'Rental Preferences')}</h3>
                                 <Link href="/profile/preferences" className="text-zinc-900 hover:scale-105 transition-transform text-xs font-black uppercase tracking-widest">
                                     {t('common.edit', undefined, 'Edit')}
                                 </Link>
                             </div>

                            {(() => {
                                const role = user?.role || 'tenant';
                                const rolePrefs = user?.preferences?.[role] || user?.preferences || {};
                                const hasPrefs = Object.keys(rolePrefs).length > 0;
                                if (!hasPrefs) {
                                    return (
                                        <p className="text-zinc-500 text-sm">
                                            No preferences set yet. <Link href="/profile/preferences" className="text-zinc-900 font-black uppercase tracking-widest hover:underline">Set them now</Link>
                                        </p>
                                    );
                                }
                                return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {role === 'tenant' ? (
                                            <>
                                                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Location</span>
                                                    <span className="font-bold text-zinc-900">{rolePrefs.location_preference?.address || (typeof rolePrefs.location_preference === 'string' ? rolePrefs.location_preference : 'Selected on map') || 'Any'}</span>
                                                </div>
                                                 <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                     <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Max Budget</span>
                                                     <span className="font-black text-zinc-900 notranslate" translate="no">{rolePrefs.budget ? `${rolePrefs.budget}€` : 'Any'}</span>
                                                 </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Location</span>
                                                    <span className="font-bold text-zinc-900">{rolePrefs.location?.name || rolePrefs.location?.address || (typeof rolePrefs.location === 'string' ? rolePrefs.location : 'Selected on map') || 'Any'}</span>
                                                </div>
                                                 <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                     <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Urgency</span>
                                                     <span className="font-black text-zinc-900 capitalize">{rolePrefs.urgency || 'Any'}</span>
                                                 </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="mt-10 space-y-3">
                            <Link href="/settings/account" className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl border border-zinc-100 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 group-hover:bg-white group-hover:text-zinc-900 transition-colors">
                                        <Settings className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-zinc-900">Account Settings</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
                            </Link>

                            <Link href="/settings/notifications" className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl border border-zinc-100 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 group-hover:bg-white group-hover:text-zinc-900 transition-colors">
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-zinc-900">Notifications</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
                            </Link>

                            <Link href="/settings/privacy" className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl border border-zinc-100 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 group-hover:bg-white group-hover:text-zinc-900 transition-colors">
                                        <Shield className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-zinc-900">Privacy & GDPR</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
                            </Link>
                        </div>
                    </motion.div>

                     <button 
                         onClick={logout} 
                         className="w-full py-5 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-2xl"
                     >
                         <LogOut className="w-5 h-5" />
                         {t('auth.logoutAction', undefined, 'Logout')}
                     </button>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
