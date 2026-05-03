"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Mail, FileText, Calendar, Zap, ShieldCheck, Check, Clock, X } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    action_url: string | null;
    read: boolean;
    created_at: string;
}

export default function NotificationBell() {
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadUnreadCount();

        // Poll for new notifications every 30 seconds
        const interval = setInterval(loadUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Close dropdown when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadUnreadCount = async () => {
        try {
            const response = await apiClient.client.get('/notifications/unread-count');
            setUnreadCount(response.data.count);
        } catch (error) {
            // Silently fail for badge count
        }
    };

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const response = await apiClient.client.get('/notifications?limit=10');
            setNotifications(response.data);
        } catch (error) {
            console.error('Failed to load notifications', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBellClick = () => {
        if (!isOpen) {
            loadNotifications();
        }
        setIsOpen(!isOpen);
    };

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            try {
                await apiClient.client.post(`/notifications/${notification.id}/read`);
                setUnreadCount(prev => Math.max(0, prev - 1));
                setNotifications(prev =>
                    prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
                );
            } catch (error) {
                // Ignore
            }
        }

        // Navigate
        if (notification.action_url) {
            router.push(notification.action_url);
            setIsOpen(false);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await apiClient.client.post('/notifications/read-all');
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error('Failed to mark all as read', error);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'application': return <FileText className="w-5 h-5 text-blue-500" />;
            case 'message': return <Mail className="w-5 h-5 text-teal-500" />;
            case 'visit': return <Calendar className="w-5 h-5 text-purple-500" />;
            case 'match': return <Zap className="w-5 h-5 text-amber-500" />;
            case 'verification': return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
            default: return <Bell className="w-5 h-5 text-zinc-400" />;
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBellClick}
                className={`relative p-2 rounded-full transition-colors ${isOpen ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                aria-label="Notifications"
            >
                <Bell className="w-6 h-6" />

                {/* Unread Badge */}
                <AnimatePresence>
                    {unreadCount > 0 && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center ring-2 ring-white dark:ring-zinc-900 shadow-sm"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50 backdrop-blur-xl"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div>
                                <h3 className="font-bold text-zinc-900 dark:text-white">Notifications</h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Stay updated with your activities</p>
                            </div>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 transition-colors px-2 py-1 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20"
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        {/* Notification List */}
                        <div className="max-h-[400px] overflow-y-auto overscroll-contain">
                            {loading ? (
                                <div className="p-12 text-center">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                                    <p className="mt-2 text-sm text-zinc-500">Loading your updates...</p>
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Bell className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                                    </div>
                                    <p className="font-medium text-zinc-900 dark:text-white">All caught up!</p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">No new notifications at the moment.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                    {notifications.map((notification) => (
                                        <motion.div
                                            key={notification.id}
                                            whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.02)' }}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`px-5 py-4 cursor-pointer transition-colors flex gap-4 ${!notification.read ? 'bg-teal-50/30 dark:bg-teal-900/10' : ''}`}
                                        >
                                            <div className="flex-shrink-0 mt-1">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${!notification.read ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
                                                    {getNotificationIcon(notification.type)}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm leading-tight ${!notification.read ? 'font-bold text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                                        {notification.title}
                                                    </p>
                                                    {!notification.read && (
                                                        <span className="flex-shrink-0 w-2 h-2 bg-teal-500 rounded-full mt-1.5 ring-4 ring-teal-500/10" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Clock className="w-3 h-3 text-zinc-400" />
                                                    <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                                                        {formatTime(notification.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    onClick={() => {
                                        router.push('/notifications');
                                        setIsOpen(false);
                                    }}
                                    className="w-full py-2 text-center text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                                >
                                    View all notifications
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
