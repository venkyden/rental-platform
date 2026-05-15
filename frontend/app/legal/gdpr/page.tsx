"use client";

import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';

export default function GDPRPage() {
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
                            {t('legal.gdpr.badge', undefined, 'Data Sovereignty')}
                        </div>
                        <h1 className="text-6xl sm:text-7xl font-black tracking-tighter text-zinc-900 uppercase">
                            {t('legal.gdpr.title', undefined, 'GDPR & Rights')}
                        </h1>
                        <p className="text-xl text-zinc-500 font-medium max-w-2xl mx-auto">
                            {t('legal.gdpr.subtitle', undefined, 'Built entirely within the European Union. Your data belongs to you.')}
                        </p>
                    </motion.div>

                    {/* Content Sections */}
                    <div className="space-y-12">
                        <motion.section variants={sectionVariants} className="glass-card !p-12 rounded-[3rem] border-zinc-100">
                            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-8 uppercase">
                                {t('legal.gdpr.sections.fundamental.title', undefined, 'Fundamental Rights')}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white font-black text-xs">A</span>
                                        <p className="text-sm font-black text-zinc-900 uppercase tracking-widest">{t('legal.gdpr.rights.access.title', undefined, 'Access & Portability')}</p>
                                    </div>
                                    <p className="text-sm text-zinc-600 leading-relaxed">
                                        {t('legal.gdpr.rights.access.content', undefined, 'Extract a machine-readable archive of all personal data and verification proofs tied to your account.')}
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white font-black text-xs">R</span>
                                        <p className="text-sm font-black text-zinc-900 uppercase tracking-widest">{t('legal.gdpr.rights.rectification.title', undefined, 'Rectification')}</p>
                                    </div>
                                    <p className="text-sm text-zinc-600 leading-relaxed">
                                        {t('legal.gdpr.rights.rectification.content', undefined, 'Instantly update inaccurate information. Modifying documents may trigger a mandatory re-verification.')}
                                    </p>
                                </div>
                                <div className="space-y-4 md:col-span-2 pt-8 border-t border-zinc-50">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white font-black text-xs">F</span>
                                        <p className="text-sm font-black text-zinc-900 uppercase tracking-widest">{t('legal.gdpr.rights.forgotten.title', undefined, 'Right to be Forgotten')}</p>
                                    </div>
                                    <p className="text-sm text-zinc-600 leading-relaxed">
                                        {t('legal.gdpr.rights.forgotten.content', undefined, 'Permanent deletion of your account and dossiers. Retention requirements may temporarily apply for active leases.')}
                                    </p>
                                </div>
                            </div>
                        </motion.section>

                        <motion.section variants={sectionVariants} className="glass-card !p-12 rounded-[3rem] border-zinc-100 text-center">
                            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-6 uppercase">
                                {t('legal.gdpr.sections.contact.title', undefined, 'Exercise Your Rights')}
                            </h2>
                            <p className="text-zinc-600 leading-relaxed text-lg max-w-2xl mx-auto mb-8">
                                {t('legal.gdpr.sections.contact.content', undefined, 'Most rights can be exercised directly via your dashboard. For manual requests, contact our Data Protection Officer.')}
                            </p>
                            <div className="inline-block px-8 py-4 bg-zinc-900 text-white rounded-2xl font-mono text-sm tracking-widest shadow-2xl">
                                dpo@roomivo.eu
                            </div>
                        </motion.section>
                    </div>

                    {/* Footer Info */}
                    <motion.div 
                        variants={sectionVariants}
                        className="pt-12 border-t border-zinc-100 text-center"
                    >
                        <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em]">
                            {t('legal.terms.lastUpdated', undefined, 'Last Updated')} • February 2026
                        </p>
                    </motion.div>
                </motion.div>
            </div>
        </PremiumLayout>
    );
}
