"use client";

import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';

export default function CookiesPage() {
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
                            {t('cookies.badge', undefined, 'Privacy Intelligence')}
                        </div>
                        <h1 className="text-6xl sm:text-7xl font-black tracking-tighter text-zinc-900 uppercase">
                            {t('cookies.title', undefined, 'Cookie Policy')}
                        </h1>
                        <p className="text-xl text-zinc-500 font-medium max-w-2xl mx-auto">
                            {t('cookies.description', undefined, 'Roomivo uses minimal tracking to ensure a seamless, secure, and fast experience.')}
                        </p>
                    </motion.div>

                    {/* Content Sections */}
                    <div className="space-y-12">
                        <motion.section variants={sectionVariants} className="glass-card !p-12 rounded-[3rem] border-zinc-100">
                            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-8 uppercase">
                                {t('cookies.sections.categories.title', undefined, 'Essential vs. Optional')}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-zinc-600">
                                <div className="space-y-4">
                                    <p className="text-xs font-black text-zinc-900 uppercase tracking-widest">{t('cookies.categories.necessary.title', undefined, 'Strictly Necessary')}</p>
                                    <p className="text-sm leading-relaxed">
                                        {t('cookies.categories.necessary.content', undefined, 'Vital for authentication tokens, CSRF protection, and load balancing. These cannot be disabled.')}
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-xs font-black text-zinc-900 uppercase tracking-widest">{t('cookies.categories.analytics.title', undefined, 'Performance')}</p>
                                    <p className="text-sm leading-relaxed">
                                        {t('cookies.categories.analytics.content', undefined, 'Anonymized, privacy-first analytics to identify bottlenecks and improve application performance.')}
                                    </p>
                                </div>
                            </div>
                        </motion.section>

                        <motion.section variants={sectionVariants} className="glass-card !p-12 rounded-[3rem] border-zinc-100">
                            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-6 uppercase">
                                {t('cookies.sections.management.title', undefined, 'Managing Preferences')}
                            </h2>
                            <p className="text-zinc-600 leading-relaxed text-lg">
                                {t('cookies.sections.management.content', undefined, "You remain in control. Most browsers allow universal cookie blocking, though blocking essential cookies will terminate your active Roomivo session.")}
                            </p>
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
