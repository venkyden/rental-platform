'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { Search, MapPin, Loader2, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    const { t } = useLanguage();
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
            ? 'w-full px-8 py-6 text-xl font-medium text-zinc-900 bg-zinc-50 border-2 border-zinc-100 rounded-[2rem] focus:outline-none focus:border-zinc-900 focus:bg-white transition-all duration-300 placeholder-zinc-300'
            : 'w-full px-4 py-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-all';

    return (
        <div ref={wrapperRef} className="relative w-full">
            {/* Input Wrapper */}
            <div className="relative group">
                <input
                    ref={inputRef}
                    id="address-autocomplete-input"
                    type="text"
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
                    placeholder={placeholder || t('common.placeholders.address')}
                    className={inputClassName || baseInput}
                    autoComplete="off"
                />

                {/* Status Icons */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                    {loading ? (
                        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                    ) : query ? (
                        <motion.button
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
                            className="p-1 hover:bg-zinc-100 rounded-full transition-colors"
                        >
                            <Search className="w-5 h-5 text-zinc-400" />
                        </motion.button>
                    ) : (
                        <Search className="w-5 h-5 text-zinc-300" />
                    )}
                </div>
            </div>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (results.length > 0 || allowManualEntry) && (
                    <motion.ul
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute z-[1100] mt-3 w-full bg-white border border-zinc-100 rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden"
                    >
                        {results.map((result, idx) => (
                            <li
                                key={idx}
                                onClick={() => handleSelect(result)}
                                onMouseEnter={() => setActiveIndex(idx)}
                                className={`group px-6 py-4 cursor-pointer transition-all flex items-center gap-4 ${
                                    idx === activeIndex ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50'
                                }`}
                            >
                                <div className={`p-2 rounded-xl transition-colors ${
                                    idx === activeIndex ? 'bg-white/20' : 'bg-zinc-100'
                                }`}>
                                    <MapPin className={`w-4 h-4 ${idx === activeIndex ? 'text-white' : 'text-zinc-500'}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`font-semibold text-sm truncate ${idx === activeIndex ? 'text-white' : 'text-zinc-900'}`}>
                                        {result.address}
                                    </p>
                                    <p className={`text-[10px] uppercase tracking-widest font-black truncate ${
                                        idx === activeIndex ? 'text-white/60' : 'text-zinc-400'
                                    }`}>
                                        {[result.postal_code, result.city].filter(Boolean).join(' • ')}
                                    </p>
                                </div>
                            </li>
                        ))}

                        {/* Manual Entry Falling back to typed text */}
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
                                className={`px-6 py-4 cursor-pointer transition-all flex items-center gap-4 border-t border-zinc-100 ${
                                    activeIndex === results.length ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50'
                                }`}
                                onMouseEnter={() => setActiveIndex(results.length)}
                            >
                                <div className={`p-2 rounded-xl ${activeIndex === results.length ? 'bg-white/20' : 'bg-zinc-100'}`}>
                                    <Navigation className={`w-4 h-4 ${activeIndex === results.length ? 'text-white' : 'text-zinc-500'}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm truncate">
                                        {t('common.components.addressAutocomplete.useTyped', { query })}
                                    </p>
                                    <p className={`text-[10px] uppercase tracking-widest font-black ${
                                        activeIndex === results.length ? 'text-white/60' : 'text-zinc-400'
                                    }`}>
                                        {t('common.components.addressAutocomplete.notFound')}
                                    </p>
                                </div>
                            </li>
                        )}

                        {/* Branding / Footer */}
                        <li className="px-6 py-2 bg-zinc-50/50 text-[8px] font-black uppercase tracking-[0.2em] text-zinc-300 text-right">
                            {t('common.components.addressAutocomplete.poweredBy')}
                        </li>
                    </motion.ul>
                )}
            </AnimatePresence>

            {/* Empty State */}
            {isOpen && results.length === 0 && !loading && query.length >= 3 && !allowManualEntry && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute z-[1100] mt-3 w-full bg-white border border-zinc-100 rounded-[2rem] p-8 text-center shadow-2xl"
                >
                    <Search className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                        {t('common.components.addressAutocomplete.noResults')}
                    </p>
                </motion.div>
            )}
        </div>
    );
}
