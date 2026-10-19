'use client';

import { useState, useRef, useEffect, use } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Video, CheckCircle2, Shield, MapPin, ChevronRight, WifiOff, Info, Play } from 'lucide-react';
import TapList from '@/components/walkthrough/TapList';
import FlatmatesFields from '@/components/walkthrough/FlatmatesFields';
import { flattenAnswers, itemsFor, spaceKeys, spaceLabel, type Flatmates, type SpaceAnswers } from '@/lib/walkthrough';
import { enqueue, failureOf, parseQueue, targetOf, withoutSent, withoutTarget, type AnswersBody } from '@/lib/walkthroughQueue';

interface Room {
    index: number;
    surface?: number | null;
}

export default function CapturePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const { showToast } = useToast();
    const { language, setLanguage, t } = useLanguage();
    const fr = language === 'fr';
    const [step, setStep] = useState<'intro' | 'preview' | 'uploading' | 'success' | 'finished' | 'answers' | 'space'>('intro');
    const [files, setFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [isSessionVerified, setIsSessionVerified] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [sessionDetails, setSessionDetails] = useState<any>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    // 'common' = an explicit property-level/common-area choice. Kept distinct from
    // null (= nothing chosen yet) so photos can never upload untagged by accident:
    // untagged uploads can't satisfy the per-room publish gate and there is no
    // endpoint to re-tag them afterwards.
    const [selectedRoom, setSelectedRoom] = useState<Room | 'common' | null>(null);
    const [loadError, setLoadError] = useState(false);

    // Quick answers (the tap lists). `openSpace` is a space key or 'flatmates'.
    const [walk, setWalk] = useState<{ bedrooms: number; shared: boolean } | null>(null);
    const [answers, setAnswers] = useState<Record<string, SpaceAnswers>>({});
    const [flatmates, setFlatmates] = useState<Flatmates>({});
    const [openSpace, setOpenSpace] = useState<string | null>(null);
    const [draft, setDraft] = useState<SpaceAnswers>({});
    const [flatmatesDraft, setFlatmatesDraft] = useState<Flatmates>({});
    const [savingAnswers, setSavingAnswers] = useState(false);
    const [waitingAnswers, setWaitingAnswers] = useState(0);
    const pendingKey = `roomivo-walkthrough-pending:${code}`;
    // The sending run in progress, if any. A new save waits for it, so an older waiting
    // answer can never reach the server after a newer one.
    const flushRun = useRef<Promise<void> | null>(null);
    // Sending can start before the stored language has loaded and finish after it, so the
    // messages it shows read the current translator and room count, not the first render's.
    const tNow = useRef(t);
    tNow.current = t;
    const walkNow = useRef(walk);
    walkNow.current = walk;
    // A request that hangs on a weak connection must end, so the answer can wait on the phone.
    const ANSWER_TIMEOUT_MS = 15000;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleOnline = () => { setIsOffline(false); syncOfflineQueue(); flushPendingAnswers(); };
        const handleOffline = () => setIsOffline(true);
        // A phone that was never "offline" (a timeout, a server error) gets no online event.
        const handleVisible = () => { if (document.visibilityState === 'visible') flushPendingAnswers(); };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        document.addEventListener('visibilitychange', handleVisible);
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
            document.removeEventListener('visibilitychange', handleVisible);
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
            if (res.data.walkthrough) {
                applyWalkthrough(res.data.walkthrough);
                flushPendingAnswers();
            }
        } catch (e) {
            console.error(e);
            setWaitingAnswers(readPendingAnswers().length);
            setLoadError(true);
        }
    };

    const applyWalkthrough = (data: any) => {
        setWalk({ bedrooms: Math.max(1, Number(data.bedrooms) || 1), shared: !!data.is_colocation });
        // Answers saved on this phone but not yet sent stay on screen until they are.
        const waiting = readPendingAnswers();
        const spaces = flattenAnswers(data.answers);
        let household: Flatmates = {};
        if (data.flatmates) {
            const { answered_at: _answeredAt, ...rest } = data.flatmates as Flatmates;
            household = rest;
        }
        for (const body of waiting) {
            if (body.space) spaces[body.space] = body.answers ?? {};
            if (body.flatmates) household = body.flatmates;
        }
        setAnswers(spaces);
        setFlatmates(household);
        setWaitingAnswers(waiting.length);
    };

    const readPendingAnswers = (): AnswersBody[] => {
        try {
            return parseQueue(localStorage.getItem(pendingKey));
        } catch {
            return [];
        }
    };

    const writePendingAnswers = (queue: AnswersBody[]) => {
        try {
            if (queue.length) localStorage.setItem(pendingKey, JSON.stringify(queue));
            else localStorage.removeItem(pendingKey);
            setWaitingAnswers(queue.length);
            return true;
        } catch {
            return false;
        }
    };

    const answerLabel = (target: string, bedrooms: number) =>
        target === 'flatmates'
            ? tNow.current('walkthrough.flatmates.title', undefined, 'Who lives here')
            : spaceLabel(tNow.current, target, bedrooms);

    // Send what is waiting on this phone, oldest first, one run at a time. A connection or
    // server problem stops the run and keeps everything; an answer the server refuses is
    // dropped and the landlord is told which space to answer again.
    const flushPendingAnswers = (): Promise<void> => {
        if (flushRun.current) return flushRun.current;
        if (!readPendingAnswers().length) return Promise.resolve();
        flushRun.current = sendWaitingAnswers().finally(() => { flushRun.current = null; });
        return flushRun.current;
    };

    const sendWaitingAnswers = async () => {
        const refused: string[] = [];
        let latest: any = null;
        let expired = false;
        for (let body = readPendingAnswers()[0]; body; body = readPendingAnswers()[0]) {
            let kept: boolean;
            try {
                const res = await apiClient.client.put(`/properties/media-sessions/${code}/answers`, body, { timeout: ANSWER_TIMEOUT_MS });
                latest = res.data;
                kept = writePendingAnswers(withoutSent(readPendingAnswers(), body));
            } catch (err: any) {
                const failure = failureOf(err?.response?.status);
                if (failure === 'retry-later') break;
                if (failure === 'link-expired') { expired = true; break; }
                console.error('[capture] a saved answer was refused', err.response?.data);
                refused.push(targetOf(body));
                kept = writePendingAnswers(withoutSent(readPendingAnswers(), body));
            }
            // Storage that cannot be written would hand back the same entry forever.
            if (!kept) break;
        }
        if (latest) applyWalkthrough(latest);
        if (refused.length) {
            const bedrooms = latest ? Math.max(1, Number(latest.bedrooms) || 1) : walkNow.current?.bedrooms ?? 1;
            showToast(tNow.current('walkthrough.capture.notAccepted', { spaces: refused.map((r) => answerLabel(r, bedrooms)).join(', ') },
                `These answers were not accepted. Please answer again: ${refused.join(', ')}`), 'error', 8000);
            if (!latest) loadSessionDetails();
        }
        if (expired) setLoadError(true);
    };

    const openAnswers = (spaceKey: string) => {
        setOpenSpace(spaceKey);
        if (spaceKey === 'flatmates') setFlatmatesDraft(flatmates);
        else setDraft(answers[spaceKey] ?? {});
        setStep('space');
    };

    const saveAnswers = async () => {
        if (!openSpace) return;
        const body: AnswersBody = openSpace === 'flatmates' ? { flatmates: flatmatesDraft } : { space: openSpace, answers: draft };
        setSavingAnswers(true);
        try {
            if (flushRun.current) await flushRun.current;
            // Kept on the phone first, replacing any older answer for this space, so that a
            // reload or a lost connection mid-request can never send the older one instead.
            const kept = writePendingAnswers(enqueue(readPendingAnswers(), body));
            try {
                const res = await apiClient.client.put(`/properties/media-sessions/${code}/answers`, body, { timeout: ANSWER_TIMEOUT_MS });
                writePendingAnswers(withoutSent(readPendingAnswers(), body));
                applyWalkthrough(res.data);
                showToast(t('walkthrough.capture.saved', undefined, 'Answers saved'), 'success', 2000);
                setStep('answers');
                flushPendingAnswers();
            } catch (err: any) {
                const failure = failureOf(err?.response?.status);
                if (failure === 'retry-later' && kept) {
                    if (body.space) setAnswers((prev) => ({ ...prev, [body.space as string]: body.answers ?? {} }));
                    if (body.flatmates) setFlatmates(body.flatmates);
                    showToast(t('walkthrough.capture.savedOffline', undefined, 'Saved on this phone. It will be sent as soon as the connection allows.'), 'info');
                    setStep('answers');
                } else if (failure === 'retry-later') {
                    showToast(t('walkthrough.capture.cannotStore', undefined, 'Could not send, and this phone cannot keep answers. Please try again when the connection is back.'), 'error');
                } else if (failure === 'link-expired') {
                    setLoadError(true);
                } else {
                    writePendingAnswers(withoutSent(readPendingAnswers(), body));
                    console.error('[capture] could not save answers', err);
                    showToast(t('walkthrough.capture.saveError', undefined, 'Could not save. Please try again.'), 'error');
                }
            }
        } finally {
            setSavingAnswers(false);
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

    const checkIsVideo = (f: File) => {
        if (f.type && f.type.toLowerCase().startsWith('video')) return true;
        const name = (f.name || '').toLowerCase();
        return name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm') || name.endsWith('.m4v') || name.endsWith('.avi') || name.endsWith('.3gp');
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const rawFiles = Array.from(e.target.files);
            const validFiles: File[] = [];

            const hasExistingVideo = sessionDetails?.has_video || files.some(f => checkIsVideo(f));

            for (const f of rawFiles) {
                const isVideo = checkIsVideo(f);
                if (isVideo) {
                    if (hasExistingVideo || validFiles.some(vf => checkIsVideo(vf))) {
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
            const isVideo = checkIsVideo(file);
            const metadataObj = {
                latitude: location?.lat || null,
                longitude: location?.lng || null,
                gps_accuracy: location?.accuracy || null,
                captured_at: new Date().toISOString(),
                media_type: isVideo ? 'video' : 'photo',
                room_index: selectedRoom && selectedRoom !== 'common' ? selectedRoom.index : null,
                room_label: selectedRoom && selectedRoom !== 'common'
                    ? `${fr ? 'Chambre' : 'Room'} ${selectedRoom.index + 1}`
                    : null,
            };

            if (isOffline) {
                try {
                    const { backgroundSyncManager } = await import('@/lib/backgroundSync');
                    await backgroundSyncManager.enqueueAndSync(
                        file,
                        JSON.stringify(metadataObj),
                        code,
                        isVideo ? 'video' : 'photo'
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
                let userMsg = '';
                if (Array.isArray(detail)) {
                    userMsg = detail
                        .map((d: any) => {
                            if (typeof d === 'string') return d;
                            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
                            if (d.msg === 'Field required' || d.type === 'missing') {
                                return fr ? `Champ obligatoire manquant (${field || 'donnée'})` : `Missing required field: ${field || 'data'}`;
                            }
                            return d.msg || d.detail || JSON.stringify(d);
                        })
                        .join(', ');
                } else if (typeof detail === 'string') {
                    if (detail.includes('Field required')) {
                        userMsg = fr ? 'Donnée ou champ obligatoire manquant.' : 'Required field or file missing.';
                    } else {
                        userMsg = detail;
                    }
                } else {
                    userMsg = fr ? "L'envoi a échoué. Le fichier sera renvoyé automatiquement." : 'Upload failed. The file will be retried automatically.';
                }

                showToast(userMsg, 'error');
                // Queue for offline retry — best-effort, never crash on queue failure
                try {
                    const { backgroundSyncManager } = await import('@/lib/backgroundSync');
                    await backgroundSyncManager.enqueueAndSync(
                        file,
                        JSON.stringify(metadataObj),
                        code,
                        isVideo ? 'video' : 'photo'
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
                                {waitingAnswers > 0 && (
                                    <p className="text-base font-bold text-amber-700 max-w-sm" data-testid="answers-not-sent">
                                        {t('walkthrough.capture.linkExpired', { count: waitingAnswers },
                                            `Answers kept on this phone were not sent: ${waitingAnswers}. Please enter them again from a new link or on your listing's edit page.`)}
                                    </p>
                                )}
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
                                        {rooms.map(room => {
                                            const active = selectedRoom !== 'common' && selectedRoom?.index === room.index;
                                            return (
                                                <button
                                                    key={room.index}
                                                    onClick={() => setSelectedRoom(room)}
                                                    className={`p-6 rounded-[2.5rem] border-2 text-left transition-all ${active ? 'bg-zinc-900 border-zinc-900 shadow-2xl' : 'border-zinc-100'}`}
                                                >
                                                    <div className={`text-xs font-black uppercase tracking-widest mb-1 ${active ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                        {fr ? 'Pièce' : 'Room'}
                                                    </div>
                                                    <div className={`text-sm font-black uppercase ${active ? 'text-white' : 'text-zinc-900'}`}>
                                                        {fr ? 'Chambre' : 'Room'} {room.index + 1}
                                                        {room.surface ? ` — ${room.surface}m²` : ''}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={() => setSelectedRoom('common')}
                                            className={`p-6 rounded-[2.5rem] border-2 text-left transition-all ${selectedRoom === 'common' ? 'bg-zinc-900 border-zinc-900 shadow-2xl' : 'border-zinc-100'}`}
                                        >
                                            <div className={`text-xs font-black uppercase tracking-widest mb-1 ${selectedRoom === 'common' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                {fr ? 'Espace' : 'Space'}
                                            </div>
                                            <div className={`text-sm font-black uppercase ${selectedRoom === 'common' ? 'text-white' : 'text-zinc-900'}`}>
                                                {fr ? 'Parties communes' : 'Common area'}
                                            </div>
                                        </button>
                                    </div>
                                    {!selectedRoom && (
                                        <p className="text-xs font-bold text-amber-600">
                                            {fr
                                                ? 'Choisissez une pièce avant de photographier — chaque chambre doit avoir sa propre photo pour publier.'
                                                : 'Pick a room before shooting — each bedroom needs its own photo before you can publish.'}
                                        </p>
                                    )}
                                </div>
                            )}

                            {walk && (
                                <div className="mb-10 rounded-[2.5rem] border-2 border-zinc-100 p-6" data-testid="quick-answers-card">
                                    <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900">
                                        {t('walkthrough.capture.title', undefined, 'Quick answers')}
                                    </h3>
                                    <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-500">
                                        {t('walkthrough.capture.body', undefined, 'Students ask the same things about every home. Answer once here, room by room, and the listing shows it.')}
                                    </p>
                                    <button
                                        onClick={() => setStep('answers')}
                                        className="mt-5 w-full rounded-2xl bg-zinc-100 py-4 text-xs font-black uppercase tracking-[0.3em] text-zinc-900 transition-colors hover:bg-zinc-200"
                                    >
                                        {t('walkthrough.capture.open', undefined, 'Answer the questions')}
                                    </button>
                                </div>
                            )}

                            <div className="mt-auto pt-4 space-y-4">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={rooms.length > 0 && !selectedRoom}
                                    className="w-full py-7 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                                {walk && (
                                    <button
                                        onClick={() => { setFiles([]); setPreviewUrls([]); setStep('answers'); }}
                                        className="w-full rounded-[2.5rem] bg-zinc-100 py-6 text-xs font-black uppercase tracking-[0.3em] text-zinc-900"
                                    >
                                        {t('walkthrough.capture.open', undefined, 'Answer the questions')}
                                    </button>
                                )}
                                <button
                                    onClick={() => setStep('finished')}
                                    className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400"
                                >
                                    {fr ? "J'ai terminé" : "I'm done"}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {!loadError && step === 'answers' && walk && (
                        <motion.div key="answers" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col">
                            <div className="mb-8 space-y-3">
                                <h1 className="text-4xl font-black tracking-tighter uppercase leading-[0.9]">
                                    {t('walkthrough.capture.title', undefined, 'Quick answers')}
                                </h1>
                                <p className="text-base font-medium leading-relaxed text-zinc-500">
                                    {t('walkthrough.capture.pick', undefined, 'Pick a space. Leave a line empty if it does not apply.')}
                                </p>
                            </div>
                            {waitingAnswers > 0 && (
                                <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-amber-50 px-5 py-4" data-testid="answers-waiting">
                                    <span className="text-sm font-bold text-amber-800">
                                        {t('walkthrough.capture.waiting', { count: waitingAnswers }, `Answers waiting to be sent: ${waitingAnswers}`)}
                                    </span>
                                    <button
                                        onClick={() => flushPendingAnswers()}
                                        className="rounded-xl bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-zinc-900"
                                    >
                                        {t('walkthrough.capture.sendNow', undefined, 'Send now')}
                                    </button>
                                </div>
                            )}
                            <ul className="space-y-3" data-testid="answer-spaces">
                                {[...spaceKeys(walk.bedrooms), ...(walk.shared ? ['flatmates'] : [])].map((key) => {
                                    const total = key === 'flatmates' ? 0 : itemsFor(key).length;
                                    const done = key === 'flatmates'
                                        ? Object.keys(flatmates).length
                                        : Object.keys(answers[key] ?? {}).length;
                                    return (
                                        <li key={key}>
                                            <button
                                                onClick={() => openAnswers(key)}
                                                className="flex w-full items-center justify-between gap-4 rounded-[2rem] border-2 border-zinc-100 px-6 py-5 text-left transition-colors hover:border-zinc-900"
                                            >
                                                <span className="text-sm font-black uppercase tracking-wider text-zinc-900">
                                                    {key === 'flatmates' ? t('walkthrough.flatmates.title', undefined, 'Who lives here') : spaceLabel(t, key, walk.bedrooms)}
                                                </span>
                                                <span className="flex items-center gap-2 text-xs font-bold text-zinc-500">
                                                    {key !== 'flatmates' && t('walkthrough.progress', { done, total }, `${done} of ${total} answered`)}
                                                    {done > 0 && <CheckCircle2 className="h-4 w-4 text-zinc-900" aria-hidden="true" />}
                                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                            <div className="mt-auto pt-10">
                                <button
                                    onClick={() => setStep('intro')}
                                    className="w-full rounded-[2.5rem] bg-zinc-900 py-6 text-xs font-black uppercase tracking-[0.3em] text-white"
                                >
                                    {t('walkthrough.capture.backToPhotos', undefined, 'Back to photos')}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {!loadError && step === 'space' && walk && openSpace && (
                        <motion.div key={`space-${openSpace}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col">
                            <h1 className="mb-6 text-4xl font-black tracking-tighter uppercase leading-[0.9]">
                                {openSpace === 'flatmates' ? t('walkthrough.flatmates.title', undefined, 'Who lives here') : spaceLabel(t, openSpace, walk.bedrooms)}
                            </h1>
                            {openSpace === 'flatmates'
                                ? <FlatmatesFields value={flatmatesDraft} onChange={setFlatmatesDraft} />
                                : <TapList spaceKey={openSpace} value={draft} onChange={setDraft} />}
                            <div className="mt-auto space-y-4 pt-10">
                                <button
                                    onClick={saveAnswers}
                                    disabled={savingAnswers}
                                    className="w-full rounded-[2.5rem] bg-zinc-900 py-6 text-xs font-black uppercase tracking-[0.3em] text-white disabled:opacity-50"
                                >
                                    {t('walkthrough.capture.save', undefined, 'Save')}
                                </button>
                                <button
                                    onClick={() => setStep('answers')}
                                    className="w-full py-3 text-xs font-black uppercase tracking-[0.3em] text-zinc-500"
                                >
                                    {t('walkthrough.capture.back', undefined, 'Back')}
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
