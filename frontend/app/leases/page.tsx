'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ArrowRight, PenLine, ShieldCheck, Clock } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import { leaseApi, Lease } from '@/app/lib/api/lease';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';

const SIGN_STATES = new Set(['awaiting_signatures', 'partially_signed']);

export default function LeasesListPage() {
    const router = useRouter();
    const toast = useToast();
    const { t } = useLanguage();
    const [leases, setLeases] = useState<Lease[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = 'My Leases | Roomivo';
        (async () => {
            try {
                setLeases(await leaseApi.list());
            } catch {
                toast.error(t('esign.list.error', undefined, 'Could not load your leases'));
            } finally {
                setLoading(false);
            }
        })();
    }, [t, toast]);

    const statusBadge = (status: string) => {
        if (status === 'signed' || status === 'active') {
            return { icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-700', label: t('esign.list.statusSigned', undefined, 'Signed') };
        }
        if (SIGN_STATES.has(status)) {
            return { icon: PenLine, cls: 'bg-amber-100 text-amber-700', label: t('esign.list.statusToSign', undefined, 'To sign') };
        }
        return { icon: Clock, cls: 'bg-zinc-100 text-zinc-500', label: t('esign.list.statusDraft', undefined, 'Draft') };
    };

    return (
        <ProtectedRoute>
            <PremiumLayout>
                <div className="max-w-4xl mx-auto px-6 py-10">
                    <h1 className="text-3xl font-black text-zinc-900 mb-8 uppercase tracking-tighter flex items-center gap-3">
                        <FileText className="w-7 h-7" />
                        {t('esign.list.title', undefined, 'My leases')}
                    </h1>

                    {loading ? (
                        <div className="text-zinc-400 py-12">{t('esign.list.loading', undefined, 'Loading…')}</div>
                    ) : leases.length === 0 ? (
                        <div className="border border-dashed border-zinc-200 rounded-2xl p-12 text-center text-zinc-400">
                            <FileText className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
                            <p className="text-sm font-semibold uppercase tracking-wider">{t('esign.list.empty', undefined, 'No leases yet')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {leases.map((lease) => {
                                const badge = statusBadge(lease.status);
                                const Icon = badge.icon;
                                return (
                                    <button
                                        key={lease.id}
                                        type="button"
                                        onClick={() => router.push(`/leases/${lease.id}/sign`)}
                                        className="w-full flex items-center justify-between gap-4 border border-zinc-150 hover:border-zinc-900 rounded-2xl p-5 text-left transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <div className="font-black uppercase tracking-tight text-zinc-900">
                                                {t(`lease.${lease.lease_type}.name`, undefined, lease.lease_type || 'Lease')}
                                            </div>
                                            <div className="text-xs text-zinc-400 mt-1">
                                                {lease.start_date ? `${t('esign.list.start', undefined, 'Start')}: ${lease.start_date}` : ''}
                                                {lease.rent_amount ? ` · ${lease.rent_amount} €/${t('esign.list.month', undefined, 'mo')}` : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black uppercase tracking-widest ${badge.cls}`}>
                                                <Icon className="w-3.5 h-3.5" />
                                                {badge.label}
                                            </span>
                                            <ArrowRight className="w-4 h-4 text-zinc-300" />
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
