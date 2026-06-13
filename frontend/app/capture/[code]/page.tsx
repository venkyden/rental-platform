'use client';

import { useState, useRef, useEffect, use } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, Shield, MapPin, ChevronRight, WifiOff } from 'lucide-react';

interface Room {
    index: number;
    label: string;
}

export default function CapturePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const { showToast } = useToast();
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
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!code) return;
        const handleOnline = () => {
            setIsOffline(false);
            syncOfflineQueue();
        };
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setIsOffline(!navigator.onLine);

        const loadSessionDetails = async () => {
            try {
                const res = await apiClient.client.get(`/properties/media-sessions/${code}`);
                setSessionDetails(res.data);
                if (res.data.location_verified) setIsSessionVerified(true);
                if (res.data.rooms) setRooms(res.data.rooms);
            } catch (e) {
                setError('Invalid or expired capture session code.');
                showToast('Invalid or expired capture session code.', 'error');
            }
        };

        loadSessionDetails();
        requestLocation();
        checkQueue();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [code]);

    const requestLocation = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                });
            },
            () => {
                // Permission denied or unavailable — uploads still work without GPS
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const checkQueue = async () => {
        const { offlineQueue } = await import('@/lib/offlineQueue');
        const count = await offlineQueue.count();
        setPendingCount(count);
    };

    const syncOfflineQueue = async () => {
        const { offlineQueue } = await import('@/lib/offlineQueue');
        const queue = await offlineQueue.getQueue();
        if (queue.length === 0) return;

        let synced = 0;
        for (const item of queue) {
            try {
                await apiClient.uploadPropertyMedia(item.file as File, item.metadata, item.code);
                if (item.id !== undefined) await offlineQueue.removeFromQueue(item.id);
                synced++;
            } catch {
                // Leave in queue to retry later
            }
        }
        if (synced > 0) {
            showToast(`${synced} offline photo${synced > 1 ? 's' : ''} uploaded.`, 'success');
            await checkQueue();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
            setPreviewUrls(prev => [...prev, ...newFiles.map(f => URL.createObjectURL(f))]);
            setStep('preview');
        }
    };

    const handleUpload = async () => {
        if (files.length === 0 || !code) return;
        setStep('uploading');
        let successCount = 0;

        for (const file of files) {
            const metadataObj = {
                latitude: location?.lat ?? null,
                longitude: location?.lng ?? null,
                gps_accuracy: location?.accuracy ?? null,
                captured_at: new Date().toISOString(),
                media_type: file.type.startsWith('video') ? 'video' : 'photo',
                room_index: selectedRoom?.index ?? null,
                room_label: selectedRoom?.label ?? null,
            };

            if (isOffline) {
                const { offlineQueue } = await import('@/lib/offlineQueue');
                await offlineQueue.addToQueue(
                    file,
                    JSON.stringify(metadataObj),
                    code,
                    file.type.startsWith('video') ? 'video' : 'photo'
                );
                successCount++;
                continue;
            }

            try {
                const response = await apiClient.uploadPropertyMedia(file, JSON.stringify(metadataObj), code);
                if (response.gps_verified) setIsSessionVerified(true);
                successCount++;
            } catch (err: any) {
                const msg = err?.response?.data?.detail || 'Upload failed. Saving for retry when online.';
                showToast(msg, 'error');
                // Queue for offline retry
                const { offlineQueue } = await import('@/lib/offlineQueue');
                await offlineQueue.addToQueue(
                    file,
                    JSON.stringify(metadataObj),
                    code,
                    file.type.startsWith('video') ? 'video' : 'photo'
                );
            }
        }

        await checkQueue();

        if (isOffline) {
            showToast(`${successCount} photo${successCount !== 1 ? 's' : ''} queued — will upload when back online.`, 'info');
            setStep('success');
        } else if (successCount > 0) {
            setStep('success');
        } else {
            setStep('preview');
        }
    };

    const resetForNextCapture = () => {
        setFiles([]);
        setPreviewUrls([]);
        setStep('intro');
    };

    return (
        <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-900/10">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 pointer-events-none" />

            <main className="max-w-xl mx-auto px-6 py-12 flex flex-col min-h-screen relative z-10">
                <header className="flex items-center justify-between mb-16">
                    <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center rounded-2xl">
                        <Camera className="text-white w-6 h-6" />
                    </div>
                    {pendingCount > 0 && (
                        <button
                            onClick={syncOfflineQueue}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg"
                        >
                            <WifiOff className="w-3 h-3" />
                            {pendingCount} Pending
                        </button>
                    )}
                </header>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
                        >
                            <div className="w-20 h-20 bg-zinc-900 text-white rounded-3xl flex items-center justify-center mx-auto mb-4">
                                <WifiOff className="w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-black uppercase tracking-tighter text-zinc-900">Session Error</h2>
                            <p className="text-zinc-500 font-bold px-4">{error}</p>
                        </motion.div>
                    )}

                    {!error && step === 'intro' && (
                        <motion.div
                            key="intro"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex-1 flex flex-col"
                        >
                            <div className="space-y-6 mb-12">
                                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Security Protocol</div>
                                <h1 className="text-5xl font-black tracking-tighter uppercase leading-[0.9]">
                                    Visual <br /> Telemetry
                                </h1>
                                <p className="text-xl text-zinc-500 font-medium leading-relaxed">
                                    Authenticate this asset by capturing high-fidelity visual data from the verified location.
                                </p>
                            </div>

                            {sessionDetails?.target_address && (
                                <div className="glass-card !p-8 rounded-[3rem] border-zinc-100 mb-12 flex items-center gap-6">
                                    <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center shrink-0">
                                        <MapPin className="text-zinc-500 w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Target Registry</div>
                                        <div className="text-sm font-black uppercase truncate max-w-[200px]">{sessionDetails.target_address}</div>
                                    </div>
                                </div>
                            )}

                            {rooms.length > 0 && (
                                <div className="space-y-6 mb-12">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Target Area</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        {rooms.map(room => (
                                            <button
                                                key={room.index}
                                                onClick={() => setSelectedRoom(room)}
                                                className={`p-6 rounded-[2.5rem] border-2 text-left transition-all ${selectedRoom?.index === room.index ? 'bg-zinc-900 border-zinc-900 shadow-2xl' : 'border-zinc-100'}`}
                                            >
                                                <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${selectedRoom?.index === room.index ? 'text-zinc-400' : 'text-zinc-500'}`}>Room</div>
                                                <div className={`text-sm font-black uppercase ${selectedRoom?.index === room.index ? 'text-white' : 'text-zinc-900'}`}>{room.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-auto pt-12">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-8 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4"
                                >
                                    Add Photos / Videos
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
                                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Telemetry Review</div>
                                <div className="grid grid-cols-1 gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {previewUrls.map((url, i) => (
                                        <div key={i} className="aspect-[4/3] rounded-[3rem] overflow-hidden bg-zinc-100 relative">
                                            {files[i].type.startsWith('video') ? (
                                                <video src={url} className="w-full h-full object-cover" controls playsInline muted />
                                            ) : (
                                                <img src={url} className="w-full h-full object-cover" alt="Preview" />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                                            <div className="absolute bottom-6 left-6 text-white text-[10px] font-black uppercase tracking-widest pointer-events-none">
                                                {files[i].type.startsWith('video') ? 'Stream' : 'Still'} &mdash; {i + 1}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-12 space-y-6">
                                <button
                                    onClick={handleUpload}
                                    className="w-full py-8 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl hover:scale-105 active:scale-95 transition-all"
                                >
                                    {isOffline ? 'Queue for Upload' : 'Transmit Telemetry'}
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-6 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 hover:text-zinc-900 transition-all"
                                >
                                    Add More
                                </button>
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
                            <div className="w-24 h-24 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin" />
                            <div className="space-y-4">
                                <h2 className="text-3xl font-black uppercase tracking-tighter">Transmitting</h2>
                                <p className="text-zinc-500 font-medium">Encrypting data packets and synchronizing with global registry...</p>
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
                                    {isOffline ? 'Queued' : 'Data Synced'}
                                </h2>
                                <p className="text-xl text-zinc-500 font-medium max-w-xs mx-auto">
                                    {isOffline
                                        ? 'Photos saved offline. They will upload automatically when you reconnect.'
                                        : 'Visual telemetry successfully committed to the asset registry.'}
                                </p>
                            </div>
                            <div className="pt-12 flex flex-col gap-6 w-full">
                                <button
                                    onClick={resetForNextCapture}
                                    className="w-full py-8 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl"
                                >
                                    Capture More
                                </button>
                                <button
                                    onClick={() => setStep('finished')}
                                    className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400"
                                >
                                    Finish Session
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'finished' && (
                        <motion.div
                            key="finished"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
                        >
                            <div className="w-24 h-24 bg-zinc-100 rounded-[3rem] flex items-center justify-center mx-auto">
                                <Shield className="w-12 h-12 text-zinc-400" />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-4xl font-black tracking-tighter uppercase">Session Complete</h2>
                                <p className="text-zinc-500 font-medium">You can close this tab. Your photos have been recorded.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* File input — no `capture` attribute so both camera and gallery are available */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                />

                <footer className="mt-20 pt-12 border-t border-zinc-100 flex flex-col items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-zinc-300" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Roomivo Encrypted Node</span>
                    </div>
                </footer>
            </main>
        </div>
    );
}
