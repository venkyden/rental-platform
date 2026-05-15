'use client';

import { motion, useSpring, useTransform, animate, Variants } from 'framer-motion';
import { ChevronRight, Search, MapPin, Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function SearchHero() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState({ total_properties: 0, verified_landlords: 0, matches_last_30_days: 0 });
  const router = useRouter();

  // ─── Single Fetch for Stats ───
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    fetch(`${apiUrl}/stats/public/overview`)
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Failed to fetch stats:', err));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    } else {
      router.push('/search');
    }
  };

  const title = t('landing.hero.title', undefined, 'Find your perfect home with confidence');
  const highlight = t('landing.hero.highlight', undefined, 'perfect home');
  const parts = title.includes(highlight) ? title.split(highlight) : [title, ''];

  return (
    <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-zinc-100/50 rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center">
          {/* ─── Floating Badge ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 px-5 py-2.5 bg-zinc-50 text-zinc-900 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-12 border border-zinc-200 shadow-xl shadow-zinc-900/5 transition-all hover:bg-white hover:border-zinc-300 group cursor-default"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-900"></span>
            </span>
            {t('landing.liveUpdates', undefined, 'Live Platform Activity')}
            <Sparkles className="w-3 h-3 text-zinc-400 group-hover:rotate-12 transition-transform" />
          </motion.div>

          {/* ─── Hero Title ─── */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter mb-8 text-zinc-900 leading-[0.85] uppercase italic"
          >
            {parts[0]}
            {title.includes(highlight) && (
              <span className="relative inline-block px-4">
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
            className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-20 font-black uppercase tracking-[0.4em] leading-relaxed"
          >
            {t('landing.subtitle', undefined, 'The most secure and transparent rental platform in France.')}
          </motion.p>

          {/* ─── Advanced Search Bar ─── */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-5xl mx-auto mb-32"
          >
            <form 
              onSubmit={handleSearch}
              className="bg-white p-3 rounded-[3rem] flex flex-col sm:flex-row items-center shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border border-zinc-100 group transition-all duration-700 hover:shadow-[0_50px_120px_-20px_rgba(0,0,0,0.2)] focus-within:border-zinc-300"
            >
              <div className="flex-1 w-full flex items-center px-10 gap-6 py-6 sm:py-0">
                <MapPin className="w-6 h-6 text-zinc-900 shrink-0" />
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('landing.hero.searchPlaceholder', undefined, 'Where do you want to live?')}
                  className="w-full bg-transparent border-none focus:ring-0 text-2xl font-black text-zinc-900 placeholder:text-zinc-200 uppercase tracking-tight"
                />
              </div>
              
              <div className="hidden sm:block w-px h-16 bg-zinc-100 mx-4" />

              <MagneticButton>
                <button 
                  type="submit"
                  className="w-full sm:w-auto bg-zinc-900 text-white px-16 py-7 rounded-[2.2rem] font-black uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 shadow-2xl shadow-zinc-900/20 group/btn"
                >
                  <Search className="w-4 h-4 group-hover/btn:scale-125 transition-transform" strokeWidth={3} />
                  <span>{t('landing.hero.searchButton', undefined, 'Execute')}</span>
                </button>
              </MagneticButton>
            </form>
            
            {/* ─── Trending Cities ─── */}
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              {['Paris', 'Lyon', 'Bordeaux', 'Nice', 'Lille'].map((city) => (
                <button
                  key={city}
                  onClick={() => setQuery(city)}
                  className="px-8 py-3 rounded-full bg-zinc-50 hover:bg-zinc-900 hover:text-white text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 border border-zinc-100 hover:border-zinc-900"
                >
                  {city}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ─── Real-Time Stats ─── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-16 max-w-5xl mx-auto pt-24 border-t border-zinc-100/60">
            <CounterStat value={stats.total_properties} label={t('landing.stats.listings', undefined, 'Active Listings')} />
            <CounterStat value={stats.verified_landlords} label={t('landing.stats.landlords', undefined, 'Verified Landlords')} />
            <div className="col-span-2 md:col-span-1">
              <CounterStat value={stats.matches_last_30_days} label={t('landing.stats.matches', undefined, 'Recent Matches')} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Sub-Components ───

function CounterStat({ value, label }: { value: number; label: string }) {
  const count = useSpring(0, { bounce: 0, duration: 2500 });
  const display = useTransform(count, (latest) => Math.floor(latest).toLocaleString());

  useEffect(() => {
    count.set(value);
  }, [value, count]);

  return (
    <div className="text-center group">
      <motion.div 
        className="text-5xl sm:text-6xl font-black text-zinc-900 tracking-tighter mb-4 notranslate italic"
        translate="no"
      >
        <motion.span>{display}</motion.span>
        <span className="text-zinc-300 ml-1">+</span>
      </motion.div>
      <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400 group-hover:text-zinc-900 transition-colors duration-700">
        {label}
      </div>
    </div>
  );
}

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
