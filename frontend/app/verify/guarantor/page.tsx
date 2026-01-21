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
            toast.success('Document garant envoyé avec succès !');
            setTimeout(() => router.push('/dashboard'), 1500);
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de l'envoi du document");
        } finally {
            setUploading(false);
        }
    };

    const handleConnect = (service: string) => {
        setUploading(true);
        // Simulate OAuth/API connection
        setTimeout(() => {
            setUploading(false);
            toast.success(`${service} connecté avec succès !`);
            router.push('/dashboard');
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                <div className="text-6xl mb-6 text-center">🤝</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Ajouter un Garant</h1>
                <p className="text-center text-gray-500 mb-8">Sélectionnez une méthode pour garantir votre dossier.</p>

                <div className="space-y-4 mb-8">
                    <button
                        onClick={() => handleConnect('Visale')}
                        className="w-full p-4 border rounded-xl hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors text-left"
                        disabled={uploading}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🏛️</span>
                            <div>
                                <div className="font-medium">Connecter Garantie Visale</div>
                                <div className="text-xs text-gray-500">Service de l'État (Gratuit)</div>
                            </div>
                        </div>
                        <span className="text-blue-600 text-sm">Connecter &rarr;</span>
                    </button>

                    <button
                        onClick={() => handleConnect('Garantme')}
                        className="w-full p-4 border rounded-xl hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors text-left"
                        disabled={uploading}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🦁</span>
                            <div>
                                <div className="font-medium">Connecter Garantme</div>
                                <div className="text-xs text-gray-500">Partenaire certifié</div>
                            </div>
                        </div>
                        <span className="text-blue-600 text-sm">Connecter &rarr;</span>
                    </button>

                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 border rounded-xl hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">👤</span>
                            <div>
                                <div className="font-medium">Garant Physique</div>
                                <div className="text-xs text-gray-500">Importer dossier complet (PDF)</div>
                            </div>
                        </div>
                        <span className="text-gray-400 text-sm">
                            {uploading ? 'Envoi...' : 'Importer →'}
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
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
}
