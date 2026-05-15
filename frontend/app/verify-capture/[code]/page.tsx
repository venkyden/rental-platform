'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, AlertCircle, Shield, RefreshCcw, ArrowRight, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function VerifyCapturePage() {
    const params = useParams();
    const code = params?.code as string;
    const [step, setStep] = useState<'loading' | 'select' | 'capture' | 'preview' | 'uploading' | 'success' | 'error'>('loading');
    const [documentType, setDocumentType] = useState('passport');
    const [side, setSide] = useState<'front' | 'back' | 'bio'>('bio');
    const [file, setFile] = useState<File | Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const [isLocalhostOnMobile, setIsLocalhostOnMobile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const documentTypes = [
        { value: 'passport', label: 'Passport / Passeport', description: 'Bio page with photo', icon: '🌍' },
        { value: 'id_card', label: 'ID Card / CNI', description: 'Front & Back photo', icon: '🆔' },
        { value: 'drivers_license', label: 'Driver\'s License / Permis', description: 'Front & Back photo', icon: '🚗' },
        { value: 'residence_permit', label: 'Residence Permit / Séjour', description: 'Front & Back photo', icon: '🏠' },
    ];

    // Validate session on load
    useEffect(() => {
        if (!code) return;
        
        if (typeof window !== 'undefined') {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isLocal && isMobile) setIsLocalhostOnMobile(true);
        }
        
        validateSession();
    }, [code]);

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
            setErrorMessage('Invalid or expired verification link. Please generate a new one.');
            setStep('error');
        }
    };

    const compressImage = async (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 1600;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Compression failed')), 'image/jpeg', 0.85);
                };
            };
            reader.onerror = (e) => reject(e);
        });
    };

    const startCapture = (currentSide: 'front' | 'back' | 'bio') => {
        setSide(currentSide);
        setStep('capture');
        setTimeout(() => fileInputRef.current?.click(), 150);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setStep('loading'); // Show mini loader while compressing
            try {
                const compressed = await compressImage(e.target.files[0]);
                setFile(compressed);
                setPreviewUrl(URL.createObjectURL(compressed));
                setStep('preview');
            } catch (err) {
                setErrorMessage('Failed to process image. Please try again.');
                setStep('select');
            }
        } else {
            setStep('select');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStep('uploading');
        setUploadProgress(0);
        try {
            const formData = new FormData();
            formData.append('file', file, 'capture.jpg');

            await axios.post(`${API_URL}/verification/identity/upload-mobile`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: {
                    verification_code: code,
                    document_type: documentType,
                    side: side,
                },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                    setUploadProgress(percent);
                }
            });

            if (documentType !== 'passport' && side === 'front') {
                // Move to back side
                setFile(null);
                setPreviewUrl(null);
                setSide('back');
                setStep('select');
            } else {
                setStep('success');
            }
        } catch (err: any) {
            setErrorMessage(err.response?.data?.detail || 'Upload failed. Check your connection.');
            setStep('preview');
        }
    };

    return (
        <div className="min-h-[100dvh] bg-white flex flex-col font-sans selection:bg-zinc-900/20 overflow-x-hidden">
            {/* Ambient Background - Optimized Blur */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-zinc-900/5 rounded-full blur-[80px] will-change-transform animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-zinc-900/5 rounded-full blur-[80px] will-change-transform" />
            </div>

            {/* Header */}
            <header className="px-6 py-6 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-2xl">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900">Secure Capture</span>
                </div>
                <div className="flex h-2 w-2 rounded-full bg-zinc-900 animate-pulse" />
            </header>

            <main className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full relative z-10">
                <AnimatePresence mode="wait">
                    {step === 'loading' && (
                        <motion.div 
                            key="loading"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col items-center justify-center"
                        >
                            <Loader2 className="w-12 h-12 text-zinc-900 animate-spin mb-6" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">Processing...</p>
                        </motion.div>
                    )}

                    {step === 'error' && (
                        <motion.div 
                            key="error"
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center"
                        >
                            <div className="w-20 h-20 bg-zinc-900 text-white rounded-3xl flex items-center justify-center mb-8">
                                <AlertCircle className="w-10 h-10" />
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter mb-4 text-zinc-900">Session Expired</h1>
                            <p className="text-zinc-500 font-bold mb-8 px-4">{errorMessage}</p>
                            <button 
                                onClick={() => window.location.reload()}
                                className="w-full py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-transform"
                            >
                                Try Refreshing
                            </button>
                        </motion.div>
                    )}

                    {step === 'success' && (
                        <motion.div 
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center"
                        >
                            <div className="w-24 h-24 bg-zinc-900 text-white rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-zinc-900 leading-none">Done!</h1>
                            <p className="text-zinc-500 font-bold text-lg leading-relaxed mb-12">
                                Your identity has been securely transmitted. You can now return to your desktop browser.
                            </p>
                            <div className="w-full p-6 rounded-3xl bg-zinc-900 text-white shadow-xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Desktop sync active</p>
                            </div>
                        </motion.div>
                    )}

                    {step === 'select' && (
                        <motion.div 
                            key="select"
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="w-full space-y-8"
                        >
                            <div>
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-zinc-900 leading-none">
                                    {side === 'bio' ? 'Identity' : side === 'front' ? 'Front Side' : 'Back Side'}
                                </h2>
                                <p className="text-zinc-500 font-medium">
                                    {side === 'bio' ? 'Select document to begin scan' : `Capture the ${side} of your document`}
                                </p>
                            </div>

                            <div className="grid gap-3">
                                {side === 'bio' ? (
                                    documentTypes.map((doc) => (
                                        <button
                                            key={doc.value}
                                            onClick={() => setDocumentType(doc.value)}
                                            className={`p-5 rounded-[2rem] border-2 text-left transition-all duration-300 flex items-center justify-between group ${documentType === doc.value
                                                ? 'border-zinc-900 bg-zinc-900 text-white'
                                                : 'border-zinc-100 bg-white'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="text-2xl">{doc.icon}</span>
                                                <div>
                                                    <div className={`font-black text-[10px] uppercase tracking-widest mb-0.5 ${documentType === doc.value ? 'text-white' : 'text-zinc-900'}`}>{doc.label}</div>
                                                    <div className={`text-xs font-medium ${documentType === doc.value ? 'text-zinc-400' : 'text-zinc-500'}`}>{doc.description}</div>
                                                </div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${documentType === doc.value ? 'border-white bg-white' : 'border-zinc-200'}`}>
                                                {documentType === doc.value && <div className="w-1.5 h-1.5 rounded-full bg-zinc-900" />}
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-8 rounded-[2rem] border-2 border-dashed border-zinc-900/30 bg-zinc-900/5 flex flex-col items-center justify-center text-center">
                                        <div className="w-16 h-16 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-lg mb-6">
                                            {side === 'front' ? <Shield className="w-8 h-8" /> : <RefreshCcw className="w-8 h-8" />}
                                        </div>
                                        <p className="text-sm font-black text-zinc-900 mb-2 uppercase tracking-tighter">Ready for {side} side</p>
                                        <p className="text-xs text-zinc-500 font-bold">Ensure lighting is clear and no glare</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => startCapture(documentType === 'passport' ? 'bio' : side === 'bio' ? 'front' : side)}
                                className="w-full bg-zinc-900 text-white font-black py-6 rounded-[2rem] shadow-2xl transition transform active:scale-95 flex items-center justify-center gap-4 text-xs uppercase tracking-[0.4em]"
                            >
                                <Camera className="w-5 h-5" />
                                Launch Camera
                            </button>
                        </motion.div>
                    )}

                    {step === 'preview' && previewUrl && (
                        <motion.div 
                            key="preview"
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col"
                        >
                            <div className="relative flex-1 bg-zinc-100 rounded-[2.5rem] overflow-hidden shadow-inner mb-6 border border-zinc-200">
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full">
                                    <span className="text-[8px] font-bold text-white uppercase tracking-widest">{side} preview</span>
                                </div>
                            </div>

                             {errorMessage && (
                                <div className="bg-zinc-900 text-white p-4 rounded-2xl mb-6 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl text-center">
                                    {errorMessage}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => {
                                        setFile(null);
                                        setPreviewUrl(null);
                                        setStep('select');
                                    }}
                                    className="flex items-center justify-center gap-3 bg-zinc-100 text-zinc-900 font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform"
                                >
                                    <RefreshCcw className="w-4 h-4" />
                                    Retake
                                </button>
                                <button
                                    onClick={handleUpload}
                                    className="flex items-center justify-center gap-3 bg-zinc-900 text-white font-black py-5 rounded-2xl shadow-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform"
                                >
                                    Confirm <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'uploading' && (
                        <motion.div 
                            key="uploading"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center"
                        >
                            <div className="relative w-32 h-32 mb-10">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-100" />
                                    <circle cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={377} strokeDashoffset={377 - (377 * uploadProgress) / 100} className="text-zinc-900 transition-all duration-300" strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl font-black text-zinc-900">{uploadProgress}%</span>
                                </div>
                            </div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2 text-zinc-900">Transmitting</h3>
                            <p className="text-zinc-500 font-medium">Securing your identity data...</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png"
                    capture="environment"
                    className="hidden"
                />
            </main>
        </div>
    );
}
