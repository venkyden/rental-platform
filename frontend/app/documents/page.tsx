'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, FileText, ChevronLeft, Lock } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import PremiumLayout from '@/components/PremiumLayout';
import { useLanguage } from '@/lib/LanguageContext';

export default function DocumentsPage() {
    const router = useRouter();
    const { t } = useLanguage();

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 relative z-10">
                    <div className="flex items-center gap-8 mb-20">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-white/40 dark:border-zinc-800/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-transparent dark:from-white/5 opacity-50"></div>
                            <span className="text-2xl font-black relative z-10 group-hover:-translate-x-1 transition-transform">←</span>
                        </button>
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-[0.2em]">
                                Encrypted Storage
                            </div>
                            <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase leading-none">
                                {t('documents.title', undefined, 'Secure Vault')}
                            </h1>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em]">
                                {t('documents.subtitle', undefined, 'Manage your verified credentials')}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Main Status Card */}
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="glass-card !p-12 sm:!p-16 rounded-[3rem] border-zinc-100 dark:border-zinc-800/50 relative overflow-hidden shadow-2xl"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                            
                            <div className="flex items-center gap-6 mb-12">
                                <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center shadow-inner">
                                    <Shield className="w-10 h-10 text-emerald-500" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black tracking-tighter uppercase">{t('documents.verification', undefined, 'Compliance Status')}</h2>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Action Required</span>
                                    </div>
                                </div>
                            </div>

                            <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mb-12">
                                {t('documents.description', undefined, 'Your documents are encrypted and stored securely. Maintain your profile to ensure fast application approvals.')}
                            </p>

                            <button
                                onClick={() => router.push('/verify/identity')}
                                className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2rem] text-sm font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl"
                            >
                                {t('documents.updateButton', undefined, 'Update My Profile')} →
                            </button>
                        </motion.div>

                        {/* Document Types Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            {[
                                { title: 'Identity', icon: Shield, color: 'text-indigo-500', bg: 'bg-indigo-500/10', count: 0 },
                                { title: 'Income', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10', count: 0 },
                                { title: 'Receipts', icon: Lock, color: 'text-purple-500', bg: 'bg-purple-500/10', count: 0 },
                                { title: 'Guarantor', icon: Shield, color: 'text-amber-500', bg: 'bg-amber-500/10', count: 0 }
                            ].map((doc, idx) => (
                                <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="glass-card !p-10 rounded-[2.5rem] border-zinc-100 dark:border-zinc-800/50 hover:shadow-xl transition-all group"
                                >
                                    <div className={`w-14 h-14 ${doc.bg} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                                        <doc.icon className={`w-7 h-7 ${doc.color}`} />
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">{doc.title}</h3>
                                    <div className="flex justify-between items-center">
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{doc.count} Files</p>
                                        <button className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest hover:translate-x-1 transition-transform">Add +</button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
