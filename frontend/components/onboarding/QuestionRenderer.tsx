'use client';

import { useState } from 'react';
import RadiusLocationPicker from '../RadiusLocationPicker';
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
    const [showManualUniversityInput, setShowManualUniversityInput] = useState(false);
    const [manualUniName, setManualUniName] = useState('');
    const [manualUniCity, setManualUniCity] = useState('');

    return (
        <div className="space-y-4">
            {/* Text Input */}
            {question.type === 'text' && (
                <div>
                    <input
                        type="text"
                        placeholder={question.placeholder}
                        className="w-full px-6 py-4 text-lg text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors placeholder-gray-400"
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
                        className="w-full mt-4 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all"
                    >
                        Continue →
                    </button>
                </div>
            )}

            {/* Select Dropdown */}
            {question.type === 'select' && (
                <div>
                    <select
                        className="w-full px-6 py-4 text-lg text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                        onChange={(e) => {
                            if (e.target.value) onAnswer(e.target.value);
                        }}
                    >
                        <option value="">Select an option...</option>
                        {question.selectOptions?.map((option, i) => (
                            <option key={i} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* University Select Dropdown (Grouped by City) + Manual Input */}
            {question.type === 'university_select' && (
                <div>
                    <select
                        id="university-select"
                        className="w-full px-6 py-4 text-lg text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                        onChange={(e) => {
                            if (e.target.value === 'other|other') {
                                setShowManualUniversityInput(true);
                            } else if (e.target.value) {
                                setShowManualUniversityInput(false);
                                const [uniId, city] = e.target.value.split('|');
                                let uniName = uniId;
                                for (const cityGroup of FRENCH_UNIVERSITIES) {
                                    const found = cityGroup.universities.find(u => u.value === uniId);
                                    if (found) {
                                        uniName = found.label;
                                        break;
                                    }
                                }
                                onAnswer({ university_id: sanitizeInput(uniId), university_name: sanitizeInput(uniName), city: sanitizeInput(city) });
                            }
                        }}
                    >
                        <option value="">Select your university...</option>
                        {FRENCH_UNIVERSITIES.map((cityGroup, cityIndex) => (
                            <optgroup key={cityIndex} label={`📍 ${cityGroup.city}`}>
                                {cityGroup.universities.map((uni, uniIndex) => (
                                    <option key={uniIndex} value={`${uni.value}|${cityGroup.city}`}>
                                        {uni.label}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                        <optgroup label="📍 Other">
                            <option value="other|other">My school isn't listed - Enter manually</option>
                        </optgroup>
                    </select>

                    {showManualUniversityInput && (
                        <div className="mt-4 space-y-3">
                            <input
                                type="text"
                                value={manualUniName}
                                onChange={(e) => setManualUniName(e.target.value)}
                                placeholder="Enter your school/university name"
                                className="w-full px-6 py-4 text-lg text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                                maxLength={100}
                            />
                            <input
                                type="text"
                                value={manualUniCity}
                                onChange={(e) => setManualUniCity(e.target.value)}
                                placeholder="City (e.g., Paris, Lyon...)"
                                className="w-full px-6 py-4 text-lg text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                                maxLength={50}
                            />
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
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue →
                            </button>
                        </div>
                    )}

                    <p className="text-sm text-gray-500 mt-2 text-center">
                        This helps us find properties near your campus
                    </p>
                </div>
            )}

            {/* Location Radius Picker */}
            {question.type === 'location_radius' && (
                <div>
                    <RadiusLocationPicker
                        initialLat={48.8566}
                        initialLng={2.3522}
                        radiusMeters={2000}
                        onLocationChange={(lat: number, lng: number) => onAnswer({ lat, lng })}
                    />
                </div>
            )}

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
                        className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between mt-4">
                        <span className="text-gray-600">{question.unit}{question.min}</span>
                        <span className="text-2xl font-bold text-blue-600">
                            {question.unit}{responses[question.id] || question.min}
                        </span>
                        <span className="text-gray-600">{question.unit}{question.max}+</span>
                    </div>
                    <button
                        onClick={() => onAnswer(responses[question.id] || question.min)}
                        className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all"
                    >
                        Continue →
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
                                className={`px-4 py-3 rounded-xl border-2 transition-all ${multiSelectValues.includes(option.value)
                                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    {multiSelectValues.length > 0 && (
                        <button
                            onClick={() => onAnswer(multiSelectValues)}
                            className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all"
                        >
                            Continue ({multiSelectValues.length} selected) →
                        </button>
                    )}
                </div>
            )}

            {/* Regular Options (no type) */}
            {!question.type && question.options?.map((option, index) => (
                <button
                    key={index}
                    onClick={() => onAnswer(option.value)}
                    className="w-full text-left px-6 py-5 bg-gray-50 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 rounded-xl border-2 border-gray-200 hover:border-blue-500 transition-all transform hover:scale-102 hover:shadow-md group"
                >
                    <span className="text-lg font-medium text-gray-800 group-hover:text-blue-600">
                        {option.label}
                    </span>
                </button>
            ))}
        </div>
    );
}
