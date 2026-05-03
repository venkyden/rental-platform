'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { ArrowLeft, Building2, ArrowRight, Download, CheckCheck, Send, Loader2, Archive } from 'lucide-react';
import Link from 'next/link';

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_name: string | null;
    content: string;
    message_type: string;
    metadata: Record<string, any>;
    is_read: boolean;
    created_at: string;
}

interface ConversationDetail {
    id: string;
    property_id: string;
    property_title: string | null;
    landlord_name: string;
    tenant_name: string;
    subject: string | null;
    status: string;
    messages: Message[];
    created_at: string;
}

interface ConversationViewProps {
    conversationId: string;
    onClose?: () => void;
    onArchive?: () => void;
}

export default function ConversationView({ conversationId, onClose, onArchive }: ConversationViewProps) {
    const { t } = useLanguage();
    const { user } = useAuth();
    const [conversation, setConversation] = useState<ConversationDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadConversation();
        markAsRead();
    }, [conversationId]);

    useEffect(() => {
        scrollToBottom();
    }, [conversation?.messages]);

    const loadConversation = async () => {
        try {
            const response = await apiClient.client.get(`/conversations/${conversationId}`);
            setConversation(response.data);
        } catch (error) {
            console.error('Error loading conversation:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async () => {
        try {
            await apiClient.client.post(`/conversations/${conversationId}/read`);
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const response = await apiClient.client.post(`/conversations/${conversationId}/messages`, {
                content: newMessage,
                message_type: 'text'
            });

            setConversation(prev => prev ? {
                ...prev,
                messages: [...prev.messages, response.data]
            } : null);
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const handleArchive = async () => {
        try {
            await apiClient.client.post(`/conversations/${conversationId}/archive`);
            onArchive?.();
        } catch (error) {
            console.error('Error archiving:', error);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    };

    const getMessageIcon = (type: string) => {
        switch (type) {
            case 'visit_request': return '';
            case 'visit_confirmed': return '';
            case 'lease_generated': return '';
            case 'system': return 'ℹ️';
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl animate-pulse">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                    <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/4 mb-2" />
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/3" />
                </div>
                <div className="flex-1 p-6 space-y-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                            <div className={`h-16 bg-zinc-200 dark:bg-zinc-800 rounded-2xl w-2/3 ${i % 2 === 0 ? 'rounded-tr-none' : 'rounded-tl-none'}`} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                {t('conversation.notFound', undefined, 'Conversation not found')}
            </div>
        );
    }

    // Group messages by date
    const messagesByDate = conversation.messages.reduce((acc, msg) => {
        const date = new Date(msg.created_at).toDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(msg);
        return acc;
    }, {} as Record<string, Message[]>);

    return (
        <div className="flex flex-col h-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors lg:hidden"
                            >
                                <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                            </button>
                        )}
                        <div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{conversation.subject}</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                {conversation.property_title}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {conversation.status === 'active' && (
                            <button
                                onClick={handleArchive}
                                className="px-4 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-xl transition-all shadow-sm"
                            >
                                {t('conversation.archiveButton', undefined, 'Archive')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Property Context Card */}
            <div className="px-6 py-3 bg-zinc-50/30 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500">{t('conversation.landlord', undefined, 'Landlord')}:</span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{conversation.landlord_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500">{t('conversation.tenant', undefined, 'Tenant')}:</span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{conversation.tenant_name}</span>
                    </div>
                </div>
                <Link
                    href={`/properties/${conversation.property_id}`}
                    className="text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center gap-1"
                >
                    {t('conversation.viewProperty', undefined, 'View Property')} <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#fafbfc] dark:bg-zinc-950/20">
                {Object.entries(messagesByDate).map(([date, msgs]) => (
                    <div key={date} className="space-y-6">
                        {/* Date separator */}
                        <div className="flex items-center justify-center">
                            <div className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs font-bold rounded-full border border-zinc-200/50 dark:border-zinc-700/50">
                                {formatDate(msgs[0].created_at)}
                            </div>
                        </div>

                        {/* Messages for this date */}
                        <div className="space-y-4">
                            {msgs.map(msg => {
                                const isOwn = msg.sender_id === user?.id;
                                const icon = getMessageIcon(msg.message_type);
                                const isSystemType = ['visit_request', 'visit_confirmed', 'lease_generated', 'system'].includes(msg.message_type);

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[85%] sm:max-w-[70%] group ${isSystemType
                                                ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-amber-900 dark:text-amber-200 rounded-3xl p-4'
                                                : isOwn
                                                    ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-3xl rounded-tr-none p-4 shadow-lg shadow-teal-500/10'
                                                    : 'bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-3xl rounded-tl-none p-4 shadow-sm'
                                                }`}
                                        >
                                            {/* Sender name for received messages */}
                                            {!isOwn && !isSystemType && (
                                                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 px-1">
                                                    {msg.sender_name}
                                                </div>
                                            )}

                                            {/* Message content */}
                                            <div className="flex items-start gap-3">
                                                {icon && <span className="text-lg">{icon}</span>}
                                                <div className="space-y-3 w-full">
                                                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                                        {msg.content}
                                                    </p>

                                                    {/* Metadata actions for special message types */}
                                                    {msg.message_type === 'lease_generated' && msg.metadata?.download_url && (
                                                        <a
                                                            href={msg.metadata.download_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`flex items-center gap-2 w-fit px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                                                isOwn 
                                                                ? 'bg-white/20 hover:bg-white/30 text-white' 
                                                                : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30'
                                                            }`}
                                                        >
                                                            <Download className="w-4 h-4" />
                                                            {t('conversation.downloadLease', undefined, 'Download Lease')}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Timestamp */}
                                            <div className={`text-[10px] mt-2 font-medium flex items-center gap-1 px-1 ${isOwn ? 'text-white/70 justify-end' : 'text-zinc-400'}`}>
                                                {formatTime(msg.created_at)}
                                                {isOwn && msg.is_read && (
                                                    <CheckCheck className="w-3 h-3" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            {conversation.status === 'active' && (
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="flex items-end gap-3 max-w-4xl mx-auto">
                        <div className="flex-1 relative">
                            <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                placeholder={t('conversation.writeMessage', undefined, 'Write a message...')}
                                className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500/50 dark:focus:border-teal-500 transition-all resize-none min-h-[56px] max-h-32 scrollbar-hide text-zinc-900 dark:text-white"
                                disabled={sending}
                                rows={1}
                            />
                        </div>
                        <button
                            onClick={sendMessage}
                            disabled={!newMessage.trim() || sending}
                            className="p-4 bg-teal-600 text-white rounded-2xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-teal-500/20 active:scale-95"
                        >
                            {sending ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <Send className="w-6 h-6" />
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Archived notice */}
            {conversation.status === 'archived' && (
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-center">
                    <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-2">
                        <Archive className="w-4 h-4" />
                        {t('conversation.archivedNotice', undefined, 'This conversation is archived')}
                    </p>
                </div>
            )}
        </div>
    );
}
