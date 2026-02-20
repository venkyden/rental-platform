'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// Leaflet specific types for proper interaction
import { Map as LeafletMap } from 'leaflet';

interface LocationPickerProps {
    initialLat: number;
    initialLng: number;
    onLocationChange: (lat: number, lng: number) => void;
}

// Dynamically import MapContainer, TileLayer to avoid SSR issues with Leaflet
const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import('react-leaflet').then((mod) => mod.TileLayer),
    { ssr: false }
);
const Marker = dynamic(
    () => import('react-leaflet').then((mod) => mod.Marker),
    { ssr: false }
);

// Component to handle map events (react-leaflet v5 pattern)
const MapEventHandler = dynamic(
    () => import('react-leaflet').then((mod) => {
        const { useMapEvents } = mod;
        const Handler = ({ onMoveEnd }: { onMoveEnd: () => void }) => {
            useMapEvents({
                moveend: onMoveEnd,
            });
            return null;
        };
        return Handler;
    }),
    { ssr: false }
);

export default function LocationPicker({ initialLat, initialLng, onLocationChange }: LocationPickerProps) {
    const mapRef = useRef<LeafletMap | null>(null);
    const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // Fix Leaflet icon issue
        const L = require('leaflet');
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png').default.src,
            iconUrl: require('leaflet/dist/images/marker-icon.png').default.src,
            shadowUrl: require('leaflet/dist/images/marker-shadow.png').default.src,
        });
    }, []);

    const handleMoveEnd = () => {
        if (mapRef.current) {
            const newCenter = mapRef.current.getCenter();
            setCenter({ lat: newCenter.lat, lng: newCenter.lng });
            onLocationChange(newCenter.lat, newCenter.lng);
        }
    };

    if (!isMounted) {
        return (
            <div className="w-full h-[400px] bg-[var(--gray-100)] rounded-xl flex items-center justify-center animate-pulse border border-[var(--gray-200)]">
                <p className="text-[var(--gray-500)] text-sm font-medium">Loading Map...</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[400px] rounded-xl overflow-hidden shadow-sm border border-[var(--card-border)] z-0">
            <MapContainer
                center={[initialLat, initialLng]}
                zoom={18}
                scrollWheelZoom={true}
                className="w-full h-full"
                ref={mapRef}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapEventHandler onMoveEnd={handleMoveEnd} />
            </MapContainer>

            {/* Fixed "Uber-style" Pin Overlay */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000] flex flex-col items-center pb-8">
                {/* Pin Head */}
                <div className="relative">
                    <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center shadow-2xl">
                        <div className="w-4 h-4 bg-white rounded-sm"></div>
                    </div>
                    {/* Triangle pointer */}
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[14px] border-t-black"></div>
                </div>
                {/* Shadow */}
                <div className="w-4 h-1.5 bg-black/20 rounded-full blur-[2px] mt-2"></div>
            </div>

            {/* Instruction Overlay */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-[var(--gray-200)] pointer-events-none z-[1000]">
                <p className="text-sm font-semibold text-[var(--foreground)] text-center whitespace-nowrap">
                    Move map to adjust pin
                </p>
            </div>
        </div>
    );
}
