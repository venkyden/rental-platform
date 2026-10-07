'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import ListingCard from '@/components/ListingCard';
import type { ListingSummary } from '@/lib/listingDisplay';

/**
 * Up to six of the twelve newest active listings, those with photos and
 * verified ownership first. Renders nothing below three, while loading, or
 * when the API fails: the page never shows placeholder homes.
 */
export default function FeaturedListings() {
  const { t } = useLanguage();
  const [listings, setListings] = useState<ListingSummary[]>([]);

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
        if (!Array.isArray(response)) throw new Error('listings response is not a list');
        const score = (p: ListingSummary) =>
          (p.photos?.length ? 2 : 0) + (p.ownership_verified ? 1 : 0);
        const ranked = [...response].sort((a: ListingSummary, b: ListingSummary) => score(b) - score(a));
        setListings(ranked.slice(0, 6));
      } catch (err) {
        // The section stays hidden, but an outage must not look like "no listings yet" in the logs.
        // A warning, not an error: the block is optional and the page is complete without it.
                console.warn('[FeaturedListings] could not load listings', err);
        if (!cancelled) setListings([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (listings.length < 3) return null;

  return (
    <section className="bg-[#fffdf7] px-6 pb-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display mb-12 text-[clamp(2rem,4.6vw,3.6rem)] font-medium leading-[1.02] tracking-[-0.03em] text-zinc-950">
          {t('landing.featured.title', undefined, 'Find a home in your city')}
        </h2>
        <div className="grid gap-10 md:grid-cols-3">
          {listings.map((listing, i) => (
            <ListingCard key={listing.id} property={listing} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
