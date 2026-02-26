import { useState } from 'react';
import RadiusLocationPicker from '../RadiusLocationPicker';
import AddressAutocomplete, { AddressResult } from '../AddressAutocomplete';
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
    const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);

    return (
        <div className="space-y-4">
            {/* Address Autocomplete */}
            {question.type === 'address_autocomplete' && (
                <div>
                    <AddressAutocomplete
                        onSelectAction={(result) => setSelectedAddress(result)}
                        restrictToCities={question.restrictToCities || []}
                        placeholder={question.placeholder || 'Start typing an address…'}
                        variant="onboarding"
                    />
                    {selectedAddress && (
                        <div className="mt-3 px-4 py-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl">
                            <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                                📍 {selectedAddress.display}
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
                        className="w-full mt-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-lg hover:shadow-teal-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Continue →
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
                        className="w-full mt-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-lg hover:shadow-teal-500/25 transition-all transform hover:-translate-y-0.5"
                    >
                        Continue →
                    </button>
                </div>
            )}

            {/* Select Dropdown */}
            {question.type === 'select' && (
                <div>
                    <select
                        className="w-full px-6 py-4 text-lg text-gray-900 dark:text-white bg-white/50 dark:bg-zinc-800/50 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 transition-colors"
                        onChange={(e) => {
                            if (e.target.value) onAnswer(e.target.value);
                        }}
                    >
                        <option value="">Select an option...</option>
                        {question.selectOptions?.map((option, i) => (
                            <option key={i} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    {question.id === 'nationality' && (
                        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400 text-center">
                            This field is collected strictly for demographic surveys. It is <strong>never</strong> used in matching or shared with landlords.
                        </p>
                    )}
                </div>
            )}

            {/* University Select Dropdown (Grouped by City) + Manual Input */}
            {question.type === 'university_select' && (
                <div>
                    <select
                        id="university-select"
                        className="w-full px-6 py-4 text-lg text-gray-900 dark:text-white bg-white/50 dark:bg-zinc-800/50 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 transition-colors"
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
                            <optgroup key={cityIndex} label={`📍 ${cityGroup.city}`} className="dark:bg-zinc-800">
                                {cityGroup.universities.map((uni, uniIndex) => (
                                    <option key={uniIndex} value={`${uni.value}|${cityGroup.city}`}>
                                        {uni.label}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                        <optgroup label="📍 Other" className="dark:bg-zinc-800">
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
                                className="w-full px-6 py-4 text-lg text-gray-900 dark:text-white bg-white/50 dark:bg-zinc-800/50 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 transition-colors"
                                maxLength={100}
                            />
                            <input
                                type="text"
                                value={manualUniCity}
                                onChange={(e) => setManualUniCity(e.target.value)}
                                placeholder="City (e.g., Paris, Lyon...)"
                                className="w-full px-6 py-4 text-lg text-gray-900 dark:text-white bg-white/50 dark:bg-zinc-800/50 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 transition-colors"
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
                                className="w-full mt-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-lg hover:shadow-teal-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue →
                            </button>
                        </div>
                    )}

                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-4 text-center">
                        This helps us find properties near your campus
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
                const coords = uniCity ? CITY_COORDS[uniCity] : null;

                // Default: center of France if no university city
                const defaultLat = coords?.lat ?? 46.6034;
                const defaultLng = coords?.lng ?? 2.2137;
                const defaultZoom = coords ? 13 : 6;

                return (
                    <div>
                        <p className="mb-4 text-zinc-600 dark:text-zinc-400 text-center">
                            {coords ? `Centered on ${uniCity} — drag the pin to refine.` : 'Drag the pin to select your target search area.'}
                        </p>
                        <RadiusLocationPicker
                            initialLat={defaultLat}
                            initialLng={defaultLng}
                            radiusMeters={2000}
                            onLocationChange={(lat: number, lng: number) => onAnswer({ lat, lng })}
                        />
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
                        <span className="text-zinc-500 dark:text-zinc-400">{question.unit}{question.min}</span>
                        <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                            {question.unit}{responses[question.id] || question.min}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400">{question.unit}{question.max}+</span>
                    </div>
                    <button
                        onClick={() => onAnswer(responses[question.id] || question.min)}
                        className="w-full mt-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-lg hover:shadow-teal-500/25 transition-all transform hover:-translate-y-0.5"
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
                                className={`px-4 py-3 text-left rounded-xl border-2 transition-all ${multiSelectValues.includes(option.value)
                                    ? 'bg-teal-100/50 dark:bg-teal-900/30 border-teal-500 text-teal-800 dark:text-teal-200'
                                    : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-teal-300 dark:hover:border-teal-700'
                                    }`}
                            >
                                <span className="font-medium text-sm sm:text-base">{option.label}</span>
                            </button>
                        ))}
                    </div>
                    {multiSelectValues.length > 0 && (
                        <button
                            onClick={() => onAnswer(multiSelectValues)}
                            className="w-full mt-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-lg hover:shadow-teal-500/25 transition-all transform hover:-translate-y-0.5"
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
                    className="w-full text-left px-6 py-5 bg-zinc-50 hover:bg-teal-50 dark:bg-zinc-800/50 dark:hover:bg-teal-900/20 rounded-xl border-2 border-transparent hover:border-teal-500 dark:hover:border-teal-400 transition-all transform hover:-translate-y-0.5 hover:shadow-md group"
                >
                    <span className="text-lg font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                        {option.label}
                    </span>
                </button>
            ))}
        </div>
    );
}
