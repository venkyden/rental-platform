'use client';

import React from 'react';
import useSWR from 'swr';
import { useLanguage } from '@/lib/LanguageContext';
import { apiClient } from '@/lib/api';
import { Scale, CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

interface Property {
    id: string;
    title: string;
    dpe_rating?: string;
    monthly_rent: number;
    size_sqm: number;
    loyer_reference_majore?: number;
}

interface Lease {
    id: string;
    property_id: string;
    property_title?: string;
    start_date: string;
    end_date?: string;
    status: string;
    deposit_amount: number;
    lease_type: string;
}

export default function ComplianceWidget() {
    const { language, t } = useLanguage();

    const fetcher = (url: string) => apiClient.client.get(url, {
        headers: { 'Accept-Language': language }
    }).then(res => res.data);

    // Fetch properties
    const { data: properties, error: propsError, isLoading: propsLoading } = useSWR<Property[]>(
        '/properties',
        fetcher
    );

    // Fetch leases
    const { data: leases, error: leasesError, isLoading: leasesLoading } = useSWR<Lease[]>(
        '/leases',
        fetcher
    );

    if (propsLoading || leasesLoading) {
        return (
            <div className="glass-card !p-8 rounded-[2.5rem] border-zinc-100 shadow-xl animate-pulse">
                <div className="h-6 w-48 bg-zinc-200 rounded-md mb-6"></div>
                <div className="space-y-4">
                    <div className="h-12 bg-zinc-100 rounded-xl"></div>
                    <div className="h-12 bg-zinc-100 rounded-xl"></div>
                </div>
            </div>
        );
    }

    if (propsError || leasesError) {
        return null; // hide gracefully if error or endpoint unavailable
    }

    // ──────────────────────────────────────────────
    // 1. DPE Compliance Check
    // ──────────────────────────────────────────────
    const nonCompliantDPE = (properties || []).filter(
        p => p.dpe_rating === 'G' || p.dpe_rating === 'F'
    );

    // ──────────────────────────────────────────────
    // 2. Encadrement des Loyers Check
    // ──────────────────────────────────────────────
    // Check if any property's monthly rent per sqm exceeds maximum majore rent control
    const rentControlViolations = (properties || []).filter(p => {
        if (!p.loyer_reference_majore || !p.size_sqm || p.size_sqm === 0) return false;
        const rentPerSqm = Number(p.monthly_rent) / Number(p.size_sqm);
        return rentPerSqm > Number(p.loyer_reference_majore);
    });

    // ──────────────────────────────────────────────
    // 3. Loi ALUR Deposit Returns Countdown
    // ──────────────────────────────────────────────
    // Find leases that ended recently (status active/terminated and end_date has passed)
    const endedLeases = (leases || []).filter(l => {
        if (!l.end_date) return false;
        const endDate = new Date(l.end_date);
        const today = new Date();
        return endDate < today && l.status === 'terminated';
    });

    // ──────────────────────────────────────────────
    // 4. Préavis Notice Alerts
    // ──────────────────────────────────────────────
    // Check active leases whose end date is approaching
    const noticeAlerts = (leases || []).filter(l => {
        if (!l.end_date || l.status !== 'active') return false;
        const endDate = new Date(l.end_date);
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Warning threshold: 90 days for unfurnished, 30 days for furnished
        const isFurnished = l.lease_type === 'meuble' || l.lease_type === 'mobilite';
        const limitDays = isFurnished ? 35 : 95;
        return diffDays > 0 && diffDays <= limitDays;
    });

    const isAllCompliant = 
        nonCompliantDPE.length === 0 && 
        rentControlViolations.length === 0 && 
        endedLeases.length === 0 && 
        noticeAlerts.length === 0;

    return (
        <div className="glass-card !p-8 rounded-[2.5rem] border-zinc-100 shadow-xl relative overflow-hidden text-left">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight flex items-center gap-3 uppercase text-[10px] tracking-[0.4em] text-zinc-400 mb-8">
                <Scale className="w-4 h-4 text-zinc-950" />
                {t('dashboard.compliance.title', undefined, 'French Law Compliance')}
            </h2>

            <div className="space-y-6">
                {/* All Compliant State */}
                {isAllCompliant && (
                    <div className="p-6 rounded-[2rem] bg-zinc-50 border border-zinc-100 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-md">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-wider text-zinc-900">
                                {t('dashboard.compliance.alur', undefined, 'Loi ALUR')} Compliant
                            </h3>
                            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mt-1">
                                {t('dashboard.compliance.dpeCompliant', undefined, 'All listings comply with energy efficiency regulations (DPE)')}
                            </p>
                        </div>
                    </div>
                )}

                {/* DPE Warning */}
                {nonCompliantDPE.map(p => {
                    const year = p.dpe_rating === 'G' ? '2025' : '2028';
                    return (
                        <div key={p.id} className="p-6 rounded-[2rem] bg-red-500/[0.02] border border-red-500/20 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                                <AlertOctagon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-wider text-red-950 flex items-center gap-2">
                                    {t('dashboard.compliance.dpe', undefined, 'DPE Warning')}
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-black">
                                        Class {p.dpe_rating}
                                    </span>
                                </h3>
                                <p className="text-zinc-600 text-xs mt-2 font-medium">
                                    {p.title}: {t('dashboard.compliance.dpeBanWarning', { rating: p.dpe_rating || 'G', year }, `Banned for new leases starting ${year}`)}
                                </p>
                            </div>
                        </div>
                    );
                })}

                {/* Rent Control Warning */}
                {rentControlViolations.map(p => {
                    const rentPerSqm = Number(p.monthly_rent) / Number(p.size_sqm);
                    const excess = Math.round((rentPerSqm - Number(p.loyer_reference_majore)) * Number(p.size_sqm));
                    return (
                        <div key={p.id} className="p-6 rounded-[2rem] bg-amber-500/[0.02] border border-amber-500/20 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-wider text-amber-950">
                                    {t('dashboard.compliance.rentControl', undefined, 'Rent Control')}
                                </h3>
                                <p className="text-zinc-600 text-xs mt-2 font-medium">
                                    {p.title}: {t('dashboard.compliance.rentExceeded', { amount: excess }, `Exceeds zone limit by ${excess}€/mo`)}
                                </p>
                            </div>
                        </div>
                    );
                })}

                {/* Deposit Return Countdown */}
                {endedLeases.map(l => {
                    const endDate = new Date(l.end_date!);
                    const today = new Date();
                    const diffTime = today.getTime() - endDate.getTime();
                    const elapsedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    // ALUR timelines: 30 days if no dispute/damage, 60 days otherwise.
                    // We check if elapsedDays is within 30 days.
                    const remainingDays = 30 - elapsedDays;
                    const isOverdue = remainingDays < 0;

                    return (
                        <div key={l.id} className={`p-6 rounded-[2rem] border flex items-start gap-4 ${isOverdue ? 'bg-red-500/[0.02] border-red-500/20' : 'bg-zinc-50 border-zinc-200'}`}>
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-900'}`}>
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-wider text-zinc-950">
                                    {t('dashboard.compliance.alur', undefined, 'Loi ALUR')} — Deposit Refund
                                </h3>
                                <p className="text-zinc-600 text-xs mt-2 font-medium">
                                    {l.property_title || 'Property'}: {isOverdue 
                                        ? t('dashboard.compliance.depositOverdue', { days: Math.abs(remainingDays) }, `Deposit return overdue by ${Math.abs(remainingDays)} days`)
                                        : t('dashboard.compliance.depositCountdown', { days: remainingDays }, `Deposit Return: ${remainingDays} days remaining`)
                                    }
                                </p>
                            </div>
                        </div>
                    );
                })}

                {/* Notice Period Warnings */}
                {noticeAlerts.map(l => {
                    const endDate = new Date(l.end_date!);
                    const today = new Date();
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isFurnished = l.lease_type === 'meuble' || l.lease_type === 'mobilite';

                    return (
                        <div key={l.id} className="p-6 rounded-[2rem] bg-zinc-50 border border-zinc-200 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-zinc-100 text-zinc-900 flex items-center justify-center flex-shrink-0">
                                <HelpCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-wider text-zinc-950">
                                    {t('dashboard.compliance.noticePeriod', undefined, 'Notice Period')}
                                </h3>
                                <p className="text-zinc-600 text-xs mt-2 font-medium">
                                    {l.property_title || 'Property'}: {t('dashboard.compliance.noticeExpiring', { days: diffDays }, `Lease ends in ${diffDays} days`)}
                                    <span className="block mt-1 font-bold text-[10px] text-zinc-500 uppercase tracking-wider">
                                        {isFurnished 
                                            ? t('dashboard.compliance.noticeFurnished', undefined, '1 month notice (Furnished)')
                                            : t('dashboard.compliance.noticeUnfurnished', undefined, '3 months notice (Unfurnished)')
                                        }
                                    </span>
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
