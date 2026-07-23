'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '@/lib/LanguageContext';
import { useToast } from '@/lib/ToastContext';
import { Copy, QrCode, ShieldCheck } from 'lucide-react';

interface QRCodeDisplayProps {
    verificationCode: string;
    captureUrl: string;
    expiresAt: string;
}

export default function QRCodeDisplay({ verificationCode, captureUrl, expiresAt }: QRCodeDisplayProps) {
    const { t } = useLanguage();
    const toast = useToast();

    const copyToClipboard = () => {
        navigator.clipboard.writeText(captureUrl);
        toast.success(t('common.components.qrCode.toast.copied', undefined, 'Link copied to clipboard!'));
    };

    return (
        <div className="glass-card !p-10 rounded-[3rem] border-zinc-100 space-y-8">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shadow-xl">
                    <QrCode className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-zinc-900">
                        {t('common.components.qrCode.title', undefined, 'Mobile Capture QR')}
                    </h3>
                    <p className="text-xs text-zinc-400 font-medium">
                        {t('common.components.qrCode.description', undefined, 'Scan with your smartphone camera to upload on-site verified media')}
                    </p>
                </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
                <div className="p-6 bg-white border-2 border-zinc-100 rounded-[2.5rem] shadow-xl">
                    <QRCodeSVG
                        value={captureUrl}
                        size={220}
                        level="H"
                        includeMargin={true}
                    />
                </div>
            </div>

            {/* Verification Code */}
            <div className="bg-zinc-50 rounded-2xl p-5 border border-zinc-100 text-center space-y-1">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">
                    {t('common.components.qrCode.codeLabel', undefined, 'Verification Code')}
                </p>
                <p className="text-2xl font-mono font-black text-zinc-900 tracking-wider">
                    {verificationCode}
                </p>
            </div>

            {/* Capture URL */}
            <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                    {t('common.components.qrCode.copyLinkLabel', undefined, 'Direct Mobile Link')}
                </p>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={captureUrl}
                        readOnly
                        className="flex-1 px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-xs font-mono text-zinc-600 truncate focus:outline-none"
                    />
                    <button
                        onClick={copyToClipboard}
                        className="px-6 py-4 bg-zinc-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-lg shrink-0"
                    >
                        <Copy className="w-4 h-4" />
                        {t('common.components.qrCode.copyButton', undefined, 'Copy')}
                    </button>
                </div>
            </div>

            {/* Expiry */}
            <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-zinc-400" />
                {t('common.components.qrCode.expiry', {
                    date: new Date(expiresAt).toLocaleDateString(),
                    time: new Date(expiresAt).toLocaleTimeString()
                }, `Expires ${new Date(expiresAt).toLocaleDateString()}`)}
            </div>

            {/* Instructions */}
            <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-900">
                    {t('common.components.qrCode.instructions.title', undefined, 'How to capture')}
                </p>
                <ol className="text-xs font-medium text-zinc-500 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>{t('common.components.qrCode.instructions.step1', undefined, 'Open your mobile camera or QR reader')}</li>
                    <li>{t('common.components.qrCode.instructions.step2', undefined, 'Scan the QR code to open the secure capture page')}</li>
                    <li>{t('common.components.qrCode.instructions.step3', undefined, 'Allow location access to verify photos were taken on-site')}</li>
                    <li>{t('common.components.qrCode.instructions.step4', undefined, 'Take photos per room and optional 1 video walkthrough')}</li>
                </ol>
            </div>
        </div>
    );
}
