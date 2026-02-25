'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';

export default function GuarantorVerifyPage() {
    const router = useRouter();
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploading(true);
            await apiClient.client.post('/documents/verify/guarantor', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Guarantor document uploaded successfully!');
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (error) {
            console.error(error);
            toast.error("Error uploading document");
        } finally {
            setUploading(false);
        }
    };

    const handleConnect = (service: string) => {
        setUploading(true);
        // Simulate OAuth/API connection
        setTimeout(() => {
            setUploading(false);
            toast.success(`${service} connected successfully!`);
            router.push('/dashboard');
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                <div className="text-6xl mb-6 text-center">🤝</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Add a Guarantor</h1>
                <p className="text-center text-gray-500 mb-8">Select a method to guarantee your application.</p>

                <div className="space-y-4 mb-8">
                    <button
                        onClick={() => handleConnect('Visale')}
                        className="w-full p-4 border rounded-xl hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors text-left"
                        disabled={uploading}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🏛️</span>
                            <div>
                                <div className="font-medium">Connect Visale Guarantee</div>
                                <div className="text-xs text-gray-500">Government Service (Free)</div>
                            </div>
                        </div>
                        <span className="text-blue-600 text-sm">Connect &rarr;</span>
                    </button>

                    <button
                        onClick={() => handleConnect('Garantme')}
                        className="w-full p-4 border rounded-xl hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors text-left"
                        disabled={uploading}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🦁</span>
                            <div>
                                <div className="font-medium">Connect Garantme</div>
                                <div className="text-xs text-gray-500">Certified Partner</div>
                            </div>
                        </div>
                        <span className="text-blue-600 text-sm">Connect &rarr;</span>
                    </button>

                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 border rounded-xl hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">👤</span>
                            <div>
                                <div className="font-medium">Physical Guarantor</div>
                                <div className="text-xs text-gray-500">Upload full dossier (PDF)</div>
                            </div>
                        </div>
                        <span className="text-gray-400 text-sm">
                            {uploading ? 'Uploading...' : 'Upload →'}
                        </span>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".pdf,.jpg,.png"
                            onChange={handleFileUpload}
                        />
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => router.back()}
                        className="flex-1 py-3 text-gray-500 hover:text-gray-700 transition-colors"
                        disabled={uploading}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
