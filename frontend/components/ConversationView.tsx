'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useLanguage } from '@/lib/LanguageContext';
import { ArrowLeft, Building2, ArrowRight, Download, CheckCheck, Send, Loader2, Archive } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

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
            case 'visit_request': return '🏠';
            case 'visit_confirmed': return '✅';
            case 'lease_generated': return '📄';
            case 'system': return 'ℹ️';
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-white/50 backdrop-blur-2xl animate-pulse rounded-[2.5rem]">
                <div className="p-8 border-b border-zinc-100">
                    <div className="h-8 bg-zinc-200 rounded-lg w-1/4 mb-4" />
                    <div className="h-4 bg-zinc-200 rounded-lg w-1/3" />
                </div>
                <div className="flex-1 p-8 space-y-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                            <div className={`h-20 bg-zinc-200 rounded-[2rem] w-2/3 ${i % 2 === 0 ? 'rounded-tr-none' : 'rounded-tl-none'}`} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="flex items-center justify-center h-full text-zinc-500 font-bold uppercase tracking-widest text-xs">
                {t('conversation.notFound', undefined, 'Conversation not found')}
            </div>
        );
    }

    const messagesByDate = conversation.messages.reduce((acc, msg) => {
        const date = new Date(msg.created_at).toDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(msg);
        return acc;
    }, {} as Record<string, Message[]>);

    return (
        <div className="flex flex-col h-full bg-white/50 backdrop-blur-2xl border border-white/40 rounded-[2.5rem] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-zinc-100 bg-white/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center hover:scale-110 active:scale-95 transition-all lg:hidden"
                            >
                                <ArrowLeft className="w-5 h-5 text-zinc-600" />
                            </button>
                        )}
                        <div>
                            <h3 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase">{conversation.subject || t('conversation.noSubject', undefined, 'Conversation')}</h3>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="p-1.5 rounded-lg bg-zinc-900/10 text-zinc-900">
                                    <Building2 className="w-4 h-4" />
                                </div>
                                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                                    {conversation.property_title}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {conversation.status === 'active' && (
                            <button
                                onClick={handleArchive}
                                className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all group"
                                title={t('conversation.archiveButton', undefined, 'Archive')}
                            >
                                <Archive className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Property Context Card */}
            <div className="px-8 py-4 bg-zinc-50/50 border-b border-zinc-100 flex items-center justify-between gap-6">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-zinc-900" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('conversation.landlord', undefined, 'Landlord')}:</span>
                        <span className="text-[11px] font-black text-zinc-900 uppercase tracking-tight">{conversation.landlord_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-zinc-400" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('conversation.tenant', undefined, 'Tenant')}:</span>
                        <span className="text-[11px] font-black text-zinc-900 uppercase tracking-tight">{conversation.tenant_name}</span>
                    </div>
                </div>
                <Link
                    href={`/properties/${conversation.property_id}`}
                    className="text-[10px] font-black text-zinc-900 uppercase tracking-widest hover:text-zinc-600 transition-colors flex items-center gap-2 group"
                >
                    {t('conversation.viewProperty', undefined, 'View Property')} 
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-8 space-y-12 bg-[#fafbfc] no-scrollbar">
                {Object.entries(messagesByDate).map(([date, msgs]) => (
                    <div key={date} className="space-y-10">
                        {/* Date separator */}
                        <div className="flex items-center justify-center">
                            <div className="px-6 py-2 bg-white text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em] rounded-full shadow-sm border border-zinc-100">
                                {formatDate(msgs[0].created_at)}
                            </div>
                        </div>

                        {/* Messages for this date */}
                        <div className="space-y-6">
                            {msgs.map(msg => {
                                const isOwn = msg.sender_id === user?.id;
                                const icon = getMessageIcon(msg.message_type);
                                const isSystemType = ['visit_request', 'visit_confirmed', 'lease_generated', 'system'].includes(msg.message_type);

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {/* Message card */}
                                        <div
                                            className={`max-w-[85%] sm:max-w-[70%] group relative ${isSystemType
                                                ? 'bg-zinc-100/50 border border-zinc-200/50 text-zinc-900 rounded-[2rem] p-6 text-center mx-auto w-full'
                                                : isOwn
                                                    ? 'bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-[2rem] rounded-tr-none p-6 shadow-2xl shadow-zinc-900/10'
                                                    : 'bg-white border border-zinc-100 text-zinc-900 rounded-[2rem] rounded-tl-none p-6 shadow-xl'
                                                }`}
                                        >
                                            {/* Sender name for received messages */}
                                            {!isOwn && !isSystemType && (
                                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">
                                                    {msg.sender_name}
                                                </div>
                                            )}

                                            {/* Message content */}
                                            <div className="flex items-start gap-4">
                                                {icon && <span className="text-2xl">{icon}</span>}
                                                <div className="space-y-4 w-full">
                                                    <p className="text-[16px] leading-relaxed whitespace-pre-wrap break-words font-medium">
                                                        {msg.content}
                                                    </p>

                                                    {/* Metadata actions for special message types */}
                                                    {msg.message_type === 'lease_generated' && msg.metadata?.download_url && (
                                                        <a
                                                            href={msg.metadata.download_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`flex items-center gap-3 w-fit px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                                isOwn 
                                                                ? 'bg-white/10 hover:bg-white/20 text-white' 
                                                                : 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/20 hover:scale-105'
                                                            }`}
                                                        >
                                                            <Download className="w-4 h-4" />
                                                            {t('conversation.downloadLease', undefined, 'Download Lease')}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Timestamp */}
                                            <div className={`text-[9px] mt-4 font-black uppercase tracking-widest flex items-center gap-2 ${isOwn ? 'text-zinc-400 justify-end' : 'text-zinc-400'}`}>
                                                {formatTime(msg.created_at)}
                                                {isOwn && msg.is_read && (
                                                    <CheckCheck className="w-3 h-3 text-zinc-900" />
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
                <div className="p-8 border-t border-zinc-100 bg-white">
                    <div className="flex items-end gap-4 max-w-5xl mx-auto">
                        <div className="flex-1 relative group">
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
                                className="w-full px-6 py-5 bg-zinc-50 border-none rounded-[2rem] focus:ring-2 focus:ring-zinc-900/20 transition-all resize-none min-h-[64px] max-h-48 no-scrollbar text-zinc-900 font-bold shadow-inner"
                                disabled={sending}
                                rows={1}
                            />
                        </div>
                        <button
                            onClick={sendMessage}
                            disabled={!newMessage.trim() || sending}
                            className="w-16 h-16 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-2xl shadow-zinc-900/10 active:scale-95"
                        >
                            {sending ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <Send className="w-6 h-6 transform translate-x-0.5 -translate-y-0.5" />
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Archived notice */}
            {conversation.status === 'archived' && (
                <div className="p-10 border-t border-zinc-100 bg-zinc-50/50 text-center">
                    <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-zinc-200 text-zinc-500 text-xs font-black uppercase tracking-widest shadow-inner">
                        <Archive className="w-4 h-4" />
                        {t('conversation.archivedNotice', undefined, 'This conversation is archived')}
                    </div>
                </div>
            )}
        </div>
    );
}
