'use client';

import { motion } from 'framer-motion';
import { ChevronRight, Home, Building2, Sparkles, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import Link from 'next/link';

export default function DualCTA() {
  const { t } = useLanguage();

  return (
    <section className="py-32 sm:py-56 bg-zinc-50/50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 sm:gap-20">
          {/* ─── Tenant CTA ─── */}
          <motion.div 
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -15 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="group relative rounded-[3rem] sm:rounded-[4rem] bg-zinc-900 p-12 sm:p-20 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]"
          >
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-[2000ms]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-zinc-800/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-xl flex items-center justify-center mb-12 border border-white/10 shadow-2xl group-hover:rotate-6 transition-transform duration-700">
                <Home className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-4xl sm:text-6xl font-black mb-6 text-white tracking-tight leading-tight">
                {t('landing.cta.tenant.title', undefined, 'Looking for a home?')}
              </h3>
              <p className="text-zinc-300 text-base mb-12 leading-relaxed font-medium">
                {t('landing.cta.tenant.desc', undefined, 'Join thousands of tenants finding verified homes in France.')}
              </p>
              <Link
                href="/auth/register?role=tenant"
                className="inline-flex items-center gap-4 px-10 py-5 bg-white text-zinc-900 font-bold rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all group/btn uppercase tracking-wider text-sm"
              >
                <span>{t('landing.cta.tenant.button', undefined, 'Start Search')}</span>
                <ArrowUpRight className="w-5 h-5 group-hover/btn:translate-x-2 group-hover/btn:-translate-y-2 transition-transform duration-500" strokeWidth={3} />
              </Link>
            </div>
          </motion.div>

          {/* ─── Landlord CTA ─── */}
          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -15 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="group relative rounded-[3rem] sm:rounded-[4rem] bg-white p-12 sm:p-20 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.05)] border border-zinc-100"
          >
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-zinc-50 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-[2000ms]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-zinc-100/50 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
              <div className="w-20 h-20 rounded-3xl bg-zinc-900 flex items-center justify-center mb-12 shadow-2xl group-hover:-rotate-6 transition-transform duration-700">
                <Building2 className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-4xl sm:text-6xl font-black mb-6 text-zinc-900 tracking-tight leading-tight">
                {t('landing.cta.landlord.title', undefined, 'Are you a landlord?')}
              </h3>
              <p className="text-zinc-500 text-base mb-12 leading-relaxed font-medium">
                {t('landing.cta.landlord.desc', undefined, 'List your property and find the perfect, verified tenant.')}
              </p>
              <Link
                href="/auth/register?role=landlord"
                className="inline-flex items-center gap-4 px-10 py-5 bg-zinc-900 text-white font-bold rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all group/btn uppercase tracking-wider text-sm"
              >
                <span>{t('landing.cta.landlord.button', undefined, 'List Property')}</span>
                <Sparkles className="w-5 h-5 group-hover/btn:scale-125 transition-transform duration-500" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
