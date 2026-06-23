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

const FUNDS_DOC_TYPES = [
    { value: 'bank_statement', label: 'Bank statement (personal or sponsor)' },
    { value: 'scholarship_letter', label: 'Scholarship award letter' },
    { value: 'sponsorship_letter', label: 'Sponsorship letter' },
    { value: 'loan_approval', label: 'Education loan approval' },
];

const FUNDS_BAND_TEXT: Record<string, string> = {
    covers_12m_plus: 'Funds verified — covers 12+ months of rent',
    covers_6m: 'Funds verified — covers 6–11 months of rent',
    covers_3m: 'Funds verified — covers 3–5 months of rent',
    covers_under_3m: 'Funds verified — covers under 3 months of rent',
    amount_only: 'Funds verified',
};

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) { setError('Please select a document'); return; }
        if (!consent) { setError('Please consent to automated document analysis to continue'); return; }
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
                    setError('Could not verify funds — currency unsupported. Try a EUR document.');
                } else {
                    setResult(FUNDS_BAND_TEXT[d.funds_band] || 'Funds verified');
                    onSuccessAction();
                }
            } else {
                const res = await apiClient.client.post('/verification/intl/solvency', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                const d = res.data;
                if (d.solvency_assurance === 'UNVERIFIED') {
                    setError('Could not verify income — currency unsupported. Try a EUR document.');
                } else {
                    setResult('Income verified (fiscal capacity)');
                    onSuccessAction();
                }
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Verification failed. Please try again.');
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
                    Your document was analysed and discarded — only the verified band is kept.
                </p>
            </div>
        );
    }

    const inputCls = 'w-full px-4 py-3 rounded-2xl border border-zinc-200 text-sm focus:outline-none focus:border-zinc-900';

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto">
            <div>
                <h3 className="text-3xl font-black tracking-tighter uppercase leading-none mb-1">
                    International solvency
                </h3>
                <p className="text-zinc-500 font-medium text-sm">
                    Use documents from outside France — foreign income, savings, scholarship, sponsorship or a student loan.
                </p>
            </div>

            {/* Path selector */}
            <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setPath('funds')}
                    className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all ${path === 'funds' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200'}`}>
                    Funds / sponsorship
                </button>
                <button type="button" onClick={() => setPath('income')}
                    className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all ${path === 'income' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200'}`}>
                    Foreign income
                </button>
            </div>

            {path === 'funds' && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Document type</label>
                        <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={inputCls}>
                            {FUNDS_DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Whose funds?</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => setFundsSource('self')}
                                className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${fundsSource === 'self' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200'}`}>
                                Mine
                            </button>
                            <button type="button" onClick={() => setFundsSource('sponsor')}
                                className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${fundsSource === 'sponsor' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200'}`}>
                                Sponsor / parent
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Monthly rent (€) — optional</label>
                <input type="number" min="0" step="1" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)}
                    placeholder="e.g. 700" className={inputCls} />
                <p className="text-[10px] text-zinc-400 mt-1">Lets us show how many months your funds cover.</p>
            </div>

            {/* File */}
            <label className="flex flex-col items-center justify-center gap-3 w-full py-10 rounded-3xl border-2 border-dashed border-zinc-200 cursor-pointer hover:border-zinc-400 transition-all">
                <Upload className="w-7 h-7 text-zinc-400" />
                <span className="text-sm font-black uppercase tracking-widest text-zinc-900">
                    {file ? file.name : 'Select document'}
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">PDF, JPG or PNG, max 10MB</span>
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
                <div className="p-5 rounded-2xl bg-zinc-900 text-white text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">{error}</p>
                </div>
            )}

            <button type="submit" disabled={submitting || !file || !consent}
                className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {submitting ? 'Verifying…' : <>Submit for verification <ArrowRight className="w-4 h-4" /></>}
            </button>
        </form>
    );
}
