'use client';

import { useState, useRef, useEffect, use } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/ToastContext';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, Shield, Zap, Info, MapPin, ChevronRight, Upload, WifiOff, RefreshCw } from 'lucide-react';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

interface Room {
    index: number;
    label: string;
}

export default function CapturePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const router = useRouter();
    const { showToast } = useToast();
    const [step, setStep] = useState<'intro' | 'capturing' | 'ready_to_capture' | 'preview' | 'uploading' | 'success' | 'finished'>('intro');
    const [files, setFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [isSessionVerified, setIsSessionVerified] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [sessionDetails, setSessionDetails] = useState<any>(null);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleOnline = () => { setIsOffline(false); checkQueue(); };
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setIsOffline(!navigator.onLine);
        loadSessionDetails();
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const loadSessionDetails = async () => {
        try {
            const res = await apiClient.client.get(`/properties/media-sessions/${code}`);
            setSessionDetails(res.data);
            if (res.data.location_verified) setIsSessionVerified(true);
            if (res.data.rooms) setRooms(res.data.rooms);
        } catch (e) {
            console.error(e);
        }
    };

    const checkQueue = async () => {
        const { offlineQueue } = await import('@/lib/offlineQueue');
        const count = await offlineQueue.count();
        setPendingCount(count);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newlyCapturedFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newlyCapturedFiles]);
            setPreviewUrls(prev => [...prev, ...newlyCapturedFiles.map(f => URL.createObjectURL(f))]);
            setStep('preview');
        }
    };

    const handleUpload = async () => {
        if (files.length === 0 || !code) return;
        setStep('uploading');
        let successCount = 0;

        for (const file of files) {
            const metadataObj = {
                latitude: location?.lat || null,
                longitude: location?.lng || null,
                gps_accuracy: location?.accuracy || null,
                captured_at: new Date().toISOString(),
                media_type: file.type.startsWith('video') ? 'video' : 'photo',
                room_index: selectedRoom?.index ?? null,
                room_label: selectedRoom?.label ?? null,
            };

            try {
                const response = await apiClient.uploadPropertyMedia(file, JSON.stringify(metadataObj), code);
                if (response.gps_verified) setIsSessionVerified(true);
                successCount++;
            } catch (error) {
                console.error(error);
            }
        }

        if (successCount > 0) setStep('success');
        else setStep('preview');
    };

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans selection:bg-teal-500/30">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 pointer-events-none"></div>

            <main className="max-w-xl mx-auto px-6 py-12 flex flex-col min-h-screen relative z-10">
                <header className="flex items-center justify-between mb-16">
                    <div className="w-12 h-12 bg-zinc-900 dark:bg-white flex items-center justify-center rounded-2xl">
                        <Camera className="text-white dark:text-zinc-900 w-6 h-6" />
                    </div>
                    {pendingCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                            <WifiOff className="w-3 h-3" />
                            {pendingCount} Pending
                        </div>
                    )}
                </header>

                <AnimatePresence mode="wait">
                    {step === 'intro' && (
                        <motion.div
                            key="intro"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="flex-1 flex flex-col"
                        >
                            <div className="space-y-6 mb-12">
                                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-500">Security Protocol</div>
                                <h1 className="text-5xl font-black tracking-tighter uppercase leading-[0.9]">
                                    Visual <br /> Telemetry
                                </h1>
                                <p className="text-xl text-zinc-500 font-medium leading-relaxed">
                                    Authenticate this asset by capturing high-fidelity visual data from the verified location.
                                </p>
                            </div>

                            {sessionDetails?.target_address && (
                                <div className="glass-card !p-8 rounded-[3rem] border-zinc-100 dark:border-zinc-800/50 mb-12 flex items-center gap-6">
                                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center shrink-0">
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
                                                className={`p-6 rounded-[2.5rem] border-2 text-left transition-all ${selectedRoom?.index === room.index ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white shadow-2xl' : 'border-zinc-100 dark:border-zinc-800'}`}
                                            >
                                                <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${selectedRoom?.index === room.index ? 'text-zinc-400' : 'text-zinc-500'}`}>Room</div>
                                                <div className={`text-sm font-black uppercase ${selectedRoom?.index === room.index ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-white'}`}>{room.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-auto pt-12">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4"
                                >
                                    Initialize Camera
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
                                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">Telemetry Review</div>
                                <div className="grid grid-cols-1 gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {previewUrls.map((url, i) => (
                                        <div key={i} className="aspect-[4/3] rounded-[3rem] overflow-hidden bg-zinc-100 dark:bg-zinc-800 relative">
                                            <img src={url} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                            <div className="absolute bottom-6 left-6 text-white text-[10px] font-black uppercase tracking-widest">
                                                {files[i].type.startsWith('video') ? 'Stream' : 'Still'} // {i + 1}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-12 space-y-6">
                                <button
                                    onClick={handleUpload}
                                    className="w-full py-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl hover:scale-105 active:scale-95 transition-all"
                                >
                                    Transmit Telemetry
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-6 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
                                >
                                    Add More Channels
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
                            <div className="w-24 h-24 border-4 border-zinc-100 dark:border-zinc-800 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
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
                            <div className="w-32 h-32 bg-emerald-500 rounded-[3rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                                <CheckCircle2 className="w-16 h-16 text-white" />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-5xl font-black tracking-tighter uppercase">Data Synced</h2>
                                <p className="text-xl text-zinc-500 font-medium max-w-xs mx-auto">Visual telemetry successfully committed to the asset registry.</p>
                            </div>
                            <div className="pt-12 flex flex-col gap-6 w-full">
                                <button
                                    onClick={() => { setFiles([]); setPreviewUrls([]); setStep('intro'); }}
                                    className="w-full py-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-[0.4em] rounded-[2.5rem] shadow-2xl"
                                >
                                    Capture New Node
                                </button>
                                <button
                                    onClick={() => setStep('finished')}
                                    className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400"
                                >
                                    Terminate Session
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Hidden Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    capture="environment"
                    multiple
                    className="hidden"
                />

                <footer className="mt-20 pt-12 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-col items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-zinc-300" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">Roomivo Encrypted Node</span>
                    </div>
                </footer>
            </main>
        </div>
    );
}
