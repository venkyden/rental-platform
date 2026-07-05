"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';

interface BiometricConsentScreenProps {
    loading?: boolean;
    onConsentedAction: () => void;
    /** Explicit exit for refusal — defaults to dashboard (history.back() is inert on direct entry) */
    onRefuseAction?: () => void;
}

/**
 * GDPR Art. 9 explicit-consent screen. Show BEFORE any selfie capture UI —
 * backend refuses selfie uploads without recorded consent.
 */
export default function BiometricConsentScreen({ loading, onConsentedAction, onRefuseAction }: BiometricConsentScreenProps) {
    const { t } = useLanguage();
    const router = useRouter();
    const [checked, setChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const consent = async () => {
        setSubmitting(true);
        try {
            await apiClient.client.post('/verification/biometric-consent');
            onConsentedAction();
        } catch {
            toast.error(t('verify.biometricConsent.error', undefined, 'Could not record your consent. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="py-20 flex justify-center">
                <div className="w-16 h-16 border-4 border-zinc-900/20 border-t-zinc-900 rounded-full animate-spin" />
            </div>
        );
    }

    const points = [
        {
            icon: <ShieldCheck className="w-5 h-5 text-zinc-900" />,
            text: t('verify.biometricConsent.point1', undefined,
                'To verify your identity, we compare your selfie with the photo on your ID document. This is a biometric face-match.'),
        },
        {
            icon: <Trash2 className="w-5 h-5 text-zinc-900" />,
            text: t('verify.biometricConsent.point2', undefined,
                'Your images are processed transiently and deleted immediately after the check — whatever the outcome. Nothing biometric is stored.'),
        },
        {
            icon: <XCircle className="w-5 h-5 text-zinc-900" />,
            text: t('verify.biometricConsent.point3', undefined,
                'You can refuse. Without the selfie step your identity simply stays unverified — you keep full access to your account.'),
        },
    ];

    return (
        <div className="w-full max-w-xl mx-auto space-y-8">
            <div className="text-center">
                <h3 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase leading-none mb-4">
                    {t('verify.biometricConsent.title', undefined, 'Your Explicit Consent')}
                </h3>
                <p className="text-zinc-500 font-medium leading-relaxed">
                    {t('verify.biometricConsent.subtitle', undefined,
                        'European law (GDPR Art. 9) requires your explicit consent before any biometric processing.')}
                </p>
            </div>

            <div className="space-y-4">
                {points.map((p, i) => (
                    <div key={i} className="flex items-start gap-4 p-5 bg-zinc-50 border border-zinc-100 rounded-2xl">
                        <div className="p-2 bg-white rounded-xl shadow-sm shrink-0">{p.icon}</div>
                        <p className="text-sm text-zinc-600 font-medium leading-relaxed">{p.text}</p>
                    </div>
                ))}
            </div>

            <label className="flex items-start gap-3 p-5 border-2 border-zinc-900 rounded-2xl cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-zinc-900"
                />
                <span className="text-sm font-bold text-zinc-900 leading-relaxed">
                    {t('verify.biometricConsent.checkbox', undefined,
                        'I explicitly consent to the processing of my biometric data (selfie face-match) for this identity verification.')}
                </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={consent}
                    disabled={!checked || submitting}
                    className="flex-1 py-5 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
                >
                    {submitting
                        ? t('verify.biometricConsent.submitting', undefined, 'Recording…')
                        : t('verify.biometricConsent.accept', undefined, 'I Consent — Continue')}
                </button>
                <button
                    onClick={onRefuseAction ?? (() => router.push('/dashboard'))}
                    className="py-5 px-8 text-zinc-500 hover:text-zinc-900 text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
                >
                    {t('verify.biometricConsent.refuse', undefined, 'Not now')}
                </button>
            </div>
        </div>
    );
}
