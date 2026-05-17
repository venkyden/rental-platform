'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error('Unhandled route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden bg-white">
      {/* Vibrancy bg */}
      <div className="vibrancy-bg opacity-30 pointer-events-none" />

      <div className="relative z-10 max-w-xl w-full text-center">
        {/* Animated Warning Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-24 h-24 rounded-[2rem] bg-zinc-950 flex items-center justify-center mx-auto mb-10 shadow-2xl border border-zinc-800"
        >
          <ShieldAlert className="w-12 h-12 text-white" strokeWidth={1.5} />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="text-3xl sm:text-5xl font-black text-zinc-900 tracking-tight uppercase italic mb-4"
        >
          {t('common.error.genericTitle', undefined, 'Something Went Wrong')}
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest leading-relaxed max-w-md mx-auto mb-16"
        >
          {t('common.error.genericDesc', undefined, 'An unexpected system error has occurred. Our engineering team has been notified.')}
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-zinc-900 hover:bg-zinc-800 text-white font-black rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-[10px]"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" />
            <span>{t('common.error.tryAgain', undefined, 'Try Again')}</span>
          </button>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-900 font-black rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-[10px]"
          >
            <Home className="w-4 h-4" />
            <span>{t('navigation.home', undefined, 'Go Home')}</span>
          </Link>
        </motion.div>

        {/* Developer Console Error Details */}
        {process.env.NODE_ENV === 'development' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-16 text-left max-w-lg mx-auto"
          >
            <details className="group cursor-pointer">
              <summary className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors select-none">
                Error Stack Details
              </summary>
              <pre className="mt-4 p-6 bg-zinc-950 border border-zinc-900 text-red-400 font-mono text-[10px] rounded-3xl overflow-auto max-h-48 leading-relaxed">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          </motion.div>
        )}
      </div>
    </div>
  );
}
