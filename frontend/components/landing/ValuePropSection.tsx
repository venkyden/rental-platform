'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { FileCheck, Sparkles, Scale, ShieldCheck, ChevronRight } from 'lucide-react';
import { useRef } from 'react';

export default function ValuePropSection() {
  const { t } = useLanguage();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 100]);

  const features = [
    {
      icon: <FileCheck className="w-8 h-8" />,
      title: t('landing.valueProp.dossier.title', undefined, 'Digital Dossier'),
      desc: t('landing.valueProp.dossier.desc', undefined, 'No more paper. Your verified identity and documents in one secure place.'),
      span: "md:col-span-2",
      bg: "bg-zinc-900/5",
      iconBg: "bg-zinc-900 text-white"
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: t('landing.valueProp.matching.title', undefined, 'AI-Powered Matching'),
      desc: t('landing.valueProp.matching.desc', undefined, 'Find properties that actually match your profile.'),
      span: "md:col-span-1",
      bg: "bg-zinc-100",
      iconBg: "bg-white text-zinc-900"
    },
    {
      icon: <Scale className="w-8 h-8" />,
      title: t('landing.valueProp.legal.title', undefined, 'French Law Compliant'),
      desc: t('landing.valueProp.legal.desc', undefined, 'Digital leases generated according to the latest regulations.'),
      span: "md:col-span-1",
      bg: "bg-zinc-50",
      iconBg: "bg-zinc-900 text-white"
    },
    {
      icon: <ShieldCheck className="w-8 h-8" />,
      title: t('landing.valueProp.payments.title', undefined, 'Secure Payments'),
      desc: t('landing.valueProp.payments.desc', undefined, 'Pay your rent and deposits through our integrated secure gateway.'),
      span: "md:col-span-2",
      bg: "bg-zinc-900 text-white",
      iconBg: "bg-white text-zinc-900",
      textColor: "text-zinc-300",
      titleColor: "text-white"
    }
  ];

  return (
    <section ref={containerRef} className="py-24 sm:py-40 relative overflow-hidden bg-white">
      {/* ─── Parallax Decorative Elements ─── */}
      <motion.div 
        style={{ y: y1 }}
        className="absolute top-1/4 -right-20 w-96 h-96 bg-zinc-100/50 rounded-full blur-[120px] -z-10"
      />
      <motion.div 
        style={{ y: y2 }}
        className="absolute bottom-1/4 -left-20 w-96 h-96 bg-zinc-50 rounded-full blur-[120px] -z-10"
      />

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="inline-block px-4 py-1.5 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-6"
            >
              {t('landing.valueProp.title', undefined, 'Why Choose Roomivo?')}
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-7xl md:text-8xl font-black tracking-tighter text-zinc-900 leading-[0.9] uppercase"
            >
              {t('landing.valueProp.subtitle', undefined, 'Secure. Transparent. Seamless.')}
            </motion.h2>
          </div>
          
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[12px] font-black text-zinc-400 uppercase tracking-[0.4em] max-w-sm mb-2"
          >
            {t('landing.valueProp.desc', undefined, 'We bridge the gap between landlords and tenants with technology that builds trust.')}
          </motion.p>
        </div>

        {/* ─── Bento Grid ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature: any, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
              whileHover={{ y: -8 }}
              className={`${feature.span} group relative overflow-hidden rounded-[3rem] p-12 border border-zinc-100 transition-all duration-500 ${feature.bg.includes('zinc-900') ? 'bg-zinc-900 shadow-2xl' : 'bg-white hover:shadow-2xl'}`}
            >
              <div className="relative z-10 h-full flex flex-col">
                <div className={`w-16 h-16 rounded-2xl ${feature.iconBg} flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500 shadow-xl`}>
                  {feature.icon}
                </div>
                
                <h3 className={`text-3xl font-black mb-4 tracking-tighter uppercase ${feature.titleColor || 'text-zinc-900'}`}>
                  {feature.title}
                </h3>
                <p className={`font-bold leading-tight ${feature.textColor || 'text-zinc-500'}`}>
                  {feature.desc}
                </p>
                
                <div className={`mt-auto pt-10 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${feature.bg.includes('zinc-900') ? 'text-zinc-400' : 'text-zinc-300'} group-hover:text-zinc-900 transition-colors`}>
                  {t('common.learnMore', undefined, 'Learn more')} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Sophisticated Overlay for white cards */}
              {!feature.bg.includes('zinc-900') && (
                <div className="absolute inset-0 bg-zinc-50 opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-0" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
