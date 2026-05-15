"use client";

import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';

export default function TermsPage() {
    const { t } = useLanguage();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
        }
    };

    const sectionVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring" as any, damping: 25, stiffness: 100 }
        }
    };

    return (
        <PremiumLayout withNavbar={true}>
            <div className="max-w-4xl mx-auto px-6 py-24">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-16"
                >
                    {/* Header */}
                    <motion.div variants={sectionVariants} className="text-center space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/5 border border-zinc-900/10 text-zinc-900 text-[10px] font-black uppercase tracking-[0.2em]">
                            {t('landing.hero.badge', undefined, 'Legal Framework')}
                        </div>
                        <h1 className="text-6xl sm:text-7xl font-black tracking-tighter text-zinc-900 uppercase">
                            {t('legal.terms.title')}
                        </h1>
                        <p className="text-xl text-zinc-500 font-medium max-w-2xl mx-auto">
                            {t('legal.terms.description')}
                        </p>
                    </motion.div>

                    {/* Content Sections */}
                    <div className="space-y-12">
                        {['service', 'obligations', 'fraud', 'liability'].map((sectionKey) => (
                            <motion.section 
                                key={sectionKey}
                                variants={sectionVariants}
                                className={`glass-card !p-12 rounded-[3rem] border-zinc-100 ${sectionKey === 'fraud' ? 'border-zinc-900 bg-zinc-900/5 shadow-2xl shadow-zinc-900/10' : ''}`}
                            >
                                <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-6 uppercase">
                                    {t(`legal.terms.sections.${sectionKey}.title`)}
                                </h2>
                                <p className="text-zinc-600 leading-relaxed text-lg">
                                    {t(`legal.terms.sections.${sectionKey}.content`)}
                                </p>
                            </motion.section>
                        ))}
                    </div>

                    {/* Footer Info */}
                    <motion.div 
                        variants={sectionVariants}
                        className="pt-12 border-t border-zinc-100 text-center"
                    >
                        <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em]">
                            {t('legal.terms.lastUpdated')}
                        </p>
                    </motion.div>
                </motion.div>
            </div>
        </PremiumLayout>
    );
}
