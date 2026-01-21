'use client';

import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
    verificationCode: string;
    captureUrl: string;
    expiresAt: string;
}

export default function QRCodeDisplay({ verificationCode, captureUrl, expiresAt }: QRCodeDisplayProps) {
    const copyToClipboard = () => {
        navigator.clipboard.writeText(captureUrl);
        alert('Link copied to clipboard!');
    };

    return (
        <div className="bg-white border-2 border-blue-200 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">📸 Upload Property Photos</h3>
            <p className="text-gray-600 mb-6">
                Scan this QR code with your phone to upload GPS-verified photos of the property
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
                <p className="text-sm text-gray-600 mb-1">Verification Code:</p>
                <p className="text-2xl font-mono font-bold text-blue-600">{verificationCode}</p>
            </div>

            {/* Capture URL */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">Or copy this link:</p>
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
                        Copy
                    </button>
                </div>
            </div>

            {/* Expiry */}
            <p className="text-xs text-gray-500 text-center">
                This link expires on {new Date(expiresAt).toLocaleDateString()} at{' '}
                {new Date(expiresAt).toLocaleTimeString()}
            </p>

            {/* Instructions */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">📱 Instructions:</p>
                <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                    <li>Open the link on your mobile phone</li>
                    <li>Allow camera and location permissions</li>
                    <li>Make sure you're AT the property location (GPS verified)</li>
                    <li>Take photos of each room</li>
                    <li>Photos will be automatically watermarked with the address</li>
                </ol>
            </div>
        </div>
    );
}
