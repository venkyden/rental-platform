'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart, MapPin, ShieldCheck, BadgeCheck, Camera } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import {
    ListingSummary,
    getTypology,
    getDisplayPrice,
    getDescriptionPreview,
    getAvailability,
    getDifferentiatorKey,
} from '@/lib/listingDisplay';

interface ListingCardProps {
    property: ListingSummary;
    onToggleSave?: (id: string) => void;
    index?: number;
}

export default function ListingCard({ property, onToggleSave, index = 0 }: ListingCardProps) {
    const { t, language } = useLanguage();

    const typology =
        getTypology(property) ??
        t(`listing.type.${property.property_type}`, undefined, property.property_type);
    const price = getDisplayPrice(property);
    const preview = getDescriptionPreview(property.description);
    const availability = getAvailability(property.available_from);
    const differentiatorKey = getDifferentiatorKey(property.amenities);
    const cover = property.photos?.[0];

    const specParts: string[] = [];
    if (property.size_sqm) specParts.push(`${Math.round(Number(property.size_sqm))}m²`);
    if (property.bedrooms > 0) {
        const key = property.bedrooms > 1 ? 'listing.bedrooms' : 'listing.bedroom';
        specParts.push(`${property.bedrooms} ${t(key, undefined, 'chambres')}`);
    }
    if (differentiatorKey) {
        const diff = t(differentiatorKey, undefined, '');
        if (diff) specParts.push(diff);
    }

    const availableDate = availability.date
        ? new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
          }).format(availability.date)
        : null;

    return (
        <motion.article
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="group bg-white rounded-[2rem] overflow-hidden border border-zinc-100 hover:border-zinc-200 hover:shadow-2xl hover:shadow-zinc-900/5 transition-all duration-500 flex flex-col"
        >
            {/* ── Photo ── */}
            <Link href={`/properties/${property.id}`} className="relative aspect-[4/3] block overflow-hidden bg-zinc-100">
                {cover ? (
                    <Image
                        src={resolveMediaUrl(cover.url)}
                        alt={property.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-1000"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-400">
                        <Camera className="w-6 h-6" />
                        <span className="text-xs font-semibold">{t('listing.noPhotos', undefined, 'Photos en cours d’ajout')}</span>
                    </div>
                )}
                <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
                    {property.ownership_verified && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                            <ShieldCheck className="w-3 h-3" />
                            {t('listing.gpsVerified', undefined, 'Photos vérifiées GPS')}
                        </span>
                    )}
                    {property.dpe_rating && (
                        <span className="px-3 py-1.5 bg-white/90 backdrop-blur text-zinc-900 text-[10px] font-bold rounded-full">
                            DPE {property.dpe_rating}
                        </span>
                    )}
                </div>
                {onToggleSave && (
                    <button
                        aria-label="save"
                        onClick={(e) => {
                            e.preventDefault();
                            onToggleSave(property.id);
                        }}
                        className={`absolute top-4 right-4 p-2.5 rounded-full backdrop-blur transition-colors ${
                            property.is_saved ? 'bg-white text-zinc-900' : 'bg-black/20 text-white hover:bg-black/40'
                        }`}
                    >
                        <Heart className={`w-4 h-4 ${property.is_saved ? 'fill-current' : ''}`} />
                    </button>
                )}
            </Link>

            {/* ── Content ── */}
            <div className="p-6 flex flex-col flex-1 gap-2">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                            {typology} · {t(property.furnished ? 'listing.furnished' : 'listing.unfurnished', undefined, property.furnished ? 'Meublé' : 'Vide')}
                        </p>
                        <Link href={`/properties/${property.id}`}>
                            <h3 className="text-lg font-bold text-zinc-900 truncate group-hover:text-zinc-600 transition-colors">
                                {property.title}
                            </h3>
                        </Link>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-xl font-black text-zinc-900 tracking-tight">
                            {Math.round(price.amount)}€{' '}
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">{t(`listing.${price.suffix}`, undefined, price.suffix)}</span>
                        </p>
                        <p className="text-[10px] font-semibold text-zinc-400">{t('listing.perMonth', undefined, '/ mois')}</p>
                    </div>
                </div>

                <p className="flex items-center gap-1.5 text-sm text-zinc-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {property.city}
                    {property.postal_code ? ` (${property.postal_code})` : ''}
                </p>

                {specParts.length > 0 && (
                    <p className="text-sm font-medium text-zinc-700">{specParts.join(' · ')}</p>
                )}

                {preview && <p className="text-sm text-zinc-500 line-clamp-2">{preview}</p>}

                <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-zinc-100">
                    <p className="flex items-center gap-2 text-xs font-semibold">
                        <span className={`w-2 h-2 rounded-full ${availability.immediate ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        <span className={availability.immediate ? 'text-emerald-700' : 'text-zinc-600'}>
                            {availability.immediate
                                ? t('listing.availableNow', undefined, 'Disponible immédiatement')
                                : `${t('listing.availableFrom', undefined, 'Disponible à partir du')} ${availableDate}`}
                        </span>
                    </p>
                    {property.landlord_first_name && (
                        <p className="flex items-center gap-1.5 text-xs text-zinc-500 truncate">
                            {t('listing.publishedBy', undefined, 'Publié par')} {property.landlord_first_name}
                            {property.landlord_identity_verified && (
                                <span className="inline-flex items-center gap-1 text-zinc-700 font-semibold">
                                    <BadgeCheck className="w-3.5 h-3.5" />
                                    {t('listing.identityVerified', undefined, 'identité vérifiée')}
                                </span>
                            )}
                        </p>
                    )}
                </div>
            </div>
        </motion.article>
    );
}
