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
      title: t('landing.howItWorks.steps.profile.title', undefined, 'Get verified'),
      description: t('landing.howItWorks.steps.profile.desc', undefined, "A few minutes with your documents — then they're deleted. You keep the proof, whichever side of the lease you're on."),
    },
    {
      step: '02',
      icon: <Zap className="w-8 h-8" />,
      title: t('landing.howItWorks.steps.matching.title', undefined, 'Search & Apply'),
      description: t('landing.howItWorks.steps.matching.desc', undefined, 'Browse verified listings and apply directly with your dossier.'),
    },
    {
      step: '03',
      icon: <FileText className="w-8 h-8" />,
      title: t('landing.howItWorks.steps.lease.title', undefined, 'Sign & move in'),
      description: t('landing.howItWorks.steps.lease.desc', undefined, 'Generate a lease that conforms to the official French model and sign it digitally. Both sides walk away with signed evidence.'),
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
              className="inline-flex items-center gap-3 px-4 py-2 bg-zinc-900 text-white rounded-full text-xs font-bold uppercase tracking-wider mb-8"
            >
              <CheckCircle2 className="w-3 h-3" />
              {t('landing.howItWorks.pipeline', undefined, 'Direct Pipeline')}
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-900 leading-tight"
            >
              {t('landing.howItWorks.title', undefined, 'Three steps to home')}
            </motion.h2>
          </div>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-zinc-500 text-base leading-relaxed max-w-sm lg:text-right"
          >
            {t('landing.howItWorks.subtitle', undefined, 'From stranger to signed lease — every step verified')}
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
                  <div className="text-5xl md:text-7xl font-black text-zinc-100 tracking-tighter group-hover:text-zinc-900/5 transition-colors duration-700 italic">
                    {item.step}
                  </div>
                </div>

                <h3 className="text-2xl font-black mb-6 text-zinc-900 tracking-tight group-hover:translate-x-2 transition-transform duration-500">
                  {item.title}
                </h3>
                <p className="text-zinc-500 leading-relaxed font-medium text-base">
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
