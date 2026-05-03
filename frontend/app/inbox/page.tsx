'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
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
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="btn-secondary !py-2.5 !px-5 text-sm"
                    >
                        ← {t('dashboard.title', undefined, 'Dashboard')}
                    </button>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">
                         {t('inbox.title', undefined, undefined)}
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-250px)]">
                    {/* Inbox List - Hidden on mobile when viewing conversation */}
                    <div className={`lg:col-span-1 ${isMobileViewingConversation ? 'hidden lg:block' : ''} glass rounded-[2.5rem] overflow-hidden shadow-xl`}>
                        <UnifiedInbox
                            onSelectConversation={handleSelectConversation}
                            selectedConversationId={selectedConversationId}
                        />
                    </div>

                    {/* Conversation View */}
                    <div className={`lg:col-span-2 ${!isMobileViewingConversation && !selectedConversationId ? 'hidden lg:block' : ''}`}>
                        {selectedConversationId ? (
                            <div className="h-full glass rounded-[2.5rem] overflow-hidden shadow-xl">
                                <ConversationView
                                    conversationId={selectedConversationId}
                                    onClose={handleCloseConversation}
                                    onArchive={handleArchive}
                                />
                            </div>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="h-full glass-card flex flex-col items-center justify-center text-zinc-400 text-center"
                            >
                                <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                                    <Mail className="w-10 h-10 text-zinc-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">{t('inbox.selectPrompt', undefined, undefined)}</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                                    {t('inbox.selectDesc', undefined, undefined)}
                                </p>
                            </motion.div>
                        )}
                    </div>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
