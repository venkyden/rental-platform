'use client';

import { motion } from 'framer-motion';
import { Search, MapPin, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import Link from 'next/link';

export default function SearchHero() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    } else {
      router.push('/search');
    }
  };

  const title = t('landing.hero.title', undefined, 'Rent with proof, not promises');
  const highlight = t('landing.hero.highlight', undefined, 'proof');
  const parts = title.includes(highlight) ? title.split(highlight) : [title, ''];

  return (
    <section className="relative pt-36 sm:pt-40 pb-16 sm:pb-24 overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-zinc-100/50 rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center">


          {/* ─── Hero Title ─── */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-7xl font-black tracking-tight mb-8 text-zinc-900 leading-[1.05]"
          >
            {parts[0]}
            {title.includes(highlight) && (
              <span className="relative inline-block px-1">
                {highlight}
                <motion.div 
                  className="absolute bottom-2 left-0 w-full h-4 bg-zinc-900/5 -rotate-1 -z-10 rounded-lg"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                />
              </span>
            )}
            {parts[1]}
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg sm:text-xl text-zinc-500 max-w-2xl mx-auto mb-16 font-medium leading-relaxed"
          >
            {t('landing.subtitle', undefined, "Tenants prove they can pay. Landlords prove they're real. No one hands over documents — or a deposit — blind.")}
          </motion.p>

          {/* ─── Advanced Search Bar ─── */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-5xl mx-auto"
          >
            <form 
              onSubmit={handleSearch}
              role="search"
              aria-label={t('landing.hero.searchPlaceholder', undefined, 'Where do you want to live?')}
              className="bg-white p-3 rounded-[3rem] flex flex-col sm:flex-row items-center shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border border-zinc-100 group transition-all duration-700 hover:shadow-[0_50px_120px_-20px_rgba(0,0,0,0.2)] focus-within:border-zinc-300"
            >
              <div className="flex-1 w-full flex items-center px-10 gap-6 py-6 sm:py-0">
                <MapPin className="w-6 h-6 text-zinc-900 shrink-0" aria-hidden="true" />
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('landing.hero.searchPlaceholder', undefined, 'Where do you want to live?')}
                  aria-label={t('landing.hero.searchPlaceholder', undefined, 'Where do you want to live?')}
                  className="w-full bg-transparent border-none focus:ring-0 text-lg sm:text-xl font-semibold text-zinc-900 placeholder:text-zinc-400"
                />
              </div>
              
              <div className="hidden sm:block w-px h-16 bg-zinc-100 mx-4" aria-hidden="true" />

              <MagneticButton>
                <button 
                  type="submit"
                  aria-label={t('landing.hero.searchButton', undefined, 'Search')}
                  className="w-full sm:w-auto bg-zinc-900 text-white px-12 py-6 rounded-[2.2rem] font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 shadow-2xl shadow-zinc-900/20 group/btn"
                >
                  <Search className="w-4 h-4 group-hover/btn:scale-125 transition-transform" strokeWidth={3} aria-hidden="true" />
                  <span>{t('landing.hero.searchButton', undefined, 'Search')}</span>
                </button>
              </MagneticButton>
            </form>
            
            {/* ─── Trust Chips ─── */}
            <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3">
              {[
                t('landing.hero.chips.identity', undefined, 'Verified identities'),
                t('landing.hero.chips.documents', undefined, 'State-signed document checks'),
                t('landing.hero.chips.media', undefined, 'GPS-verified photos'),
              ].map((chip) => (
                <div key={chip} className="flex items-center gap-2 text-zinc-500">
                  <ShieldCheck className="w-4 h-4 text-zinc-900" aria-hidden="true" />
                  <span className="text-sm font-semibold">{chip}</span>
                </div>
              ))}
            </div>

            {/* ─── Trending Cities ─── */}
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              {['Paris', 'Lyon', 'Bordeaux', 'Nice', 'Lille'].map((city) => (
                <button
                  key={city}
                  onClick={() => setQuery(city)}
                  className="px-6 py-3 rounded-full bg-zinc-50 hover:bg-zinc-900 hover:text-white text-zinc-500 text-sm font-semibold transition-all duration-500 border border-zinc-100 hover:border-zinc-900"
                >
                  {city}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Sub-Components ───

function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current!.getBoundingClientRect();
    const x = clientX - (left + width / 2);
    const y = clientY - (top + height / 2);
    setPosition({ x: x * 0.25, y: y * 0.25 });
  };

  const reset = () => setPosition({ x: 0, y: 0 });

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 200, damping: 20, mass: 0.1 }}
      className="w-full sm:w-auto"
    >
      {children}
    </motion.div>
  );
}
