'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';

// Preference card component for editable sections
interface PreferenceCardProps {
    title: string;
    emoji: string;
    value: string | string[] | number;
    onEdit: () => void;
}

function PreferenceCard({ title, emoji, value, onEdit }: PreferenceCardProps) {
    const displayValue = Array.isArray(value)
        ? value.join(', ')
        : value?.toString() || 'Not set';

    return (
        <div
            onClick={onEdit}
            className="bg-white rounded-xl p-4 shadow-sm border-2 border-gray-100 hover:border-blue-300 cursor-pointer transition-all hover:shadow-md"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{emoji}</span>
                    <div>
                        <h3 className="font-medium text-gray-900">{title}</h3>
                        <p className="text-gray-600 text-sm truncate max-w-[200px]">{displayValue}</p>
                    </div>
                </div>
                <span className="text-gray-400">✏️</span>
            </div>
        </div>
    );
}

// Edit modal component
interface EditModalProps {
    isOpen: boolean;
    title: string;
    currentValue: any;
    options?: { value: string; label: string }[];
    type: 'select' | 'multiselect' | 'range' | 'text';
    min?: number;
    max?: number;
    unit?: string;
    onSave: (value: any) => void;
    onClose: () => void;
}

function EditModal({ isOpen, title, currentValue, options, type, min, max, unit, onSave, onClose }: EditModalProps) {
    const [value, setValue] = useState(currentValue);
    const [multiValues, setMultiValues] = useState<string[]>(Array.isArray(currentValue) ? currentValue : []);

    useEffect(() => {
        setValue(currentValue);
        setMultiValues(Array.isArray(currentValue) ? currentValue : []);
    }, [currentValue, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (type === 'multiselect') {
            onSave(multiValues);
        } else {
            onSave(value);
        }
    };

    const toggleMultiValue = (v: string) => {
        setMultiValues(prev =>
            prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold mb-4">{title}</h3>

                {type === 'select' && options && (
                    <div className="space-y-2">
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setValue(opt.value)}
                                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${value === opt.value
                                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                                    : 'border-gray-200 hover:border-blue-300'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                {type === 'multiselect' && options && (
                    <div className="grid grid-cols-2 gap-2">
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => toggleMultiValue(opt.value)}
                                className={`px-4 py-3 rounded-xl border-2 transition-all ${multiValues.includes(opt.value)
                                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                                    : 'border-gray-200 hover:border-blue-300'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                {type === 'range' && (
                    <div>
                        <input
                            type="range"
                            min={min}
                            max={max}
                            value={value || min}
                            onChange={(e) => setValue(parseInt(e.target.value))}
                            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between mt-2 text-gray-600">
                            <span>{unit}{min}</span>
                            <span className="text-xl font-bold text-blue-600">{unit}{value}</span>
                            <span>{unit}{max}+</span>
                        </div>
                    </div>
                )}

                {type === 'text' && (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                )}

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-medium hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SettingsPreferencesPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { success, error: showError } = useToast();
    const [preferences, setPreferences] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editModal, setEditModal] = useState<{
        isOpen: boolean;
        key: string;
        title: string;
        type: 'select' | 'multiselect' | 'range' | 'text';
        options?: { value: string; label: string }[];
        min?: number;
        max?: number;
        unit?: string;
    }>({
        isOpen: false,
        key: '',
        title: '',
        type: 'text'
    });

    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            const response = await apiClient.client.get('/onboarding/status');
            setPreferences(response.data.preferences || {});
        } catch (error) {
            console.error('Failed to load preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const savePreference = async (key: string, value: any) => {
        setSaving(true);
        try {
            await apiClient.client.put('/onboarding/preferences', {
                responses: { [key]: value }
            });
            setPreferences(prev => ({ ...prev, [key]: value }));
            success('Preference updated!');
        } catch (error) {
            showError('Failed to save preference');
        } finally {
            setSaving(false);
            setEditModal(prev => ({ ...prev, isOpen: false }));
        }
    };

    const openEdit = (config: typeof editModal) => {
        setEditModal({ ...config, isOpen: true });
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
                </div>
            </ProtectedRoute>
        );
    }

    const isTenant = user?.role === 'tenant';

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white shadow sticky top-0 z-10">
                    <div className="max-w-3xl mx-auto py-4 px-4 flex items-center gap-4">
                        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">
                            ← Back
                        </button>
                        <h1 className="text-xl font-bold text-gray-900">Matching Preferences</h1>
                    </div>
                </header>

                <main className="max-w-3xl mx-auto py-6 px-4">
                    {/* Identity Section */}
                    <section className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">👤 Profile</h2>
                        <div className="grid gap-3 md:grid-cols-2">
                            <PreferenceCard
                                title="Nationality"
                                emoji="🌍"
                                value={preferences.nationality || 'Not set'}
                                onEdit={() => openEdit({
                                    isOpen: true,
                                    key: 'nationality',
                                    title: 'Your Nationality',
                                    type: 'select',
                                    options: ['French', 'American', 'British', 'German', 'Italian', 'Spanish', 'Other'].map(n => ({ value: n.toLowerCase(), label: n }))
                                })}
                            />
                            <PreferenceCard
                                title="Languages"
                                emoji="💬"
                                value={preferences.languages || []}
                                onEdit={() => openEdit({
                                    isOpen: true,
                                    key: 'languages',
                                    title: 'Languages Spoken',
                                    type: 'multiselect',
                                    options: [
                                        { value: 'fr', label: '🇫🇷 French' },
                                        { value: 'en', label: '🇬🇧 English' },
                                        { value: 'es', label: '🇪🇸 Spanish' },
                                        { value: 'de', label: '🇩🇪 German' },
                                    ]
                                })}
                            />
                            <PreferenceCard
                                title="Gender"
                                emoji="👤"
                                value={preferences.gender || 'Not set'}
                                onEdit={() => openEdit({
                                    isOpen: true,
                                    key: 'gender',
                                    title: 'Gender',
                                    type: 'select',
                                    options: [
                                        { value: 'female', label: '👩 Female' },
                                        { value: 'male', label: '👨 Male' },
                                        { value: 'other', label: '🧑 Other' },
                                    ]
                                })}
                            />
                        </div>
                    </section>

                    {isTenant ? (
                        <>
                            {/* Budget & Housing */}
                            <section className="mb-8">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">💰 Budget & Housing</h2>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <PreferenceCard
                                        title="Max Budget"
                                        emoji="💶"
                                        value={`€${preferences.budget || 0}`}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'budget',
                                            title: 'Max Budget',
                                            type: 'range',
                                            min: 300,
                                            max: 3000,
                                            unit: '€'
                                        })}
                                    />
                                    <PreferenceCard
                                        title="Min Surface"
                                        emoji="📐"
                                        value={`${preferences.min_surface_area || 0}m²`}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'min_surface_area',
                                            title: 'Minimum Surface',
                                            type: 'range',
                                            min: 9,
                                            max: 100,
                                            unit: 'm²'
                                        })}
                                    />
                                    <PreferenceCard
                                        title="Furnished"
                                        emoji="🛋️"
                                        value={preferences.furnished_preference || 'No preference'}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'furnished_preference',
                                            title: 'Furnished Preference',
                                            type: 'select',
                                            options: [
                                                { value: 'furnished', label: '🛋️ Furnished' },
                                                { value: 'unfurnished', label: '📦 Unfurnished' },
                                                { value: 'no_preference', label: '🤷 No preference' },
                                            ]
                                        })}
                                    />
                                </div>
                            </section>

                            {/* Location & Transport */}
                            <section className="mb-8">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">📍 Location & Transport</h2>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <PreferenceCard
                                        title="Near Location"
                                        emoji="📍"
                                        value={preferences.proximity_landmark || 'Not set'}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'proximity_landmark',
                                            title: 'Near Location',
                                            type: 'text'
                                        })}
                                    />
                                    <PreferenceCard
                                        title="Transport"
                                        emoji="🚇"
                                        value={preferences.transport_needs || []}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'transport_needs',
                                            title: 'Transport Needs',
                                            type: 'multiselect',
                                            options: [
                                                { value: 'metro', label: '🚇 Metro' },
                                                { value: 'bus', label: '🚌 Bus' },
                                                { value: 'rer', label: '🚉 RER/Train' },
                                                { value: 'bike', label: '🚲 Bike' },
                                            ]
                                        })}
                                    />
                                    <PreferenceCard
                                        title="Services"
                                        emoji="🏪"
                                        value={preferences.service_needs || []}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'service_needs',
                                            title: 'Nearby Services',
                                            type: 'multiselect',
                                            options: [
                                                { value: 'grocery', label: '🛒 Grocery' },
                                                { value: 'hospital', label: '🏥 Hospital' },
                                                { value: 'pharmacy', label: '💊 Pharmacy' },
                                                { value: 'atm', label: '🏧 ATM' },
                                            ]
                                        })}
                                    />
                                </div>
                            </section>

                            {/* Amenities */}
                            <section className="mb-8">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">✨ Amenities</h2>
                                <div className="grid gap-3">
                                    <PreferenceCard
                                        title="Must-Have Amenities"
                                        emoji="✨"
                                        value={preferences.must_have_amenities || []}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'must_have_amenities',
                                            title: 'Must-Have Amenities',
                                            type: 'multiselect',
                                            options: [
                                                { value: 'fiber', label: '📶 Fiber Internet' },
                                                { value: 'parking', label: '🚗 Parking' },
                                                { value: 'balcony', label: '☀️ Balcony' },
                                                { value: 'elevator', label: '🛗 Elevator' },
                                                { value: 'laundry', label: '🧺 Laundry' },
                                                { value: 'dishwasher', label: '🍽️ Dishwasher' },
                                            ]
                                        })}
                                    />
                                </div>
                            </section>
                        </>
                    ) : (
                        /* Landlord Preferences */
                        <>
                            <section className="mb-8">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">👥 Tenant Preferences</h2>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <PreferenceCard
                                        title="Accepted Tenant Types"
                                        emoji="👥"
                                        value={preferences.accepted_tenant_types || []}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'accepted_tenant_types',
                                            title: 'Preferred Tenants',
                                            type: 'multiselect',
                                            options: [
                                                { value: 'student', label: '🎓 Students' },
                                                { value: 'employee', label: '💼 Employees' },
                                                { value: 'freelancer', label: '💻 Freelancers' },
                                                { value: 'family', label: '👨‍👩‍👧 Families' },
                                            ]
                                        })}
                                    />
                                    <PreferenceCard
                                        title="Nationality Pref"
                                        emoji="🌍"
                                        value={preferences.nationality_preference || 'No preference'}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'nationality_preference',
                                            title: 'Nationality Preference',
                                            type: 'select',
                                            options: [
                                                { value: 'no_preference', label: '🌐 No preference' },
                                                { value: 'french', label: '🇫🇷 French preferred' },
                                                { value: 'international', label: '🌍 International' },
                                            ]
                                        })}
                                    />
                                    <PreferenceCard
                                        title="Gender Pref"
                                        emoji="👤"
                                        value={preferences.gender_preference || 'No preference'}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'gender_preference',
                                            title: 'Gender Preference',
                                            type: 'select',
                                            options: [
                                                { value: 'no_preference', label: '🤷 No preference' },
                                                { value: 'female_only', label: '👩 Female only' },
                                                { value: 'male_only', label: '👨 Male only' },
                                            ]
                                        })}
                                    />
                                </div>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 Requirements</h2>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <PreferenceCard
                                        title="Accepted Guarantees"
                                        emoji="🛡️"
                                        value={preferences.accepted_guarantees || []}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'accepted_guarantees',
                                            title: 'Accepted Guarantees',
                                            type: 'multiselect',
                                            options: [
                                                { value: 'visale', label: '🏛️ Visale' },
                                                { value: 'garantme', label: '🔐 GarantMe' },
                                                { value: 'parents', label: '👨‍👩‍👧 Parents' },
                                                { value: 'bank', label: '🏦 Bank' },
                                            ]
                                        })}
                                    />
                                    <PreferenceCard
                                        title="House Rules"
                                        emoji="📋"
                                        value={preferences.house_rules || []}
                                        onEdit={() => openEdit({
                                            isOpen: true,
                                            key: 'house_rules',
                                            title: 'House Rules',
                                            type: 'multiselect',
                                            options: [
                                                { value: 'no_smoking', label: '🚭 No Smoking' },
                                                { value: 'no_pets', label: '🐾 No Pets' },
                                                { value: 'no_parties', label: '🎉 No Parties' },
                                            ]
                                        })}
                                    />
                                </div>
                            </section>
                        </>
                    )}
                </main>

                {/* Edit Modal */}
                <EditModal
                    isOpen={editModal.isOpen}
                    title={editModal.title}
                    currentValue={preferences[editModal.key]}
                    options={editModal.options}
                    type={editModal.type}
                    min={editModal.min}
                    max={editModal.max}
                    unit={editModal.unit}
                    onSave={(value) => savePreference(editModal.key, value)}
                    onClose={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                />

                {saving && (
                    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 shadow-2xl">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-blue-600 mx-auto"></div>
                            <p className="mt-2 text-gray-600">Saving...</p>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
