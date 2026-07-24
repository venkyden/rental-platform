'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Mail, FileText, Calendar, Zap, ShieldCheck, CheckCheck, Clock } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    action_url: string | null;
    read: boolean;
    created_at: string;
}

const iconFor = (type: string) => {
    switch (type) {
        case 'application': return FileText;
        case 'message': return Mail;
        case 'visit': return Calendar;
        case 'match': return Zap;
        case 'verification': return ShieldCheck;
        default: return Bell;
    }
};

export default function NotificationsPage() {
    const router = useRouter();
    const toast = useToast();
    const { t } = useLanguage();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = 'Notifications | Roomivo';
        (async () => {
            try {
                const res = await apiClient.client.get('/notifications?limit=50');
                setNotifications(res.data);
            } catch {
                toast.error(t('notifications.error', undefined, 'Could not load your notifications'));
            } finally {
                setLoading(false);
            }
        })();
    }, [t, toast]);

    const markAllRead = async () => {
        try {
            await apiClient.client.post('/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch {
            toast.error(t('notifications.markAllError', undefined, 'Could not update notifications'));
        }
    };

    const handleClick = async (n: Notification) => {
        if (!n.read) {
            try {
                await apiClient.client.post(`/notifications/${n.id}/read`);
                setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
            } catch {
                // non-blocking: still navigate below
            }
        }
        if (n.action_url) router.push(n.action_url);
    };

    const hasUnread = notifications.some((n) => !n.read);

    return (
        <ProtectedRoute>
            <PremiumLayout>
                <div className="max-w-3xl mx-auto px-6 py-10">
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tighter flex items-center gap-3">
                            <Bell className="w-7 h-7" />
                            {t('notifications.title', undefined, 'Notifications')}
                        </h1>
                        {hasUnread && (
                            <button
                                type="button"
                                onClick={markAllRead}
                                className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
                            >
                                <CheckCheck className="w-4 h-4" />
                                {t('notifications.markAllRead', undefined, 'Mark all read')}
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="text-zinc-400 py-12">{t('common.loading', undefined, 'Loading…')}</div>
                    ) : notifications.length === 0 ? (
                        <PremiumEmptyState
                            icon={Bell}
                            title={t('notifications.empty', undefined, 'No notifications')}
                            description={t('notifications.emptyDesc', undefined, 'You are all caught up.')}
                        />
                    ) : (
                        <div className="space-y-2">
                            {notifications.map((n) => {
                                const Icon = iconFor(n.type);
                                const clickable = Boolean(n.action_url);
                                return (
                                    <button
                                        key={n.id}
                                        type="button"
                                        onClick={() => handleClick(n)}
                                        disabled={!clickable && n.read}
                                        className={`w-full flex items-start gap-4 border rounded-2xl p-5 text-left transition-colors ${
                                            n.read ? 'border-zinc-150 bg-white' : 'border-zinc-900 bg-zinc-50'
                                        } ${clickable ? 'hover:border-zinc-900 cursor-pointer' : 'cursor-default'}`}
                                    >
                                        <div className="shrink-0 mt-0.5">
                                            <Icon className="w-5 h-5 text-zinc-900" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black uppercase tracking-tight text-zinc-900 truncate">
                                                    {n.title}
                                                </span>
                                                {!n.read && <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />}
                                            </div>
                                            <p className="text-sm text-zinc-600 mt-1 leading-relaxed">{n.message}</p>
                                            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                                <Clock className="w-3 h-3" />
                                                {new Date(n.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
