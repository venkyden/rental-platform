"use client";

import { useState, useMemo } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { motion } from 'framer-motion';
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
}

export default function QuestionRenderer({
    question,
    responses,
    onAnswer,
    onRangeUpdate,
    multiSelectValues,
    onMultiSelectToggle,
    sanitizeInput,
}: QuestionRendererProps) {
    const { t } = useLanguage();
    const [showManualUniversityInput, setShowManualUniversityInput] = useState(false);
    const [manualUniName, setManualUniName] = useState('');
    const [manualUniCity, setManualUniCity] = useState('');
    const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [mapRadius, setMapRadius] = useState<number>(2000);

    // Prepare university options for Combobox
    const universityOptions = useMemo(() => {
        const options = FRENCH_UNIVERSITIES.flatMap(cityGroup => 
            cityGroup.universities.map(uni => ({
                label: uni.label,
                value: `${uni.value}|${cityGroup.city}|${uni.label}`,
                group: cityGroup.city
            }))
        );
        // Add manual input option
        options.push({
            label: t('onboarding.university.other', undefined, 'Other / My school isn\'t listed'),
            value: 'other|other|other',
            group: 'Other'
        });
        return options;
    }, [t]);

    return (
        <div className="space-y-4">
            {/* Address Autocomplete */}
            {question.type === 'address_autocomplete' && (
                <div className="space-y-8">
                    <div className="relative group">
                        <AddressAutocomplete
                            onSelectAction={(result) => setSelectedAddress(result)}
                            restrictToCities={question.restrictToCities || []}
                            placeholder={question.placeholder || t('common.placeholders.address')}
                            variant="onboarding"
                        />
                    </div>
                    {selectedAddress && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="px-8 py-6 bg-teal-500/5 dark:bg-teal-400/5 border border-teal-500/20 rounded-[2rem] shadow-inner"
                        >
                            <p className="text-sm font-black text-teal-600 dark:text-teal-400 uppercase tracking-tight text-center">
                                 {selectedAddress.display}
                            </p>
                        </motion.div>
                    )}
                    <button
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
                        className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl shadow-zinc-900/20 dark:shadow-white/5 hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all"
                    >
                        {t('common.continue', undefined, 'Continue')} →
                    </button>
                </div>
            )}

            {/* Text Input */}
            {question.type === 'text' && (
                <div className="space-y-8">
                    <input
                        type="text"
                        placeholder={question.placeholder}
                        className="w-full px-8 py-6 text-xl font-bold text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-800/50 border-none rounded-[2rem] focus:ring-2 focus:ring-teal-500/50 transition-all placeholder:text-zinc-400 shadow-inner text-center"
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value) {
                                onAnswer(e.currentTarget.value);
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                            if (input?.value) onAnswer(input.value);
                        }}
                        className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl shadow-zinc-900/20 dark:shadow-white/5 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {t('common.next')} →
                    </button>
                </div>
            )}

            {/* Select Dropdown (Using Combobox) */}
            {question.type === 'select' && (
                <div className="space-y-6">
                    <div className="relative group">
                        <Combobox
                            options={question.selectOptions || []}
                            value={responses[question.id] || ''}
                            onChangeAction={(val) => onAnswer(val)}
                            placeholder={t('common.placeholders.selectOption')}
                        />
                    </div>
                    {question.id === 'nationality' && (
                        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 text-center uppercase tracking-widest leading-relaxed px-4">
                            {t('onboarding.university.nationalityNote', undefined, 'This field is collected strictly for demographic surveys. It is never used in matching or shared with landlords.')}
                        </p>
                    )}
                </div>
            )}

            {/* University Select (Using Combobox) */}
            {question.type === 'university_select' && (
                <div className="space-y-6">
                    <div className="relative group">
                        <Combobox
                            options={universityOptions}
                            value="" // Reset after each selection logic
                            onChangeAction={(val) => {
                                if (val === 'other|other|other') {
                                    setShowManualUniversityInput(true);
                                } else {
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

                    {showManualUniversityInput && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="mt-6 p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-6"
                        >
                            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest text-center">{t('onboarding.university.manualTitle', undefined, 'Manual University Entry')}</h3>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={manualUniName}
                                    onChange={(e) => setManualUniName(e.target.value)}
                                    placeholder={t('common.placeholders.universityName', undefined, 'University Name')}
                                    className="w-full px-6 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl focus:ring-2 focus:ring-teal-500/50 transition-all font-bold shadow-inner"
                                    maxLength={100}
                                />
                                <input
                                    type="text"
                                    value={manualUniCity}
                                    onChange={(e) => setManualUniCity(e.target.value)}
                                    placeholder={t('common.placeholders.city')}
                                    className="w-full px-6 py-4 bg-white dark:bg-zinc-900 border-none rounded-2xl focus:ring-2 focus:ring-teal-500/50 transition-all font-bold shadow-inner"
                                    maxLength={50}
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowManualUniversityInput(false)}
                                    className="flex-1 py-4 text-xs font-black text-zinc-400 hover:text-zinc-900 dark:hover:text-white uppercase tracking-widest transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={() => {
                                        if (manualUniName.trim() && manualUniCity.trim()) {
                                            onAnswer({
                                                university_id: 'custom',
                                                university_name: sanitizeInput(manualUniName),
                                                city: sanitizeInput(manualUniCity)
                                            });
                                            setManualUniName('');
                                            setManualUniCity('');
                                            setShowManualUniversityInput(false);
                                        }
                                    }}
                                    disabled={!manualUniName.trim() || !manualUniCity.trim()}
                                    className="flex-[2] py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all disabled:opacity-30"
                                >
                                    {t('common.next')} →
                                </button>
                            </div>
                        </motion.div>
                    )}

                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-4 text-center uppercase tracking-widest">
                        {t('onboarding.university.help', undefined, 'This helps us find properties near your campus')}
                    </p>
                </div>
            )}

            {/* Location Radius Picker */}
            {question.type === 'location_radius' && (() => {
                // City-to-coordinates lookup for major French cities
                const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
                    'Paris': { lat: 48.8566, lng: 2.3522 },
                    'Lyon': { lat: 45.7640, lng: 4.8357 },
                    'Toulouse': { lat: 43.6047, lng: 1.4442 },
                    'Bordeaux': { lat: 44.8378, lng: -0.5792 },
                    'Lille': { lat: 50.6292, lng: 3.0573 },
                    'Marseille / Aix': { lat: 43.2965, lng: 5.3698 },
                    'Marseille': { lat: 43.2965, lng: 5.3698 },
                    'Aix': { lat: 43.5297, lng: 5.4474 },
                    'Nantes': { lat: 47.2184, lng: -1.5536 },
                    'Strasbourg': { lat: 48.5734, lng: 7.7521 },
                    'Montpellier': { lat: 43.6108, lng: 3.8767 },
                    'Rennes': { lat: 48.1173, lng: -1.6778 },
                    'Grenoble': { lat: 45.1885, lng: 5.7245 },
                    'Nice': { lat: 43.7102, lng: 7.2620 },
                };

                // Try to get coordinates from previous university selection
                const uniResponse = responses?.university;
                const uniCity = typeof uniResponse === 'object' ? uniResponse?.city : null;

                // Try to get coordinates from workplace selection
                const workplaceResponse = responses?.workplace;
                const workplaceLat = typeof workplaceResponse === 'object' ? workplaceResponse?.lat : null;
                const workplaceLng = typeof workplaceResponse === 'object' ? workplaceResponse?.lng : null;

                const coords = uniCity ? CITY_COORDS[uniCity] : (workplaceLat && workplaceLng ? { lat: workplaceLat, lng: workplaceLng } : null);

                // Default: center of France if no location
                const defaultLat = coords?.lat ?? 46.6034;
                const defaultLng = coords?.lng ?? 2.2137;

                const currentLat = mapCenter?.lat ?? defaultLat;
                const currentLng = mapCenter?.lng ?? defaultLng;

                const centerText = uniCity ? t('onboarding.radius.centeredOn', { city: uniCity }, `Centered on ${uniCity} — `) : (workplaceResponse ? t('onboarding.radius.centeredWorkplace', undefined, 'Centered on your workplace — ') : '');

                return (
                    <div className="space-y-8">
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 text-center px-4 uppercase tracking-[0.2em] leading-relaxed">
                            {centerText}{t('onboarding.radius.help', undefined, 'drag the pin to select your target search area, and use the slider to adjust your commute radius.')}
                        </p>
                        <div className="rounded-[2.5rem] overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-2xl">
                            <RadiusLocationPicker
                                initialLat={currentLat}
                                initialLng={currentLng}
                                radiusMeters={mapRadius}
                                onLocationChange={(lat: number, lng: number) => setMapCenter({ lat, lng })}
                            />
                        </div>

                        <div className="bg-zinc-50 dark:bg-zinc-800/30 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-inner">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest">{t('onboarding.radius.areaSize', undefined, 'Search Area Size')}</h3>
                                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">{t('onboarding.radius.commuteDesc', undefined, 'Maximum commute distance')}</p>
                                </div>
                                <div translate="no" className="notranslate text-2xl font-black text-teal-600 dark:text-teal-400 tracking-tighter">
                                    {mapRadius >= 1000 ? `${+(mapRadius / 1000).toFixed(1)} km` : `${mapRadius} m`}
                                </div>
                            </div>
                            <input
                                type="range"
                                min={500}
                                max={20000}
                                step={500}
                                value={mapRadius}
                                onChange={(e) => setMapRadius(Number(e.target.value))}
                                className="w-full h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-teal-500 shadow-inner"
                            />
                            <div className="flex justify-between text-[9px] font-black text-zinc-300 dark:text-zinc-600 mt-4 uppercase tracking-[0.3em]">
                                <span translate="no" className="notranslate">500m</span>
                                <span translate="no" className="notranslate">20km</span>
                            </div>
                        </div>

                        <button
                            onClick={() => onAnswer({ lat: currentLat, lng: currentLng, radius: mapRadius })}
                            className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl shadow-zinc-900/20 dark:shadow-white/5 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            {t('common.next')} →
                        </button>
                    </div>
                );
            })()}

            {/* Range Slider */}
            {question.type === 'range' && (
                <div className="py-8 space-y-12">
                    <div className="relative">
                        <input
                            type="range"
                            min={question.min}
                            max={question.max}
                            step={question.step}
                            defaultValue={responses[question.id] || question.min}
                            onChange={(e) => {
                                const value = parseInt(e.target.value);
                                onRangeUpdate(question.id, value);
                            }}
                            className="w-full h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full appearance-none cursor-pointer accent-teal-500 shadow-inner"
                        />
                        <div className="flex justify-between mt-6">
                            <span translate="no" className="notranslate text-[10px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-widest">
                                {question.unit === '€' ? question.unit : ''}{question.min}{question.unit !== '€' ? question.unit : ''}
                            </span>
                            <div translate="no" className="notranslate text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
                                {question.unit === '€' ? question.unit : ''}{responses[question.id] || question.min}{question.unit !== '€' ? question.unit : ''}
                            </div>
                            <span translate="no" className="notranslate text-[10px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-widest">
                                {question.unit === '€' ? question.unit : ''}{question.max}{question.unit !== '€' ? question.unit : ''}+
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => onAnswer(responses[question.id] || question.min)}
                        className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl shadow-zinc-900/20 dark:shadow-white/5 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {t('common.next')} →
                    </button>
                </div>
            )}

            {/* Multi-Select */}
            {question.type === 'multiselect' && (
                <div className="space-y-10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {question.options?.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => onMultiSelectToggle(option.value, question.maxSelections || 5)}
                                className={`px-8 py-6 text-left rounded-[1.5rem] border-none transition-all group relative overflow-hidden ${multiSelectValues.includes(option.value)
                                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xl shadow-zinc-900/20 dark:shadow-white/5'
                                    : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-inner'
                                    }`}
                            >
                                <span className="font-black text-xs uppercase tracking-widest relative z-10">{t(option.label, undefined, option.label)}</span>
                                {multiSelectValues.includes(option.value) && (
                                    <motion.div 
                                        layoutId="multi-check"
                                        className="absolute right-6 top-1/2 -translate-y-1/2"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-teal-400" />
                                    </motion.div>
                                )}
                            </button>
                        ))}
                    </div>
                    {multiSelectValues.length > 0 && (
                        <button
                            onClick={() => onAnswer(multiSelectValues)}
                            className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl shadow-zinc-900/20 dark:shadow-white/5 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            {t('common.next')} ({multiSelectValues.length} {t('common.selected', undefined, 'selected')}) →
                        </button>
                    )}
                </div>
            )}

            {/* Regular Options (no type) */}
            <div className="space-y-4">
                {!question.type && question.options?.map((option, index) => (
                    <button
                        key={index}
                        onClick={() => onAnswer(option.value)}
                        className="w-full text-left px-10 py-6 bg-zinc-50 hover:bg-zinc-900 dark:bg-zinc-800/50 dark:hover:bg-white rounded-[2rem] border-none transition-all group shadow-inner hover:shadow-2xl hover:scale-[1.02] active:scale-95"
                    >
                        <span className="text-sm font-black uppercase tracking-widest text-zinc-500 group-hover:text-white dark:group-hover:text-zinc-900 transition-colors">
                            {t(option.label, undefined, option.label)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
