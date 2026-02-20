'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
            case 'application': return '📋';
            case 'message': return '💬';
            case 'visit': return '📅';
            case 'match': return '🎯';
            case 'verification': return '✅';
            default: return '🔔';
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
            <button
                onClick={handleBellClick}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Notifications"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-sm text-blue-600 hover:text-blue-800"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-gray-500">
                                Loading...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <span className="text-3xl mb-2 block">🔔</span>
                                <p className="text-gray-500">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0 ${!notification.read ? 'bg-blue-50/50' : ''
                                        }`}
                                >
                                    <div className="flex gap-3">
                                        <span className="text-xl flex-shrink-0">
                                            {getNotificationIcon(notification.type)}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                                    {notification.title}
                                                </p>
                                                {!notification.read && (
                                                    <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5"></span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 truncate">
                                                {notification.message}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {formatTime(notification.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => {
                                    router.push('/notifications');
                                    setIsOpen(false);
                                }}
                                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                View all notifications
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
