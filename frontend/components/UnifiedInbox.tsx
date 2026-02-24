'use client';

import { useState, useEffect } from 'react';
import EmptyState from '@/components/EmptyState';
import { apiClient } from '@/lib/api';
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

interface ConversationSummary {
    id: string;
    property_id: string;
    property_title: string | null;
    property_address: string | null;
    other_party_name: string;
    other_party_email: string;
    subject: string | null;
    status: string;
    last_message_preview: string | null;
    last_message_at: string;
    unread_count: number;
    created_at: string;
}

interface UnifiedInboxProps {
    onSelectConversation?: (conversationId: string) => void;
    selectedConversationId?: string | null;
}

export default function UnifiedInbox({ onSelectConversation, selectedConversationId }: UnifiedInboxProps) {
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [totalUnread, setTotalUnread] = useState(0);

    useEffect(() => {
        loadConversations();
        loadUnreadCount();
    }, [filter]);

    const loadConversations = async () => {
        try {
            const params = filter !== 'all' ? `?status=${filter}` : '';
            const response = await apiClient.client.get(`/inbox${params}`);
            setConversations(response.data);
        } catch (error) {
            console.error('Error loading inbox:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUnreadCount = async () => {
        try {
            const response = await apiClient.client.get('/inbox/unread-count');
            setTotalUnread(response.data.total_unread);
        } catch (error) {
            console.error('Error loading unread count:', error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Hier';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('fr-FR', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        }
    };

    const filteredConversations = conversations.filter(conv => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            conv.other_party_name.toLowerCase().includes(query) ||
            conv.property_title?.toLowerCase().includes(query) ||
            conv.subject?.toLowerCase().includes(query)
        );
    });

    // Group conversations by property
    const groupedByProperty = filteredConversations.reduce((acc, conv) => {
        const key = conv.property_id;
        if (!acc[key]) {
            acc[key] = {
                property_title: conv.property_title,
                property_address: conv.property_address,
                conversations: []
            };
        }
        acc[key].conversations.push(conv);
        return acc;
    }, {} as Record<string, { property_title: string | null; property_address: string | null; conversations: ConversationSummary[] }>);

    if (loading) {
        return (
            <div className="animate-pulse space-y-4 p-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-gray-200 rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        📬 Boîte de réception
                        {totalUnread > 0 && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-sm rounded-full">
                                {totalUnread}
                            </span>
                        )}
                    </h2>
                </div>

                {/* Search */}
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 pl-10 rounded-lg bg-white/20 text-white placeholder-white/70 focus:bg-white focus:text-gray-900 focus:placeholder-gray-400 transition-colors"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b">
                {[
                    { key: 'all', label: 'Tous' },
                    { key: 'active', label: 'Actifs' },
                    { key: 'archived', label: 'Archivés' }
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key as typeof filter)}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${filter === key
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Conversations List */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex-1 overflow-y-auto"
            >
                {Object.keys(groupedByProperty).length === 0 ? (
                    <div className="py-16">
                        <EmptyState
                            icon="📭"
                            title="Aucune conversation"
                            description="Vous n'avez pas encore de messages. Les demandes des locataires apparaîtront ici."
                            layout="transparent"
                        />
                    </div>
                ) : (
                    Object.entries(groupedByProperty).map(([propertyId, group]) => (
                        <motion.div variants={itemVariants} key={propertyId} className="border-b last:border-b-0">
                            {/* Property Header */}
                            <div className="px-4 py-2 bg-gray-50 border-b">
                                <div className="font-medium text-gray-900 text-sm">
                                    🏠 {group.property_title || 'Propriété'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {group.property_address}
                                </div>
                            </div>

                            {/* Conversations for this property */}
                            {group.conversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => onSelectConversation?.(conv.id)}
                                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors border-b last:border-b-0 ${selectedConversationId === conv.id ? 'bg-blue-50' : ''
                                        } ${conv.unread_count > 0 ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                                            {conv.other_party_name.charAt(0).toUpperCase()}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`font-medium truncate ${conv.unread_count > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                                                    {conv.other_party_name}
                                                </span>
                                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                                    {formatDate(conv.last_message_at)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 mt-1">
                                                <p className={`text-sm truncate ${conv.unread_count > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                    {conv.last_message_preview || conv.subject}
                                                </p>
                                                {conv.unread_count > 0 && (
                                                    <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                                                        {conv.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </motion.div>
                    ))
                )}
            </motion.div>
        </div>
    );
}
