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
    }, []);

    return (
        <div className="space-y-4">
            {/* Address Autocomplete */}
            {question.type === 'address_autocomplete' && (
                <div>
                    <AddressAutocomplete
                        onSelectAction={(result) => setSelectedAddress(result)}
                        restrictToCities={question.restrictToCities || []}
                        placeholder={question.placeholder || t('common.placeholders.address')}
                        variant="onboarding"
                    />
                    {selectedAddress && (
                        <div className="mt-3 px-4 py-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl">
                            <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                                 {selectedAddress.display}
                            </p>
                        </div>
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
                        className="w-full mt-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-sm hover: transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t('common.back')} →
                    </button>
                </div>
            )}

            {/* Text Input */}
            {question.type === 'text' && (
                <div>
                    <input
                        type="text"
                        placeholder={question.placeholder}
                        className="w-full px-6 py-4 text-lg text-gray-900 dark:text-white bg-white/50 dark:bg-zinc-800/50 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 transition-colors placeholder-zinc-400 dark:placeholder-zinc-500"
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
                        className="w-full mt-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-sm hover: transition-all transform hover:-translate-y-0.5"
                    >
                        {t('common.next')} →
                    </button>
                </div>
            )}

            {/* Select Dropdown (Using Combobox) */}
            {question.type === 'select' && (
                <div>
                    <Combobox
                        options={question.selectOptions || []}
                        value={responses[question.id] || ''}
                        onChange={(val) => onAnswer(val)}
                        placeholder={t('common.placeholders.selectOption')}
                    />
                    {question.id === 'nationality' && (
                        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400 text-center">
                            {t('onboarding.university.nationalityNote', undefined, 'This field is collected strictly for demographic surveys. It is never used in matching or shared with landlords.')}
                        </p>
                    )}
                </div>
            )}

            {/* University Select (Using Combobox) */}
            {question.type === 'university_select' && (
                <div>
                    <Combobox
                        options={universityOptions}
                        value="" // Reset after each selection logic
                        onChange={(val) => {
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

                    {showManualUniversityInput && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg space-y-4"
                        >
                            <h3 className="font-semibold text-zinc-900 dark:text-white">{t('onboarding.university.manualTitle', undefined, 'Manual University Entry')}</h3>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={manualUniName}
                                    onChange={(e) => setManualUniName(e.target.value)}
                                    placeholder={t('common.placeholders.universityName', undefined, 'University Name')}
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-teal-500 transition-colors"
                                    maxLength={100}
                                />
                                <input
                                    type="text"
                                    value={manualUniCity}
                                    onChange={(e) => setManualUniCity(e.target.value)}
                                    placeholder={t('common.placeholders.city')}
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-teal-500 transition-colors"
                                    maxLength={50}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowManualUniversityInput(false)}
                                    className="flex-1 py-3 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 font-medium transition-colors"
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
                                    className="flex-[2] py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
                                >
                                    {t('common.next')} →
                                </button>
                            </div>
                        </motion.div>
                    )}

                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-4 text-center">
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
                    <div className="space-y-6">
                        <p className="text-zinc-600 dark:text-zinc-400 text-center px-4">
                            {centerText}{t('onboarding.radius.help', undefined, 'drag the pin to select your target search area, and use the slider to adjust your commute radius.')}
                        </p>
                        <RadiusLocationPicker
                            initialLat={currentLat}
                            initialLng={currentLng}
                            radiusMeters={mapRadius}
                            onLocationChange={(lat: number, lng: number) => setMapCenter({ lat, lng })}
                        />

                        <div className="bg-white/50 dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 mx-1">
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{t('onboarding.radius.areaSize', undefined, 'Search Area Size')}</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('onboarding.radius.commuteDesc', undefined, 'Maximum commute distance')}</p>
                                </div>
                                <div translate="no" className="notranslate text-lg font-bold text-teal-600 dark:text-teal-400">
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
                                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-teal-600"
                            />
                            <div className="flex justify-between text-xs text-zinc-400 mt-2 font-medium">
                                <span translate="no" className="notranslate">500m</span>
                                <span translate="no" className="notranslate">20km</span>
                            </div>
                        </div>

                        <button
                            onClick={() => onAnswer({ lat: currentLat, lng: currentLng, radius: mapRadius })}
                            className="w-full mt-6 py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-sm hover: transition-all transform hover:-translate-y-0.5"
                        >
                            {t('common.next')} →
                        </button>
                    </div>
                );
            })()}

            {/* Range Slider */}
            {question.type === 'range' && (
                <div className="py-4">
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
                        className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    <div className="flex justify-between mt-4">
                        <span translate="no" className="notranslate text-zinc-500 dark:text-zinc-400">
                            {question.unit === '€' ? question.unit : ''}{question.min}{question.unit !== '€' ? question.unit : ''}
                        </span>
                        <span translate="no" className="notranslate text-2xl font-bold text-teal-600 dark:text-teal-400">
                            {question.unit === '€' ? question.unit : ''}{responses[question.id] || question.min}{question.unit !== '€' ? question.unit : ''}
                        </span>
                        <span translate="no" className="notranslate text-zinc-500 dark:text-zinc-400">
                            {question.unit === '€' ? question.unit : ''}{question.max}{question.unit !== '€' ? question.unit : ''}+
                        </span>
                    </div>
                    <button
                        onClick={() => onAnswer(responses[question.id] || question.min)}
                        className="w-full mt-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-sm hover: transition-all transform hover:-translate-y-0.5"
                    >
                        {t('common.next')} →
                    </button>
                </div>
            )}

            {/* Multi-Select */}
            {question.type === 'multiselect' && (
                <div>
                    <div className="grid grid-cols-2 gap-3">
                        {question.options?.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => onMultiSelectToggle(option.value, question.maxSelections || 5)}
                                className={`px-4 py-3 text-left rounded-xl border-2 transition-all ${multiSelectValues.includes(option.value)
                                    ? 'bg-teal-100/50 dark:bg-teal-900/30 border-teal-500 text-teal-800 dark:text-teal-200'
                                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-teal-300 dark:hover:border-teal-700'
                                    }`}
                            >
                                <span className="font-medium text-sm sm:text-base">{t(option.label, undefined, option.label)}</span>
                            </button>
                        ))}
                    </div>
                    {multiSelectValues.length > 0 && (
                        <button
                            onClick={() => onAnswer(multiSelectValues)}
                            className="w-full mt-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-sm hover: transition-all transform hover:-translate-y-0.5"
                        >
                            {t('common.next')} ({multiSelectValues.length} {t('common.selected', undefined, 'selected')}) →
                        </button>
                    )}
                </div>
            )}

            {/* Regular Options (no type) */}
            {!question.type && question.options?.map((option, index) => (
                <button
                    key={index}
                    onClick={() => onAnswer(option.value)}
                    className="w-full text-left px-6 py-5 bg-zinc-50 hover:bg-teal-50 dark:bg-zinc-800/50 dark:hover:bg-teal-900/20 rounded-xl border-2 border-transparent hover:border-teal-500 dark:hover:border-teal-400 transition-all transform hover:-translate-y-0.5 hover:shadow-md group"
                >
                    <span className="text-lg font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                        {t(option.label, undefined, option.label)}
                    </span>
                </button>
            ))}
        </div>
    );
}
