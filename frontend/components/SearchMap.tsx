'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '@/lib/LanguageContext';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface Property {
    id: string;
    title: string;
    city: string;
    monthly_rent: number;
    latitude?: number;
    longitude?: number;
    photos: { url: string }[];
    match_score?: number;
}

interface SearchMapProps {
    properties: Property[];
    center?: [number, number];
}

// Dynamically import Leaflet components
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
const ZoomControl = dynamic(() => import('react-leaflet').then(m => m.ZoomControl), { ssr: false });

export default function SearchMap({ properties, center = [48.8566, 2.3522] }: SearchMapProps) {
    const [isMounted, setIsMounted] = useState(false);
    const { t } = useLanguage();
    const router = useRouter();
    const [L, setL] = useState<any>(null);

    useEffect(() => {
        const Leaflet = require('leaflet');
        setL(Leaflet);
        setIsMounted(true);
        
        // Fix default icons
        delete Leaflet.Icon.Default.prototype._getIconUrl;
        Leaflet.Icon.Default.mergeOptions({
            iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png').default.src,
            iconUrl: require('leaflet/dist/images/marker-icon.png').default.src,
            shadowUrl: require('leaflet/dist/images/marker-shadow.png').default.src,
        });
    }, []);

    // Industry Grade: Custom Price Marker
    const createPriceIcon = (price: number, matchScore?: number) => {
        if (!L) return null;
        const isHighMatch = matchScore && matchScore >= 85;
        return L.divIcon({
            className: 'custom-div-icon',
            html: `
                <div class="group relative flex items-center justify-center">
                    <div class="px-3 py-1.5 rounded-full ${isHighMatch ? 'bg-zinc-900' : 'bg-zinc-900/50'} text-white text-[10px] font-black shadow-2xl border-2 border-white/20 transition-all group-hover:scale-110 group-hover:-translate-y-1">
                        €${price}
                    </div>
                    ${isHighMatch ? '<div class="absolute -top-1 -right-1 w-2 h-2 bg-zinc-400 rounded-full animate-ping"></div>' : ''}
                </div>
            `,
            iconSize: [60, 30],
            iconAnchor: [30, 15]
        });
    };

    if (!isMounted || !L) return (
        <div className="w-full h-full bg-zinc-50 flex items-center justify-center overflow-hidden rounded-[3.5rem] border border-zinc-100 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">Mapping Marketplace...</span>
            </div>
        </div>
    );

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-full relative rounded-[3.5rem] overflow-hidden border border-zinc-100 shadow-2xl z-0"
        >
            <MapContainer
                center={center}
                zoom={13}
                className="w-full h-full"
                scrollWheelZoom={true}
                zoomControl={false}
            >
                {/* Premium Tile Layer: CartoDB Positron (Cleaner, more aesthetic) */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />

                <ZoomControl position="bottomright" />
                
                {properties.map(property => {
                    if (!property.latitude || !property.longitude) return null;
                    
                    const isHighMatch = (property.match_score || 0) >= 85;
                    const priceIcon = createPriceIcon(property.monthly_rent, property.match_score);

                    return (
                        <Marker 
                            key={property.id} 
                            position={[property.latitude, property.longitude]}
                            icon={priceIcon}
                        >
                            <Popup className="premium-map-popup" offset={[0, -10]}>
                                <div className="p-1 w-64 flex flex-col gap-4">
                                    <div className="aspect-[16/10] rounded-[1.5rem] overflow-hidden bg-zinc-100 relative group/img">
                                        <img 
                                            src={resolveMediaUrl(property.photos?.[0]?.url)} 
                                            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700" 
                                            alt={property.title}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <div className="absolute bottom-3 left-4">
                                            <span className="text-xl font-black text-white tracking-tighter">€${property.monthly_rent}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="px-1">
                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-900 mb-1 truncate">
                                            {property.title}
                                        </h4>
                                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{property.city}</p>
                                        
                                        <div className="flex items-center justify-between gap-4 mb-4">
                                            {property.match_score && (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="h-1.5 w-16 bg-zinc-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-zinc-900" style={{ width: `${property.match_score}%` }} />
                                                    </div>
                                                    <span className="text-[9px] font-black text-zinc-900 italic">
                                                        {Math.round(property.match_score)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <button 
                                            onClick={() => router.push(`/properties/${property.id}`)}
                                            className="w-full py-4 bg-zinc-900 text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-xl hover:bg-zinc-800 transition-all active:scale-95 shadow-xl"
                                        >
                                            {t('search.property.viewDetails', undefined, 'Explore')} →
                                        </button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
            
            {/* Legend / Overlay */}
            <div className="absolute top-8 left-8 p-4 glass-card border-none rounded-2xl shadow-2xl pointer-events-none">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-zinc-900 shadow-[0_0_10px_rgba(24,24,27,0.5)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">High Compatibility</span>
                </div>
            </div>
        </motion.div>
    );
}
