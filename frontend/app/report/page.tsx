"use client";

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import PremiumLayout from '@/components/PremiumLayout';
import { apiClient } from '@/lib/api';

// Notice and action (DSA art. 16): anyone can report a published listing.
const REASONS = ['discrimination', 'scam', 'misleading', 'unsafe_housing', 'other_illegal'] as const;
type Reason = typeof REASONS[number];

function ReportForm() {
    const { t } = useLanguage();
    const listingId = useSearchParams().get('listing');
    const [title, setTitle] = useState<string | null>(null);
    const [reason, setReason] = useState<Reason | null>(null);
    const [explanation, setExplanation] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [goodFaith, setGoodFaith] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reference, setReference] = useState<string | null>(null);

    useEffect(() => {
        if (!listingId) return;
        apiClient.client.get(`/properties/${listingId}`)
            .then((r) => setTitle(r.data?.title ?? null))
            .catch(() => setTitle(null));
    }, [listingId]);

    if (!listingId) {
        return <p className="text-zinc-600 text-lg">{t('report.missingListing')}</p>;
    }

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!reason || explanation.trim().length < 20 || !name.trim() || !email.trim() || !goodFaith) {
            setError(t('report.errors.invalid'));
            return;
        }
        setSending(true);
        try {
            const r = await apiClient.client.post('/reports', {
                property_id: listingId,
                reason,
                explanation: explanation.trim(),
                notifier_name: name.trim(),
                notifier_email: email.trim(),
                good_faith: true,
            });
            setReference(r.data.id);
        } catch (err: any) {
            const code = err?.response?.status;
            setError(t(
                code === 404 ? 'report.errors.notFound'
                    : code === 429 ? 'report.errors.tooMany'
                        : code === 422 ? 'report.errors.invalid'
                            : 'report.errors.generic'
            ));
        } finally {
            setSending(false);
        }
    };

    if (reference) {
        return (
            <div className="space-y-6" role="status">
                <h2 className="text-3xl font-black tracking-tight text-zinc-900">{t('report.doneTitle')}</h2>
                <p className="text-zinc-600 text-lg">{t('report.doneBody', { ref: reference })}</p>
                <Link href={`/properties/${listingId}`} className="inline-block text-sm font-bold text-zinc-900 underline">
                    {t('report.backToListing')}
                </Link>
            </div>
        );
    }

    const field = 'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none';

    return (
        <form onSubmit={submit} className="space-y-8" noValidate>
            {title && (
                <p className="text-zinc-600">
                    {t('report.listing')}:{' '}
                    <Link href={`/properties/${listingId}`} className="font-bold text-zinc-900 underline">{title}</Link>
                </p>
            )}

            <fieldset className="space-y-3">
                <legend className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-3">{t('report.reasonLabel')}</legend>
                {REASONS.map((r) => (
                    <label key={r} className="flex gap-3 items-start rounded-2xl border border-zinc-200 bg-white p-4 cursor-pointer has-[:checked]:border-zinc-900">
                        <input
                            type="radio"
                            name="reason"
                            value={r}
                            checked={reason === r}
                            onChange={() => setReason(r)}
                            className="mt-1"
                        />
                        <span>
                            <span className="block font-bold text-zinc-900">{t(`report.reasons.${r}`)}</span>
                            <span className="block text-sm text-zinc-500">{t(`report.hints.${r}`)}</span>
                        </span>
                    </label>
                ))}
            </fieldset>

            <div className="space-y-2">
                <label htmlFor="report-explanation" className="block text-sm font-black uppercase tracking-widest text-zinc-900">
                    {t('report.explanationLabel')}
                </label>
                <p id="report-explanation-hint" className="text-sm text-zinc-500">{t('report.explanationHint')}</p>
                <textarea
                    id="report-explanation"
                    aria-describedby="report-explanation-hint"
                    rows={5}
                    maxLength={3000}
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    className={field}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label htmlFor="report-name" className="block text-sm font-black uppercase tracking-widest text-zinc-900">{t('report.nameLabel')}</label>
                    <input id="report-name" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={field} />
                </div>
                <div className="space-y-2">
                    <label htmlFor="report-email" className="block text-sm font-black uppercase tracking-widest text-zinc-900">{t('report.emailLabel')}</label>
                    <input id="report-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                </div>
            </div>

            <label className="flex gap-3 items-start text-zinc-700">
                <input type="checkbox" checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} className="mt-1" />
                <span>{t('report.goodFaith')}</span>
            </label>

            <div className="space-y-2 text-sm text-zinc-500 border-l-2 border-zinc-200 pl-4">
                <p>{t('report.howItWorks')}</p>
                <p>
                    {t('report.privacyNote')}{' '}
                    <Link href="/legal/privacy" className="underline">{t('legal.privacy.title')}</Link>
                </p>
            </div>

            {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}

            <button
                type="submit"
                disabled={sending}
                className="w-full sm:w-auto px-8 py-4 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.3em] rounded-2xl disabled:opacity-50"
            >
                {sending ? t('report.sending') : t('report.submit')}
            </button>
        </form>
    );
}

export default function ReportPage() {
    const { t } = useLanguage();
    return (
        <PremiumLayout withNavbar={true}>
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-24 space-y-10">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-zinc-900">{t('report.title')}</h1>
                <Suspense fallback={null}>
                    <ReportForm />
                </Suspense>
            </div>
        </PremiumLayout>
    );
}
