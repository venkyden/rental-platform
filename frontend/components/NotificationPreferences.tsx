'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';

interface ContactPreferences {
    email_notifications: boolean;
    sms_notifications: boolean;
    push_notifications: boolean;
    email_frequency: 'instant' | 'daily' | 'weekly';
    preferred_contact: 'email' | 'phone' | 'in_app';
}

const DEFAULT_PREFERENCES: ContactPreferences = {
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    email_frequency: 'instant',
    preferred_contact: 'email'
};

import { motion } from 'framer-motion';
import { Mail, MessageSquare, Phone, Bell, ShieldCheck, Clock, Check } from 'lucide-react';

export default function NotificationPreferences() {
    const { t } = useLanguage();
    const { user } = useAuth();
    const toast = useToast();
    const [preferences, setPreferences] = useState<ContactPreferences>(DEFAULT_PREFERENCES);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (user && (user as any).contact_preferences) {
            setPreferences((user as any).contact_preferences);
        }
    }, [user]);

    const handleChange = (key: keyof ContactPreferences, value: any) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiClient.client.patch('/auth/me/preferences', {
                contact_preferences: preferences
            });
            toast.success(t('settings.notifications.saved', undefined, 'Preferences saved!'));
            setHasChanges(false);
        } catch (error) {
            toast.error(t('settings.notifications.error', undefined, 'Failed to save preferences'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-12">
            <div className="glass-card !p-10">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">{t('settings.notifications.title', undefined, 'Contact Preferences')}</h2>
                        <p className="text-sm font-medium text-zinc-500 mt-1">{t('settings.notifications.subtitle', undefined, 'Control how Roomivo communicates with you.')}</p>
                    </div>
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-zinc-900/20 hover:scale-105 transition-all disabled:opacity-50"
                        >
                            {saving ? t('settings.notifications.saving', undefined, 'Saving...') : t('settings.notifications.saveChanges', undefined, 'Save Changes')}
                        </button>
                    )}
                </div>

                {/* Notification Channels */}
                <div className="space-y-6 mb-12">
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6">{t('settings.notifications.channels', undefined, 'Channels')}</h3>

                    <div className="flex items-center justify-between p-6 bg-zinc-50 rounded-2xl border border-transparent hover:border-zinc-200 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm">
                                <Bell className="w-5 h-5 text-zinc-900" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-zinc-900 uppercase tracking-wider">{t('settings.notifications.inApp', undefined, 'In-App')}</p>
                                <p className="text-xs font-bold text-zinc-500">{t('settings.notifications.inAppDesc', undefined, 'Real-time alerts within the platform')}</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">{t('settings.notifications.alwaysOn', undefined, 'Always On')}</span>
                    </div>

                    {[
                        { key: 'email_notifications', label: t('settings.notifications.email', undefined, 'Email'), desc: t('settings.notifications.emailDesc', undefined, 'Critical updates and activity'), icon: Mail },
                        { key: 'sms_notifications', label: t('settings.notifications.whatsapp', undefined, 'WhatsApp'), desc: t('settings.notifications.whatsappDesc', undefined, 'Instant mobile notifications'), icon: MessageSquare }
                    ].map((channel) => (
                        <div key={channel.key} className="flex items-center justify-between p-6 bg-zinc-50 rounded-2xl border border-transparent hover:border-zinc-200 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white rounded-xl shadow-sm">
                                    <channel.icon className="w-5 h-5 text-zinc-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-zinc-900 uppercase tracking-wider">{channel.label}</p>
                                    <p className="text-xs font-bold text-zinc-500">{channel.desc}</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={preferences[channel.key as keyof ContactPreferences] as boolean}
                                    onChange={(e) => handleChange(channel.key as keyof ContactPreferences, e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-12 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900"></div>
                            </label>
                        </div>
                    ))}
                </div>

                {/* Email Frequency */}
                {preferences.email_notifications && (
                    <div className="mb-12">
                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6">{t('settings.notifications.frequency', undefined, 'Frequency')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { value: 'instant', label: t('settings.notifications.options.instant', undefined, 'Instant'), icon: Clock },
                                { value: 'daily', label: t('settings.notifications.options.daily', undefined, 'Daily'), icon: Clock },
                                { value: 'weekly', label: t('settings.notifications.options.weekly', undefined, 'Weekly'), icon: Clock }
                            ].map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => handleChange('email_frequency', option.value)}
                                    className={`p-6 rounded-2xl border-2 text-left transition-all duration-500 ${preferences.email_frequency === option.value
                                        ? 'border-zinc-900 bg-zinc-50'
                                        : 'border-transparent bg-zinc-50 hover:bg-zinc-100'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <option.icon className={`w-5 h-5 ${preferences.email_frequency === option.value ? 'text-zinc-900' : 'text-zinc-400'}`} />
                                        {preferences.email_frequency === option.value && <div className="bg-zinc-900 rounded-full p-1"><Check className="w-3 h-3 text-white" /></div>}
                                    </div>
                                    <p className={`text-xs font-black uppercase tracking-widest ${preferences.email_frequency === option.value ? 'text-zinc-900' : 'text-zinc-900'}`}>
                                        {option.label}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Preferred Contact Method */}
                <div>
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6">{t('settings.notifications.primaryMethod', undefined, 'Primary Method')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { value: 'in_app', label: t('settings.notifications.inApp', undefined, 'In-App'), icon: Bell },
                            { value: 'email', label: t('settings.notifications.email', undefined, 'Email'), icon: Mail },
                            { value: 'phone', label: t('settings.notifications.whatsapp', undefined, 'WhatsApp'), icon: MessageSquare }
                        ].map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleChange('preferred_contact', option.value)}
                                className={`p-6 rounded-2xl border-2 text-left transition-all duration-500 ${preferences.preferred_contact === option.value
                                    ? 'border-zinc-900 bg-zinc-50'
                                    : 'border-transparent bg-zinc-50 hover:bg-zinc-100'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <option.icon className={`w-5 h-5 ${preferences.preferred_contact === option.value ? 'text-zinc-900' : 'text-zinc-400'}`} />
                                    {preferences.preferred_contact === option.value && <div className="bg-zinc-900 rounded-full p-1"><Check className="w-3 h-3 text-white" /></div>}
                                </div>
                                <p className={`text-xs font-black uppercase tracking-widest ${preferences.preferred_contact === option.value ? 'text-zinc-900' : 'text-zinc-900'}`}>
                                    {option.label}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Privacy Notice */}
                <div className="mt-12 p-8 bg-zinc-900 rounded-3xl text-white">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-zinc-800 rounded-2xl">
                            <ShieldCheck className="w-6 h-6 text-zinc-100" />
                        </div>
                        <div>
                            <p className="text-sm font-black uppercase tracking-widest mb-2">{t('settings.notifications.privacyNotice', undefined, 'Privacy Protected')}</p>
                            <p className="text-xs font-bold text-zinc-400 leading-relaxed">
                                {t('settings.notifications.privacyDesc', undefined, 'Your personal contact details are only shared with verified parties after mutual identification. All initial communication is secured via Roomivo messaging.')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
