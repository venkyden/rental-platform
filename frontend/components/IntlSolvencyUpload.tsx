'use client';

/**
 * International solvency upload — the frontend entry point for the INTL rails.
 *
 * Two document paths, selected by what the applicant HOLDS (never by nationality):
 *  - Foreign income  → POST /verification/intl/solvency  (FX-normalised income ratio)
 *  - Funds / sponsor → POST /verification/intl/funds      (banded funds coverage)
 *
 * Both are MEDIUM assurance. Documents are analysed by Google Gemini then discarded
 * (verify-and-forget); only the banded claim is kept. Consent is required.
 */

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';
import { Upload, ArrowRight, CheckCircle2 } from 'lucide-react';

interface Props {
    onSuccessAction: () => void;
}

type Path = 'funds' | 'income';

const FUNDS_DOC_TYPES = ['bank_statement', 'scholarship_letter', 'sponsorship_letter', 'loan_approval'] as const;
const FUNDS_BANDS = ['covers_12m_plus', 'covers_6m', 'covers_3m', 'covers_under_3m', 'amount_only'] as const;

export default function IntlSolvencyUpload({ onSuccessAction }: Props) {
    const { t } = useLanguage();
    const [path, setPath] = useState<Path>('funds');
    const [documentType, setDocumentType] = useState('bank_statement');
    const [fundsSource, setFundsSource] = useState<'self' | 'sponsor'>('self');
    const [monthlyRent, setMonthlyRent] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [consent, setConsent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<string | null>(null);

    const bandText = (band: string) =>
        FUNDS_BANDS.includes(band as (typeof FUNDS_BANDS)[number])
            ? t(`verification.intl.bands.${band}`, undefined, 'Funds verified')
            : t('verification.intl.bands.amount_only', undefined, 'Funds verified');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) { setError(t('verification.intl.errors.noFile', undefined, 'Please select a document')); return; }
        if (!consent) { setError(t('verification.intl.errors.noConsent', undefined, 'Please consent to automated document analysis to continue')); return; }
        setSubmitting(true);
        setError('');
        try {
            const fd = new FormData();
            fd.append('file', file);
            if (monthlyRent) fd.append('monthly_rent', monthlyRent);

            if (path === 'funds') {
                fd.append('document_type', documentType);
                fd.append('funds_source', fundsSource);
                const res = await apiClient.client.post('/verification/intl/funds', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                const d = res.data;
                if (d.assurance === 'UNVERIFIED') {
                    setError(t('verification.intl.errors.fundsCurrency', undefined, 'Could not verify funds — currency unsupported. Try a EUR document.'));
                } else {
                    setResult(bandText(d.funds_band));
                    onSuccessAction();
                }
            } else {
                const res = await apiClient.client.post('/verification/intl/solvency', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                const d = res.data;
                if (d.solvency_assurance === 'UNVERIFIED') {
                    setError(t('verification.intl.errors.incomeCurrency', undefined, 'Could not verify income — currency unsupported. Try a EUR document.'));
                } else {
                    setResult(t('verification.intl.incomeVerified', undefined, 'Income verified (fiscal capacity)'));
                    onSuccessAction();
                }
            }
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : t('verification.intl.errors.generic', undefined, 'Verification failed. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    if (result) {
        return (
            <div className="text-center py-16 space-y-6">
                <div className="w-20 h-20 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <p className="text-2xl font-black text-zinc-900 tracking-tight">{result}</p>
                <p className="text-zinc-500 font-medium max-w-sm mx-auto">
                    {t('verification.intl.successNote', undefined, 'Your document was analysed and discarded — only the verified band is kept.')}
                </p>
            </div>
        );
    }

    const inputCls = 'w-full px-4 py-3 rounded-2xl border border-zinc-200 text-sm focus:outline-none focus:border-zinc-900';
    const labelCls = 'block text-xs font-bold text-zinc-500 mb-2';

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto">
            <div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-1">
                    {t('verification.intl.title', undefined, 'International solvency')}
                </h3>
                <p className="text-zinc-500 font-medium text-sm">
                    {t('verification.intl.subtitle', undefined, 'Use documents from outside France — foreign income, savings, scholarship, sponsorship or a student loan.')}
                </p>
            </div>

            {/* Path selector */}
            <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setPath('funds')}
                    className={`py-4 rounded-2xl text-sm font-bold border transition-all ${path === 'funds' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200 hover:text-zinc-900'}`}>
                    {t('verification.intl.paths.funds', undefined, 'Funds / sponsorship')}
                </button>
                <button type="button" onClick={() => setPath('income')}
                    className={`py-4 rounded-2xl text-sm font-bold border transition-all ${path === 'income' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200 hover:text-zinc-900'}`}>
                    {t('verification.intl.paths.income', undefined, 'Foreign income')}
                </button>
            </div>

            {path === 'funds' && (
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>{t('verification.intl.docTypeLabel', undefined, 'Document type')}</label>
                        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={inputCls}>
                            {FUNDS_DOC_TYPES.map((v) => (
                                <option key={v} value={v}>{t(`verification.intl.docTypes.${v}`, undefined, v)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>{t('verification.intl.fundsSourceLabel', undefined, 'Whose funds?')}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => setFundsSource('self')}
                                className={`py-3 rounded-2xl text-sm font-bold border ${fundsSource === 'self' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200 hover:text-zinc-900'}`}>
                                {t('verification.intl.fundsSource.self', undefined, 'Mine')}
                            </button>
                            <button type="button" onClick={() => setFundsSource('sponsor')}
                                className={`py-3 rounded-2xl text-sm font-bold border ${fundsSource === 'sponsor' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200 hover:text-zinc-900'}`}>
                                {t('verification.intl.fundsSource.sponsor', undefined, 'Sponsor / parent')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <label className={labelCls}>{t('verification.intl.rentLabel', undefined, 'Monthly rent (€) — optional')}</label>
                <input type="number" min="0" step="1" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)}
                    placeholder={t('verification.intl.rentPlaceholder', undefined, 'e.g. 700')} className={inputCls} />
                <p className="text-xs text-zinc-400 mt-1">{t('verification.intl.rentHint', undefined, 'Lets us show how many months your funds cover.')}</p>
            </div>

            {/* File */}
            <label className="flex flex-col items-center justify-center gap-3 w-full py-10 rounded-3xl border-2 border-dashed border-zinc-200 cursor-pointer hover:border-zinc-400 transition-all">
                <Upload className="w-7 h-7 text-zinc-400" />
                <span className="text-sm font-bold text-zinc-900 break-all px-4 text-center">
                    {file ? file.name : t('verification.intl.fileSelect', undefined, 'Select document')}
                </span>
                <span className="text-xs font-medium text-zinc-400">{t('verification.intl.fileFormats', undefined, 'PDF, JPG or PNG, max 10MB')}</span>
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif"
                    onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
            </label>

            {/* Consent */}
            <label className="flex items-start gap-3 px-1 cursor-pointer select-none">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900" />
                <span className="text-xs text-zinc-500 leading-relaxed">
                    {t('verification.upload.consent', undefined,
                        'I consent to automated analysis of my document by Google Gemini to extract only the facts needed for verification. The document is not retained afterwards.')}{' '}
                    <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline text-zinc-700 hover:text-zinc-900">
                        {t('verification.upload.consentLink', undefined, 'Privacy Policy')}
                    </a>
                </span>
            </label>

            {error && (
                <div className="p-5 rounded-2xl bg-zinc-900 text-white text-center" role="alert">
                    <p className="text-sm font-bold">{error}</p>
                </div>
            )}

            <button type="submit" disabled={submitting || !file || !consent}
                className="w-full py-5 bg-zinc-900 text-white rounded-[2rem] text-sm font-bold uppercase tracking-wider disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {submitting
                    ? t('verification.intl.submitting', undefined, 'Verifying…')
                    : <>{t('verification.intl.submit', undefined, 'Submit for verification')} <ArrowRight className="w-4 h-4" /></>}
            </button>
        </form>
    );
}
