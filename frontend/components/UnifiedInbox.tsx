'use client';

import { useState, useEffect } from 'react';
import EmptyState from '@/components/EmptyState';
import { apiClient } from '@/lib/api';
import { motion, Variants } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';

import { ListSkeleton } from '@/components/SkeletonLoaders';
import { Search } from 'lucide-react';

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
    const { t } = useLanguage();

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
            return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return t('inbox.time.yesterday', undefined, undefined);
        } else if (diffDays < 7) {
            return date.toLocaleDateString('en-GB', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        }
    };

    const filteredConversations = conversations.filter(conv => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            conv.other_party_name?.toLowerCase().includes(query) ||
            conv.property_title?.toLowerCase().includes(query) ||
            conv.subject?.toLowerCase().includes(query)
        );
    });

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
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/10 overflow-hidden h-full">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                    <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/3 mb-4 animate-pulse" />
                    <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-full animate-pulse" />
                </div>
                <div className="p-4">
                    <ListSkeleton count={6} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                         {t('inbox.title', undefined, undefined)}
                        {totalUnread > 0 && (
                            <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                                {totalUnread}
                            </span>
                        )}
                    </h2>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder={t('inbox.searchPlaceholder', undefined, undefined)}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2.5 pl-10 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex px-2 pt-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/30">
                {[
                    { key: 'all', label: t('inbox.filters.all', undefined, undefined) },
                    { key: 'active', label: t('inbox.filters.active', undefined, undefined) },
                    { key: 'archived', label: t('inbox.filters.archived', undefined, undefined) }
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key as typeof filter)}
                        className={`flex-1 py-3 text-sm font-semibold transition-all relative ${filter === key
                            ? 'text-teal-600 dark:text-teal-400'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                    >
                        {label}
                        {filter === key && (
                            <motion.div
                                layoutId="inbox-filter-tab"
                                className="absolute bottom-0 left-4 right-4 h-0.5 bg-teal-500 rounded-full"
                            />
                        )}
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
                            icon=""
                            title={t('inbox.status.noConversations', undefined, undefined)}
                            description={t('inbox.status.noConversationsDesc', undefined, undefined)}
                            layout="transparent"
                        />
                    </div>
                ) : (
                    Object.entries(groupedByProperty).map(([propertyId, group]) => (
                        <motion.div variants={itemVariants} key={propertyId} className="border-b last:border-b-0">
                            {/* Property Header */}
                            <div className="px-4 py-2 bg-gray-50 border-b">
                                <div className="font-medium text-gray-900 text-sm">
                                     {group.property_title || t('search.property', undefined, undefined)}
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
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-white font-bold">
                                            {conv.other_party_name?.charAt(0).toUpperCase() || '?'}
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
