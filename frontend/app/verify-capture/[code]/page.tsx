'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, AlertCircle, Shield, ArrowLeft, RefreshCcw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function VerifyCapturePage() {
    const params = useParams();
    const code = params?.code as string;
    const [step, setStep] = useState<'loading' | 'select' | 'capture' | 'preview' | 'uploading' | 'success' | 'error'>('loading');
    const [documentType, setDocumentType] = useState('passport');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [isLocalhostOnMobile, setIsLocalhostOnMobile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const documentTypes = [
        { value: 'passport', label: 'Passport / Passeport', description: '1 photo of bio page', icon: '🌍' },
        { value: 'id_card', label: 'National ID Card / CNI', description: 'Front side photo', icon: '🆔' },
        { value: 'drivers_license', label: 'Driver\'s License / Permis', description: 'Front side photo', icon: '🚗' },
        { value: 'residence_permit', label: 'Residence Permit / Séjour', description: 'Front side photo', icon: '🏠' },
    ];

    // Validate session on load
    useEffect(() => {
        if (!code) return;
        
        // Check for localhost on mobile
        if (typeof window !== 'undefined') {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isLocal && isMobile) {
                setIsLocalhostOnMobile(true);
            }
        }
        
        validateSession();
    }, [code]);

    // Cleanup preview URL
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const validateSession = async () => {
        if (!code) return;
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
            setStep('select');
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
            setStep('preview');
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col font-sans selection:bg-teal-500/20 transition-colors duration-500">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px]" />
            </div>

            {/* Header */}
            <header className="px-6 py-8 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900 dark:text-white">Secure Capture</span>
                </div>
                <div className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
            </header>

            <main className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full relative z-10">
                <AnimatePresence mode="wait">
                    {/* Step: Loading */}
                    {step === 'loading' && (
                        <motion.div 
                            key="loading"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col items-center justify-center"
                        >
                            <div className="w-16 h-16 border-4 border-teal-500/10 border-t-teal-500 rounded-full animate-spin mb-6" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">Establishing Secure Link...</p>
                        </motion.div>
                    )}

                    {/* Step: Error */}
                    {step === 'error' && (
                        <motion.div 
                            key="error"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="flex-1 flex flex-col items-center justify-center text-center"
                        >
                            <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-[2rem] flex items-center justify-center mb-8">
                                <AlertCircle className="w-10 h-10" />
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter mb-4 text-zinc-900 dark:text-white leading-none">Session Invalid</h1>
                            <p className="text-zinc-500 font-medium mb-8 leading-relaxed">{errorMessage}</p>
                            <button 
                                onClick={() => window.location.reload()}
                                className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl"
                            >
                                Try Refreshing
                            </button>
                        </motion.div>
                    )}

                    {/* Step: Success */}
                    {step === 'success' && (
                        <motion.div 
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center"
                        >
                            <div className="w-24 h-24 bg-teal-500 text-white rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl shadow-teal-500/30">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-zinc-900 dark:text-white leading-none">Success!</h1>
                            <p className="text-zinc-500 font-medium text-lg leading-relaxed mb-12">
                                Your identity document has been securely verified. You can now close this window and continue on your desktop.
                            </p>
                            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Desktop will auto-sync in seconds</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Step: Select */}
                    {step === 'select' && (
                        <motion.div 
                            key="select"
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="w-full space-y-10"
                        >
                            <div className="text-center">
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 text-zinc-900 dark:text-white leading-none">Identity Capture</h2>
                                <p className="text-zinc-500 font-medium">Select your document type to begin live scan</p>
                            </div>

                            {isLocalhostOnMobile && (
                                <div className="p-6 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 space-y-3">
                                    <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                                        <AlertCircle className="w-5 h-5" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Localhost Warning</p>
                                    </div>
                                    <p className="text-xs font-medium text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                                        You are accessing this via localhost. If this fails to connect, use your computer's IP address instead.
                                    </p>
                                </div>
                            )}

                            <div className="grid gap-4">
                                {documentTypes.map((doc) => (
                                    <button
                                        key={doc.value}
                                        onClick={() => setDocumentType(doc.value)}
                                        className={`p-6 rounded-[2rem] border-2 text-left transition-all duration-300 flex items-center justify-between group ${documentType === doc.value
                                            ? 'border-teal-500 bg-teal-500/5 dark:bg-teal-500/10'
                                            : 'border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                                            }`}
                                    >
                                        <div className="flex items-center gap-5">
                                            <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{doc.icon}</span>
                                            <div>
                                                <div className="font-black text-[10px] uppercase tracking-widest text-zinc-900 dark:text-white mb-1">{doc.label}</div>
                                                <div className="text-xs text-zinc-500 font-medium">{doc.description}</div>
                                            </div>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${documentType === doc.value ? 'border-teal-500 bg-teal-500' : 'border-zinc-200 dark:border-zinc-700'}`}>
                                            {documentType === doc.value && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={startCapture}
                                className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black py-6 rounded-[2rem] shadow-2xl shadow-zinc-900/20 transition transform active:scale-95 flex items-center justify-center gap-4 text-xs uppercase tracking-[0.4em]"
                            >
                                <Camera className="w-5 h-5" />
                                Launch Camera
                            </button>
                        </motion.div>
                    )}

                    {/* Step: Preview */}
                    {step === 'preview' && previewUrl && (
                        <motion.div 
                            key="preview"
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col h-full"
                        >
                            <div className="relative flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-[3rem] overflow-hidden shadow-inner mb-8 border border-zinc-200 dark:border-zinc-800">
                                <img src={previewUrl} alt="Document preview" className="w-full h-full object-contain" />
                            </div>

                            {errorMessage && (
                                <div className="bg-red-500/10 text-red-500 p-6 rounded-[2rem] mb-6 text-[10px] font-black uppercase tracking-[0.2em] border border-red-500/20 text-center">
                                    {errorMessage}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => {
                                        setFile(null);
                                        setPreviewUrl(null);
                                        setErrorMessage('');
                                        setStep('select');
                                    }}
                                    className="flex items-center justify-center gap-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-black py-5 rounded-[2rem] text-[10px] uppercase tracking-[0.3em]"
                                >
                                    <RefreshCcw className="w-4 h-4" />
                                    Retake
                                </button>
                                <button
                                    onClick={handleUpload}
                                    className="flex items-center justify-center gap-3 bg-teal-500 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-teal-500/20 text-[10px] uppercase tracking-[0.3em]"
                                >
                                    Confirm
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step: Uploading */}
                    {step === 'uploading' && (
                        <motion.div 
                            key="uploading"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center"
                        >
                            <div className="w-20 h-20 border-4 border-teal-500/10 border-t-teal-500 rounded-full animate-spin mb-10" />
                            <h3 className="text-3xl font-black uppercase tracking-tighter mb-3 text-zinc-900 dark:text-white leading-none">Verifying...</h3>
                            <p className="text-zinc-500 font-medium">Securing your identity document on the cloud</p>
                        </motion.div>
                    )}
                </AnimatePresence>

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
