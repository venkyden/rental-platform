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
            return t('dashboard.inbox.time.yesterday', undefined, 'Yesterday');
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
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/10 overflow-hidden h-full shadow-2xl">
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                    <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/3 mb-4 animate-pulse" />
                    <div className="h-14 bg-zinc-200 dark:bg-zinc-800 rounded-2xl w-full animate-pulse" />
                </div>
                <div className="p-6">
                    <ListSkeleton count={6} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white/50 dark:bg-zinc-900/50 backdrop-blur-2xl border border-white/40 dark:border-zinc-800/50 rounded-[2.5rem] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-white/30 dark:bg-zinc-900/30">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase flex items-center gap-4">
                         {t('dashboard.inbox.title', undefined, 'Messages')}
                        {totalUnread > 0 && (
                            <span className="px-3 py-1 bg-teal-500 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-teal-500/20">
                                {totalUnread}
                            </span>
                        )}
                    </h2>
                </div>

                {/* Search */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-teal-500 transition-colors" />
                    <input
                        type="text"
                        placeholder={t('dashboard.inbox.searchPlaceholder', undefined, 'Search messages...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-5 py-4 pl-12 rounded-[1.5rem] bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 border-none focus:ring-2 focus:ring-teal-500/50 transition-all font-bold text-sm shadow-inner"
                    />
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex p-2 bg-zinc-50/50 dark:bg-zinc-800/30">
                {[
                    { key: 'all', label: t('dashboard.inbox.filters.all', undefined, 'All') },
                    { key: 'active', label: t('dashboard.inbox.filters.active', undefined, 'Active') },
                    { key: 'archived', label: t('dashboard.inbox.filters.archived', undefined, 'Archived') }
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key as typeof filter)}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-2xl ${filter === key
                            ? 'bg-white dark:bg-zinc-900 text-teal-600 shadow-xl dark:shadow-white/5'
                            : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
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
                className="flex-1 overflow-y-auto no-scrollbar"
            >
                {Object.keys(groupedByProperty).length === 0 ? (
                    <div className="py-24">
                        <EmptyState
                            icon=""
                            title={t('dashboard.inbox.status.noConversations', undefined, 'No messages found')}
                            description={t('dashboard.inbox.status.noConversationsDesc', undefined, 'Start a conversation to see it here.')}
                            layout="transparent"
                        />
                    </div>
                ) : (
                    Object.entries(groupedByProperty).map(([propertyId, group]) => (
                        <motion.div variants={itemVariants} key={propertyId} className="group/property">
                            {/* Property Header */}
                            <div className="px-6 py-4 bg-zinc-50/30 dark:bg-zinc-800/10 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 backdrop-blur-md z-10">
                                <div className="font-black text-zinc-900 dark:text-white text-[10px] uppercase tracking-[0.2em] mb-1">
                                     {group.property_title || t('search.property', undefined, 'Property')}
                                </div>
                                <div className="text-[10px] font-bold text-zinc-400 truncate uppercase tracking-widest">
                                    {group.property_address}
                                </div>
                            </div>

                            {/* Conversations for this property */}
                            <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                                {group.conversations.map(conv => (
                                    <button
                                        key={conv.id}
                                        onClick={() => onSelectConversation?.(conv.id)}
                                        className={`w-full p-6 text-left transition-all relative ${selectedConversationId === conv.id 
                                            ? 'bg-teal-500/5 dark:bg-teal-400/5 shadow-inner' 
                                            : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30'
                                            }`}
                                    >
                                        {selectedConversationId === conv.id && (
                                            <div className="absolute left-0 top-6 bottom-6 w-1 bg-teal-500 rounded-r-full shadow-[0_0_12px_rgba(20,184,166,0.5)]" />
                                        )}
                                        <div className="flex items-center gap-5">
                                            {/* Avatar */}
                                            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-black shadow-lg transition-transform duration-500 ${
                                                conv.unread_count > 0 
                                                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 scale-105' 
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 scale-100'
                                            }`}>
                                                {conv.other_party_name?.charAt(0).toUpperCase() || '?'}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-4 mb-1">
                                                    <span className={`text-lg tracking-tight truncate ${conv.unread_count > 0 ? 'font-black text-zinc-900 dark:text-white' : 'font-bold text-zinc-700 dark:text-zinc-300'}`}>
                                                        {conv.other_party_name}
                                                    </span>
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                                                        {formatDate(conv.last_message_at)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-4">
                                                    <p className={`text-sm truncate ${conv.unread_count > 0 ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-zinc-500 dark:text-zinc-500 font-medium'}`}>
                                                        {conv.last_message_preview || conv.subject}
                                                    </p>
                                                    {conv.unread_count > 0 && (
                                                        <span className="flex-shrink-0 w-6 h-6 bg-teal-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20">
                                                            {conv.unread_count}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    ))
                )}
            </motion.div>
        </div>
    );
}
