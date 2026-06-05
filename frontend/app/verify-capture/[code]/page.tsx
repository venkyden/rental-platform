'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, AlertCircle, Shield, RefreshCcw, ArrowRight, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';

type Step = 'loading' | 'select_doc' | 'guide' | 'capture' | 'preview' | 'uploading' | 'success' | 'error';

const DOCUMENT_TYPES = [
    {
        value: 'passport',
        labelEn: 'Passport',
        labelFr: 'Passeport',
        descEn: 'Bio page with photo',
        descFr: 'Page biométrique avec photo',
        icon: '🌍',
    },
    {
        value: 'id_card',
        labelEn: 'National ID Card',
        labelFr: "Carte Nationale d'Identité",
        descEn: 'Front side with photo',
        descFr: 'Recto avec photo',
        icon: '🆔',
    },
    {
        value: 'drivers_license',
        labelEn: "Driver's License",
        labelFr: 'Permis de conduire',
        descEn: 'Front side with photo',
        descFr: 'Recto avec photo',
        icon: '🚗',
    },
    {
        value: 'residence_permit',
        labelEn: 'Residence Permit',
        labelFr: 'Titre de séjour',
        descEn: 'Front side with photo',
        descFr: 'Recto avec photo',
        icon: '🏠',
    },
];

function IdSelfieIllustration() {
    return (
        <div className="relative w-full aspect-video bg-zinc-900 rounded-3xl overflow-hidden flex items-center justify-center">
            {/* Corner guides */}
            <div className="absolute top-4 left-4 w-7 h-7 border-t-2 border-l-2 border-white/40 rounded-tl-md" />
            <div className="absolute top-4 right-4 w-7 h-7 border-t-2 border-r-2 border-white/40 rounded-tr-md" />
            <div className="absolute bottom-4 left-4 w-7 h-7 border-b-2 border-l-2 border-white/40 rounded-bl-md" />
            <div className="absolute bottom-4 right-4 w-7 h-7 border-b-2 border-r-2 border-white/40 rounded-br-md" />

            {/* Person + ID card illustration */}
            <div className="flex items-center gap-5">
                {/* Face silhouette */}
                <div className="flex flex-col items-center gap-1">
                    <div className="w-16 h-16 rounded-full bg-zinc-700 border-2 border-white/20 flex items-center justify-center overflow-hidden relative">
                        {/* simple face */}
                        <div className="absolute top-3 w-12 h-8 rounded-full bg-zinc-600" />
                        <div className="absolute bottom-0 w-full h-7 rounded-t-[50%] bg-zinc-600" />
                        <div className="absolute top-5 flex gap-3">
                            <div className="w-2 h-2 rounded-full bg-white/50" />
                            <div className="w-2 h-2 rounded-full bg-white/50" />
                        </div>
                    </div>
                    <div className="w-20 h-4 rounded-t-full bg-zinc-700 border-t-2 border-x-2 border-white/20" />
                </div>

                {/* Plus / next-to indicator */}
                <div className="text-white/30 text-xl font-black">+</div>

                {/* ID card mockup */}
                <div className="w-28 h-[4.5rem] bg-zinc-700 rounded-xl border-2 border-white/40 p-2 flex gap-2">
                    {/* ID photo area */}
                    <div className="w-10 h-full rounded-lg bg-zinc-600 border border-white/20 flex items-center justify-center shrink-0">
                        <div className="w-5 h-5 rounded-full bg-white/20" />
                    </div>
                    {/* ID text lines */}
                    <div className="flex-1 flex flex-col justify-center gap-1.5">
                        <div className="h-1.5 bg-white/40 rounded-full w-full" />
                        <div className="h-1.5 bg-white/25 rounded-full w-3/4" />
                        <div className="h-1.5 bg-white/25 rounded-full w-full" />
                        <div className="h-1 bg-white/15 rounded-full w-full mt-1" />
                        <div className="h-1 bg-white/15 rounded-full w-full" />
                    </div>
                </div>
            </div>

            {/* Example label */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full">
                <span className="text-[8px] font-black text-white uppercase tracking-[0.25em]">Example</span>
            </div>
        </div>
    );
}

export default function VerifyCapturePage() {
    const params = useParams();
    const { language, setLanguage } = useLanguage();
    const code = params?.code as string;
    const fr = language === 'fr';

    const [isMobile, setIsMobile] = useState(false);
    const [step, setStep] = useState<Step>('loading');
    const [documentType, setDocumentType] = useState('id_card');
    const [file, setFile] = useState<File | Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setIsMobile(
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
        );
    }, []);

    useEffect(() => {
        if (!code) {
            setErrorMessage(fr ? 'Lien invalide. Utilisez le lien envoyé sur votre appareil.' : 'No verification code provided. Please use the link sent to your device.');
            setStep('error');
            return;
        }
        validateSession();
    }, [code]);

    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    const validateSession = async () => {
        setStep('loading');
        setErrorMessage('');
        try {
            const res = await apiClient.client.get(`/verification/identity/session/${code}`);
            setStep(res.data.completed ? 'success' : 'select_doc');
        } catch {
            setErrorMessage(fr ? 'Lien invalide ou expiré. Générez-en un nouveau.' : 'Invalid or expired verification link. Please generate a new one.');
            setStep('error');
        }
    };

    const compressImage = async (f: File): Promise<Blob> =>
        new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                resolve(f);
            }, 3000);
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = ev => {
                const img = new Image();
                img.src = ev.target?.result as string;
                img.onload = () => {
                    clearTimeout(timer);
                    const MAX = 1800;
                    let w = img.width, h = img.height;
                    if (w > MAX || h > MAX) {
                        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                        else       { w = Math.round(w * MAX / h); h = MAX; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(b => { if (!b) { resolve(f); return; } resolve(b); }, 'image/jpeg', 0.88);
                };
                img.onerror = () => {
                    clearTimeout(timer);
                    resolve(f);
                };
            };
            reader.onerror = () => {
                clearTimeout(timer);
                resolve(f);
            };
        });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.files?.[0];
        if (!raw) { setStep('guide'); return; }
        const isHeic = /\.heic|\.heif$/i.test(raw.name) || raw.type === 'image/heic' || raw.type === 'image/heif';
        setStep('loading');
        try {
            const processed = isHeic ? raw : await compressImage(raw);
            setFile(processed);
            setPreviewUrl(URL.createObjectURL(processed));
            setStep('preview');
        } catch {
            setErrorMessage(fr ? 'Impossible de traiter l\'image. Réessayez.' : 'Failed to process image. Please try again.');
            setStep('guide');
        }
        if (e.target) e.target.value = '';
    };

    const handleUpload = async () => {
        if (!file) return;
        setStep('uploading');
        setUploadProgress(0);
        try {
            const formData = new FormData();
            formData.append('file', file, 'selfie_with_id.jpg');
            await apiClient.client.post('/verification/identity/upload-mobile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: { verification_code: code, document_type: documentType, side: 'selfie_with_id' },
                onUploadProgress: ev => setUploadProgress(Math.round((ev.loaded * 100) / (ev.total || 1))),
            });
            setStep('success');
        } catch (err: any) {
            setErrorMessage(err.response?.data?.detail || (fr ? 'Envoi échoué. Vérifiez votre connexion.' : 'Upload failed. Check your connection.'));
            setStep('preview');
        }
    };

    return (
        <div className="min-h-[100dvh] bg-white flex flex-col font-sans selection:bg-zinc-900/20 overflow-x-hidden">
            {/* Background blobs */}
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
                                {fr ? 'Traitement...' : 'Processing...'}
                            </p>
                        </motion.div>
                    )}

                    {/* Error */}
                    {step === 'error' && (
                        <motion.div key="error" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
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
                        <motion.div key="success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 bg-zinc-900 text-white rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-zinc-900 leading-none">
                                {fr ? 'Identité Vérifiée !' : 'Identity Verified!'}
                            </h1>
                            <p className="text-zinc-500 font-bold text-lg leading-relaxed mb-12">
                                {fr
                                    ? 'Votre identité a été confirmée. Vous pouvez fermer cette page.'
                                    : 'Your identity has been confirmed. You can close this page and return to your desktop.'}
                            </p>
                            <div className="w-full p-6 rounded-3xl bg-zinc-900 text-white shadow-xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                    {fr ? 'Synchronisation bureau active' : 'Desktop sync active'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 1 — Select document type */}
                    {step === 'select_doc' && (
                        <motion.div key="select_doc" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="w-full space-y-6">
                            <div>
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-zinc-900 leading-none">
                                    {fr ? 'Votre document' : 'Your document'}
                                </h2>
                                <p className="text-zinc-500 font-medium">
                                    {fr ? 'Quel document allez-vous utiliser ?' : 'Which document will you use?'}
                                </p>
                            </div>

                            <div className="grid gap-3">
                                {DOCUMENT_TYPES.map(doc => (
                                    <button key={doc.value} onClick={() => setDocumentType(doc.value)}
                                        className={`p-5 rounded-[2rem] border-2 text-left transition-all flex items-center justify-between ${
                                            documentType === doc.value
                                                ? 'border-zinc-900 bg-zinc-900 text-white'
                                                : 'border-zinc-100 bg-white hover:border-zinc-300'
                                        }`}>
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">{doc.icon}</span>
                                            <div>
                                                <div className={`font-black text-[10px] uppercase tracking-widest mb-0.5 ${documentType === doc.value ? 'text-white' : 'text-zinc-900'}`}>
                                                    {fr ? doc.labelFr : doc.labelEn}
                                                </div>
                                                <div className={`text-xs font-medium ${documentType === doc.value ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                    {fr ? doc.descFr : doc.descEn}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${documentType === doc.value ? 'border-white bg-white' : 'border-zinc-200'}`}>
                                            {documentType === doc.value && <div className="w-1.5 h-1.5 rounded-full bg-zinc-900" />}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <button onClick={() => setStep('guide')}
                                className="w-full bg-zinc-900 text-white font-black py-6 rounded-[2rem] shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-4 text-xs uppercase tracking-[0.4em]">
                                {fr ? 'Continuer' : 'Continue'} <ArrowRight className="w-5 h-5" />
                            </button>
                        </motion.div>
                    )}

                    {/* Step 2 — Guide: show example */}
                    {step === 'guide' && (
                        <motion.div key="guide" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="w-full space-y-6">
                            <div>
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-zinc-900 leading-none">
                                    {fr ? 'Prêt ?' : 'Ready?'}
                                </h2>
                                <p className="text-zinc-500 font-medium">
                                    {fr
                                        ? `Tenez votre ${DOCUMENT_TYPES.find(d => d.value === documentType)?.labelFr ?? 'document'} à côté de votre visage`
                                        : `Hold your ${DOCUMENT_TYPES.find(d => d.value === documentType)?.labelEn ?? 'document'} next to your face`}
                                </p>
                            </div>

                            <IdSelfieIllustration />

                            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
                                    {fr ? 'Conseils' : 'Tips'}
                                </p>
                                {(fr ? [
                                    'Tenez le document bien visible à côté de votre visage',
                                    'Bonne lumière — évitez les reflets sur le document',
                                    'Les deux visages (le vôtre et celui du document) doivent être nets',
                                    'Ne couvrez pas de texte ou de photo avec vos doigts',
                                ] : [
                                    'Hold the document clearly visible beside your face',
                                    'Good lighting — avoid glare on the document',
                                    'Both faces (yours and the one on the document) must be clear',
                                    'Don\'t cover any text or photo with your fingers',
                                ]).map((tip, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                                        <p className="text-sm font-medium text-zinc-600">{tip}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setStep('select_doc')}
                                    className="flex-1 py-5 bg-zinc-100 text-zinc-900 font-black rounded-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform">
                                    {fr ? 'Retour' : 'Back'}
                                </button>
                                <button onClick={() => { setStep('capture'); setTimeout(() => fileInputRef.current?.click(), 100); }}
                                    className="flex-[2] bg-zinc-900 text-white font-black py-5 rounded-2xl shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-xs uppercase tracking-[0.4em]">
                                    <Camera className="w-5 h-5" />
                                    {fr ? 'Prendre la photo' : 'Take Photo'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Preview */}
                    {step === 'preview' && previewUrl && (
                        <motion.div key="preview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="flex-1 flex flex-col">
                            <div className="mb-4">
                                <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-900 leading-none">
                                    {fr ? 'Vérifiez la photo' : 'Check the photo'}
                                </h2>
                                <p className="text-zinc-500 font-medium text-sm mt-1">
                                    {fr ? 'Votre visage et votre document sont-ils nets ?' : 'Are both your face and document clear?'}
                                </p>
                            </div>
                            <div className="relative flex-1 bg-zinc-100 rounded-[2.5rem] overflow-hidden shadow-inner mb-6 border border-zinc-200">
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                            </div>
                            {errorMessage && (
                                <div className="bg-zinc-900 text-white p-4 rounded-2xl mb-4 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl text-center">
                                    {errorMessage}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => { setFile(null); setPreviewUrl(null); setErrorMessage(''); setStep('guide'); setTimeout(() => fileInputRef.current?.click(), 100); }}
                                    className="flex items-center justify-center gap-3 bg-zinc-100 text-zinc-900 font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform">
                                    <RefreshCcw className="w-4 h-4" />
                                    {fr ? 'Reprendre' : 'Retake'}
                                </button>
                                <button onClick={handleUpload}
                                    className="flex items-center justify-center gap-3 bg-zinc-900 text-white font-black py-5 rounded-2xl shadow-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform">
                                    {fr ? 'Envoyer' : 'Submit'} <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Uploading */}
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
                                {fr ? 'Vérification...' : 'Verifying...'}
                            </h3>
                            <p className="text-zinc-500 font-medium">
                                {fr ? 'Analyse en cours...' : 'Analysing your photo...'}
                            </p>
                        </motion.div>
                    )}

                </AnimatePresence>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/heic,image/heif"
                    {...(isMobile ? { capture: "environment" } : {})}
                    className="hidden"
                />
            </main>
        </div>
    );
}
