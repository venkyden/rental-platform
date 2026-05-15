'use client';

import { motion } from 'framer-motion';
import { Users, Zap, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    {
      step: '01',
      icon: <Users className="w-8 h-8" />,
      title: t('landing.howItWorks.steps.profile.title', undefined, 'Create Profile'),
      description: t('landing.howItWorks.steps.profile.desc', undefined, 'Build your verified digital rental identity with a complete dossier.'),
    },
    {
      step: '02',
      icon: <Zap className="w-8 h-8" />,
      title: t('landing.howItWorks.steps.matching.title', undefined, 'Smart Matching'),
      description: t('landing.howItWorks.steps.matching.desc', undefined, 'Connect with compatible listings instantly based on your profile.'),
    },
    {
      step: '03',
      icon: <FileText className="w-8 h-8" />,
      title: t('landing.howItWorks.steps.lease.title', undefined, 'Automated Lease'),
      description: t('landing.howItWorks.steps.lease.desc', undefined, 'Sign legal contracts digitally and securely with automated generation.'),
    }
  ];

  return (
    <section className="py-32 sm:py-56 bg-white relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-1/2 left-0 w-full h-px bg-zinc-100 hidden lg:block -translate-y-1/2" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-32 gap-12">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-3 px-4 py-2 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.4em] mb-8"
            >
              <CheckCircle2 className="w-3 h-3" />
              Direct Pipeline
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl sm:text-7xl font-black tracking-tighter text-zinc-900 uppercase italic leading-[0.9]"
            >
              {t('landing.howItWorks.title', undefined, 'Three steps to home')}
            </motion.h2>
          </div>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-zinc-400 text-[12px] font-black uppercase tracking-[0.5em] max-w-sm lg:text-right"
          >
            {t('landing.howItWorks.subtitle', undefined, 'The smart way to rent in France')}
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-3 gap-20 lg:gap-32 relative">
          {steps.map((item, i) => (
            <motion.div 
              key={item.step}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative group"
            >
              <div className="relative">
                <div className="flex items-center justify-between mb-12">
                  <div className="w-24 h-24 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 text-zinc-900 flex items-center justify-center shadow-xl shadow-zinc-900/5 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-700 group-hover:scale-110 group-hover:-rotate-3">
                    {item.icon}
                  </div>
                  <div className="text-7xl font-black text-zinc-100 tracking-tighter group-hover:text-zinc-900/5 transition-colors duration-700 italic">
                    {item.step}
                  </div>
                </div>

                <h3 className="text-3xl font-black mb-8 text-zinc-900 uppercase tracking-tight group-hover:translate-x-2 transition-transform duration-500">
                  {item.title}
                </h3>
                <p className="text-zinc-400 leading-relaxed font-black uppercase text-[11px] tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">
                  {item.description}
                </p>

                {/* Status Bar */}
                <div className="mt-12 h-1 w-full bg-zinc-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: '100%' }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.3 + 0.5, duration: 1.5 }}
                    className="h-full bg-zinc-900"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
