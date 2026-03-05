'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────

export interface AddressResult {
    address: string;       // street + housenumber
    city: string;
    postal_code: string;
    lat: number;
    lng: number;
    display: string;       // full formatted string for the dropdown
}

interface PhotonFeature {
    type: string;
    geometry: { type: string; coordinates: [number, number] };
    properties: {
        osm_id: number;
        name?: string;
        street?: string;
        housenumber?: string;
        postcode?: string;
        city?: string;
        state?: string;
        country?: string;
        type?: string;
    };
}

interface AddressAutocompleteProps {
    /** Called when user selects an address from the dropdown */
    onSelectAction: (result: AddressResult) => void;
    /** Restrict results to these cities (lowercase). Empty = no restriction. */
    restrictToCities?: string[];
    /** Country code for Photon API (default: 'fr'). Set to '' for global. */
    countryCode?: string;
    /** Pre-filled value for the input */
    initialValue?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Additional CSS class for the input */
    inputClassName?: string;
    /** Variant: 'onboarding' uses the teal rounded style, 'form' uses standard form style */
    variant?: 'onboarding' | 'form';
    /** Allow user to proceed with typed text even if no autocomplete match */
    allowManualEntry?: boolean;
}

// ─── City bounding boxes (lon_min, lat_min, lon_max, lat_max) ───

const CITY_BOUNDS: Record<string, { bbox: string; lat: number; lng: number }> = {
    nantes: {
        bbox: '-1.65,47.17,-1.45,47.28',
        lat: 47.2184,
        lng: -1.5536,
    },
    paris: {
        bbox: '2.22,48.81,2.47,48.91',
        lat: 48.8566,
        lng: 2.3522,
    },
};

// ─── Component ───────────────────────────────────────────────────

export default function AddressAutocomplete({
    onSelectAction,
    restrictToCities = [],
    countryCode = 'fr',
    initialValue = '',
    placeholder = 'Start typing an address…',
    inputClassName,
    variant = 'form',
    allowManualEntry = true,
}: AddressAutocompleteProps) {
    const [query, setQuery] = useState(initialValue);
    const [results, setResults] = useState<AddressResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─── Fetch from Photon API ───

    const fetchSuggestions = useCallback(
        async (q: string) => {
            if (q.length < 3) {
                setResults([]);
                setIsOpen(false);
                return;
            }

            setLoading(true);

            try {
                const params = new URLSearchParams({
                    q,
                    limit: '8',
                    lang: 'fr',
                });

                // Add country filter if specified
                if (countryCode) {
                    params.set('osm_tag', `place`);
                }

                // If restricting to specific cities, add bbox for the first matching city
                if (restrictToCities.length > 0) {
                    const cityKey = restrictToCities[0].toLowerCase();
                    const bounds = CITY_BOUNDS[cityKey];
                    if (bounds) {
                        params.set('bbox', bounds.bbox);
                        params.set('lat', String(bounds.lat));
                        params.set('lon', String(bounds.lng));
                    }
                }

                const res = await fetch(
                    `https://photon.komoot.io/api/?${params.toString()}`
                );

                const allResults: AddressResult[] = [];

                if (res.ok) {
                    const data = await res.json();
                    const features: PhotonFeature[] = data.features || [];

                    for (const f of features) {
                        const p = f.properties;
                        const [lng, lat] = f.geometry.coordinates;

                        // Country filter: only show results from the target country
                        if (countryCode && p.country) {
                            const countryLower = p.country.toLowerCase();
                            if (countryCode === 'fr' && !['france', 'francia', 'frankreich'].includes(countryLower)) {
                                continue;
                            }
                        }

                        // If restricting to cities, filter — but use fuzzy matching
                        if (
                            restrictToCities.length > 0 &&
                            p.city &&
                            !restrictToCities.some(
                                (c) => p.city!.toLowerCase().includes(c.toLowerCase()) ||
                                    c.toLowerCase().includes(p.city!.toLowerCase())
                            )
                        ) {
                            continue;
                        }

                        const street = p.street || p.name || '';
                        const housenumber = p.housenumber || '';
                        const address = housenumber
                            ? `${housenumber} ${street}`
                            : street;

                        if (!address) continue;

                        const display = [
                            address,
                            p.postcode,
                            p.city,
                        ]
                            .filter(Boolean)
                            .join(', ');

                        allResults.push({
                            address,
                            city: p.city || '',
                            postal_code: p.postcode || '',
                            lat,
                            lng,
                            display,
                        });
                    }
                }

                // Deduplicate by display string
                const seen = new Set<string>();
                const deduped = allResults.filter((r) => {
                    if (seen.has(r.display)) return false;
                    seen.add(r.display);
                    return true;
                });

                setResults(deduped.slice(0, 6));
                setIsOpen(deduped.length > 0 || (allowManualEntry && q.length >= 3));
                setActiveIndex(-1);
            } catch (err) {
                console.error('Photon API error:', err);
                setResults([]);
                // Still show manual entry option on error
                if (allowManualEntry && q.length >= 3) {
                    setIsOpen(true);
                }
            } finally {
                setLoading(false);
            }
        },
        [restrictToCities, countryCode, allowManualEntry]
    );

    // ─── Debounced input handler ───

    const handleInputChange = (value: string) => {
        setQuery(value);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 300);
    };

    // ─── Keyboard navigation ───

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            handleSelect(results[activeIndex]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    // ─── Select handler ───

    const handleSelect = (result: AddressResult) => {
        setQuery(result.display);
        setIsOpen(false);
        setResults([]);
        onSelectAction(result);
    };

    // ─── Styles ───

    const baseInput =
        variant === 'onboarding'
            ? 'w-full px-6 py-4 text-lg text-gray-900 dark:text-white bg-white/50 dark:bg-zinc-800/50 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 transition-colors placeholder-zinc-400 dark:placeholder-zinc-500'
            : 'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500';

    return (
        <div ref={wrapperRef} className="relative">
            {/* Input */}
            <div className="relative">
                <input
                    ref={inputRef}
                    id="address-autocomplete-input"
                    type="text"
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
                    placeholder={placeholder}
                    className={inputClassName || baseInput}
                    autoComplete="off"
                />

                {/* Loading spinner */}
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Search icon when idle */}
                {!loading && !query && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </div>
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (results.length > 0 || allowManualEntry) && (
                <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                    {results.map((result, idx) => (
                        <li
                            key={idx}
                            onClick={() => handleSelect(result)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={`px-4 py-3 cursor-pointer transition-colors flex items-start gap-3 ${idx === activeIndex
                                ? 'bg-teal-50 dark:bg-teal-900/30'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                                } ${idx === 0 ? 'rounded-t-xl' : ''}`}
                        >
                            {/* Pin icon */}
                            <span className="mt-0.5 text-teal-500 shrink-0">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </span>
                            <div className="min-w-0">
                                <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                    {result.address}
                                </p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                    {[result.postal_code, result.city]
                                        .filter(Boolean)
                                        .join(' ')}
                                </p>
                            </div>
                        </li>
                    ))}

                    {/* Manual entry fallback */}
                    {allowManualEntry && query.length >= 3 && (
                        <li
                            onClick={() => {
                                onSelectAction({
                                    address: query,
                                    city: '',
                                    postal_code: '',
                                    lat: 0,
                                    lng: 0,
                                    display: query,
                                });
                                setQuery(query);
                                setIsOpen(false);
                            }}
                            className={`px-4 py-3 cursor-pointer transition-colors flex items-start gap-3 border-t border-zinc-100 dark:border-zinc-700 rounded-b-xl ${activeIndex === results.length
                                    ? 'bg-zinc-100 dark:bg-zinc-700/50'
                                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                                }`}
                            onMouseEnter={() => setActiveIndex(results.length)}
                        >
                            <span className="mt-0.5 text-zinc-400 shrink-0">✍️</span>
                            <div className="min-w-0">
                                <p className="font-medium text-sm text-zinc-700 dark:text-zinc-300 truncate">
                                    Use &ldquo;{query}&rdquo; as typed
                                </p>
                                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                    Address not found? Enter it manually
                                </p>
                            </div>
                        </li>
                    )}

                    {/* Powered by */}
                    <li className="px-4 py-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 text-right border-t border-zinc-100 dark:border-zinc-700">
                        Powered by OpenStreetMap
                    </li>
                </ul>
            )}

            {/* No results */}
            {isOpen && results.length === 0 && !loading && query.length >= 3 && !allowManualEntry && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-4 text-center">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        No addresses found
                        {restrictToCities.length > 0 && (
                            <span className="block text-xs mt-1">
                                Restricted to: {restrictToCities.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}
                            </span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}
