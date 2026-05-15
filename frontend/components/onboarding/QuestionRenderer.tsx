'use client';

import { useState, useMemo } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, GraduationCap, Building2, Check, ArrowRight, X } from 'lucide-react';
import RadiusLocationPicker from '../RadiusLocationPicker';
import AddressAutocomplete, { AddressResult } from '../AddressAutocomplete';
import Combobox from '../Combobox';
import { Question, FRENCH_UNIVERSITIES } from './onboardingQuestions';

interface QuestionRendererProps {
    question: Question;
    responses: Record<string, any>;
    onAnswer: (value: any) => void;
    onRangeUpdate: (id: string, value: number) => void;
    multiSelectValues: string[];
    onMultiSelectToggle: (value: string, max: number) => void;
    sanitizeInput: (input: string) => string;
    userType: 'tenant' | 'landlord' | 'agency';
}

export default function QuestionRenderer({
    question,
    responses,
    onAnswer,
    onRangeUpdate,
    multiSelectValues,
    onMultiSelectToggle,
    sanitizeInput,
    userType,
}: QuestionRendererProps) {
    const { t } = useLanguage();
    const [showManualUniversityInput, setShowManualUniversityInput] = useState(false);
    const [manualUniName, setManualUniName] = useState('');
    const [manualUniCity, setManualUniCity] = useState('');
    const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [mapRadius, setMapRadius] = useState<number>(2000);

    const universityOptions = useMemo(() => {
        const options = FRENCH_UNIVERSITIES.flatMap(cityGroup => 
            cityGroup.universities.map(uni => ({
                label: uni.label,
                value: `${uni.value}|${cityGroup.city}|${uni.label}`,
                group: cityGroup.city
            }))
        );
        options.push({
            label: t('onboarding.university.other', undefined, 'Other / My school isn\'t listed'),
            value: 'other|other|other',
            group: 'Other'
        });
        return options;
    }, [t]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants: any = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring", damping: 25, stiffness: 300 }
        }
    };

    /* ----------------------------------------------------------------
       Render Helpers
       ---------------------------------------------------------------- */

    const renderAddressAutocomplete = () => (
        <div className="space-y-8">
            <div className="relative group">
                <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10 text-zinc-400 group-focus-within:text-zinc-900 transition-colors">
                    <Search className="w-5 h-5" />
                </div>
                <AddressAutocomplete
                    onSelectAction={(result) => setSelectedAddress(result)}
                    restrictToCities={question.restrictToCities || []}
                    placeholder={question.placeholder || t('common.placeholders.address')}
                    variant="onboarding"
                />
            </div>
            
            <AnimatePresence>
                {selectedAddress && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="px-10 py-8 bg-zinc-50 border border-zinc-100 rounded-[2.5rem] flex items-center gap-6"
                    >
                        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-white shrink-0">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Confirmed Location</p>
                            <p className="text-xl font-bold text-zinc-900 truncate leading-tight">
                                {selectedAddress.display}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                    if (selectedAddress) {
                        onAnswer({
                            address: selectedAddress.address,
                            city: selectedAddress.city,
                            postal_code: selectedAddress.postal_code,
                            lat: selectedAddress.lat,
                            lng: selectedAddress.lng,
                            display: selectedAddress.display,
                        });
                    }
                }}
                disabled={!selectedAddress}
                className="w-full py-8 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.5em] rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] disabled:opacity-30 transition-all flex items-center justify-center gap-4 group"
            >
                {t('common.continue', undefined, 'Continue')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.button>
        </div>
    );

    const renderUniversitySelect = () => (
        <div className="space-y-8">
            <div className="relative group">
                <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10 text-zinc-400 group-focus-within:text-zinc-900 transition-colors">
                    <GraduationCap className="w-5 h-5" />
                </div>
                <Combobox
                    options={universityOptions}
                    value=""
                    onChangeAction={(val) => {
                        if (val === 'other|other|other') {
                            setShowManualUniversityInput(true);
                        } else if (val && typeof val === 'string' && val.includes('|')) {
                            const [uniId, city, label] = val.split('|');
                            setShowManualUniversityInput(false);
                            onAnswer({ 
                                university_id: sanitizeInput(uniId), 
                                university_name: sanitizeInput(label), 
                                city: sanitizeInput(city) 
                            });
                        }
                    }}
                    placeholder={t('common.placeholders.selectUniversity')}
                />
            </div>

            <AnimatePresence>
                {showManualUniversityInput && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-10 bg-zinc-50 rounded-[3rem] border border-zinc-100 shadow-inner space-y-8">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                    <Building2 className="w-4 h-4" />
                                    Manual Entry
                                </h3>
                                <button onClick={() => setShowManualUniversityInput(false)} className="text-zinc-400 hover:text-zinc-900 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={manualUniName}
                                    onChange={(e) => setManualUniName(e.target.value)}
                                    placeholder={t('common.placeholders.universityName', undefined, 'School Name')}
                                    className="w-full px-8 py-6 bg-white border-none rounded-2xl focus:ring-2 focus:ring-zinc-900 transition-all font-bold placeholder:text-zinc-300"
                                />
                                <input
                                    type="text"
                                    value={manualUniCity}
                                    onChange={(e) => setManualUniCity(e.target.value)}
                                    placeholder={t('common.placeholders.city')}
                                    className="w-full px-8 py-6 bg-white border-none rounded-2xl focus:ring-2 focus:ring-zinc-900 transition-all font-bold placeholder:text-zinc-300"
                                />
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    if (manualUniName.trim() && manualUniCity.trim()) {
                                        onAnswer({
                                            university_id: 'custom',
                                            university_name: sanitizeInput(manualUniName),
                                            city: sanitizeInput(manualUniCity)
                                        });
                                    }
                                }}
                                disabled={!manualUniName.trim() || !manualUniCity.trim()}
                                className="w-full py-6 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all disabled:opacity-30"
                            >
                                {t('common.confirm')}
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    const renderLocationRadius = () => {
        const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
            'Paris': { lat: 48.8566, lng: 2.3522 },
            'Lyon': { lat: 45.7640, lng: 4.8357 },
            'Toulouse': { lat: 43.6047, lng: 1.4442 },
            'Bordeaux': { lat: 44.8378, lng: -0.5792 },
            'Lille': { lat: 50.6292, lng: 3.0573 },
            'Marseille': { lat: 43.2965, lng: 5.3698 },
            'Nantes': { lat: 47.2184, lng: -1.5536 },
        };

        const uniResponse = responses?.university;
        const uniCity = typeof uniResponse === 'object' ? uniResponse?.city : null;
        const workplaceResponse = responses?.workplace;
        const workplaceLat = typeof workplaceResponse === 'object' ? workplaceResponse?.lat : null;
        const workplaceLng = typeof workplaceResponse === 'object' ? workplaceResponse?.lng : null;

        const coords = uniCity ? CITY_COORDS[uniCity] : (workplaceLat && workplaceLng ? { lat: workplaceLat, lng: workplaceLng } : null);
        const currentLat = mapCenter?.lat ?? (coords?.lat ?? 46.6034);
        const currentLng = mapCenter?.lng ?? (coords?.lng ?? 2.2137);

        return (
            <div className="space-y-10">
                <div className="rounded-[3rem] overflow-hidden border border-zinc-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] relative group">
                    <RadiusLocationPicker
                        initialLat={currentLat}
                        initialLng={currentLng}
                        radiusMeters={mapRadius}
                        onLocationChange={(lat: number, lng: number) => setMapCenter({ lat, lng })}
                    />
                    <div className="absolute top-6 left-6 right-6 flex items-center justify-center pointer-events-none">
                        <div className="px-6 py-3 bg-white/90 backdrop-blur shadow-xl rounded-full border border-zinc-100 flex items-center gap-3">
                            <div className="w-2 h-2 bg-zinc-900 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">Interactive Selection</span>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-50 p-10 rounded-[3rem] border border-zinc-100 shadow-inner">
                    <div className="flex justify-between items-end mb-10">
                        <div>
                            <h3 className="text-[10px] font-black text-zinc-900 uppercase tracking-[0.3em] mb-2">{t('onboarding.radius.areaSize', undefined, 'Search Area Radius')}</h3>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('onboarding.radius.commuteDesc', undefined, 'Maximum commute distance')}</p>
                        </div>
                        <div className="text-4xl font-black text-zinc-900 tracking-tighter">
                            {mapRadius >= 1000 ? `${+(mapRadius / 1000).toFixed(1)}km` : `${mapRadius}m`}
                        </div>
                    </div>
                    <input
                        type="range"
                        min={500}
                        max={20000}
                        step={500}
                        value={mapRadius}
                        onChange={(e) => setMapRadius(Number(e.target.value))}
                        className="w-full h-1.5 bg-zinc-200 rounded-full appearance-none cursor-pointer accent-zinc-900"
                    />
                    <div className="flex justify-between text-[9px] font-black text-zinc-300 mt-6 uppercase tracking-[0.5em]">
                        <span>500m</span>
                        <span>20km</span>
                    </div>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onAnswer({ lat: currentLat, lng: currentLng, radius: mapRadius })}
                    className="w-full py-8 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.5em] rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] transition-all"
                >
                    {t('common.confirm_area', undefined, 'Confirm Search Area')}
                </motion.button>
            </div>
        );
    };

    const renderRange = () => {
        const value = responses[question.id] || question.min || 0;
        return (
            <div className="space-y-16 py-8">
                <div className="relative">
                    <motion.div 
                        animate={{ left: `${((value - (question.min || 0)) / ((question.max || 100) - (question.min || 0))) * 100}%` }}
                        className="absolute -top-16 -translate-x-1/2 flex flex-col items-center"
                    >
                        <span className="text-5xl font-black text-zinc-900 tracking-tighter mb-2">
                            {question.unit === '€' ? '€' : ''}{value}{question.unit !== '€' ? question.unit : ''}
                        </span>
                        <div className="w-0.5 h-6 bg-zinc-900" />
                    </motion.div>
                    
                    <input
                        type="range"
                        min={question.min || 0}
                        max={question.max || 100}
                        step={question.step || 1}
                        value={value}
                        onChange={(e) => onRangeUpdate(question.id, parseInt(e.target.value))}
                        className="w-full h-1.5 bg-zinc-100 rounded-full appearance-none cursor-pointer accent-zinc-900"
                    />
                    
                    <div className="flex justify-between mt-8">
                        <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{question.min}{question.unit}</span>
                        <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{question.max}{question.unit}+</span>
                    </div>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onAnswer(value)}
                    className="w-full py-8 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.5em] rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)]"
                >
                    {t('common.next')}
                </motion.button>
            </div>
        );
    };

    const renderMultiSelect = () => (
        <div className="space-y-12">
            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
                {question.options?.map((option, index) => {
                    const isSelected = multiSelectValues.includes(option.value);
                    return (
                        <motion.button
                            key={index}
                            variants={itemVariants}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => onMultiSelectToggle(option.value, question.maxSelections || 5)}
                            className={`px-8 py-8 text-left rounded-[2.5rem] transition-all duration-300 relative overflow-hidden flex items-center justify-between group ${
                                isSelected
                                ? 'bg-zinc-900 text-white shadow-2xl'
                                : 'bg-white border border-zinc-100 text-zinc-400 hover:border-zinc-300'
                            }`}
                        >
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] relative z-10 transition-colors ${isSelected ? 'text-white' : 'group-hover:text-zinc-900'}`}>
                                {t(option.label.startsWith('options.') ? `onboarding.questions.${userType}.${question.id}.${option.label}` : option.label, undefined, option.label)}
                            </span>
                            {isSelected && (
                                <motion.div layoutId="check" className="shrink-0">
                                    <Check className="w-5 h-5 text-white" />
                                </motion.div>
                            )}
                        </motion.button>
                    );
                })}
            </motion.div>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAnswer(multiSelectValues)}
                disabled={multiSelectValues.length === 0}
                className="w-full py-8 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.5em] rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] disabled:opacity-30"
            >
                {t('common.continue')} ({multiSelectValues.length} Selected)
            </motion.button>
        </div>
    );

    const renderDefaultOptions = () => (
        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
        >
            {question.options?.map((option, index) => (
                <motion.button
                    key={index}
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, x: 10 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onAnswer(option.value)}
                    className="w-full text-left px-10 py-8 bg-white hover:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 hover:border-zinc-900 transition-all group flex items-center justify-between"
                >
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 group-hover:text-white transition-colors">
                        {t(option.label.startsWith('options.') ? `onboarding.questions.${userType}.${question.id}.${option.label}` : option.label, undefined, option.label)}
                    </span>
                    <div className="w-8 h-8 rounded-full border border-zinc-100 flex items-center justify-center group-hover:border-zinc-700 transition-colors">
                        <ArrowRight className="w-4 h-4 text-transparent group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </div>
                </motion.button>
            ))}
        </motion.div>
    );

    const renderTextInput = () => (
        <div className="space-y-10">
            <div className="relative group">
                <input
                    type="text"
                    placeholder={question.placeholder}
                    className="w-full px-12 py-10 text-2xl font-bold text-zinc-900 bg-zinc-50 border-none rounded-[3rem] focus:ring-2 focus:ring-zinc-900 transition-all placeholder:text-zinc-200 text-center"
                    onKeyPress={(e) => e.key === 'Enter' && e.currentTarget.value && onAnswer(e.currentTarget.value)}
                    autoFocus
                />
            </div>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                    if (input?.value) onAnswer(input.value);
                }}
                className="w-full py-8 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.5em] rounded-[2rem] shadow-2xl transition-all"
            >
                {t('common.next')}
            </motion.button>
        </div>
    );

    /* ----------------------------------------------------------------
       Main Dispatcher
       ---------------------------------------------------------------- */

    switch (question.type) {
        case 'address_autocomplete': return renderAddressAutocomplete();
        case 'text': return renderTextInput();
        case 'university_select': return renderUniversitySelect();
        case 'location_radius': return renderLocationRadius();
        case 'range': return renderRange();
        case 'multiselect': return renderMultiSelect();
        case 'select':
        default: return renderDefaultOptions();
    }
}
