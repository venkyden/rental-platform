"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';

// The queue for reports of illegal listings (DSA art. 16). A person decides;
// the backend sends the emails and takes the listing down when a report is upheld.
type Report = {
    id: string;
    property_id: string;
    property_title: string;
    reason: string;
    explanation: string;
    notifier_name: string | null;
    notifier_email: string | null;
    status: 'received' | 'upheld' | 'rejected' | 'reversed';
    ground: 'illegal' | 'terms' | null;
    decision_reason: string | null;
    created_at: string | null;
    decided_at: string | null;
};

function ReportCard({ report, onDecided }: { report: Report; onDecided: () => void }) {
    const { t, language } = useLanguage();
    const [reason, setReason] = useState('');
    const [ground, setGround] = useState<'illegal' | 'terms'>('illegal');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const date = (iso: string | null) =>
        iso ? new Date(iso).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    const decide = async (decision: 'upheld' | 'rejected' | 'reversed') => {
        setSaving(true);
        setMessage(null);
        try {
            await apiClient.client.post(`/reports/admin/${report.id}/decision`, {
                decision,
                reason: reason.trim(),
                ground: decision === 'upheld' ? ground : null,
            });
            setMessage(t('reportsAdmin.saved'));
            onDecided();
        } catch {
            setMessage(t('reportsAdmin.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const canDecide = report.status === 'received' || report.status === 'upheld';
    const reasonTooShort = reason.trim().length < 20;
    const button = 'px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-40';

    return (
        <article className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href={`/properties/${report.property_id}`} className="font-bold underline">
                    {report.property_title}
                </Link>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black uppercase tracking-widest">
                    {t(`reportsAdmin.status.${report.status}`)}
                </span>
            </div>
            <p className="text-sm font-bold">{t(`report.reasons.${report.reason}`)}</p>
            <p className="whitespace-pre-wrap text-zinc-700">{report.explanation}</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-zinc-500">
                <div>
                    <dt className="inline">{t('reportsAdmin.reporter')}: </dt>
                    <dd className="inline">
                        {report.notifier_email ? `${report.notifier_name} <${report.notifier_email}>` : t('reportsAdmin.reporterErased')}
                    </dd>
                </div>
                <div>
                    {t('reportsAdmin.receivedOn', { date: date(report.created_at) })}
                    {report.decided_at && ` · ${t('reportsAdmin.decidedOn', { date: date(report.decided_at) })}`}
                </div>
            </dl>
            {report.decision_reason && <p className="text-sm text-zinc-600 border-l-2 border-zinc-200 pl-3">{report.decision_reason}</p>}

            {canDecide && (
                <div className="space-y-3 border-t border-zinc-100 pt-4">
                    <label htmlFor={`reason-${report.id}`} className="block text-sm font-bold">{t('reportsAdmin.decisionReason')}</label>
                    <textarea
                        id={`reason-${report.id}`}
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full rounded-2xl border border-zinc-200 px-4 py-3"
                    />
                    {report.status === 'received' ? (
                        <>
                            <fieldset className="flex flex-wrap gap-4 text-sm">
                                <legend className="font-bold mb-1">{t('reportsAdmin.ground')}</legend>
                                <label className="flex gap-2"><input type="radio" checked={ground === 'illegal'} onChange={() => setGround('illegal')} />{t('reportsAdmin.groundIllegal')}</label>
                                <label className="flex gap-2"><input type="radio" checked={ground === 'terms'} onChange={() => setGround('terms')} />{t('reportsAdmin.groundTerms')}</label>
                            </fieldset>
                            <div className="flex flex-wrap gap-3">
                                <button disabled={saving || reasonTooShort} onClick={() => decide('upheld')} className={`${button} bg-zinc-900 text-white`}>{t('reportsAdmin.uphold')}</button>
                                <button disabled={saving || reasonTooShort} onClick={() => decide('rejected')} className={`${button} bg-zinc-100`}>{t('reportsAdmin.reject')}</button>
                            </div>
                        </>
                    ) : (
                        <button disabled={saving || reasonTooShort} onClick={() => decide('reversed')} className={`${button} bg-zinc-100`}>{t('reportsAdmin.reverse')}</button>
                    )}
                </div>
            )}
            {message && <p role="status" className="text-sm font-bold">{message}</p>}
        </article>
    );
}

export default function AdminReportsPage() {
    const { t } = useLanguage();
    const [reports, setReports] = useState<Report[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await apiClient.client.get('/reports/admin');
            setReports(r.data);
            setError(null);
        } catch (err: any) {
            setError(t(err?.response?.status === 403 ? 'reportsAdmin.forbidden' : 'reportsAdmin.loadError'));
        }
    }, [t]);

    useEffect(() => { load(); }, [load]);

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 text-zinc-900">
                <Navbar />
                <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 space-y-6">
                    <h1 className="text-3xl font-extrabold tracking-tight">{t('reportsAdmin.title')}</h1>
                    {error && <p role="alert" className="font-bold">{error}</p>}
                    {reports && reports.length === 0 && <p className="text-zinc-500">{t('reportsAdmin.empty')}</p>}
                    {reports?.map((report) => <ReportCard key={report.id} report={report} onDecided={load} />)}
                </main>
            </div>
        </ProtectedRoute>
    );
}
