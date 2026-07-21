'use client';

import React from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import { Bell, AlertTriangle, Info, AlertOctagon, ArrowRight, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AlertItem {
    type: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    count: number;
    action_url: string;
}

interface AlertsResponse {
    total_alerts: number;
    alerts: AlertItem[];
}

export default function AlertCenter() {
    const router = useRouter();
    const { language, t } = useLanguage();

    const fetcher = (url: string) => apiClient.client.get(url, {
        headers: { 'Accept-Language': language }
    }).then(res => res.data);

    // Fetch alerts with 30s polling
    const { data, error, isLoading, mutate } = useSWR<AlertsResponse>(
        '/stats/landlord/alerts',
        fetcher,
        {
            refreshInterval: 30000,
            revalidateOnFocus: true
        }
    );

    if (isLoading) {
        return (
            <div className="glass-card !p-8 rounded-[2.5rem] border-zinc-100 shadow-xl animate-pulse">
                <div className="flex justify-between items-center mb-6">
                    <div className="h-6 w-36 bg-zinc-200 rounded-md"></div>
                    <div className="h-4 w-4 bg-zinc-200 rounded-full"></div>
                </div>
                <div className="space-y-4">
                    <div className="h-20 bg-zinc-100 rounded-2xl"></div>
                    <div className="h-20 bg-zinc-100 rounded-2xl"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-card !p-8 rounded-[2.5rem] border-red-100 bg-red-50/10 text-red-900 shadow-xl flex flex-col items-center text-center">
                <AlertTriangle className="w-8 h-8 text-red-600 mb-3" />
                <h3 className="font-bold text-lg">Failed to load alerts</h3>
                <p className="text-sm text-red-500 mt-1 mb-4">An error occurred while fetching your active alerts.</p>
                <button
                    onClick={() => mutate()}
                    className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                    <RotateCw className="w-3.5 h-3.5" /> Retry
                </button>
            </div>
        );
    }

    const alerts = data?.alerts || [];

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'critical':
                return {
                    border: 'border-red-500/20 bg-red-500/[0.02]',
                    iconBg: 'bg-red-50 text-red-600',
                    badge: 'bg-red-100 text-red-700 border-red-200',
                    label: t('dashboard.alerts.critical', undefined, 'Critical')
                };
            case 'warning':
                return {
                    border: 'border-amber-500/20 bg-amber-500/[0.02]',
                    iconBg: 'bg-amber-50 text-amber-600',
                    badge: 'bg-amber-100 text-amber-700 border-amber-200',
                    label: t('dashboard.alerts.warning', undefined, 'Warning')
                };
            default:
                return {
                    border: 'border-zinc-200/50 bg-zinc-500/[0.01]',
                    iconBg: 'bg-zinc-100 text-zinc-600',
                    badge: 'bg-zinc-100 text-zinc-600 border-zinc-200',
                    label: t('dashboard.alerts.info', undefined, 'Info')
                };
        }
    };

    const getAlertIcon = (type: string, severity: string) => {
        if (severity === 'critical') return <AlertOctagon className="w-5 h-5" />;
        if (type === 'vacant_property' || type === 'expiring_lease') return <AlertTriangle className="w-5 h-5" />;
        return <Info className="w-5 h-5" />;
    };

    return (
        <div className="glass-card !p-8 rounded-[2.5rem] border-zinc-100 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-8 px-2">
                <h2 className="text-xl font-black text-zinc-950 tracking-tight flex items-center gap-3 uppercase text-xs tracking-[0.4em] text-zinc-400">
                    <Bell className="w-4 h-4 text-zinc-950" />
                    {t('dashboard.alerts.title', undefined, 'Landlord Action Center')}
                </h2>
                <button
                    onClick={() => mutate()}
                    className="p-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 rounded-full transition-all active:scale-95 border border-zinc-100"
                    aria-label="Refresh alerts"
                >
                    <RotateCw className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                    {alerts.length > 0 ? (
                        alerts.map((alert) => {
                            const styles = getSeverityStyles(alert.severity);
                            return (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    key={alert.type}
                                    className={`p-6 rounded-[2rem] border ${styles.border} flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:scale-[1.01]`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3.5 rounded-2xl flex-shrink-0 shadow-sm ${styles.iconBg}`}>
                                            {getAlertIcon(alert.type, alert.severity)}
                                        </div>
                                        <div className="text-left">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <h3 className="font-black text-zinc-950 text-base tracking-tight uppercase leading-none">
                                                    {alert.title}
                                                </h3>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-widest border ${styles.badge}`}>
                                                    {styles.label}
                                                </span>
                                            </div>
                                            <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                                                {alert.description}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => router.push(alert.action_url)}
                                        className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 self-end md:self-auto shadow-md"
                                    >
                                        {t('dashboard.alerts.resolve', undefined, 'Resolve')}
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </motion.div>
                            );
                        })
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-12 text-center flex flex-col items-center justify-center"
                        >
                            <span className="text-5xl mb-4">☕</span>
                            <p className="text-zinc-400 text-sm font-black uppercase tracking-widest max-w-sm">
                                {t('dashboard.alerts.empty', undefined, 'No urgent actions. Perfect morning coffee status!')}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
