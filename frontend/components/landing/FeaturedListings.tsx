'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { Sparkles, MapPin, Eye, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function FeaturedListings() {
  const { t } = useLanguage();

  const listings = [
    {
      id: '1',
      title: 'Haussmannian Luxury Apartment',
      city: 'Paris 8e',
      price: 2400,
      specs: '2 beds • 1 bath • 75 m²',
      image: '/apartment_1.png',
      tag: t('landing.featured.tags.verified', undefined, 'GPS Verified'),
    },
    {
      id: '2',
      title: 'Chic Industrial Loft',
      city: 'Lyon 2e',
      price: 1850,
      specs: '1 bed • 1 bath • 52 m²',
      image: '/apartment_2.png',
      tag: t('landing.featured.tags.popular', undefined, 'Trending'),
    },
    {
      id: '3',
      title: 'Elegant Classic Residence',
      city: 'Bordeaux Centre',
      price: 1600,
      specs: '2 beds • 1 bath • 68 m²',
      image: '/apartment_3.png',
      tag: t('landing.featured.tags.verified', undefined, 'GPS Verified'),
    }
  ];

  return (
    <section className="py-24 sm:py-36 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
          <div className="max-w-2xl">
            {/* Section badge */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2.5 px-4 py-2 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-8"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('landing.featured.badge', undefined, 'Handpicked Select')}</span>
            </motion.div>

            {/* Section titles */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl sm:text-7xl font-black tracking-tighter text-zinc-900 uppercase italic leading-[0.9] mb-6"
            >
              {t('landing.featured.title', undefined, 'Featured Listings')}
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-zinc-500 font-bold uppercase text-[11px] tracking-widest leading-relaxed max-w-sm"
          >
            {t('landing.featured.subtitle', undefined, 'Hand-selected and fully verified residential properties in France.')}
          </motion.p>
        </div>

        {/* 3-card Showcase grid */}
        <div className="grid md:grid-cols-3 gap-10">
          {listings.map((listing, i) => (
            <motion.div
              key={listing.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -10 }}
              className="group bg-zinc-50 rounded-[2.5rem] overflow-hidden border border-zinc-100 hover:border-zinc-200 transition-all duration-500 hover:shadow-2xl hover:shadow-zinc-900/5 flex flex-col h-full"
            >
              {/* Image container */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                <Image
                  src={listing.image}
                  alt={listing.title}
                  fill
                  sizes="(max-w-768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-[1200ms] ease-[0.16, 1, 0.3, 1]"
                />
                
                {/* Badge Overlay */}
                <div className="absolute top-6 left-6 z-10">
                  <span className="px-4 py-2 bg-zinc-900/90 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">
                    {listing.tag}
                  </span>
                </div>
              </div>

              {/* Card content */}
              <div className="p-8 flex flex-col flex-grow">
                <div className="flex items-center gap-2 text-zinc-400 text-[10px] font-black uppercase tracking-wider mb-3">
                  <MapPin className="w-3.5 h-3.5 text-zinc-900" />
                  <span>{listing.city}</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight uppercase group-hover:text-zinc-700 transition-colors mb-2">
                  {listing.title}
                </h3>

                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest mb-6">
                  {listing.specs}
                </p>

                {/* Pricing and Link */}
                <div className="mt-auto pt-6 border-t border-zinc-200/50 flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-black text-zinc-900 tracking-tight">€{listing.price}</span>
                    <span className="text-zinc-400 font-bold text-[10px] tracking-wider uppercase ml-1">/ {t('landing.featured.mo', undefined, 'mo')}</span>
                  </div>

                  <Link
                    href={`/properties/${listing.id}`}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95 group/btn"
                  >
                    <span>{t('landing.featured.view', undefined, 'View')}</span>
                    <Eye className="w-3.5 h-3.5 group-hover/btn:scale-125 transition-transform" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
