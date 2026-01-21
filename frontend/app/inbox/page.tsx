'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import UnifiedInbox from '@/components/UnifiedInbox';
import ConversationView from '@/components/ConversationView';

export default function InboxPage() {
    const router = useRouter();
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [isMobileViewingConversation, setIsMobileViewingConversation] = useState(false);

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
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                {/* Header */}
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                                ← Dashboard
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">
                                📬 Boîte de réception
                            </h1>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
                        {/* Inbox List - Hidden on mobile when viewing conversation */}
                        <div className={`lg:col-span-1 ${isMobileViewingConversation ? 'hidden lg:block' : ''}`}>
                            <UnifiedInbox
                                onSelectConversation={handleSelectConversation}
                                selectedConversationId={selectedConversationId}
                            />
                        </div>

                        {/* Conversation View */}
                        <div className={`lg:col-span-2 ${!isMobileViewingConversation && !selectedConversationId ? 'hidden lg:block' : ''}`}>
                            {selectedConversationId ? (
                                <ConversationView
                                    conversationId={selectedConversationId}
                                    onClose={handleCloseConversation}
                                    onArchive={handleArchive}
                                />
                            ) : (
                                <div className="h-full bg-white rounded-xl shadow-lg flex flex-col items-center justify-center text-gray-400">
                                    <span className="text-6xl mb-4">💬</span>
                                    <p className="text-lg">Sélectionnez une conversation</p>
                                    <p className="text-sm mt-2">
                                        Cliquez sur une conversation pour voir les messages
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
