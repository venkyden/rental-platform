'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Institutional endorsement strip — displayed prominently under the hero.
 * Logos are subject to usage authorization (PÉPITE / SNEE / Ministère ESR);
 * see CLAUDE.md Phase 1 item 7.
 */
export default function EndorsementStrip() {
  const { t } = useLanguage();

  return (
    <section className="py-12 sm:py-16 bg-white border-y border-zinc-100">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex flex-col lg:flex-row items-center justify-between gap-10"
        >
          <div className="text-center lg:text-left max-w-md">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
              {t('landing.endorsement.label', undefined, 'Backed by')}
            </p>
            <p className="text-sm text-zinc-600 font-medium leading-relaxed">
              {t('landing.endorsement.note', undefined, 'Founded by Audencia student-entrepreneurs under the Statut National Étudiant-Entrepreneur (SNEE), PÉPITE Pays de la Loire.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-16">
            <Image
              src="/images/ministere-esr.png"
              alt="Ministère de l'Enseignement supérieur et de la Recherche"
              width={300}
              height={210}
              className="h-24 sm:h-32 w-auto object-contain"
            />
            <Image
              src="/images/pepite-snee.jpg"
              alt="PÉPITE France — Le réseau des Étudiants-Entrepreneurs"
              width={380}
              height={214}
              className="h-24 sm:h-32 w-auto object-contain"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
