'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { Sparkles, Building2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import ListingCard from '@/components/ListingCard';
import type { ListingSummary } from '@/lib/listingDisplay';
import { PropertyCardSkeleton } from '@/components/SkeletonLoaders';

export default function FeaturedListings() {
  const { t } = useLanguage();
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiClient.getProperties({
          status: 'active',
          limit: 12,
          sort_by: 'created_at',
          order_direction: 'desc',
        });
        if (cancelled) return;
        const score = (p: ListingSummary) =>
          (p.photos?.length ? 2 : 0) + (p.ownership_verified ? 1 : 0);
        const ranked = [...response].sort((a: ListingSummary, b: ListingSummary) => score(b) - score(a));
        setListings(ranked.slice(0, 6));
      } catch {
        if (!cancelled) setListings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fewer than 3 real listings → honest landlord CTA instead of thin/fake content
  const showListings = listings.length >= 3;

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

        {loading ? (
          <div className="grid md:grid-cols-3 gap-10">
            {[0, 1, 2].map((i) => <PropertyCardSkeleton key={i} />)}
          </div>
        ) : showListings ? (
          <div className="grid md:grid-cols-3 gap-10">
            {listings.map((listing, i) => (
              <ListingCard key={listing.id} property={listing} index={i} />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-[2.5rem] border border-zinc-100 bg-zinc-50 p-12 sm:p-20 text-center"
          >
            <Building2 className="w-8 h-8 mx-auto mb-6 text-zinc-400" />
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 uppercase mb-4">
              {t('landing.featured.emptyTitle', undefined, 'Publiez la première annonce vérifiée de votre ville')}
            </h3>
            <p className="text-zinc-500 max-w-xl mx-auto mb-8">
              {t('landing.featured.emptySubtitle', undefined, 'Photos vérifiées par GPS, identité vérifiée, dossier locataire certifié — publiez gratuitement.')}
            </p>
            <Link
              href="/properties/new"
              className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 text-white rounded-full text-[11px] font-black uppercase tracking-[0.2em] hover:bg-zinc-800 transition-colors"
            >
              {t('landing.featured.emptyCta', undefined, 'Publier une annonce')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
