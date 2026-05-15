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
            <div className="w-full h-[400px] bg-zinc-50 rounded-[2.5rem] flex items-center justify-center animate-pulse border border-zinc-100">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Initializing Map</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[400px] rounded-[2.5rem] overflow-hidden border border-zinc-100 shadow-inner z-0 group">
            <MapContainer
                center={[initialLat, initialLng]}
                zoom={13}
                scrollWheelZoom={true}
                className="w-full h-full grayscale-[0.8] opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                ref={mapRef}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Visual Circle to show search area */}
                <Circle
                    center={center}
                    radius={radiusMeters}
                    pathOptions={{ 
                        color: '#18181b', // zinc-900
                        fillColor: '#18181b', 
                        fillOpacity: 0.15,
                        weight: 2,
                        dashArray: '8, 8'
                    }}
                />
                <MapEventHandler onMoveEnd={handleMoveEnd} />
            </MapContainer>

            {/* Fixed "Uber-style" Pin Overlay */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000] flex flex-col items-center pb-12">
                <div className="relative">
                    <div className="w-14 h-14 bg-zinc-900 rounded-full flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] border-4 border-white">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </div>
                    {/* Shadow below pin */}
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/20 rounded-full blur-md" />
                </div>
            </div>

            {/* Scale Indicator */}
            <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-xl px-6 py-3 rounded-2xl shadow-xl border border-zinc-100 z-[1000]">
                <div className="flex items-center gap-3">
                    <div className="w-4 h-1 bg-zinc-900 rounded-full" />
                    <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">
                        {radiusMeters >= 1000 ? `${+(radiusMeters / 1000).toFixed(1)}km` : `${radiusMeters}m`}
                    </span>
                </div>
            </div>
        </div>
    );
}
