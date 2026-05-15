'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

interface StaticMapViewProps {
    lat: number;
    lng: number;
    address: string;
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
const Popup = dynamic(
    () => import('react-leaflet').then((mod) => mod.Popup),
    { ssr: false }
);

export default function StaticMapView({ lat, lng, address }: StaticMapViewProps) {
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

    if (!isMounted) {
        return (
            <div className="w-full h-[400px] bg-zinc-50 rounded-[3rem] flex items-center justify-center animate-pulse border border-zinc-100">
                <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">Initializing Satellite...</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-[400px] rounded-[3rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] border border-white z-0">
            <MapContainer
                center={[lat, lng]}
                zoom={15}
                scrollWheelZoom={false}
                zoomControl={false}
                className="w-full h-full"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[lat, lng]}>
                    <Popup>{address}</Popup>
                </Marker>
            </MapContainer>

            {/* Premium Overlay */}
            <div className="absolute top-8 left-8 bg-white/90 backdrop-blur-3xl px-6 py-3 rounded-2xl border border-white/20 shadow-2xl z-[1000]">
                <div className="text-[10px] font-black text-zinc-900 uppercase tracking-widest flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                    Property Geolocation Verified
                </div>
            </div>
        </div>
    );
}
