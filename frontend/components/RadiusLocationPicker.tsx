'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { Map as LeafletMap } from 'leaflet';

interface RadiusLocationPickerProps {
    initialLat: number;
    initialLng: number;
    radiusMeters: number; // Radius in meters
    onLocationChange: (lat: number, lng: number) => void;
}

// Dynamic imports for Leaflet components
const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import('react-leaflet').then((mod) => mod.TileLayer),
    { ssr: false }
);
const Circle = dynamic(
    () => import('react-leaflet').then((mod) => mod.Circle),
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

export default function RadiusLocationPicker({ initialLat, initialLng, radiusMeters, onLocationChange }: RadiusLocationPickerProps) {
    const mapRef = useRef<LeafletMap | null>(null);
    const [center, setCenter] = useState({ lat: initialLat, lng: initialLng });
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
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
            <div className="w-full h-[300px] bg-[var(--gray-100)] rounded-xl flex items-center justify-center animate-pulse border border-[var(--gray-200)]">
                <p className="text-[var(--gray-500)] text-sm font-medium">Loading Map...</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[300px] rounded-xl overflow-hidden shadow-sm border border-[var(--card-border)] z-0">
            <MapContainer
                center={[initialLat, initialLng]}
                zoom={13}
                scrollWheelZoom={true}
                className="w-full h-full"
                ref={mapRef}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Visual Circle to show search area */}
                <Circle
                    center={center}
                    radius={radiusMeters}
                    pathOptions={{ color: 'var(--primary-500)', fillColor: 'var(--primary-500)', fillOpacity: 0.2 }}
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
            </div>

            {/* Instruction Overlay */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-[var(--gray-200)] pointer-events-none z-[1000]">
                <p className="text-xs font-semibold text-[var(--foreground)] text-center whitespace-nowrap">
                    Search Area ({Math.round(radiusMeters / 1000)}km)
                </p>
            </div>
        </div>
    );
}
