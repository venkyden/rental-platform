'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, AlertCircle, Shield, RefreshCcw, ArrowRight, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';

type Step = 'loading' | 'select_doc' | 'guide' | 'preview' | 'uploading' | 'success' | 'error';
type CaptureSide = 'front' | 'back' | 'selfie';

const DOCUMENT_TYPES = [
    { value: 'passport', labelEn: 'Passport', labelFr: 'Passeport', descEn: 'Bio page with photo', descFr: 'Page biométrique avec photo', icon: '🌍', hasBack: false },
    { value: 'id_card', labelEn: 'National ID Card', labelFr: "Carte Nationale d'Identité", descEn: 'Front & back', descFr: 'Recto & verso', icon: '🆔', hasBack: true },
    { value: 'drivers_license', labelEn: "Driver's License", labelFr: 'Permis de conduire', descEn: 'Front & back', descFr: 'Recto & verso', icon: '🚗', hasBack: true },
    { value: 'residence_permit', labelEn: 'Residence Permit', labelFr: 'Titre de séjour', descEn: 'Front & back', descFr: 'Recto & verso', icon: '🏠', hasBack: true },
];

export default function VerifyCapturePage() {
    const params = useParams();
    const { language, setLanguage } = useLanguage();
    const code = params?.code as string;
    const fr = language === 'fr';

    const [step, setStep] = useState<Step>('loading');
    const [documentType, setDocumentType] = useState('id_card');
    const [currentSide, setCurrentSide] = useState<CaptureSide>('front');
    const [images, setImages] = useState<{ front: Blob | null, back: Blob | null, selfie: Blob | null }>({ front: null, back: null, selfie: null });
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = ev => {
                const img = new Image();
                img.src = ev.target?.result as string;
                img.onload = () => {
                    const MAX = 1800;
                    let w = img.width, h = img.height;
                    if (w > MAX || h > MAX) {
                        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                        else       { w = Math.round(w * MAX / h); h = MAX; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression failed')), 'image/jpeg', 0.88);
                };
            };
            reader.onerror = reject;
        });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.files?.[0];
        if (!raw) return;
        const isHeic = /\.heic|\.heif$/i.test(raw.name);
        setStep('loading');
        try {
            const processed = isHeic ? raw : await compressImage(raw);
            setImages(prev => ({ ...prev, [currentSide]: processed }));
            setPreviewUrl(URL.createObjectURL(processed));
            setStep('preview');
        } catch {
            setErrorMessage(fr ? 'Impossible de traiter l\'image. Réessayez.' : 'Failed to process image. Please try again.');
            setStep('guide');
        }
        if (e.target) e.target.value = '';
    };

    const handleNextCapture = () => {
        setPreviewUrl(null);
        setErrorMessage('');
        const doc = DOCUMENT_TYPES.find(d => d.value === documentType);
        
        if (currentSide === 'front') {
            if (doc?.hasBack) {
                setCurrentSide('back');
                setStep('guide');
            } else {
                setCurrentSide('selfie');
                setStep('guide');
            }
        } else if (currentSide === 'back') {
            setCurrentSide('selfie');
            setStep('guide');
        } else if (currentSide === 'selfie') {
            handleFinalUpload();
        }
    };

    const handleFinalUpload = async () => {
        if (!images.front || !images.selfie) return;
        setStep('uploading');
        setUploadProgress(0);
        try {
            const formData = new FormData();
            formData.append('document_type', documentType);
            formData.append('verification_code', code);
            formData.append('front', images.front, 'front.jpg');
            if (images.back) formData.append('back', images.back, 'back.jpg');
            formData.append('selfie', images.selfie, 'selfie.jpg');

            await apiClient.client.post('/verification/identity/upload-multi-mobile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: ev => setUploadProgress(Math.round((ev.loaded * 100) / (ev.total || 1))),
            });
            setStep('success');
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            if (detail?.code === 'BIOMETRIC_CONSENT_REQUIRED') {
                setErrorMessage(fr
                    ? "Consentement biométrique requis : retournez sur votre ordinateur."
                    : 'Biometric consent required: go back to your computer.');
            } else {
                setErrorMessage(typeof detail === 'string' && detail
                    ? detail
                    : (fr ? 'Envoi échoué. Vérifiez votre connexion.' : 'Upload failed. Check your connection.'));
            }
            setStep('preview');
        }
    };

    const getGuideContent = () => {
        if (currentSide === 'front') {
            return {
                title: fr ? 'Face Avant' : 'Front of ID',
                desc: fr ? 'Prenez en photo le recto de votre document' : 'Take a clear photo of the front of your document',
                tips: fr ? ['Évitez les reflets', 'Le texte doit être lisible', 'Placez sur une surface plane', 'Les 4 coins doivent être visibles'] : ['Avoid glare', 'Text must be clearly readable', 'Place on a flat surface', 'Ensure all 4 corners are visible']
            };
        } else if (currentSide === 'back') {
            return {
                title: fr ? 'Face Arrière' : 'Back of ID',
                desc: fr ? 'Prenez en photo le verso de votre document' : 'Take a clear photo of the back of your document',
                tips: fr ? ['Évitez les reflets', 'Le texte doit être lisible', 'Placez sur une surface plane', 'Les 4 coins doivent être visibles'] : ['Avoid glare', 'Text must be clearly readable', 'Place on a flat surface', 'Ensure all 4 corners are visible']
            };
        } else {
            return {
                title: fr ? 'Prenez un Selfie' : 'Take a Selfie',
                desc: fr ? 'Regardez l\'objectif avec un éclairage clair' : 'Look at the camera with clear lighting',
                tips: fr ? ['Retirez vos lunettes', 'Restez dans la lumière', 'Regardez droit devant'] : ['Remove glasses', 'Stay well lit', 'Look straight ahead']
            };
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
                                {fr ? 'Traitement...' : 'Processing...'}
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
                                    ? 'Votre identité a été confirmée. Vous pouvez fermer cette page.'
                                    : 'Your identity has been confirmed. You can close this page and return to your desktop.'}
                            </p>
                            <div className="w-full p-6 rounded-3xl bg-zinc-900 text-white shadow-xl mb-6">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                    {fr ? 'Synchronisation bureau active' : 'Desktop sync active'}
                                </p>
                            </div>
                            <button onClick={() => window.location.href = '/dashboard'}
                                className="w-full py-4 bg-zinc-100 text-zinc-900 font-black rounded-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform">
                                {fr ? 'Retourner au tableau de bord' : 'Return to Dashboard'}
                            </button>
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

                            <button onClick={() => { setCurrentSide('front'); setStep('guide'); }}
                                className="w-full bg-zinc-900 text-white font-black py-6 rounded-[2rem] shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-4 text-xs uppercase tracking-[0.4em]">
                                {fr ? 'Continuer' : 'Continue'} <ArrowRight className="w-5 h-5" />
                            </button>
                        </motion.div>
                    )}

                    {/* Guide: show example */}
                    {step === 'guide' && (
                        <motion.div key="guide" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="w-full space-y-6 flex-1 flex flex-col justify-center">
                            
                            {/* Step indicators */}
                            <div className="flex justify-center gap-2 mb-8">
                                <div className={`h-1.5 flex-1 rounded-full ${currentSide === 'front' ? 'bg-zinc-900' : 'bg-zinc-200'}`} />
                                {DOCUMENT_TYPES.find(d => d.value === documentType)?.hasBack && (
                                    <div className={`h-1.5 flex-1 rounded-full ${currentSide === 'back' ? 'bg-zinc-900' : 'bg-zinc-200'}`} />
                                )}
                                <div className={`h-1.5 flex-1 rounded-full ${currentSide === 'selfie' ? 'bg-zinc-900' : 'bg-zinc-200'}`} />
                            </div>

                            <div>
                                <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-zinc-900 leading-none">
                                    {getGuideContent().title}
                                </h2>
                                <p className="text-zinc-500 font-medium text-lg">
                                    {getGuideContent().desc}
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-3 mt-8">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
                                    {fr ? 'Conseils' : 'Tips'}
                                </p>
                                {getGuideContent().tips.map((tip, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                                        <p className="text-sm font-medium text-zinc-600">{tip}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-10">
                                <button onClick={() => setTimeout(() => fileInputRef.current?.click(), 100)}
                                    className="w-full bg-zinc-900 text-white font-black py-5 rounded-2xl shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-xs uppercase tracking-[0.4em]">
                                    <Camera className="w-5 h-5" />
                                    {fr ? 'Prendre la photo' : 'Take Photo'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Preview */}
                    {step === 'preview' && previewUrl && (
                        <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col">
                            <div className="mb-4">
                                <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-900 leading-none">
                                    {fr ? 'Vérifiez la photo' : 'Check the photo'}
                                </h2>
                                <p className="text-zinc-500 font-medium text-sm mt-1">
                                    {fr ? 'La photo est-elle nette ?' : 'Is the photo clear?'}
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
                                <button onClick={() => { setPreviewUrl(null); setErrorMessage(''); setStep('guide'); setTimeout(() => fileInputRef.current?.click(), 100); }}
                                    className="flex items-center justify-center gap-3 bg-zinc-100 text-zinc-900 font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform">
                                    <RefreshCcw className="w-4 h-4" />
                                    {fr ? 'Reprendre' : 'Retake'}
                                </button>
                                <button onClick={handleNextCapture}
                                    className="flex items-center justify-center gap-3 bg-zinc-900 text-white font-black py-5 rounded-2xl shadow-2xl text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform">
                                    {currentSide === 'selfie' ? (fr ? 'Envoyer' : 'Submit') : (fr ? 'Suivant' : 'Next')} <ArrowRight className="w-4 h-4" />
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
                                {fr ? 'Analyse en cours...' : 'Analysing your identity...'}
                            </p>
                        </motion.div>
                    )}

                </AnimatePresence>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/heic,image/heif"
                    capture={currentSide === 'selfie' ? 'user' : 'environment'}
                    className="hidden"
                />
            </main>
        </div>
    );
}
