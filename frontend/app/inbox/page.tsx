'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import UnifiedInbox from '@/components/UnifiedInbox';
import ConversationView from '@/components/ConversationView';
import { Mail } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { motion } from 'framer-motion';

export default function InboxPage() {
    const router = useRouter();
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [isMobileViewingConversation, setIsMobileViewingConversation] = useState(false);
    const { t } = useLanguage();

    const handleSelectConversation = (conversationId: string) => {
        setSelectedConversationId(conversationId);
        setIsMobileViewingConversation(true);
    };

    const handleCloseConversation = () => {
        setIsMobileViewingConversation(false);
    };

    const handleArchive = () => {
        setSelectedConversationId(null);
        setIsMobileViewingConversation(false);
    };

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-16">
                        <div className="flex items-center gap-8">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="w-16 h-16 rounded-2xl bg-white shadow-2xl border border-white/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group overflow-hidden relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-transparent opacity-50"></div>
                                <span className="text-2xl font-black relative z-10 group-hover:-translate-x-1 transition-transform">←</span>
                            </button>
                            <div className="space-y-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/10 border border-zinc-900/20 text-zinc-900 text-[8px] font-black uppercase tracking-[0.2em]">
                                    {t('dashboard.inbox.secure', undefined, 'Secure Communications')}
                                </div>
                                <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-zinc-900 uppercase leading-none">
                                    {t('dashboard.inbox.title', undefined, 'Messages')}
                                </h1>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em]">
                                    {t('dashboard.inbox.subtitle', undefined, 'Real-time Rental Workspace')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 h-[calc(100vh-320px)] min-h-[700px]">
                        {/* Inbox List - Hidden on mobile when viewing conversation */}
                        <div className={`lg:col-span-4 ${isMobileViewingConversation ? 'hidden lg:block' : ''} h-full`}>
                            <div className="h-full glass-card !p-0 overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)]_40px_80px_-20px_rgba(0,0,0,0.4)] border-zinc-100 rounded-[3rem]">
                                <UnifiedInbox
                                    onSelectConversation={handleSelectConversation}
                                    selectedConversationId={selectedConversationId}
                                />
                            </div>
                        </div>

                        {/* Conversation View */}
                        <div className={`lg:col-span-8 h-full ${!isMobileViewingConversation && !selectedConversationId ? 'hidden lg:block' : ''}`}>
                            {selectedConversationId ? (
                                <div className="h-full glass-card !p-0 overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)]_40px_80px_-20px_rgba(0,0,0,0.4)] border-zinc-100 rounded-[3rem]">
                                    <ConversationView
                                        conversationId={selectedConversationId}
                                        onClose={handleCloseConversation}
                                        onArchive={handleArchive}
                                    />
                                </div>
                            ) : (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="h-full glass-card !p-20 border-dashed border-2 border-zinc-100 flex flex-col items-center justify-center text-center rounded-[3rem] relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02] pointer-events-none"></div>
                                    <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-10 shadow-inner">
                                        <Mail className="w-10 h-10 text-zinc-300" />
                                    </div>
                                    <h3 className="text-3xl font-black text-zinc-900 mb-4 uppercase tracking-tighter">
                                        {t('dashboard.inbox.selectPrompt', undefined, 'Workspace Selected')}
                                    </h3>
                                    <p className="text-xl text-zinc-500 font-medium max-w-sm mx-auto leading-relaxed">
                                        {t('dashboard.inbox.selectDesc', undefined, 'Choose a message from the left to engage in professional communication and manage your rental journey.')}
                                    </p>
                                    <div className="mt-12 flex gap-4">
                                        <div className="px-6 py-2 bg-zinc-100 rounded-full text-[10px] font-black text-zinc-400 uppercase tracking-widest">End-to-End Encrypted</div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
