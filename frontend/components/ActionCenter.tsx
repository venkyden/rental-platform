'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';

interface AlertItem {
    type: string;
    severity: string;
    title: string;
    description: string;
    count: number;
    action_url: string;
}

interface AlertsData {
    total_alerts: number;
    alerts: AlertItem[];
}

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; icon: string; text: string; badge: string }> = {
    critical: {
        bg: 'bg-zinc-50 border border-zinc-200',
        border: 'border-l-4 border-red-500',
        icon: '',
        text: 'text-red-800',
        badge: 'bg-red-100 text-red-700',
    },
    warning: {
        bg: 'bg-zinc-50 border border-zinc-200',
        border: 'border-l-4 border-amber-500',
        icon: '',
        text: 'text-amber-800',
        badge: 'bg-amber-100 text-amber-700',
    },
    info: {
        bg: 'bg-zinc-50 border border-zinc-200',
        border: 'border-l-4 border-blue-400',
        icon: '',
        text: 'text-blue-800',
        badge: 'bg-blue-100 text-blue-700',
    },
};

const TYPE_ICONS: Record<string, string> = {
    expiring_lease: '',
    pending_application: '',
    unread_messages: '',
    vacant_property: '️',
};

export default function ActionCenter() {
    const { t } = useLanguage();
    const router = useRouter();
    const [data, setData] = useState<AlertsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const res = await apiClient.client.get('/stats/landlord/alerts');
                setData(res.data);
            } catch (err) {
                console.error('Failed to fetch alerts:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAlerts();
    }, []);

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-gray-100 rounded-xl" />
                ))}
            </div>
        );
    }

    if (!data || data.total_alerts === 0) {
        return (
            <div className="premium-card p-8 text-center">
                <span className="text-5xl block mb-3"></span>
                <p className="text-lg font-semibold text-gray-700">{t('actionCenter.allInOrder', undefined, 'All is in order')}</p>
                <p className="text-sm text-gray-500 mt-1">{t('actionCenter.noUrgentAction', undefined, 'No urgent action required')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {data.alerts.map((alert, idx) => {
                const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
                const typeIcon = TYPE_ICONS[alert.type] || '';

                return (
                    <button
                        key={idx}
                        onClick={() => router.push(alert.action_url)}
                        className={`w-full ${config.bg} ${config.border} rounded-xl p-4 flex items-center gap-4 group hover:shadow-md transition-all duration-200 text-left`}
                    >
                        {/* Icon */}
                        <div className="w-12 h-12 rounded-xl bg-white/80 backdrop-blur flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                            {typeIcon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <h4 className={`font-bold ${config.text} truncate`}>{alert.title}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.badge} flex-shrink-0`}>
                                    {alert.count}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 truncate">{alert.description}</p>
                        </div>

                        {/* Arrow */}
                        <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <span className={config.text}>→</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
