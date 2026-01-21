'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';

export default function IncomeVerifyPage() {
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
            // Using the income verification endpoint
            await apiClient.client.post('/documents/verify/income', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Justificatif de revenus envoyé avec succès !');
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de l'envoi du document");
        } finally {
            setUploading(false);
        }
    };



    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                <div className="text-6xl mb-6 text-center">💼</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Justificatifs de Revenus</h1>
                <p className="text-center text-gray-500 mb-8">
                    Sécurisez votre dossier pour les propriétaires.
                </p>

                <div className="space-y-4 mb-8">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                    >
                        <span className="text-4xl block mb-2">📄</span>
                        <span className="text-gray-600 font-medium">Glissez votre Avis d'Impôt 2025</span>
                        <span className="text-xs text-gray-400 block mt-1">
                            {uploading ? 'Envoi...' : 'PDF uniquement'}
                        </span>
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.jpg,.png"
                        onChange={handleFileUpload}
                        disabled={uploading}
                    />

                    <div className="grid grid-cols-1 gap-4">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border rounded-xl p-4 text-center hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <span className="text-2xl block mb-1">📑</span>
                            <span className="text-xs font-medium">3 Fiches de paie</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => router.back()}
                        className="w-full py-3 text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={uploading}
                    >
                        Annuler / Retour
                    </button>
                    {/* Optional skip button if needed */}
                </div>
            </div>
        </div>
    );
}
