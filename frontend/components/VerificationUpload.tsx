'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import DocumentCapture from './DocumentCapture';

interface VerificationUploadProps {
    verificationType: 'identity' | 'employment';
    onSuccess: () => void;
}

export default function VerificationUpload({ verificationType, onSuccess }: VerificationUploadProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [documentType, setDocumentType] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [showCamera, setShowCamera] = useState(false);

    const documentTypes = verificationType === 'identity'
        ? [
            { value: 'passport', label: 'Passport (1 photo)', captures: 1 },
            { value: 'id_card', label: 'National ID Card (2 photos: front & back)', captures: 2 },
            { value: 'drivers_license', label: "Driver's License (2 photos: front & back)", captures: 2 },
        ]
        : [
            { value: 'payslip', label: 'Recent Payslip', captures: 1 },
            { value: 'contract', label: 'Employment Contract', captures: 1 },
            { value: 'tax_return', label: 'Tax Return', captures: 1 },
        ];

    const selectedDocType = documentTypes.find(dt => dt.value === documentType);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
            setError('');
        }
    };

    const handleCameraCapture = (capturedFiles: File[]) => {
        setFiles(capturedFiles);
        setShowCamera(false);
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!files.length || !documentType) {
            setError('Please select a document type and capture/upload all required photos');
            return;
        }

        setUploading(true);
        setError('');

        try {
            // Upload all files
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append('file', files[i]);
                formData.append('document_type', documentType);
                formData.append('side', i === 0 ? 'front' : 'back');

                const endpoint = verificationType === 'identity'
                    ? '/verification/identity/upload'
                    : '/verification/employment/upload';

                await apiClient.client.post(endpoint, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    params: {
                        document_type: documentType
                    }
                });
            }

            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            {showCamera && (
                <DocumentCapture
                    documentType={documentType}
                    onComplete={handleCameraCapture}
                    onCancel={() => setShowCamera(false)}
                />
            )}

            <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                    {verificationType === 'identity' ? 'Identity Verification' : 'Employment Verification'}
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                    {verificationType === 'identity'
                        ? '🔒 For security, please capture live photos of your government-issued ID'
                        : 'Upload a recent payslip or employment document'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="rounded-md bg-red-50 p-4">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 mb-2">
                            Document Type
                        </label>
                        <select
                            id="documentType"
                            value={documentType}
                            onChange={(e) => {
                                setDocumentType(e.target.value);
                                setFiles([]); // Reset files when document type changes
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        >
                            <option value="">Select document type...</option>
                            {documentTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {verificationType === 'identity' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Capture Document {selectedDocType && `(${selectedDocType.captures} photo${selectedDocType.captures > 1 ? 's' : ''})`}
                            </label>
                            {files.length === 0 ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!documentType) {
                                            setError('Please select a document type first');
                                            return;
                                        }
                                        setShowCamera(true);
                                    }}
                                    disabled={!documentType}
                                    className="w-full py-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-blue-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="text-2xl">📷</span>
                                    Open Camera to Capture Document
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                        <p className="text-sm text-green-800 font-medium mb-2">
                                            ✅ {files.length} photo{files.length > 1 ? 's' : ''} captured
                                        </p>
                                        {files.map((file, index) => (
                                            <p key={index} className="text-xs text-green-700">
                                                {index + 1}. {file.name} ({(file.size / 1024).toFixed(0)} KB)
                                            </p>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFiles([]);
                                            setShowCamera(true);
                                        }}
                                        className="text-sm text-blue-600 hover:text-blue-700"
                                    >
                                        Recapture
                                    </button>
                                </div>
                            )}
                            <p className="mt-2 text-xs text-gray-500">
                                🔒 Live capture prevents fraud and ensures document authenticity
                            </p>
                        </div>
                    ) : (
                        <div>
                            <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
                                Upload Document
                            </label>
                            <input
                                type="file"
                                id="file"
                                onChange={handleFileChange}
                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Accepted formats: JPEG, PNG, PDF (Max 10MB)
                            </p>
                        </div>
                    )}

                    {files.length > 0 && verificationType === 'employment' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <p className="text-sm text-blue-800">
                                📎 {files[0].name} ({(files[0].size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={uploading || files.length === 0}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {uploading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Uploading...
                            </span>
                        ) : (
                            'Upload & Verify'
                        )}
                    </button>
                </form>

                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <p className="text-xs text-gray-600">
                        🔒 Your documents are encrypted and stored securely. We use industry-standard security practices to protect your privacy.
                    </p>
                </div>
            </div>
        </>
    );
}
