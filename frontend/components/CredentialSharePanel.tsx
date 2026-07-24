'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://roomivo.app';
// Only used for the evidence-PDF API link, so carry the /api/v1 mount here.
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const API_URL = API_ORIGIN.endsWith('/api/v1') ? API_ORIGIN : `${API_ORIGIN}/api/v1`;

interface Props {
    credentialId: string;
    subjectRole: string;
    expiresAt: string;
    assuranceSummary?: string;
}

export default function CredentialSharePanel({ credentialId, subjectRole, expiresAt, assuranceSummary }: Props) {
    const { language } = useLanguage();
    const fr = language === 'fr';
    const verifyUrl = `${SITE_URL}/c/${credentialId}`;
    const [copied, setCopied] = useState(false);

    const copyLink = async () => {
        await navigator.clipboard.writeText(verifyUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const roleLabel = subjectRole === 'landlord'
        ? (fr ? 'propriétaire' : 'landlord')
        : (fr ? 'locataire' : 'tenant');
    const expiryDate = new Date(expiresAt).toLocaleDateString(fr ? 'fr-FR' : 'en-GB');

    return (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            {/* Header */}
            <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-4 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                    <p className="font-semibold text-emerald-800">
                        {fr ? 'Attestation émise' : 'Certificate issued'}
                    </p>
                    <p className="text-sm text-emerald-700">
                        {fr
                            ? `Partagez ce lien pour prouver votre profil ${roleLabel} · expire le ${expiryDate}`
                            : `Share this link to prove your ${roleLabel} profile · expires ${expiryDate}`}
                    </p>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* Assurance summary */}
                {assuranceSummary && (
                    <p className="text-sm text-zinc-500">{assuranceSummary}</p>
                )}

                {/* Verify URL */}
                <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
                    <span className="flex-1 text-sm font-mono text-zinc-700 truncate">{verifyUrl}</span>
                    <button
                        onClick={copyLink}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-200 transition-colors"
                        title={fr ? 'Copier' : 'Copy'}
                    >
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-zinc-500" />}
                    </button>
                </div>

                {/* Anti-phishing reminder */}
                <p className="text-xs text-zinc-400 leading-relaxed">
                    {fr ? 'Conseil anti-phishing : indiquez à votre interlocuteur de saisir le code ' : 'Anti-phishing tip: ask the other person to type the code '}
                    <span className="font-mono font-semibold text-zinc-600">{credentialId.slice(0, 12)}…</span>
                    {fr ? ' directement sur ' : ' directly on '}
                    <strong>roomivo.app</strong>
                    {fr ? ' plutôt que de cliquer sur le lien.' : ' rather than clicking the link.'}
                </p>

                {/* QR */}
                <div className="flex justify-center py-2">
                    <QRCodeSVG value={verifyUrl} size={140} level="M" />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                    <a
                        href={`${SITE_URL}/c/${credentialId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        {fr ? 'Voir la page' : 'Open the page'}
                    </a>
                    <a
                        href={`${API_URL}/credentials/${credentialId}/evidence.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        {fr ? 'Télécharger le PDF' : 'Download PDF'}
                    </a>
                </div>
            </div>
        </div>
    );
}
