'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Shield, Bell, Settings, ArrowLeft, Loader2, Globe, Heart, DollarSign, Home, MapPin, Sparkles, Check, X, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import PremiumLayout from '@/components/PremiumLayout';
import { useLanguage } from '@/lib/LanguageContext';

// Preference card component for editable sections
interface PreferenceCardProps {
    title: string;
    icon: any;
    value: string | string[] | number;
    onEdit: () => void;
    isCurrency?: boolean;
    isSurface?: boolean;
}

function PreferenceCard({ title, icon: Icon, value, onEdit, isCurrency, isSurface }: PreferenceCardProps) {
    const { t } = useLanguage();
    
    let displayValue = '';
    if (Array.isArray(value)) {
        displayValue = value.map(v => t(`settings.preferences.options.${v}`, undefined, v)).join(', ');
    } else if (isCurrency) {
        displayValue = `€${value}`;
    } else if (isSurface) {
        displayValue = `${value}m²`;
    } else if (value !== undefined && value !== null) {
        displayValue = t(`settings.preferences.options.${value}`, undefined, value.toString());
    } else {
        displayValue = t('settings.preferences.notSet', undefined, 'Not set');
    }

    return (
        <button
            onClick={onEdit}
            className="w-full text-left p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all group"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-zinc-700 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                        <Icon className="w-5 h-5 text-teal-500" />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{title}</h3>
                        <p className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider truncate max-w-[200px]">{displayValue}</p>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
            </div>
        </button>
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
    const { t } = useLanguage();
    const [value, setValue] = useState(currentValue);
    const [multiValues, setMultiValues] = useState<string[]>(Array.isArray(currentValue) ? currentValue : []);

    useEffect(() => {
        setValue(currentValue);
        setMultiValues(Array.isArray(currentValue) ? currentValue : []);
    }, [currentValue, isOpen]);

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
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md" />
                    <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black tracking-tight">{title}</h3>
                            <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"><X className="w-5 h-5 text-zinc-400" /></button>
                        </div>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                            {type === 'select' && options && options.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setValue(opt.value)}
                                    className={`w-full text-left px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${value === opt.value
                                        ? 'bg-teal-500 text-white shadow-xl shadow-teal-500/20'
                                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        {opt.label}
                                        {value === opt.value && <Check className="w-4 h-4" />}
                                    </div>
                                </button>
                            ))}

                            {type === 'multiselect' && options && options.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => toggleMultiValue(opt.value)}
                                    className={`w-full text-left px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${multiValues.includes(opt.value)
                                        ? 'bg-teal-500 text-white shadow-xl shadow-teal-500/20'
                                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        {opt.label}
                                        {multiValues.includes(opt.value) && <Check className="w-4 h-4" />}
                                    </div>
                                </button>
                            ))}

                            {type === 'range' && (
                                <div className="py-8">
                                    <input
                                        type="range"
                                        min={min}
                                        max={max}
                                        value={value || min}
                                        onChange={(e) => setValue(parseInt(e.target.value))}
                                        className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full appearance-none cursor-pointer accent-teal-500"
                                    />
                                    <div className="flex justify-between mt-6">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{unit === '€' ? unit : ''}{min}{unit !== '€' ? unit : ''}</span>
                                        <span className="text-2xl font-black text-teal-500">{unit === '€' ? unit : ''}{value || min}{unit !== '€' ? unit : ''}</span>
                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{unit === '€' ? unit : ''}{max}{unit !== '€' ? unit : ''}+</span>
                                    </div>
                                </div>
                            )}

                            {type === 'text' && (
                                <input
                                    type="text"
                                    value={value || ''}
                                    onChange={(e) => setValue(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl px-6 py-4 font-black text-sm uppercase tracking-widest focus:ring-2 focus:ring-teal-500/20 transition-all"
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-10">
                            <button onClick={onClose} className="py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleSave} className="py-4 bg-teal-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-teal-500/20 hover:scale-105 transition-all">
                                {t('common.save')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

export default function SettingsPreferencesPage() {
    const { t } = useLanguage();
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
            success(t('settings.preferences.updated', undefined, 'Updated!'));
        } catch (error) {
            showError(t('settings.preferences.failed', undefined, 'Failed to save'));
        } finally {
            setSaving(false);
            setEditModal(prev => ({ ...prev, isOpen: false }));
        }
    };

    const openEdit = (config: any) => {
        setEditModal({ ...config, isOpen: true });
    };

    if (loading) return <PremiumLayout withNavbar={true}><div className="flex justify-center items-center py-40"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div></PremiumLayout>;

    const isTenant = user?.role === 'tenant';

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

                        <div className="flex flex-col gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-[2rem] border border-zinc-200/50 dark:border-zinc-700/30 backdrop-blur-xl">
                            {[
                                { id: 'account', icon: User, label: t('settings.tabs.profile'), path: '/settings/account' },
                                { id: 'notifications', icon: Bell, label: t('settings.tabs.notifications'), path: '/settings/notifications' },
                                { id: 'privacy', icon: Shield, label: t('settings.tabs.privacy'), path: '/settings/privacy' },
                                { id: 'preferences', icon: Settings, label: t('settings.tabs.preferences'), path: '/settings/preferences' }
                            ].map((tab) => (
                                <div key={tab.id} className="flex flex-col">
                                    <button
                                        onClick={() => router.push(tab.path)}
                                        className={`flex items-center gap-4 px-6 py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-widest transition-all duration-500 ${
                                            tab.id === 'preferences' 
                                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xl scale-100' 
                                            : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                        }`}
                                    >
                                        <tab.icon className={`w-4 h-4 ${tab.id === 'preferences' ? 'text-teal-500' : ''}`} />
                                        {tab.label}
                                    </button>
                                    
                                    {tab.id === 'preferences' && (
                                        <div className="px-6 py-4 flex flex-col gap-4">
                                            <button 
                                                className="text-[10px] font-black uppercase tracking-widest text-left text-teal-500"
                                            >
                                                {t('settings.preferences.matchingCriteria')}
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
                                <h2 className="text-2xl font-black tracking-tight mb-8">{t('settings.preferences.title')}</h2>
                                
                                <div className="space-y-12">
                                    <section>
                                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                            <User className="w-3 h-3" /> {t('settings.preferences.identity')}
                                        </h3>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <PreferenceCard title={t('settings.preferences.nationality')} icon={Globe} value={preferences.nationality} onEdit={() => openEdit({ key: 'nationality', title: t('settings.preferences.nationality'), type: 'select', options: ['French', 'American', 'British', 'German', 'Italian', 'Spanish', 'Other'].map(n => ({ value: n.toLowerCase(), label: n })) })} />
                                            <PreferenceCard title={t('settings.preferences.languages')} icon={Globe} value={preferences.languages} onEdit={() => openEdit({ key: 'languages', title: t('settings.preferences.languages'), type: 'multiselect', options: [{ value: 'fr', label: '🇫🇷 French' }, { value: 'en', label: '🇬🇧 English' }, { value: 'es', label: '🇪🇸 Spanish' }, { value: 'de', label: '🇩🇪 German' }] })} />
                                            <PreferenceCard title={t('settings.preferences.gender')} icon={User} value={preferences.gender} onEdit={() => openEdit({ key: 'gender', title: t('settings.preferences.gender'), type: 'select', options: [{ value: 'female', label: t('settings.preferences.options.female') }, { value: 'male', label: t('settings.preferences.options.male') }, { value: 'other', label: t('settings.preferences.options.other') }] })} />
                                        </div>
                                    </section>

                                    {isTenant ? (
                                        <>
                                            <section>
                                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                    <DollarSign className="w-3 h-3" /> {t('settings.preferences.housing')}
                                                </h3>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <PreferenceCard title={t('settings.preferences.maxBudget')} icon={DollarSign} value={preferences.budget || 0} isCurrency={true} onEdit={() => openEdit({ key: 'budget', title: t('settings.preferences.maxBudget'), type: 'range', min: 300, max: 3000, unit: '€' })} />
                                                    <PreferenceCard title={t('settings.preferences.minSurface')} icon={Home} value={preferences.min_surface_area || 0} isSurface={true} onEdit={() => openEdit({ key: 'min_surface_area', title: t('settings.preferences.minSurface'), type: 'range', min: 9, max: 100, unit: 'm²' })} />
                                                    <PreferenceCard title={t('settings.preferences.furnished')} icon={Home} value={preferences.furnished_preference} onEdit={() => openEdit({ key: 'furnished_preference', title: t('settings.preferences.furnished'), type: 'select', options: [{ value: 'furnished', label: t('settings.preferences.options.furnished') }, { value: 'unfurnished', label: t('settings.preferences.options.unfurnished') }, { value: 'no_preference', label: t('settings.preferences.options.noPreference') }] })} />
                                                </div>
                                            </section>

                                            <section>
                                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                    <MapPin className="w-3 h-3" /> {t('settings.preferences.location')}
                                                </h3>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <PreferenceCard title={t('settings.preferences.near')} icon={MapPin} value={preferences.proximity_landmark} onEdit={() => openEdit({ key: 'proximity_landmark', title: t('settings.preferences.near'), type: 'text' })} />
                                                    <PreferenceCard title={t('settings.preferences.transport')} icon={MapPin} value={preferences.transport_needs} onEdit={() => openEdit({ key: 'transport_needs', title: t('settings.preferences.transport'), type: 'multiselect', options: [{ value: 'metro', label: t('settings.preferences.options.metro') }, { value: 'bus', label: t('settings.preferences.options.bus') }, { value: 'rer', label: t('settings.preferences.options.rer') }, { value: 'bike', label: t('settings.preferences.options.bike') }] })} />
                                                </div>
                                            </section>

                                            <section>
                                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                     <Sparkles className="w-3 h-3" /> {t('settings.preferences.amenities')}
                                                 </h3>
                                                 <div className="grid gap-4">
                                                     <PreferenceCard title={t('settings.preferences.mustHave')} icon={Sparkles} value={preferences.must_have_amenities} onEdit={() => openEdit({ key: 'must_have_amenities', title: t('settings.preferences.mustHave'), type: 'multiselect', options: [{ value: 'fiber', label: t('settings.preferences.options.fiber') }, { value: 'parking', label: t('settings.preferences.options.parking') }, { value: 'balcony', label: t('settings.preferences.options.balcony') }, { value: 'elevator', label: t('settings.preferences.options.elevator') }, { value: 'laundry', label: t('settings.preferences.options.laundry') }, { value: 'dishwasher', label: t('settings.preferences.options.dishwasher') }] })} />
                                                 </div>
                                             </section>

                                             <section>
                                                 <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                     <DollarSign className="w-3 h-3" /> {t('settings.preferences.caf')}
                                                 </h3>
                                                 <div className="grid gap-4 sm:grid-cols-2">
                                                     <PreferenceCard title={t('settings.preferences.cafPreference')} icon={DollarSign} value={preferences.caf_preference} onEdit={() => openEdit({ key: 'caf_preference', title: t('settings.preferences.cafPreference'), type: 'select', options: [{ value: 'yes', label: t('settings.preferences.options.yes') }, { value: 'no', label: t('settings.preferences.options.no') }] })} />
                                                 </div>
                                             </section>
                                        </>
                                    ) : (
                                        <>
                                            <section>
                                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                    <Heart className="w-3 h-3" /> {t('settings.preferences.tenant')}
                                                </h3>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <PreferenceCard title={t('settings.preferences.tenantType')} icon={Heart} value={preferences.accepted_tenant_types} onEdit={() => openEdit({ key: 'accepted_tenant_types', title: t('settings.preferences.tenantType'), type: 'multiselect', options: [{ value: 'student', label: t('settings.preferences.options.student') }, { value: 'employee', label: t('settings.preferences.options.employee') }, { value: 'freelancer', label: t('settings.preferences.options.freelancer') }, { value: 'family', label: t('settings.preferences.options.family') }] })} />
                                                    <PreferenceCard title={t('settings.preferences.nationality')} icon={Globe} value={preferences.nationality_preference} onEdit={() => openEdit({ key: 'nationality_preference', title: t('settings.preferences.nationality'), type: 'select', options: [{ value: 'no_preference', label: t('settings.preferences.options.noPreference') }, { value: 'french', label: t('settings.preferences.options.frenchPreferred') }, { value: 'international', label: t('settings.preferences.options.international') }] })} />
                                                </div>
                                            </section>

                                            <section>
                                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                    <ShieldCheck className="w-3 h-3" /> {t('settings.preferences.requirements')}
                                                </h3>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <PreferenceCard title={t('settings.preferences.guarantees')} icon={Shield} value={preferences.accepted_guarantees} onEdit={() => openEdit({ key: 'accepted_guarantees', title: t('settings.preferences.guarantees'), type: 'multiselect', options: [{ value: 'visale', label: t('settings.preferences.options.visale') }, { value: 'garantme', label: t('settings.preferences.options.garantme') }, { value: 'parents', label: t('settings.preferences.options.parents') }, { value: 'bank', label: t('settings.preferences.options.bank') }] })} />
                                                    <PreferenceCard title={t('settings.preferences.rules')} icon={AlertTriangle} value={preferences.house_rules} onEdit={() => openEdit({ key: 'house_rules', title: t('settings.preferences.rules'), type: 'multiselect', options: [{ value: 'no_smoking', label: t('settings.preferences.options.noSmoking') }, { value: 'no_pets', label: t('settings.preferences.options.noPets') }, { value: 'no_parties', label: t('settings.preferences.options.noParties') }] })} />
                                                </div>
                                            </section>

                                            <section>
                                                 <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                     <DollarSign className="w-3 h-3" /> {t('settings.preferences.caf')}
                                                 </h3>
                                                 <div className="grid gap-4 sm:grid-cols-2">
                                                     <PreferenceCard title={t('settings.preferences.cafEligibility')} icon={DollarSign} value={preferences.caf_eligibility} onEdit={() => openEdit({ key: 'caf_eligibility', title: t('settings.preferences.cafEligibility'), type: 'select', options: [{ value: 'yes', label: t('settings.preferences.options.yes') }, { value: 'no', label: t('settings.preferences.options.no') }] })} />
                                                 </div>
                                             </section>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <EditModal
                isOpen={editModal.isOpen}
                title={editModal.title}
                currentValue={preferences[editModal.key]}
                options={editModal.options}
                type={editModal.type}
                min={editModal.min}
                max={editModal.max}
                unit={editModal.unit}
                onSave={(val) => savePreference(editModal.key, val)}
                onClose={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
            />

            {saving && (
                <div className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm flex items-center justify-center z-[200]">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl flex items-center gap-4">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('settings.preferences.updating', undefined, 'Updating...')}</p>
                    </div>
                </div>
            )}
        </PremiumLayout>
    );
}
