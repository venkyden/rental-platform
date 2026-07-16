'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { MapPin, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function FeaturedListings() {
  const { t } = useLanguage();

  const cities = [
    {
      name: 'Paris',
      area: t('landing.featured.cities.paris', undefined, 'Haussmannian apartments, studios and flatshares'),
      image: '/apartment_1.png',
    },
    {
      name: 'Lyon',
      area: t('landing.featured.cities.lyon', undefined, 'Lofts and apartments from Presqu’île to Part-Dieu'),
      image: '/apartment_2.png',
    },
    {
      name: 'Bordeaux',
      area: t('landing.featured.cities.bordeaux', undefined, 'Classic residences in the city centre and Chartrons'),
      image: '/apartment_3.png',
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
              className="inline-flex items-center gap-2.5 px-4 py-2 bg-zinc-900 text-white rounded-full text-xs font-bold uppercase tracking-wider mb-8"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{t('landing.featured.badge', undefined, 'Explore')}</span>
            </motion.div>

            {/* Section titles */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-900 leading-tight mb-6"
            >
              {t('landing.featured.title', undefined, 'Find a home in your city')}
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-zinc-500 text-base leading-relaxed max-w-sm"
          >
            {t('landing.featured.subtitle', undefined, 'Browse listings across France — every landlord and property goes through our verification checks.')}
          </motion.p>
        </div>

        {/* 3-card city grid */}
        <div className="grid md:grid-cols-3 gap-10">
          {cities.map((city, i) => (
            <motion.div
              key={city.name}
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
                  src={city.image}
                  alt={city.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-[1200ms]"
                />
              </div>

              {/* Card content */}
              <div className="p-8 flex flex-col flex-grow">
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight mb-2">
                  {city.name}
                </h3>

                <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                  {city.area}
                </p>

                <div className="mt-auto pt-6 border-t border-zinc-200/50">
                  <Link
                    href={`/search?q=${encodeURIComponent(city.name)}`}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full text-xs font-bold uppercase tracking-wider shadow-md transition-all active:scale-95 group/btn"
                  >
                    <span>{t('landing.featured.view', undefined, 'Browse listings')}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
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
