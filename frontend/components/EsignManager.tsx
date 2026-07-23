'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';
import { Loader2, FileText, ShieldCheck, UploadCloud, PenLine, Clock, Download, AlertTriangle, BadgeCheck } from 'lucide-react';

interface EsignStatus {
    lease_id: string;
    status: string;
    your_party: 'landlord' | 'tenant';
    you_signed: boolean;
    document_present: boolean;
    document_source: string | null;
    legality_status: string | null;
    legality_flags: string[];
    legality_notes: string[];
    signed_parties: string[];
    fully_signed: boolean;
}

interface EsignManagerProps {
    leaseId: string;
}

export default function EsignManager({ leaseId }: EsignManagerProps) {
    const { t } = useLanguage();
    const [status, setStatus] = useState<EsignStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // signing inputs
    const sigPadRef = useRef<SignatureCanvas | null>(null);
    const [typedName, setTypedName] = useState('');
    const [consent, setConsent] = useState(false);

    const loadStatus = useCallback(async () => {
        try {
            const res = await apiClient.client.get(`/esign/leases/${leaseId}/status`);
            setStatus(res.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || t('esign.error.load', undefined, 'Could not load the signing status'));
        } finally {
            setLoading(false);
        }
    }, [leaseId, t]);

    useEffect(() => { loadStatus(); }, [loadStatus]);

    const handleUpload = async (file: File) => {
        if (file.type !== 'application/pdf') {
            setError(t('esign.error.notPdf', undefined, 'The lease must be a PDF file'));
            return;
        }
        setBusy(true);
        setError('');
        try {
            const form = new FormData();
            form.append('file', file);
            await apiClient.client.post(`/esign/leases/${leaseId}/document`, form);
            await loadStatus();
        } catch (err: any) {
            setError(err.response?.data?.detail || t('esign.error.upload', undefined, 'Upload failed'));
        } finally {
            setBusy(false);
        }
    };

    const handleSign = async () => {
        const drawn = sigPadRef.current && !sigPadRef.current.isEmpty()
            ? sigPadRef.current.getCanvas().toDataURL('image/png')
            : null;
        if (!drawn && !typedName.trim()) {
            setError(t('esign.error.noSignature', undefined, 'Draw or type your signature'));
            return;
        }
        if (!consent) {
            setError(t('esign.error.noConsent', undefined, 'You must consent to sign electronically'));
            return;
        }
        setBusy(true);
        setError('');
        try {
            await apiClient.client.post(`/esign/leases/${leaseId}/sign`, {
                signature_image: drawn,
                typed_name: drawn ? null : typedName.trim(),
                consent: true,
            });
            setTypedName('');
            sigPadRef.current?.clear();
            await loadStatus();
        } catch (err: any) {
            setError(err.response?.data?.detail || t('esign.error.sign', undefined, 'Signing failed'));
        } finally {
            setBusy(false);
        }
    };

    const handleDownloadEvidence = async () => {
        setBusy(true);
        setError('');
        try {
            const res = await apiClient.client.get(`/esign/leases/${leaseId}/evidence.pdf`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `Roomivo_signature_${leaseId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.response?.data?.detail || t('esign.error.evidence', undefined, 'Could not download the evidence pack'));
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-3 text-zinc-400 py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('esign.loading', undefined, 'Loading signing status…')}
            </div>
        );
    }

    if (!status) {
        return <div className="text-rose-600 py-8">{error || t('esign.error.load', undefined, 'Could not load the signing status')}</div>;
    }

    const isLandlord = status.your_party === 'landlord';
    const needsUpload = !status.document_present;
    const canSignNow = status.document_present && !status.you_signed && !status.fully_signed;
    const waitingForOther = status.you_signed && !status.fully_signed;

    return (
        <div className="mt-6 border-t border-zinc-100 pt-10">
            <h3 className="text-2xl font-black text-zinc-900 mb-2 flex items-center gap-4 uppercase tracking-tighter">
                <PenLine className="w-6 h-6" />
                {t('esign.title', undefined, 'Electronic signature')}
            </h3>
            <p className="text-sm text-zinc-500 mb-8 max-w-2xl">
                {t('esign.subtitle', undefined, 'Both verified parties sign the landlord-provided lease. Roomivo did not draft the wording and does not certify its legal compliance; it attests verified identities, document integrity, and timestamps.')}
            </p>

            {error && (
                <div className="mb-6 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded">
                    {error}
                </div>
            )}

            {/* Step state banner */}
            <div className="mb-8 flex flex-wrap gap-2 text-xs font-black uppercase tracking-widest">
                <span className={`px-3 py-1.5 rounded ${status.document_present ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                    1. {t('esign.step.document', undefined, 'Lease uploaded')}
                </span>
                <span className={`px-3 py-1.5 rounded ${status.signed_parties.includes('landlord') ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                    2. {t('esign.step.landlord', undefined, 'Landlord signed')}
                </span>
                <span className={`px-3 py-1.5 rounded ${status.signed_parties.includes('tenant') ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                    3. {t('esign.step.tenant', undefined, 'Tenant signed')}
                </span>
                <span className={`px-3 py-1.5 rounded ${status.fully_signed ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                    4. {t('esign.step.evidence', undefined, 'Proof issued')}
                </span>
            </div>

            {/* Legality red-line result (§5.6) — shown so flags are "shown-and-overridden" (LU-6) */}
            {status.document_present && status.legality_status === 'VALIDATED' && (
                <div className="mb-8 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded">
                    <BadgeCheck className="w-5 h-5 shrink-0" />
                    {t('esign.legality.validated', undefined, 'Legality screen passed: the lease references French tenancy law, the mandatory annexes, and no prohibited clause was detected.')}
                </div>
            )}
            {status.document_present && status.legality_status !== 'VALIDATED' && (status.legality_flags?.length ?? 0) > 0 && (
                <div className="mb-8 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded">
                    <div className="flex items-center gap-2 font-black uppercase tracking-tight mb-2">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        {t('esign.legality.flaggedTitle', undefined, 'Lease attached — not legality-verified')}
                    </div>
                    <p className="mb-2">
                        {t('esign.legality.flaggedBody', undefined, 'This is an automated screen, not legal advice. The following points were flagged; you may still proceed — signing records that they were shown and accepted.')}
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        {status.legality_notes?.map((note, i) => (<li key={i}>{note}</li>))}
                    </ul>
                </div>
            )}

            {/* Upload — landlord only */}
            {needsUpload && isLandlord && (
                <label className="block border-2 border-dashed border-zinc-300 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-900 transition-colors">
                    <UploadCloud className="w-8 h-8 mx-auto mb-3 text-zinc-400" />
                    <span className="block font-black uppercase tracking-tight text-zinc-900">
                        {t('esign.upload.cta', undefined, 'Upload your lease (PDF)')}
                    </span>
                    <span className="block text-xs text-zinc-400 mt-1">
                        {t('esign.upload.hint', undefined, 'Your own lease document. Roomivo does not modify it.')}
                    </span>
                    <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        disabled={busy}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                    />
                </label>
            )}

            {/* Upload pending — tenant waiting */}
            {needsUpload && !isLandlord && (
                <div className="flex items-center gap-3 text-zinc-500 py-6">
                    <Clock className="w-5 h-5" />
                    {t('esign.upload.waiting', undefined, 'Waiting for the landlord to upload the lease.')}
                </div>
            )}

            {/* Sign */}
            {canSignNow && (
                <div className="max-w-xl">
                    <div className="flex items-center gap-2 mb-3 text-sm text-zinc-600">
                        <FileText className="w-4 h-4" />
                        {t('esign.sign.ready', undefined, 'The lease is ready for your signature.')}
                    </div>

                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">
                        {t('esign.sign.draw', undefined, 'Draw your signature')}
                    </label>
                    <div className="border border-zinc-300 rounded-lg overflow-hidden bg-white mb-2">
                        <SignatureCanvas
                            ref={sigPadRef}
                            penColor="#1A3C6E"
                            canvasProps={{ className: 'w-full h-40' }}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => sigPadRef.current?.clear()}
                        className="text-xs text-zinc-400 hover:text-zinc-900 mb-6"
                    >
                        {t('esign.sign.clear', undefined, 'Clear')}
                    </button>

                    <div className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">
                        {t('esign.sign.orTyped', undefined, 'Or type your full name')}
                    </div>
                    <input
                        type="text"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        placeholder={t('esign.sign.typedPlaceholder', undefined, 'Full legal name')}
                        className="w-full border border-zinc-300 rounded-lg px-4 py-3 mb-6 text-sm"
                    />

                    <label className="flex items-start gap-3 mb-6 text-sm text-zinc-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            className="mt-1"
                        />
                        <span>{t('esign.sign.consent', undefined, 'I consent to signing this lease electronically (eIDAS simple signature). I confirm my identity has been verified by Roomivo.')}</span>
                    </label>

                    <button
                        type="button"
                        onClick={handleSign}
                        disabled={busy}
                        className="inline-flex items-center gap-2 bg-zinc-900 text-white font-black uppercase tracking-tight px-6 py-3 rounded-lg disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                        {t('esign.sign.submit', undefined, 'Sign the lease')}
                    </button>
                </div>
            )}

            {/* Waiting for the other party */}
            {waitingForOther && (
                <div className="flex items-center gap-3 text-zinc-500 py-6">
                    <Clock className="w-5 h-5" />
                    {t('esign.sign.waitingOther', undefined, 'You have signed. Waiting for the other party to sign.')}
                </div>
            )}

            {/* Fully signed */}
            {status.fully_signed && (
                <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <ShieldCheck className="w-6 h-6 text-emerald-600" />
                        <span className="font-black uppercase tracking-tight text-emerald-800">
                            {t('esign.done.title', undefined, 'Lease signed by both parties')}
                        </span>
                    </div>
                    <p className="text-sm text-emerald-700 mb-5 max-w-2xl">
                        {t('esign.done.body', undefined, 'A tamper-evident proof of signature is available. It records both verified signers, the document fingerprint (SHA-256), and timestamps, sealed with Roomivo’s Ed25519 signature.')}
                    </p>
                    <button
                        type="button"
                        onClick={handleDownloadEvidence}
                        disabled={busy}
                        className="inline-flex items-center gap-2 bg-emerald-700 text-white font-black uppercase tracking-tight px-6 py-3 rounded-lg disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {t('esign.done.download', undefined, 'Download proof of signature')}
                    </button>
                </div>
            )}
        </div>
    );
}
