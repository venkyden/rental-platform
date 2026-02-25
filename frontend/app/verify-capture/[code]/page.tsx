'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function VerifyCaptureePage({ params }: { params: { code: string } }) {
    const { code } = params;
    const [step, setStep] = useState<'loading' | 'select' | 'capture' | 'preview' | 'uploading' | 'success' | 'error'>('loading');
    const [documentType, setDocumentType] = useState('passport');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const documentTypes = [
        { value: 'passport', label: '📘 Passport', description: '1 photo of bio page' },
        { value: 'id_card', label: '🪪 National ID Card', description: 'Front side photo' },
        { value: 'drivers_license', label: '🚗 Driver\'s License', description: 'Front side photo' },
    ];

    // Validate session on load
    useEffect(() => {
        validateSession();
    }, []);

    // Cleanup preview URL
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const validateSession = async () => {
        try {
            const res = await axios.get(`${API_URL}/verification/identity/session/${code}`);
            if (res.data.completed) {
                setStep('success');
            } else {
                setStep('select');
            }
        } catch {
            setErrorMessage('This verification link is invalid or has expired. Please generate a new one from your desktop.');
            setStep('error');
        }
    };

    const startCapture = () => {
        setStep('capture');
        // Small delay to ensure state update then trigger file input
        setTimeout(() => {
            if (fileInputRef.current) fileInputRef.current.click();
        }, 100);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setStep('preview');
        } else {
            setStep('select'); // User cancelled
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStep('uploading');
        try {
            const formData = new FormData();
            formData.append('file', file);

            await axios.post(`${API_URL}/verification/identity/upload-mobile`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: {
                    verification_code: code,
                    document_type: documentType,
                },
            });

            setStep('success');
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Upload failed. Please try again.';
            setErrorMessage(msg);
            setStep('preview'); // Allow retry
        }
    };

    // ─── Loading ───
    if (step === 'loading') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Verifying session...</p>
                </div>
            </div>
        );
    }

    // ─── Error ───
    if (step === 'error') {
        return (
            <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-3">Link Invalid</h1>
                    <p className="text-gray-600">{errorMessage}</p>
                </div>
            </div>
        );
    }

    // ─── Success ───
    if (step === 'success') {
        return (
            <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <div className="bg-white rounded-full p-6 shadow-lg mb-6 inline-block">
                        <span className="text-6xl">✅</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Identity Verified!</h1>
                    <p className="text-gray-600 mb-2">
                        Your document has been captured and verified successfully.
                    </p>
                    <p className="text-gray-500 text-sm">
                        You can close this page — your desktop will update automatically.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white shadow p-4 sticky top-0 z-10">
                <h1 className="text-lg font-bold" style={{ color: '#22B8B8' }}>🆔 Identity Verification</h1>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">

                {/* Step: Select document type */}
                {step === 'select' && (
                    <div className="w-full">
                        <div className="text-center mb-6">
                            <div className="text-5xl mb-3">🛂</div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Capture Your ID</h2>
                            <p className="text-gray-600 text-sm">
                                Select your document type and take a clear photo
                            </p>
                        </div>

                        <div className="space-y-3 mb-6">
                            {documentTypes.map((doc) => (
                                <button
                                    key={doc.value}
                                    onClick={() => setDocumentType(doc.value)}
                                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${documentType === doc.value
                                        ? 'border-teal-500 bg-teal-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                        }`}
                                >
                                    <div className="font-semibold text-gray-900">{doc.label}</div>
                                    <div className="text-xs text-gray-500 mt-1">{doc.description}</div>
                                </button>
                            ))}
                        </div>

                        {/* Tips */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-6">
                            <p className="text-sm font-medium text-blue-900 mb-2">📷 Tips:</p>
                            <ul className="text-xs text-blue-800 space-y-1">
                                <li>• Place document on a flat, well-lit surface</li>
                                <li>• Ensure all text is clearly readable</li>
                                <li>• Avoid glare and shadows</li>
                                <li>• Don't cover any text with your fingers</li>
                            </ul>
                        </div>

                        <button
                            onClick={startCapture}
                            className="w-full bg-teal-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:bg-teal-700 transition transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span>📷</span> Take Photo
                        </button>
                    </div>
                )}

                {/* Step: Capturing (spinner while camera opens) */}
                {step === 'capture' && (
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Opening camera...</p>
                    </div>
                )}

                {/* Step: Preview */}
                {step === 'preview' && previewUrl && (
                    <div className="w-full flex-1 flex flex-col">
                        <div className="relative flex-1 bg-black rounded-lg overflow-hidden shadow-xl mb-6">
                            <img src={previewUrl} alt="Document preview" className="w-full h-full object-contain" />
                        </div>

                        {errorMessage && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
                                {errorMessage}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setFile(null);
                                    setPreviewUrl(null);
                                    setErrorMessage('');
                                    setStep('select');
                                }}
                                className="flex-1 bg-white text-gray-700 font-bold py-3 px-4 rounded-xl shadow border border-gray-200"
                            >
                                Retake
                            </button>
                            <button
                                onClick={handleUpload}
                                className="flex-1 bg-green-600 text-white font-bold py-3 px-4 rounded-xl shadow hover:bg-green-700"
                            >
                                Confirm & Verify
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Uploading */}
                {step === 'uploading' && (
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600 mx-auto mb-6"></div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Verifying Document...</h3>
                        <p className="text-gray-600">This may take a moment</p>
                    </div>
                )}

                {/* Hidden file input for camera capture */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                />
            </main>
        </div>
    );
}
