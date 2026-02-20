'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';

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

export default function NotificationPreferences() {
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
            await apiClient.client.patch('/users/me/preferences', {
                contact_preferences: preferences
            });
            toast.success('Preferences saved!');
            setHasChanges(false);
        } catch (error) {
            toast.error('Failed to save preferences');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Contact Preferences</h2>
                    <p className="text-sm text-gray-500">How would you like to be notified?</p>
                </div>
                {hasChanges && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                )}
            </div>

            {/* Notification Channels */}
            <div className="space-y-4 mb-8">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                    Notification Channels
                </h3>

                {/* In-App (Always on) */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🔔</span>
                        <div>
                            <p className="font-medium text-gray-900">In-App Notifications</p>
                            <p className="text-sm text-gray-500">Always on - see notifications in the app</p>
                        </div>
                    </div>
                    <span className="text-green-600 text-sm font-medium">Always On</span>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">📧</span>
                        <div>
                            <p className="font-medium text-gray-900">Email Notifications</p>
                            <p className="text-sm text-gray-500">Receive updates via email</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={preferences.email_notifications}
                            onChange={(e) => handleChange('email_notifications', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* WhatsApp */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">💬</span>
                        <div>
                            <p className="font-medium text-gray-900">WhatsApp Notifications</p>
                            <p className="text-sm text-gray-500">Receive messages via WhatsApp (requires phone number)</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={preferences.sms_notifications}
                            onChange={(e) => handleChange('sms_notifications', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                </div>
            </div>

            {/* Email Frequency */}
            {preferences.email_notifications && (
                <div className="mb-8">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                        Email Frequency
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { value: 'instant', label: 'Instant', desc: 'As they happen' },
                            { value: 'daily', label: 'Daily Digest', desc: 'Once per day' },
                            { value: 'weekly', label: 'Weekly', desc: 'Once per week' }
                        ].map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleChange('email_frequency', option.value)}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${preferences.email_frequency === option.value
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <p className={`font-medium ${preferences.email_frequency === option.value ? 'text-blue-700' : 'text-gray-900'}`}>
                                    {option.label}
                                </p>
                                <p className="text-sm text-gray-500">{option.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Preferred Contact Method */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                    Preferred Contact Method
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                    How should landlords/tenants contact you?
                    <span className="text-amber-600 font-medium"> Contact info is only shared after both parties are verified.</span>
                </p>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { value: 'in_app', label: 'In-App Messages', icon: '💬' },
                        { value: 'email', label: 'Email', icon: '📧' },
                        { value: 'phone', label: 'Phone/WhatsApp', icon: '📞' }
                    ].map(option => (
                        <button
                            key={option.value}
                            onClick={() => handleChange('preferred_contact', option.value)}
                            className={`p-4 rounded-xl border-2 text-center transition-all ${preferences.preferred_contact === option.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <span className="text-2xl block mb-1">{option.icon}</span>
                            <p className={`font-medium text-sm ${preferences.preferred_contact === option.value ? 'text-blue-700' : 'text-gray-900'}`}>
                                {option.label}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Privacy Notice */}
            <div className="mt-8 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-start gap-3">
                    <span className="text-xl">🔒</span>
                    <div>
                        <p className="font-medium text-gray-900 text-sm">Privacy Protected</p>
                        <p className="text-sm text-gray-600">
                            Your contact details (phone, email) are only shared with the other party
                            after <strong>both of you complete ID verification</strong>. Until then,
                            all communication happens through our secure in-app messaging.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
