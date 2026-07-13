'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import {
    CheckCircle2,
    XCircle,
    Clock,
    ShieldCheck,
    ShieldAlert,
    Download,
    Copy,
    Check,
    ExternalLink,
    AlertTriangle,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://roomivo.app';

interface DepositBinding {
    deposit_amount: number;
    lease_type: string;
    payee_iban_masked: string;
    payee_name_match: 'MATCH' | 'MISMATCH';
    payee_match_target?: string;
    bank_ownership_confirmed: boolean;
    bound_at?: string;
}

interface VerifyResponse {
    credential_id: string;
    valid: boolean;
    expired: boolean;
    revoked: boolean;
    signature_valid: boolean;
    subject_role: string;
    subject_display_name: string | null;
    issued_at: string;
    expires_at: string;
    rail: string;
    // Most claims are plain strings; deposit_binding (item 15) + entity_verified
    // (item 16) are nested objects.
    claims: Record<string, string> & {
        deposit_binding?: DepositBinding;
        landlord_type?: string;
        entity_verified?: { denomination: string; gerant_match: boolean };
    };
    disclaimer: string;
    assurance_summary: string;
}

// Plain-language statements of what was verified. Internal tiers (HIGH/MEDIUM)
// are intentionally NOT shown to the landlord — only the affirmative fact.
function claimSentence(key: string, value: string, claims: Record<string, string>): string | null {
    switch (key) {
        case 'identity_assurance':
            return value === 'HIGH'
                ? "Identité confirmée auprès des registres de l'État"
                : value === 'MEDIUM'
                ? "Pièce d'identité vérifiée + selfie concordant"
                : null;
        case 'solvency_assurance':
            return value === 'UNVERIFIED' ? null : 'Revenus vérifiés (capacité fiscale)';
        case 'funds_coverage_assurance': {
            if (value === 'UNVERIFIED') return null;
            const band = claims['funds_coverage_band'];
            const months: Record<string, string> = {
                covers_12m_plus: '12 mois ou plus',
                covers_6m: '6 à 11 mois',
                covers_3m: '3 à 5 mois',
                covers_under_3m: 'moins de 3 mois',
                amount_only: '',
            };
            const span = months[band] ? ` couvrant ${months[band]} de loyer` : '';
            const sponsor = claims['funds_coverage_source'] === 'sponsor' ? ' (via un garant/sponsor)' : '';
            return `Fonds vérifiés${span}${sponsor}`;
        }
        case 'property_control_assurance':
            return 'Documents de contrôle du bien vérifiés';
        case 'mrh_insurance_assurance':
            return String(claims['mrh_insurance_verified']) === 'true'
                ? 'Assurance habitation (MRH) vérifiée'
                : 'Assurance habitation (MRH) signalée pour vérification';
        default:
            return null; // raw bands / labels / sources are inputs to other sentences
    }
}

function StatusBanner({ data }: { data: VerifyResponse }) {
    if (data.revoked) {
        return (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                <XCircle className="w-6 h-6 text-red-500 shrink-0" />
                <div>
                    <p className="font-semibold text-red-700">Attestation révoquée</p>
                    <p className="text-sm text-red-600">Le titulaire a révoqué cette attestation.</p>
                </div>
            </div>
        );
    }
    if (data.expired) {
        return (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <Clock className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                    <p className="font-semibold text-amber-700">Attestation expirée</p>
                    <p className="text-sm text-amber-600">Le titulaire peut en générer une nouvelle à tout moment.</p>
                </div>
            </div>
        );
    }
    if (!data.signature_valid) {
        return (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
                <div>
                    <p className="font-semibold text-red-700">Signature invalide</p>
                    <p className="text-sm text-red-600">L&apos;intégrité cryptographique de cette attestation ne peut pas être vérifiée.</p>
                </div>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            <div>
                <p className="font-semibold text-emerald-700">Attestation valide ✓</p>
                <p className="text-sm text-emerald-600">Signature cryptographique vérifiée. Expire le {new Date(data.expires_at).toLocaleDateString('fr-FR')}.</p>
            </div>
        </div>
    );
}

export default function CredentialVerifyPage() {
    const params = useParams<{ credential_id: string }>();
    const credentialId = params.credential_id;
    const verifyUrl = `${SITE_URL}/c/${credentialId}`;

    const [data, setData] = useState<VerifyResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!credentialId) return;
        fetch(`${API_URL}/credentials/${credentialId}`)
            .then(r => {
                if (!r.ok) throw new Error(r.status === 404 ? 'Attestation introuvable.' : 'Erreur serveur.');
                return r.json();
            })
            .then(setData)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [credentialId]);

    const copyLink = async () => {
        await navigator.clipboard.writeText(verifyUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
                <div className="max-w-md w-full text-center">
                    <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-zinc-900 mb-2">Attestation introuvable</h1>
                    <p className="text-zinc-500 text-sm">{error ?? 'Cette attestation n\'existe pas ou a expiré.'}</p>
                </div>
            </div>
        );
    }

    const roleLabel = data.subject_role === 'landlord' ? 'Propriétaire / Bailleur' : 'Locataire';
    const claimEntries = Object.entries(data.claims);

    return (
        <div className="min-h-screen bg-zinc-50">
            {/* Anti-phishing header */}
            <div className="bg-zinc-900 text-white text-xs py-2 px-4 text-center">
                <span className="text-zinc-400">Vous avez reçu ce lien ? Vérifiez vous-même sur </span>
                <span className="font-semibold text-white">roomivo.app</span>
                <span className="text-zinc-400"> → entrez le code </span>
                <span className="font-mono font-semibold text-amber-400">{credentialId.slice(0, 12)}…</span>
                <span className="text-zinc-400"> — ne faites jamais confiance à un lien entrant.</span>
            </div>

            <div className="max-w-lg mx-auto px-4 py-10 space-y-6">

                {/* Wordmark + institutional trust */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <ShieldCheck className="w-7 h-7 text-zinc-900" />
                        <span className="text-2xl font-bold tracking-tight text-zinc-900">Roomivo</span>
                    </div>
                    <p className="text-sm text-zinc-500">Attestation de vérification</p>
                    <div className="flex items-center justify-center gap-5 pt-2">
                        <Image
                            src="/images/pepite-snee.jpg"
                            alt="PÉPITE Pays de la Loire — Statut National Étudiant-Entrepreneur (SNEE)"
                            width={120}
                            height={44}
                            className="h-9 w-auto object-contain opacity-90"
                        />
                        <Image
                            src="/images/ministere-esr.png"
                            alt="Ministère de l'Enseignement supérieur et de la Recherche"
                            width={96}
                            height={44}
                            className="h-11 w-auto object-contain opacity-90"
                        />
                    </div>
                </div>

                {/* Status */}
                <StatusBanner data={data} />

                {/* Subject */}
                <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-1">
                    <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Titulaire</p>
                    <p className="text-lg font-semibold text-zinc-900">{data.subject_display_name ?? '—'}</p>
                    <p className="text-sm text-zinc-500">{roleLabel} · Rail {data.rail}</p>
                    {data.claims.entity_verified && (
                        <p className="text-sm text-zinc-700 pt-1">
                            Bailleur : <span className="font-semibold">{data.claims.entity_verified.denomination}</span>
                            {data.claims.entity_verified.gerant_match
                                ? <span className="text-emerald-600"> — gérant vérifié ✓</span>
                                : <span className="text-amber-600"> — lien gérant non confirmé</span>}
                        </p>
                    )}
                </div>

                {/* Claims table — plain-language, no tier words */}
                <div className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
                    {(() => {
                        const rows = claimEntries
                            .map(([key, value]) => claimSentence(key, String(value), data.claims as Record<string, string>))
                            .filter((s): s is string => Boolean(s));
                        if (rows.length === 0) {
                            return <div className="p-5 text-sm text-zinc-400">Aucune vérification enregistrée.</div>;
                        }
                        return rows.map((sentence, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                <span className="text-sm text-zinc-800">{sentence}</span>
                            </div>
                        ));
                    })()}
                </div>

                {/* Deposit-binding (item 15) — MATCH = reassurance, MISMATCH = warning */}
                {(() => {
                    const db = data.claims.deposit_binding;
                    if (!db) return null;
                    const match = db.payee_name_match === 'MATCH';
                    return (
                        <div className={`rounded-2xl border p-5 space-y-2 ${match ? 'bg-white border-zinc-200' : 'bg-amber-50 border-amber-300'}`}>
                            <div className="flex items-center gap-2">
                                {match
                                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                    : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
                                <p className="font-semibold text-zinc-900">Dépôt de garantie — engagement de paiement</p>
                            </div>
                            <p className="text-sm text-zinc-800">
                                <span className="font-semibold">{db.deposit_amount} €</span> à verser sur{' '}
                                <span className="font-mono">{db.payee_iban_masked}</span>
                            </p>
                            <p className={`text-sm font-medium ${match ? 'text-emerald-700' : 'text-amber-800'}`}>
                                {match
                                    ? 'Le titulaire du compte correspond au bailleur vérifié ✓'
                                    : '⚠ Le titulaire du compte ne correspond pas au bailleur vérifié — n’envoyez rien.'}
                            </p>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Roomivo n&apos;est pas dans le flux financier : ceci prouve à qui vous deviez payer,
                                pas que les fonds ont circulé. La propriété du compte n&apos;a pas été confirmée auprès de la banque.
                            </p>
                        </div>
                    );
                })()}

                {/* Assurance summary */}
                <p className="text-sm text-zinc-500 text-center">{data.assurance_summary}</p>

                {/* Verify-by-ID box */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm font-semibold text-amber-800">Comment savoir que ce lien est authentique ?</p>
                    </div>
                    <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
                        <li>Rendez-vous sur <strong>roomivo.app</strong> depuis votre navigateur (ne cliquez pas sur le lien reçu).</li>
                        <li>Saisissez le code ci-dessous dans le champ de vérification.</li>
                    </ol>
                    <div className="bg-white border border-amber-200 rounded-xl p-3 font-mono text-sm text-zinc-900 break-all text-center select-all">
                        {credentialId}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={copyLink}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copié !' : 'Copier le lien'}
                    </button>
                    <a
                        href={`${API_URL}/credentials/${credentialId}/evidence.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Télécharger le PDF
                    </a>
                </div>

                {/* QR code */}
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 flex flex-col items-center gap-3">
                    <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">QR code à partager</p>
                    <QRCodeSVG value={verifyUrl} size={160} level="M" />
                    <p className="text-xs text-zinc-400 text-center">Scannez pour vérifier directement</p>
                </div>

                {/* Metadata + disclaimer */}
                <div className="space-y-2 text-xs text-zinc-400">
                    <div className="flex justify-between">
                        <span>Identifiant</span>
                        <span className="font-mono">{credentialId.slice(0, 20)}…</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Émis le</span>
                        <span>{new Date(data.issued_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Expire le</span>
                        <span>{new Date(data.expires_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Clé publique</span>
                        <a
                            href={`${API_URL}/credentials/public-key`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            Vérifier la signature <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>

                <p className="text-xs text-zinc-400 text-center leading-relaxed">{data.disclaimer}</p>

            </div>
        </div>
    );
}
