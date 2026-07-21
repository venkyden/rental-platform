'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { Search, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden bg-white">
      {/* Dynamic vibrancy background grid */}
      <div className="vibrancy-bg opacity-30 pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full text-center">
        {/* Animated Error Code */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-[120px] sm:text-[180px] font-black tracking-tighter text-zinc-900 leading-none italic uppercase mb-8 opacity-90 select-none"
        >
          404
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="text-3xl sm:text-5xl font-black text-zinc-900 tracking-tight uppercase italic mb-4"
        >
          {t('common.error.notFoundTitle', undefined, 'Page Not Found')}
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-zinc-400 font-bold uppercase text-xs tracking-widest leading-relaxed max-w-md mx-auto mb-16"
        >
          {t('common.error.notFoundDesc', undefined, 'The page you are looking for does not exist, has been moved, or is temporarily unavailable.')}
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-zinc-900 hover:bg-zinc-800 text-white font-black rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-xs"
          >
            <Home className="w-4 h-4" />
            <span>{t('navigation.home', undefined, 'Go Home')}</span>
          </Link>
          
          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-900 font-black rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-xs"
          >
            <Search className="w-4 h-4" />
            <span>{t('dashboard.quickActions.browse.title', undefined, 'Browse Listings')}</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
