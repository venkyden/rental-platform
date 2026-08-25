'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import AddressAutocomplete, { AddressResult } from './AddressAutocomplete';
import { Footprints, Bike, Car, TrainFront } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), { ssr: false });
const ZoomControl = dynamic(() => import('react-leaflet').then((mod) => mod.ZoomControl), { ssr: false });

interface NeighborhoodMapProps {
    lat: number;
    lng: number;
    address: string;
    /**
     * The property's already-computed nearby-transit list (Overpass POI data,
     * fetched once at listing-creation time — see app/utils/location.py
     * get_nearby_pois). Same array PropertyDetailClient already renders under
     * "Neighborhood Connectivity". Formatted strings like
     * "🚉 Gare Austerlitz (Line C) — 350m"; a "📋 Routes: …" summary line (no
     * distance suffix) may be prepended. Used for the "Public transport" mode
     * — no live routing call, just the nearest stop already on hand.
     */
    publicTransport?: string[];
}

type Mode = 'walking' | 'cycling' | 'driving' | 'transit';

interface RouteState {
    distance_m: number;
    duration_s: number;
    // GeoJSON LineString coordinates are [lng, lat] — converted to Leaflet's
    // [lat, lng] pairs before rendering.
    positions: [number, number][];
}

interface NearestStop {
    label: string;
    distanceM: number;
}

const MODES: { key: Mode; icon: typeof Footprints; labelKey: string }[] = [
    { key: 'walking', icon: Footprints, labelKey: 'property.neighborhoodMap.walking' },
    { key: 'cycling', icon: Bike, labelKey: 'property.neighborhoodMap.cycling' },
    { key: 'driving', icon: Car, labelKey: 'property.neighborhoodMap.driving' },
    { key: 'transit', icon: TrainFront, labelKey: 'property.neighborhoodMap.transit' },
];

function formatDistance(m: number): string {
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatDuration(s: number): string {
    const minutes = Math.round(s / 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
}

/**
 * Parses the nearest stop out of the property's public_transport list. Items
 * are formatted "<emoji + label> — <N>m"; the list is pre-sorted by distance
 * before an optional "📋 Routes: …" summary line (no distance suffix) is
 * prepended — so the first item that actually matches the distance suffix is
 * the nearest one.
 */
function parseNearestStop(publicTransport: string[] | undefined): NearestStop | null {
    if (!publicTransport) return null;
    for (const entry of publicTransport) {
        const match = entry.match(/^(.*)\s—\s(\d+)m$/);
        if (match) {
            return { label: match[1].trim(), distanceM: parseInt(match[2], 10) };
        }
    }
    return null;
}

export default function NeighborhoodMap({ lat, lng, address, publicTransport }: NeighborhoodMapProps) {
    const { t } = useLanguage();
    const [isMounted, setIsMounted] = useState(false);
    const [mode, setMode] = useState<Mode>('walking');
    const [origin, setOrigin] = useState<{ lat: number; lng: number; label: string } | null>(null);
    const [route, setRoute] = useState<RouteState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nearestStop = parseNearestStop(publicTransport);
    // Guards against out-of-order responses when the mode is switched
    // rapidly (e.g. walking -> cycling -> driving) — only the response for
    // the most recently issued request is applied.
    const requestIdRef = useRef(0);

    useEffect(() => {
        setIsMounted(true);
        const L = require('leaflet');
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png').default.src,
            iconUrl: require('leaflet/dist/images/marker-icon.png').default.src,
            shadowUrl: require('leaflet/dist/images/marker-shadow.png').default.src,
        });
    }, []);

    const fetchRoute = useCallback(
        async (originLat: number, originLng: number, selectedMode: Mode) => {
            const requestId = ++requestIdRef.current;
            setLoading(true);
            setError(null);
            try {
                const res = await apiClient.client.post('/location/directions', {
                    origin_lat: originLat,
                    origin_lng: originLng,
                    dest_lat: lat,
                    dest_lng: lng,
                    mode: selectedMode,
                });
                if (requestId !== requestIdRef.current) return; // a newer request has superseded this one
                const coords: [number, number][] = res.data.geometry.coordinates.map(
                    ([lngC, latC]: [number, number]) => [latC, lngC]
                );
                setRoute({
                    distance_m: res.data.distance_m,
                    duration_s: res.data.duration_s,
                    positions: coords,
                });
            } catch (e) {
                if (requestId !== requestIdRef.current) return;
                console.error('Directions error:', e);
                setError(t('property.neighborhoodMap.searchError', undefined, 'Could not compute a route to this address.'));
                setRoute(null);
            } finally {
                if (requestId === requestIdRef.current) setLoading(false);
            }
        },
        [lat, lng, t]
    );

    const handleAddressSelect = (result: AddressResult) => {
        if (result.lat === undefined || result.lng === undefined) {
            setError(t('property.neighborhoodMap.searchError', undefined, 'Could not compute a route to this address.'));
            setOrigin(null);
            setRoute(null);
            return;
        }
        setOrigin({ lat: result.lat, lng: result.lng, label: result.display });
        fetchRoute(result.lat, result.lng, mode);
    };

    const handleModeChange = (newMode: Mode) => {
        setMode(newMode);
        // "transit" has no routing call (see parseNearestStop) — only the three
        // ORS-backed modes re-fetch a route.
        if (newMode !== 'transit' && origin) fetchRoute(origin.lat, origin.lng, newMode);
    };

    if (!isMounted) {
        return (
            <div className="w-full h-[400px] bg-zinc-50 rounded-[3rem] flex items-center justify-center animate-pulse border border-zinc-100">
                <p className="text-zinc-400 text-xs font-black uppercase tracking-[0.2em]">
                    {t('property.neighborhoodMap.loading', undefined, 'Loading map…')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="relative w-full h-[400px] rounded-[3rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] border border-white z-0">
                <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom zoomControl={false} className="w-full h-full">
                    <ZoomControl position="topright" />
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[lat, lng]}>
                        <Popup>{address}</Popup>
                    </Marker>
                    {mode !== 'transit' && origin && (
                        <Marker position={[origin.lat, origin.lng]}>
                            <Popup>{origin.label}</Popup>
                        </Marker>
                    )}
                    {mode !== 'transit' && route && (
                        <Polyline positions={route.positions} pathOptions={{ color: '#18181b', weight: 4 }} />
                    )}
                </MapContainer>
            </div>

            <div className="space-y-4">
                {mode !== 'transit' && (
                    <AddressAutocomplete
                        onSelectAction={handleAddressSelect}
                        countryCode="fr"
                        allowManualEntry={false}
                        placeholder={t('property.neighborhoodMap.searchPlaceholder', undefined, 'Search an address to calculate…')}
                        variant="form"
                    />
                )}
                <div className="flex flex-wrap gap-3">
                    {MODES.map(({ key, icon: Icon, labelKey }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => handleModeChange(key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                mode === key ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
                            }`}
                            aria-pressed={mode === key}
                        >
                            <Icon className="w-4 h-4" />
                            {t(labelKey, undefined, key)}
                        </button>
                    ))}
                </div>
                {mode === 'transit' ? (
                    nearestStop ? (
                        <p className="text-sm font-black text-zinc-900">
                            {t('property.neighborhoodMap.nearestStop', { stop: nearestStop.label })} · {formatDistance(nearestStop.distanceM)}
                        </p>
                    ) : (
                        <p className="text-xs text-zinc-400 font-bold">
                            {t('property.neighborhoodMap.noStopsFound', undefined, 'No nearby stops on file for this property.')}
                        </p>
                    )
                ) : (
                    <>
                        {loading && (
                            <p className="text-xs text-zinc-400 font-bold">{t('property.neighborhoodMap.calculating', undefined, 'Calculating…')}</p>
                        )}
                        {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
                        {route && !loading && (
                            <p className="text-sm font-black text-zinc-900">
                                {formatDistance(route.distance_m)} · {formatDuration(route.duration_s)}
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
