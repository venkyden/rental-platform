'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { ShieldCheck, ArrowLeft, Upload, Link as LinkIcon } from 'lucide-react';

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
            await apiClient.client.post('/verification/guarantor/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Guarantor dossier uploaded successfully!');
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
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
            <div className="max-w-xl w-full bg-white rounded-[2.5rem] shadow-sm p-12 border border-zinc-200">
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className="p-4 bg-zinc-900 rounded-2xl mb-6 shadow-xl shadow-zinc-900/10">
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-3">Add a Guarantor</h1>
                    <p className="text-zinc-500 text-lg">Select a method to guarantee your application.</p>
                </div>

                <div className="space-y-4 mb-10">
                    <button
                        onClick={() => handleConnect('Visale')}
                        className="w-full p-6 border border-zinc-100 rounded-3xl hover:border-zinc-900 hover:bg-zinc-50 cursor-pointer flex justify-between items-center transition-all group disabled:opacity-50"
                        disabled={uploading}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:text-zinc-900 transition-colors">
                                <LinkIcon className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-zinc-900">Connect Visale Guarantee</div>
                                <div className="text-sm text-zinc-500">Government Service (Free)</div>
                            </div>
                        </div>
                        <span className="text-zinc-900 font-bold text-sm">Connect &rarr;</span>
                    </button>

                    <button
                        onClick={() => handleConnect('Garantme')}
                        className="w-full p-6 border border-zinc-100 rounded-3xl hover:border-zinc-900 hover:bg-zinc-50 cursor-pointer flex justify-between items-center transition-all group disabled:opacity-50"
                        disabled={uploading}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:text-zinc-900 transition-colors">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-zinc-900">Connect Garantme</div>
                                <div className="text-sm text-zinc-500">Certified Partner</div>
                            </div>
                        </div>
                        <span className="text-zinc-900 font-bold text-sm">Connect &rarr;</span>
                    </button>

                    <div
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className="w-full p-6 border border-zinc-100 rounded-3xl hover:border-zinc-900 hover:bg-zinc-50 cursor-pointer flex justify-between items-center transition-all group disabled:opacity-50"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:text-zinc-900 transition-colors">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-zinc-900">Physical Guarantor</div>
                                <div className="text-sm text-zinc-500">Upload single PDF with ID, Contract & Payslips</div>
                            </div>
                        </div>
                        <span className="text-zinc-400 group-hover:text-zinc-900 font-bold text-sm">
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

                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => router.back()}
                        className="w-full py-4 text-zinc-400 hover:text-zinc-900 font-bold transition-colors flex items-center justify-center gap-2"
                        disabled={uploading}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
