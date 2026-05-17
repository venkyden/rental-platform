'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Clock, Trash2, FileText, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function FrenchComplianceSection() {
  const { t } = useLanguage();

  const rules = [
    {
      icon: <Clock className="w-6 h-6 text-zinc-900" />,
      title: t('landing.compliance.conservation.title', undefined, 'Data Conservation'),
      desc: t('landing.compliance.conservation.desc', undefined, 'Rental application dossiers are kept for a maximum of 3 years following the last contact or active rental, in accordance with CNIL guidelines.'),
    },
    {
      icon: <Trash2 className="w-6 h-6 text-zinc-900" />,
      title: t('landing.compliance.deletion.title', undefined, 'Right to Erasure'),
      desc: t('landing.compliance.deletion.desc', undefined, 'You can request complete and irreversible deletion of your dossier and documents at any time. Verification data is wiped within 48 hours.'),
    },
    {
      icon: <FileText className="w-6 h-6 text-zinc-900" />,
      title: t('landing.compliance.renewal.title', undefined, 'Automated Lease & Renewal'),
      desc: t('landing.compliance.renewal.desc', undefined, 'Lease notifications and rent indexing calculations are generated in compliance with the Loi Alur and Article 10 of the July 6, 1989 law.'),
    }
  ];

  return (
    <section className="py-24 sm:py-32 bg-zinc-50 border-y border-zinc-100 relative overflow-hidden">
      {/* Dynamic light gradient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-zinc-100 rounded-full blur-[100px] opacity-40 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="max-w-3xl mb-20">
          {/* Section badge */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2.5 px-4 py-2 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-8"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('landing.footer.legal', undefined, 'Legal Compliance')}</span>
          </motion.div>

          {/* Section titles */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl font-black tracking-tighter text-zinc-900 uppercase italic leading-[0.9] mb-6"
          >
            {t('landing.compliance.title', undefined, 'French Data & Rental Law Compliance')}
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-zinc-500 font-bold uppercase text-[11px] tracking-widest leading-relaxed max-w-xl"
          >
            {t('landing.compliance.subtitle', undefined, 'Your data is managed in strict accordance with French regulations and European standards.')}
          </motion.p>
        </div>

        {/* Dynamic 3-card layout */}
        <div className="grid md:grid-cols-3 gap-8">
          {rules.map((rule, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -8 }}
              className="group bg-white rounded-[2.5rem] p-10 border border-zinc-100 hover:border-zinc-200 transition-all duration-500 shadow-xl shadow-zinc-900/5"
            >
              <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-500 shadow-sm">
                <div className="group-hover:text-white transition-colors duration-500">
                  {rule.icon}
                </div>
              </div>

              <h3 className="text-2xl font-black mb-4 text-zinc-900 tracking-tight uppercase group-hover:translate-x-1 transition-transform duration-500">
                {rule.title}
              </h3>
              
              <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest leading-relaxed opacity-90 group-hover:opacity-100 transition-opacity">
                {rule.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
