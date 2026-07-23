'use client';

import { useState, useRef, useEffect, use } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Video, CheckCircle2, Shield, MapPin, ChevronRight, WifiOff, Info, Play } from 'lucide-react';

interface Room {
    index: number;
    label: string;
}

export default function CapturePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const { showToast } = useToast();
    const { language, setLanguage } = useLanguage();
    const fr = language === 'fr';
    const [step, setStep] = useState<'intro' | 'preview' | 'uploading' | 'success' | 'finished'>('intro');
    const [files, setFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [isSessionVerified, setIsSessionVerified] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [sessionDetails, setSessionDetails] = useState<any>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [loadError, setLoadError] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleOnline = () => { setIsOffline(false); syncOfflineQueue(); };
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setIsOffline(!navigator.onLine);
        loadSessionDetails();
        requestLocation();

        let unsubscribe: (() => void) | null = null;
        import('@/lib/backgroundSync')
            .then(({ backgroundSyncManager }) => {
                unsubscribe = backgroundSyncManager.subscribe((count: number) => {
                    setPendingCount(count);
                });
            })
            .catch(() => {
                // IndexedDB unavailable (e.g. mobile private browsing) — offline queue disabled
                console.warn('Offline queue unavailable — uploads will not be queued for retry.');
            });

        return () => {
            unsubscribe?.();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const requestLocation = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            () => { /* silently ignore denied/unavailable */ },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    const loadSessionDetails = async () => {
        try {
            const res = await apiClient.client.get(`/properties/media-sessions/${code}`);
            setSessionDetails(res.data);
            setLoadError(false);
            if (res.data.location_verified) setIsSessionVerified(true);
            if (res.data.rooms) setRooms(res.data.rooms);
        } catch (e) {
            console.error(e);
            setLoadError(true);
        }
    };

    const syncOfflineQueue = async () => {
        const { backgroundSyncManager } = await import('@/lib/backgroundSync');
        await backgroundSyncManager.sync();
        if (pendingCount > 0) {
            showToast(fr ? 'Envoi des photos en attente…' : 'Sending your pending photos…', 'info');
        }
    };

    const [uploadProgress, setUploadProgress] = useState(0);

    const compressImage = async (f: File): Promise<File> => {
        if (f.type.startsWith('video')) return f;
        return new Promise((resolve) => {
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
                    canvas.toBlob(b => {
                        if (b) {
                            resolve(new File([b], f.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg' }));
                        } else {
                            resolve(f);
                        }
                    }, 'image/jpeg', 0.88);
                };
                img.onerror = () => resolve(f);
            };
            reader.onerror = () => resolve(f);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const rawFiles = Array.from(e.target.files);
            const validFiles: File[] = [];

            const hasExistingVideo = sessionDetails?.has_video || files.some(f => f.type.startsWith('video'));

            for (const f of rawFiles) {
                const isVideo = f.type.startsWith('video');
                if (isVideo) {
                    if (hasExistingVideo || validFiles.some(vf => vf.type.startsWith('video'))) {
                        showToast(
                            fr ? 'Une seule vidéo de présentation est autorisée par annonce.' : 'Only 1 video walkthrough allowed per listing.',
                            'error'
                        );
                        continue;
                    }
                    if (f.size > 100 * 1024 * 1024) {
                        showToast(
                            fr ? 'La vidéo dépasse la limite de 100 Mo.' : 'Video exceeds 100MB size limit.',
                            'error'
                        );
                        continue;
                    }
                    validFiles.push(f);
                } else {
                    if (f.size > 15 * 1024 * 1024) {
                        showToast(
                            fr ? "L'image dépasse la limite de 15 Mo." : 'Image exceeds 15MB limit.',
                            'error'
                        );
                        continue;
                    }
                    const compressed = await compressImage(f);
                    validFiles.push(compressed);
                }
            }

            if (validFiles.length > 0) {
                setFiles(prev => [...prev, ...validFiles]);
                setPreviewUrls(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);
                setStep('preview');
            }
        }
        if (e.target) e.target.value = '';
    };

    const handleUpload = async () => {
        if (files.length === 0 || !code) return;
        setStep('uploading');
        setUploadProgress(0);
        let successCount = 0;
        const total = files.length;

        for (let idx = 0; idx < total; idx++) {
            const file = files[idx];
            const metadataObj = {
                latitude: location?.lat || null,
                longitude: location?.lng || null,
                gps_accuracy: location?.accuracy || null,
                captured_at: new Date().toISOString(),
                media_type: file.type.startsWith('video') ? 'video' : 'photo',
                room_index: selectedRoom?.index ?? null,
                room_label: selectedRoom?.label ?? null,
            };

            if (isOffline) {
                try {
                    const { backgroundSyncManager } = await import('@/lib/backgroundSync');
                    await backgroundSyncManager.enqueueAndSync(
                        file,
                        JSON.stringify(metadataObj),
                        code,
                        file.type.startsWith('video') ? 'video' : 'photo'
                    );
                    successCount++;
                } catch {
                    showToast(
                        fr ? 'Impossible de mettre le média en attente. Réessayez une fois reconnecté.' : 'Offline queueing unavailable. Please try again when online.',
                        'error'
                    );
                }
                setUploadProgress(Math.round(((idx + 1) * 100) / total));
                continue;
            }

            try {
                const response = await apiClient.uploadPropertyMedia(file, JSON.stringify(metadataObj), code);
                if (response.gps_verified) setIsSessionVerified(true);
                successCount++;
            } catch (err: any) {
                const detail = err?.response?.data?.detail;
                const msg = Array.isArray(detail)
                    ? detail.map((d: any) => (typeof d === 'string' ? d : d.msg || d.detail || JSON.stringify(d))).join(', ')
                    : (typeof detail === 'string' ? detail
                        : (fr ? "L'envoi a échoué. Le fichier sera renvoyé automatiquement." : 'Upload failed. The file will be retried automatically.'));
                showToast(msg === 'Field required' ? (fr ? 'Formulaire incomplet. Veuillez compléter tous les champs.' : 'Required field missing. Please check your data.') : msg, 'error');
                // Queue for offline retry — best-effort, never crash on queue failure
                try {
                    const { backgroundSyncManager } = await import('@/lib/backgroundSync');
                    await backgroundSyncManager.enqueueAndSync(
                        file,
                        JSON.stringify(metadataObj),
                        code,
                        file.type.startsWith('video') ? 'video' : 'photo'
                    );
                } catch {
                    // IndexedDB unavailable — skip offline queueing silently
                }
            }
            setUploadProgress(Math.round(((idx + 1) * 100) / total));
        }

        if (isOffline) {
            showToast(
                fr
                    ? `${successCount} média${successCount !== 1 ? 's' : ''} en attente — envoi automatique dès le retour du réseau.`
                    : `${successCount} file${successCount !== 1 ? 's' : ''} queued — they will upload as soon as you're back online.`,
                'info'
            );
            setStep('success');
        } else if (successCount > 0) {
            setStep('success');
        } else {
            setStep('preview');
        }
    };

    return (
        <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-900/10">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 pointer-events-none"></div>

            <main className="max-w-xl mx-auto px-6 py-12 flex flex-col min-h-screen relative z-10">
                <header className="flex items-center justify-between mb-16">
                    <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center rounded-2xl">
                        <Camera className="text-white w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-3">
                        {pendingCount > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg">
                                <WifiOff className="w-3 h-3" />
                                {pendingCount} {fr ? 'en attente' : 'pending'}
                            </div>
                        )}
                        <button
                            onClick={() => setLanguage(fr ? 'en' : 'fr')}
                            className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-xs font-black uppercase tracking-wider text-zinc-900 transition-colors"
                        >
                            {fr ? 'EN' : 'FR'}
                        </button>
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {loadError && (
                        <motion.div
                            key="load-error"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
                        >
                            <div className="space-y-4">
                                <h1 className="text-4xl font-black tracking-tighter uppercase leading-[0.9]">
                                    {fr ? 'Lien invalide ou expiré' : 'Invalid or expired link'}
                                </h1>
                                <p className="text-lg text-zinc-500 font-medium leading-relaxed max-w-sm">
                                    {fr
                                        ? 'Cette session de photos/vidéo est introuvable. Le lien a peut-être expiré — demandez-en un nouveau depuis votre annonce.'
                                        : 'This capture session could not be found. The link may have expired — please request a new one from your listing.'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {!loadError && step === 'intro' && (
                        <motion.div
                            key="intro"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex-1 flex flex-col"
                        >
                            <div className="space-y-6 mb-10">
                                <div className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                                    {fr ? 'Médias du logement' : 'Property media'}
                                </div>
                                <h1 className="text-5xl font-black tracking-tighter uppercase leading-[0.9]">
                                    {fr ? <>Capturez<br />sur place</> : <>Capture<br />on-site</>}
                                </h1>
                                <p className="text-xl text-zinc-500 font-medium leading-relaxed">
                                    {fr
                                        ? "Prenez des photos et vidéos du logement depuis le logement lui-même. Votre position géolocalisée certifie votre annonce."
                                        : 'Capture photos and video tours while you are at the property. Your GPS location certifies your listing.'}
                                </p>
                            </div>

                            {sessionDetails?.target_address && (
                                <div className="glass-card !p-6 rounded-[2.5rem] border-zinc-100 mb-8 flex items-center gap-5">
                                    <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center shrink-0">
                                        <MapPin className="text-zinc-500 w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">
                                            {fr ? 'Adresse du bien' : 'Property address'}
                                        </div>
                                        <div className="text-sm font-black uppercase truncate max-w-[200px]">{sessionDetails.target_address}</div>
                                    </div>
                                </div>
                            )}

                            {/* Dedicated Video Tour Guidance UI */}
                            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white p-8 rounded-[2.5rem] shadow-xl mb-10 border border-zinc-700/50 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                        <Video className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 block">
                                            {fr ? 'Option recommandée' : 'Recommended Feature'}
                                        </span>
                                        <h3 className="text-lg font-black uppercase tracking-tight text-white">
                                            {fr ? 'Vidéo de présentation (Tour Virtuel)' : 'Video Tour Walkthrough'}
                                        </h3>
                                    </div>
                                </div>
                                <p className="text-sm text-zinc-300 font-medium leading-relaxed mb-6">
                                    {fr
                                        ? 'Enregistrez une vidéo continue en marchant depuis l\'entrée pour montrer l\'agencement, les pièces et la luminosité (Max 100 Mo, 1 vidéo par annonce).'
                                        : 'Record a continuous video walkthrough starting from the main entrance, walking through all rooms to highlight room layout, space, and natural light (Max 100MB, 1 video per listing).'}
                                </p>
                                <button
                                    onClick={() => videoInputRef.current?.click()}
                                    className="w-full py-4 bg-white text-zinc-900 text-xs font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-zinc-100 transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95"
                                >
                                    <Video className="w-4 h-4 text-zinc-900" />
                                    {fr ? 'Enregistrer une vidéo' : 'Record Video Tour'}
                                </button>
                            </div>

                            {rooms.length > 0 && (
                                <div className="space-y-6 mb-10">
                                    <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                                        {fr ? 'Quelle pièce photographiez-vous ?' : 'Which room are you photographing?'}
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        {rooms.map(room => (
                                            <button
                                                key={room.index}
                                                onClick={() => setSelectedRoom(room)}
                                                className={`p-6 rounded-[2.5rem] border-2 text-left transition-all ${selectedRoom?.index === room.index ? 'bg-zinc-900 border-zinc-900 shadow-2xl' : 'border-zinc-100'}`}
                                            >
                                                <div className={`text-xs font-black uppercase tracking-widest mb-1 ${selectedRoom?.index === room.index ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                    {fr ? 'Pièce' : 'Room'}
                                                </div>
                                                <div className={`text-sm font-black uppercase ${selectedRoom?.index === room.index ? 'text-white' : 'text-zinc-900'}`}>{room.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-auto pt-4 space-y-4">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-7 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4"
                                >
                                    <Camera className="w-4 h-4" />
                                    {fr ? "Prendre des photos" : 'Take Room Photos'}
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'preview' && (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col"
                        >
                            <div className="space-y-8 flex-1">
                                <div className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                                    {fr ? 'Vérifiez vos médias' : 'Check your media'}
                                </div>
                                <div className="grid grid-cols-1 gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {previewUrls.map((url, i) => (
                                        <div key={i} className="aspect-[4/3] rounded-[3rem] overflow-hidden bg-zinc-100 relative">
                                            {files[i].type.startsWith('video') ? (
                                                <video src={url} className="w-full h-full object-cover" controls playsInline muted />
                                            ) : (
                                                <img src={url} className="w-full h-full object-cover" alt={fr ? 'Aperçu' : 'Preview'} />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                                            <div className="absolute bottom-6 left-6 text-white text-xs font-black uppercase tracking-widest pointer-events-none flex items-center gap-2">
                                                {files[i].type.startsWith('video') ? (
                                                    <span className="px-3 py-1 bg-white text-zinc-900 rounded-full font-extrabold flex items-center gap-1.5">
                                                        <Video className="w-3 h-3" /> {fr ? 'Vidéo Tour' : 'Video Tour'}
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full">
                                                        Photo &mdash; {i + 1}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-10 space-y-4">
                                <button
                                    onClick={handleUpload}
                                    className="w-full py-8 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl hover:scale-105 active:scale-95 transition-all"
                                >
                                    {fr ? 'Envoyer les médias' : 'Send media files'}
                                </button>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="py-4 bg-zinc-100 text-zinc-900 text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Camera className="w-4 h-4" />
                                        {fr ? "+ Photos" : '+ Photos'}
                                    </button>
                                    <button
                                        onClick={() => videoInputRef.current?.click()}
                                        className="py-4 bg-zinc-100 text-zinc-900 text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Video className="w-4 h-4" />
                                        {fr ? "+ Vidéo" : '+ Video'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 'uploading' && (
                        <motion.div
                            key="uploading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center space-y-12"
                        >
                            <div className="relative w-28 h-28 flex items-center justify-center">
                                <div className="w-24 h-24 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin absolute" />
                                <span className="text-xl font-black text-zinc-900 z-10">{uploadProgress}%</span>
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-3xl font-black uppercase tracking-tighter">
                                    {fr ? 'Envoi en cours' : 'Sending'}
                                </h2>
                                <p className="text-zinc-500 font-medium">
                                    {fr ? 'Vos médias sont transmis de manière sécurisée…' : 'Your media files are being uploaded securely…'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {step === 'success' && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center space-y-12"
                        >
                            <div className="w-32 h-32 bg-zinc-900 rounded-[3rem] flex items-center justify-center shadow-2xl shadow-zinc-900/20">
                                <CheckCircle2 className="w-16 h-16 text-white" />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-5xl font-black tracking-tighter uppercase">
                                    {fr ? 'Médias bien reçus' : 'Media received'}
                                </h2>
                                <p className="text-xl text-zinc-500 font-medium max-w-xs mx-auto">
                                    {fr
                                        ? 'Vos médias ont été ajoutés au dossier du logement.'
                                        : 'Your photos and video have been added to the property file.'}
                                </p>
                            </div>
                            <div className="pt-12 flex flex-col gap-6 w-full">
                                <button
                                    onClick={() => { setFiles([]); setPreviewUrls([]); setStep('intro'); }}
                                    className="w-full py-8 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl"
                                >
                                    {fr ? "Capturer d'autres médias" : 'Capture more media'}
                                </button>
                                <button
                                    onClick={() => setStep('finished')}
                                    className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400"
                                >
                                    {fr ? "J'ai terminé" : "I'm done"}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'finished' && (
                        <motion.div
                            key="finished"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex-1 flex flex-col items-center justify-center text-center space-y-12"
                        >
                            <div className="w-32 h-32 bg-zinc-900 rounded-[3rem] flex items-center justify-center shadow-2xl shadow-zinc-900/20">
                                <CheckCircle2 className="w-16 h-16 text-white" />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-5xl font-black tracking-tighter uppercase">
                                    {fr ? "C'est terminé" : 'All done'}
                                </h2>
                                <p className="text-xl text-zinc-500 font-medium max-w-xs mx-auto">
                                    {fr
                                        ? 'Merci ! Vous pouvez fermer cette page et reprendre sur votre ordinateur.'
                                        : 'Thank you! You can close this page and continue on your computer.'}
                                </p>
                            </div>
                            <button
                                onClick={() => { setFiles([]); setPreviewUrls([]); setStep('intro'); }}
                                className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400"
                            >
                                {fr ? "Reprendre d'autres photos/vidéos" : 'Take more photos/videos'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Hidden Photo Camera Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                />

                {/* Hidden Dedicated Video Camera Input */}
                <input
                    type="file"
                    ref={videoInputRef}
                    onChange={handleFileChange}
                    accept="video/*"
                    capture="environment"
                    className="hidden"
                />

                <footer className="mt-20 pt-12 border-t border-zinc-100 flex flex-col items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-zinc-300" />
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-300">
                            {fr ? 'Roomivo — Capture sécurisée' : 'Roomivo — Secure capture'}
                        </span>
                    </div>
                </footer>
            </main>
        </div>
    );
}
