'use client';

import React from 'react';
import KpiCard from './KpiCard';
import { Building, CheckCircle2, FileText, BarChart3, Clock, DollarSign } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface AgencyStats {
    active_mandates: number;
    leased: number;
    applications: number;
    webhook_count: number;
    member_count: number;
    avg_rental_days: number;
    conversion_rate: number;
    managed_revenue: number;
}

interface AgencyKpiRowProps {
    stats: AgencyStats | null;
    loading?: boolean;
}

export default function AgencyKpiRow({ stats, loading = false }: AgencyKpiRowProps) {
    const { t } = useLanguage();

    if (loading || !stats) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
                <KpiCard label="Mandates" value="..." icon={<Building />} loading={true} />
                <KpiCard label="Leased" value="..." icon={<CheckCircle2 />} loading={true} />
                <KpiCard label="Applications" value="..." icon={<FileText />} loading={true} />
                <KpiCard label="Conversion" value="..." icon={<BarChart3 />} loading={true} />
                <KpiCard label="Avg. Days" value="..." icon={<Clock />} loading={true} />
            </div>
        );
    }

    // Format managed revenue nicely, e.g. "12,450€"
    const formattedRevenue = new Intl.NumberFormat(t('common.locale', undefined, 'fr-FR'), {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0
    }).format(stats.managed_revenue);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            <KpiCard
                label={t('dashboard.agency.activeMandates', undefined, 'Active Mandates')}
                value={stats.active_mandates}
                icon={<Building className="w-5 h-5" />}
                delta={{
                    value: `+2 new`,
                    isPositive: true,
                    timeframe: 'this week'
                }}
            />
            <KpiCard
                label={t('dashboard.agency.leased', undefined, 'Leased')}
                value={`${stats.leased} / ${stats.active_mandates}`}
                icon={<CheckCircle2 className="w-5 h-5" />}
                delta={{
                    value: `${stats.conversion_rate}%`,
                    isPositive: stats.conversion_rate >= 80,
                    timeframe: 'Occupancy'
                }}
            />
            <KpiCard
                label={t('dashboard.agency.applications', undefined, 'Pending Applications')}
                value={stats.applications}
                icon={<FileText className="w-5 h-5" />}
                delta={{
                    value: stats.applications > 0 ? `${stats.applications} waiting` : 'All clear',
                    isPositive: stats.applications === 0,
                    timeframe: 'Status'
                }}
            />
            <KpiCard
                label={t('dashboard.agency.managedRevenue', undefined, 'Managed Revenue')}
                value={formattedRevenue}
                icon={<DollarSign className="w-5 h-5" />}
                delta={{
                    value: `+8.2%`,
                    isPositive: true,
                    timeframe: 'vs last month'
                }}
            />
            <KpiCard
                label={t('dashboard.agency.avgRentalTime', undefined, 'Avg. Rental Time')}
                value={`${stats.avg_rental_days}${t('dashboard.agency.daysSuffix', undefined, 'd')}`}
                icon={<Clock className="w-5 h-5" />}
                delta={{
                    value: `-1.2 days`,
                    isPositive: true,
                    timeframe: 'vs benchmark'
                }}
            />
        </div>
    );
}
