"use client";

import { motion, Variants } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';

const SECTIONS = ['controller', 'data', 'purposes', 'recipients', 'transfers', 'retention', 'automated', 'rights', 'security'];

export default function PrivacyPage() {
    const { t } = useLanguage();

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
        }
    };

    const sectionVariants: Variants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: 'spring', damping: 25, stiffness: 100 }
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
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/5 border border-zinc-900/10 text-zinc-900 text-xs font-black uppercase tracking-[0.2em]">
                            {t('legal.privacy.subtitle', undefined, 'Privacy & Trust')}
                        </div>
                        <h1 className="text-6xl sm:text-7xl font-black tracking-tighter text-zinc-900 uppercase">
                            {t('legal.privacy.title')}
                        </h1>
                        <p className="text-xl text-zinc-500 font-medium max-w-2xl mx-auto">
                            {t('legal.privacy.description')}
                        </p>
                    </motion.div>

                    {/* Content Sections */}
                    <div className="space-y-12">
                        {SECTIONS.map((sectionKey) => (
                            <motion.section 
                                key={sectionKey}
                                variants={sectionVariants}
                                className="glass-card !p-12 rounded-[3rem] border-zinc-100"
                            >
                                <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-6 uppercase">
                                    {t(`legal.privacy.sections.${sectionKey}.title`)}
                                </h2>
                                <div className="space-y-4">
                                    {t(`legal.privacy.sections.${sectionKey}.content`).split('\n\n').map((paragraph, i) => (
                                        <p key={i} className="text-zinc-600 leading-relaxed text-lg">{paragraph}</p>
                                    ))}
                                </div>
                            </motion.section>
                        ))}
                    </div>

                    <p className="text-center text-xs font-black text-zinc-400 uppercase tracking-[0.3em]">
                        {t('legal.privacy.lastUpdated')}
                    </p>
                </motion.div>
            </div>
        </PremiumLayout>
    );
}
