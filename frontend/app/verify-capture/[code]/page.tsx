'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, AlertCircle, Shield, RefreshCcw, ArrowRight, Loader2, UserCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';
import LivenessCapture from '@/components/LivenessCapture';

type Step =
    | 'loading'
    | 'select'
    | 'capture'
    | 'preview'
    | 'uploading'
    | 'liveness'
    | 'selfie_preview'
    | 'selfie_uploading'
    | 'success'
    | 'error';

export default function VerifyCapturePage() {
    const params = useParams();
    const { t, language, setLanguage } = useLanguage();
    const code = params?.code as string;

    const [step, setStep] = useState<Step>('loading');
    const [documentType, setDocumentType] = useState('passport');
    const [side, setSide] = useState<'front' | 'back' | 'bio'>('bio');
    const [file, setFile] = useState<File | Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
    const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fr = language === 'fr';

    const documentTypes = [
        { value: 'passport',          label: t('verify.identity.passport',      undefined, 'Passport'),         description: fr ? 'Page biométrique avec photo' : 'Bio page with photo',      icon: '🌍' },
        { value: 'id_card',            label: t('verify.identity.idCard',        undefined, 'ID Card'),           description: fr ? 'Recto & Verso'                : 'Front & Back photo',       icon: '🆔' },
        { value: 'drivers_license',    label: t('verify.identity.driversLicense',undefined, "Driver's License"),  description: fr ? 'Recto & Verso'                : 'Front & Back photo',       icon: '🚗' },
        { value: 'residence_permit',   label: t('verify.identity.residencePermit',undefined, 'Residence Permit'), description: fr ? 'Recto & Verso'                : 'Front & Back photo',       icon: '🏠' },
    ];

    useEffect(() => {
        if (!code) return;
        validateSession();
    }, [code]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            if (selfiePreviewUrl) URL.revokeObjectURL(selfiePreviewUrl);
        };
    }, [previewUrl, selfiePreviewUrl]);

    const validateSession = async () => {
        try {
            const res = await apiClient.client.get(`/verification/identity/session/${code}`);
            setStep(res.data.completed ? 'success' : 'select');
        } catch {
            setErrorMessage('Invalid or expired verification link. Please generate a new one.');
            setStep('error');
        }
    };

    const compressImage = async (f: File): Promise<Blob> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = ev => {
                const img = new Image();
                img.src = ev.target?.result as string;
                img.onload = () => {
                    const MAX = 1600;
                    let w = img.width, h = img.height;
                    if (w > h ? w > MAX : h > MAX) {
                        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                        else       { w = Math.round(w * MAX / h); h = MAX; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression failed')), 'image/jpeg', 0.85);
                };
            };
            reader.onerror = reject;
        });

    const startCapture = (s: 'front' | 'back' | 'bio') => {
        setSide(s);
        setStep('capture');
        setTimeout(() => fileInputRef.current?.click(), 150);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.files?.[0];
        if (!raw) { setStep('select'); return; }
        const isHeic = /\.heic|\.heif$/i.test(raw.name);
        setStep('loading');
        try {
            const processed = isHeic ? raw : await compressImage(raw);
            setFile(processed);
            setPreviewUrl(URL.createObjectURL(processed));
            setStep('preview');
        } catch {
            setErrorMessage('Failed to process image. Please try again.');
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
            await apiClient.client.post('/verification/identity/upload-mobile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: { verification_code: code, document_type: documentType, side },
                onUploadProgress: ev => setUploadProgress(Math.round((ev.loaded * 100) / (ev.total || 1))),
            });

            if (documentType !== 'passport' && side === 'front') {
                // Need back side next
                setFile(null);
                setPreviewUrl(null);
                setSide('back');
                setStep('select');
            } else {
                // All doc sides done — proceed to liveness
                setFile(null);
                setPreviewUrl(null);
                setStep('liveness');
            }
        } catch (err: any) {
            setErrorMessage(err.response?.data?.detail || 'Upload failed. Check your connection.');
            setStep('preview');
        }
    };

    const handleLivenessCapture = useCallback((blob: Blob) => {
        setSelfieBlob(blob);
        setSelfiePreviewUrl(URL.createObjectURL(blob));
        setStep('selfie_preview');
    }, []);

    const handleLivenessError = useCallback((msg: string) => {
        setErrorMessage(msg || 'Camera access failed. Please allow camera permissions and try again.');
        setStep('error');
    }, []);

    const handleSelfieUpload = async () => {
        if (!selfieBlob) return;
        setStep('selfie_uploading');
        try {
            const formData = new FormData();
            formData.append('file', selfieBlob, 'selfie.jpg');
            await apiClient.client.post('/verification/identity/upload-mobile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: { verification_code: code, document_type: documentType, side: 'selfie' },
            });
            setStep('success');
        } catch (err: any) {
            setErrorMessage(err.response?.data?.detail || 'Selfie upload failed. Please retake.');
            setStep('selfie_preview');
        }
    };

    return (
        <div className="min-h-[100dvh] bg-white flex flex-col font-sans selection:bg-zinc-900/20 overflow-x-hidden">
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-zinc-900/5 rounded-full blur-[80px] animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-zinc-900/5 rounded-full blur-[80px]" />
            </div>

            <header className="px-6 py-6 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-2xl">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900">
                        {fr ? 'Capture Sécurisée' : 'Secure Capture'}
                    </span>
                </div>
                <button
                    onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
                    className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-[10px] font-black uppercase tracking-wider text-zinc-900 transition-colors"
                >
                    {fr ? 'EN' : 'FR'}
                </button>
            </header>

            <main className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full relative z-10">
                <AnimatePresence mode="wait">
                    {/* Loading */}
                    {step === 'loading' && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col items-center justify-center">
                            <Loader2 className="w-12 h-12 text-zinc-900 animate-spin mb-6" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">
                                {fr ? 'Traitement en cours...' : 'Processing...'}
                            </p>
                        </motion.div>
                    )}

                    {/* Error */}
                    {step === 'error' && (
                        <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-zinc-900 text-white rounded-3xl flex items-center justify-center mb-8">
                                <AlertCircle className="w-10 h-10" />
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter mb-4 text-zinc-900">
                                {fr ? 'Erreur' : 'Error'}
                            </h1>
                            <p className="text-zinc-500 font-bold mb-8 px-4">{errorMessage}</p>
                            <button onClick={validateSession}
                                className="w-full py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-transform">
                                {fr ? 'Réessayer' : 'Try Again'}
                            </button>
                        </motion.div>
                    )}

                    {/* Success */}
                    {step === 'success' && (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 bg-zinc-900 text-white rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-zinc-900 leading-none">
                                {fr ? 'Identité Vérifiée !' : 'Identity Verified!'}
                            </h1>
                            <p className="text-zinc-500 font-bold text-lg leading-relaxed mb-12">
                                {fr
                                    ? 'Votre identité a été confirmée. Vous pouvez fermer cette page et retourner sur votre ordinateur.'
                                    : 'Your identity has been confirmed. You can close this page and return to your desktop.'}
                            </p>
                            <div className="w-full p-6 rounded-3xl bg-zinc-900 text-white shadow-xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                    {fr ? 'Synchronisation active' : 'Desktop sync active'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Doc type selection / side prompt */}
                    {step === 'select' && (
                        <motion.div key="select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="w-full space-y-8">
                            <div>
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-zinc-900 leading-none">
                                    {side === 'bio'   ? (fr ? 'Identité'     : 'Identity')
                                   : side === 'front' ? (fr ? 'Face Avant'   : 'Front Side')
                                   :                    (fr ? 'Face Arrière' : 'Back Side')}
                                </h2>
                                <p className="text-zinc-500 font-medium">
                                    {side === 'bio'
                                        ? (fr ? 'Sélectionnez un document pour commencer' : 'Select document to begin')
                                        : (fr ? `Photographiez le côté : ${side}` : `Capture the ${side} of your document`)}
                                </p>
                            </div>

                            <div className="grid gap-3">
                                {side === 'bio' ? documentTypes.map(doc => (
                                    <button key={doc.value} onClick={() => setDocumentType(doc.value)}
                                        className={`p-5 rounded-[2rem] border-2 text-left transition-all flex items-center justify-between group ${
                                            documentType === doc.value ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-100 bg-white'}`}>
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
                                )) : (
                                    <div className="p-8 rounded-[2rem] border-2 border-dashed border-zinc-900/30 bg-zinc-900/5 flex flex-col items-center justify-center text-center">
                                        <div className="w-16 h-16 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-lg mb-6">
                                            {side === 'front' ? <Shield className="w-8 h-8" /> : <RefreshCcw className="w-8 h-8" />}
                                        </div>
                                        <p className="text-sm font-black text-zinc-900 mb-2 uppercase tracking-tighter">
                                            {fr ? `Prêt pour : ${side}` : `Ready for ${side} side`}
                                        </p>
                                        <p className="text-xs text-zinc-500 font-bold">
                                            {fr ? 'Évitez les reflets et ombres' : 'Ensure clear lighting, no glare'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button onClick={() => startCapture(documentType === 'passport' ? 'bio' : side === 'bio' ? 'front' : side)}
                                className="w-full bg-zinc-900 text-white font-black py-6 rounded-[2rem] shadow-2xl transition transform active:scale-95 flex items-center justify-center gap-4 text-xs uppercase tracking-[0.4em]">
                                <Camera className="w-5 h-5" />
                                {fr ? 'Lancer l\'Appareil' : 'Launch Camera'}
                            </button>
                        </motion.div>
                    )}

                    {/* Preview (doc) */}
                    {step === 'preview' && previewUrl && (
                        <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col">
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
                                <button onClick={() => { setFile(null); setPreviewUrl(null); setStep('select'); }}
                                    className="flex items-center justify-center gap-3 bg-zinc-100 text-zinc-900 font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform">
                                    <RefreshCcw className="w-4 h-4" />
                                    {fr ? 'Reprendre' : 'Retake'}
                                </button>
                                <button onClick={handleUpload}
                                    className="flex items-center justify-center gap-3 bg-zinc-900 text-white font-black py-5 rounded-2xl shadow-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform">
                                    {fr ? 'Valider' : 'Confirm'} <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Uploading doc */}
                    {step === 'uploading' && (
                        <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="relative w-32 h-32 mb-10">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-100" />
                                    <circle cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="8"
                                        strokeDasharray={377} strokeDashoffset={377 - (377 * uploadProgress) / 100}
                                        className="text-zinc-900 transition-all duration-300" strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl font-black text-zinc-900">{uploadProgress}%</span>
                                </div>
                            </div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2 text-zinc-900">
                                {fr ? 'Envoi...' : 'Transmitting'}
                            </h3>
                            <p className="text-zinc-500 font-medium">
                                {fr ? 'Sécurisation de vos données...' : 'Securing your identity data...'}
                            </p>
                        </motion.div>
                    )}

                    {/* Liveness check */}
                    {step === 'liveness' && (
                        <motion.div key="liveness" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="w-full space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-14 h-14 bg-zinc-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                                    <UserCircle2 className="w-7 h-7" />
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-900">
                                    {fr ? 'Vérification de Présence' : 'Liveness Check'}
                                </h2>
                                <p className="text-zinc-500 font-medium text-sm">
                                    {fr
                                        ? 'Placez votre visage dans le cadre, puis clignez des yeux.'
                                        : 'Position your face in the frame, then blink once.'}
                                </p>
                            </div>
                            <LivenessCapture
                                onCapture={handleLivenessCapture}
                                onError={handleLivenessError}
                                language={language}
                            />
                        </motion.div>
                    )}

                    {/* Selfie preview */}
                    {step === 'selfie_preview' && selfiePreviewUrl && (
                        <motion.div key="selfie_preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4 text-center">
                                {fr ? 'Votre selfie' : 'Your selfie'}
                            </p>
                            <div className="relative flex-1 bg-zinc-100 rounded-[2.5rem] overflow-hidden shadow-inner mb-6 border border-zinc-200">
                                <img src={selfiePreviewUrl} alt="Selfie preview" className="w-full h-full object-contain" />
                            </div>
                            {errorMessage && (
                                <div className="bg-zinc-900 text-white p-4 rounded-2xl mb-6 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl text-center">
                                    {errorMessage}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => { setSelfieBlob(null); setSelfiePreviewUrl(null); setErrorMessage(''); setStep('liveness'); }}
                                    className="flex items-center justify-center gap-3 bg-zinc-100 text-zinc-900 font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform">
                                    <RefreshCcw className="w-4 h-4" />
                                    {fr ? 'Reprendre' : 'Retake'}
                                </button>
                                <button onClick={handleSelfieUpload}
                                    className="flex items-center justify-center gap-3 bg-zinc-900 text-white font-black py-5 rounded-2xl shadow-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform">
                                    {fr ? 'Confirmer' : 'Confirm'} <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Selfie uploading */}
                    {step === 'selfie_uploading' && (
                        <motion.div key="selfie_uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center">
                            <Loader2 className="w-14 h-14 text-zinc-900 animate-spin mb-8" />
                            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2 text-zinc-900">
                                {fr ? 'Vérification...' : 'Verifying...'}
                            </h3>
                            <p className="text-zinc-500 font-medium">
                                {fr ? 'Comparaison des visages en cours...' : 'Comparing faces...'}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/heic,image/heif"
                    capture="environment"
                    className="hidden"
                />
            </main>
        </div>
    );
}
