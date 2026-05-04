'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '@/lib/LanguageContext';

interface QRCodeDisplayProps {
    verificationCode: string;
    captureUrl: string;
    expiresAt: string;
}

export default function QRCodeDisplay({ verificationCode, captureUrl, expiresAt }: QRCodeDisplayProps) {
    const { t } = useLanguage();
    const copyToClipboard = () => {
        navigator.clipboard.writeText(captureUrl);
        alert(t('common.components.qrCode.toast.copied'));
    };

    return (
        <div className="bg-white border-2 border-blue-200 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4"> {t('common.components.qrCode.title')}</h3>
            <p className="text-gray-600 mb-6">
                {t('common.components.qrCode.description')}
            </p>

            {/* QR Code */}
            <div className="flex justify-center mb-6">
                <div className="p-4 bg-white border-2 border-gray-300 rounded-lg">
                    <QRCodeSVG
                        value={captureUrl}
                        size={200}
                        level="H"
                        includeMargin={true}
                    />
                </div>
            </div>

            {/* Verification Code */}
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-1">{t('common.components.qrCode.codeLabel')}</p>
                <p className="text-2xl font-mono font-bold text-blue-600">{verificationCode}</p>
            </div>

            {/* Capture URL */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">{t('common.components.qrCode.copyLinkLabel')}</p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={captureUrl}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border rounded text-sm"
                    />
                    <button
                        onClick={copyToClipboard}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        {t('common.components.qrCode.copyButton')}
                    </button>
                </div>
            </div>

            {/* Expiry */}
            <p className="text-xs text-gray-500 text-center">
                {t('common.components.qrCode.expiry', {
                    date: new Date(expiresAt).toLocaleDateString(),
                    time: new Date(expiresAt).toLocaleTimeString()
                })}
            </p>

            {/* Instructions */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-medium mb-2"> {t('common.components.qrCode.instructions.title')}</p>
                <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                    <li>{t('common.components.qrCode.instructions.step1')}</li>
                    <li>{t('common.components.qrCode.instructions.step2')}</li>
                    <li>{t('common.components.qrCode.instructions.step3')}</li>
                    <li>{t('common.components.qrCode.instructions.step4')}</li>
                    <li>{t('common.components.qrCode.instructions.step5')}</li>
                </ol>
            </div>
        </div>
    );
}
