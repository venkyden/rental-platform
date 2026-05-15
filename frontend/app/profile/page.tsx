"use client";

import { User, Settings, Bell, Shield, LogOut, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

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
                                 <div className="inline-flex items-center px-3 py-1 bg-zinc-900/5 text-zinc-900 text-[8px] font-black rounded-full border border-zinc-900/10 uppercase tracking-[0.2em]">
                                     {user?.role}
                                 </div>
                             </div>
                        </div>

                        <div className="space-y-6 pt-6 border-t border-zinc-100">
                             <div className="flex justify-between items-center">
                                 <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em]">{t('profile.preferences.title', undefined, 'Rental Preferences')}</h3>
                                 <Link href="/profile/preferences" className="text-zinc-900 hover:scale-105 transition-transform text-[10px] font-black uppercase tracking-widest">
                                     {t('common.edit', undefined, 'Edit')}
                                 </Link>
                             </div>

                            {user?.preferences && Object.keys(user.preferences).length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {user.role === 'tenant' ? (
                                        <>
                                            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Location</span>
                                                <span className="font-bold text-zinc-900">{user.preferences.location_preference?.address || (typeof user.preferences.location_preference === 'string' ? user.preferences.location_preference : 'Selected on map') || 'Any'}</span>
                                            </div>
                                             <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                 <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Max Budget</span>
                                                 <span className="font-black text-zinc-900 notranslate" translate="no">{user.preferences.budget ? `${user.preferences.budget}€` : 'Any'}</span>
                                             </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Location</span>
                                                <span className="font-bold text-zinc-900">{user.preferences.location?.name || (typeof user.preferences.location === 'string' ? user.preferences.location : 'Selected on map') || 'Any'}</span>
                                            </div>
                                             <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                                 <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Urgency</span>
                                                 <span className="font-black text-zinc-900 capitalize">{user.preferences.urgency || 'Any'}</span>
                                             </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                 <p className="text-zinc-500 text-sm">
                                     No preferences set yet. <Link href="/profile/preferences" className="text-zinc-900 font-black uppercase tracking-widest hover:underline">Set them now</Link>
                                 </p>
                            )}
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
                         className="w-full py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-2xl"
                     >
                         <LogOut className="w-5 h-5" />
                         {t('auth.logout', undefined, 'Logout')}
                     </button>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
