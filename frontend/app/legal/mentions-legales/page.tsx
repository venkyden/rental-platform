"use client";

import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';

export default function MentionsLegalesPage() {
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
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl">
                            {t('legal.notice.subtitle', undefined, 'Administrative Compliance')}
                        </div>
                        <h1 className="text-6xl sm:text-7xl font-black tracking-tighter text-zinc-900 uppercase">
                            {t('legal.notice.title')}
                        </h1>
                        <p className="text-xl text-zinc-500 font-medium max-w-2xl mx-auto">
                            {t('legal.notice.subtitle')}
                        </p>
                    </motion.div>

                    {/* Content Sections */}
                    <div className="space-y-12">
                        <motion.section variants={sectionVariants} className="glass-card !p-12 rounded-[3rem] border-zinc-100">
                            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-8 uppercase">
                                {t('legal.notice.editor.title')}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-zinc-600">
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">{t('legal.notice.editor.labels.company', undefined, 'Company')}</p>
                                    <p className="font-bold text-zinc-900">{t('legal.notice.editor.company')}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">{t('legal.notice.editor.labels.form', undefined, 'Legal Form')}</p>
                                    <p className="font-bold text-zinc-900">{t('legal.notice.editor.form')}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">{t('legal.notice.editor.labels.capital', undefined, 'Capital')}</p>
                                    <p className="font-bold text-zinc-900">{t('legal.notice.editor.capital')}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">{t('legal.notice.editor.labels.hq', undefined, 'Headquarters')}</p>
                                    <p className="font-bold text-zinc-900">{t('legal.notice.editor.hq')}</p>
                                </div>
                            </div>
                        </motion.section>

                        <motion.section variants={sectionVariants} className="glass-card !p-12 rounded-[3rem] border-zinc-100">
                            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-8 uppercase">
                                {t('legal.notice.infrastructure.title', undefined, 'Infrastructure')}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-zinc-600">
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">{t('legal.notice.infrastructure.frontend.title', undefined, 'Frontend Hosting')}</p>
                                    <p className="font-bold text-zinc-900">{t('legal.notice.infrastructure.frontend.company', undefined, 'Vercel Inc.')}</p>
                                    <p className="text-sm">{t('legal.notice.infrastructure.frontend.address', undefined, '440 N Barranca Ave #4133, Covina, CA 91723, USA')}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">{t('legal.notice.infrastructure.backend.title', undefined, 'Backend Logic')}</p>
                                    <p className="font-bold text-zinc-900">{t('legal.notice.infrastructure.backend.company', undefined, 'Railway Corporation')}</p>
                                    <p className="text-sm">{t('legal.notice.infrastructure.backend.address', undefined, '548 Market St, San Francisco, CA 94104, USA')}</p>
                                </div>
                            </div>
                        </motion.section>
                    </div>

                    {/* Contact Disclaimer */}
                    <motion.div 
                        variants={sectionVariants}
                        className="pt-12 border-t border-zinc-100 text-center"
                    >
                        <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em]">
                            Propriété de Roomivo SAS • Tous droits réservés
                        </p>
                    </motion.div>
                </motion.div>
            </div>
        </PremiumLayout>
    );
}
