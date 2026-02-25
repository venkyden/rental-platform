'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

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
            case 'visit_request': return '📅';
            case 'visit_confirmed': return '✅';
            case 'lease_generated': return '📄';
            case 'system': return 'ℹ️';
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Conversation not found
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
        <div className="flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                ←
                            </button>
                        )}
                        <div>
                            <h3 className="font-bold">{conversation.subject}</h3>
                            <p className="text-sm text-white/80">
                                🏠 {conversation.property_title}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {conversation.status === 'active' && (
                            <button
                                onClick={handleArchive}
                                className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                            >
                                📁 Archive
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Property Context Card */}
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <div>
                        <span className="text-gray-500">Landlord:</span>{' '}
                        <span className="font-medium">{conversation.landlord_name}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Tenant:</span>{' '}
                        <span className="font-medium">{conversation.tenant_name}</span>
                    </div>
                </div>
                <a
                    href={`/properties/${conversation.property_id}`}
                    className="text-blue-600 hover:underline"
                >
                    View Property →
                </a>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {Object.entries(messagesByDate).map(([date, msgs]) => (
                    <div key={date}>
                        {/* Date separator */}
                        <div className="flex items-center justify-center my-4">
                            <div className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                                {formatDate(msgs[0].created_at)}
                            </div>
                        </div>

                        {/* Messages for this date */}
                        {msgs.map(msg => {
                            const isOwn = msg.sender_id === user?.id;
                            const icon = getMessageIcon(msg.message_type);
                            const isSystemType = ['visit_request', 'visit_confirmed', 'lease_generated', 'system'].includes(msg.message_type);

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}
                                >
                                    <div
                                        className={`max-w-[75%] ${isSystemType
                                            ? 'bg-amber-50 border border-amber-200 text-amber-900'
                                            : isOwn
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white border text-gray-900'
                                            } rounded-2xl px-4 py-2 shadow-sm`}
                                    >
                                        {/* Sender name for received messages */}
                                        {!isOwn && !isSystemType && (
                                            <div className="text-xs text-gray-500 mb-1">
                                                {msg.sender_name}
                                            </div>
                                        )}

                                        {/* Message content */}
                                        <div className="flex items-start gap-2">
                                            {icon && <span>{icon}</span>}
                                            <p className="whitespace-pre-wrap break-words">
                                                {msg.content}
                                            </p>
                                        </div>

                                        {/* Metadata actions for special message types */}
                                        {msg.message_type === 'lease_generated' && msg.metadata?.download_url && (
                                            <a
                                                href={msg.metadata.download_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`mt-2 inline-block text-sm ${isOwn ? 'text-white/80 hover:text-white' : 'text-blue-600 hover:underline'}`}
                                            >
                                                📥 Download Lease
                                            </a>
                                        )}

                                        {/* Timestamp */}
                                        <div className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
                                            {formatTime(msg.created_at)}
                                            {isOwn && msg.is_read && ' ✓✓'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            {conversation.status === 'active' && (
                <div className="p-4 border-t bg-white">
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Write a message..."
                            className="flex-1 px-4 py-3 border rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={sending}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!newMessage.trim() || sending}
                            className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {sending ? (
                                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <span>➤</span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Archived notice */}
            {conversation.status === 'archived' && (
                <div className="p-4 border-t bg-gray-100 text-center text-gray-500 text-sm">
                    This conversation is archived
                </div>
            )}
        </div>
    );
}
