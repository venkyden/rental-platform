'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Camera, FileText, ChevronLeft } from 'lucide-react';
import PremiumLayout from '@/components/PremiumLayout';
import { useLanguage } from '@/lib/LanguageContext';

export default function IdentityVerifyPage() {
    const router = useRouter();
    const { t } = useLanguage();

    return (
        <PremiumLayout withNavbar={false}>
            <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-slate-50 dark:bg-zinc-950">
                {/* Background Effects */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-slate-50 to-white dark:from-indigo-900/20 dark:via-zinc-950 dark:to-zinc-950"></div>
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10"></div>
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="max-w-2xl w-full relative z-10"
                >
                    <div className="glass-card !p-12 sm:!p-16 rounded-[3.5rem] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_60px_120px_-20px_rgba(0,0,0,0.5)] border-zinc-100 dark:border-zinc-800/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        
                        <button 
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] hover:text-zinc-900 dark:hover:text-white transition-all mb-12 group"
                        >
                            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            {t('common.actions.back', undefined, 'Back')}
                        </button>

                        <div className="mb-16 text-center space-y-4">
                            <div className="w-20 h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <Shield className="w-10 h-10 text-indigo-500" />
                            </div>
                            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase leading-none">
                                {t('verify.identity.title', undefined, 'Identity Validation')}
                            </h1>
                            <p className="text-lg text-zinc-500 dark:text-zinc-400 font-medium max-w-sm mx-auto">
                                Securely verify your identity to unlock trust across the Roomivo ecosystem.
                            </p>
                        </div>

                        <div className="space-y-6 mb-16">
                            <motion.div 
                                whileHover={{ scale: 1.02 }}
                                className="p-8 bg-white/50 dark:bg-zinc-800/30 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-700/30 shadow-xl group cursor-pointer transition-all"
                            >
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                                            <Camera className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black uppercase tracking-tight mb-1">{t('verify.identity.idCard', undefined, 'Passport / CNI')}</h3>
                                            <p className="text-xs text-zinc-500 font-medium">{t('verify.identity.scanDesc', undefined, 'Secure automated scan via camera.')}</p>
                                        </div>
                                    </div>
                                    <div className="hidden sm:block">
                                        <div className="px-4 py-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase tracking-widest rounded-xl">Fast Scan</div>
                                    </div>
                                </div>
                                <button className="mt-8 w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl">
                                    {t('verify.identity.scanButton', undefined, 'Launch Scanner')}
                                </button>
                            </motion.div>

                            <motion.div 
                                whileHover={{ scale: 1.02 }}
                                className="p-8 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm opacity-80 hover:opacity-100 transition-all group cursor-pointer"
                            >
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <FileText className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black uppercase tracking-tight mb-1">{t('verify.identity.residency', undefined, 'Residence Permit')}</h3>
                                            <p className="text-xs text-zinc-500 font-medium">{t('verify.identity.visaDesc', undefined, 'Required for non-EU passport holders.')}</p>
                                        </div>
                                    </div>
                                </div>
                                <button className="mt-8 w-full py-4 border-2 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:border-zinc-900 hover:text-zinc-900 dark:hover:border-white dark:hover:text-white transition-all">
                                    {t('verify.identity.uploadPdf', undefined, 'Import PDF Document')}
                                </button>
                            </motion.div>
                        </div>

                        <div className="text-center">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-[10px] font-black uppercase tracking-[0.4em] transition-all"
                            >
                                {t('onboarding.skip', undefined, 'I will do this later')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </PremiumLayout>
    );
}
