'use client';

import { useState, useRef, useEffect, use } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/ToastContext';
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

interface Room {
    index: number;
    label: string;
}

function GpsQualityBadge({ accuracy }: { accuracy: number | null }) {
    if (accuracy === null) return null;
    const rounded = Math.round(accuracy);
    if (rounded <= 30) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold">
            🟢 {rounded}m
        </span>
    );
    if (rounded <= 100) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold">
            🟡 {rounded}m
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold">
            🔴 {rounded}m
        </span>
    );
}

export default function CapturePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const router = useRouter();
    const { showToast } = useToast();
    const [step, setStep] = useState<'intro' | 'capturing' | 'ready_to_capture' | 'preview' | 'uploading' | 'success'>('intro');
    const [files, setFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isSessionVerified, setIsSessionVerified] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [sessionDetails, setSessionDetails] = useState<any>(null);

    // Room selection state
    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

    // Upload result state
    const [lastUploadResult, setLastUploadResult] = useState<{
        gps_verified: boolean;
        distance_meters: number | null;
        gps_accuracy: number | null;
    } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial check and network listeners + Fetch Session
    useEffect(() => {
        const handleOnline = () => { setIsOffline(false); checkQueueHelper(); };
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setIsOffline(!navigator.onLine);

        checkQueueHelper();
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
            if (res.data.rooms && res.data.rooms.length > 0) {
                setRooms(res.data.rooms);
            }
        } catch (e) {
            console.error("Failed to load session", e);
        }
    };

    const checkQueueHelper = async () => {
        const { offlineQueue } = await import('@/lib/offlineQueue');
        const count = await offlineQueue.count();
        setPendingCount(count);
        if (navigator.onLine && count > 0) triggerSync();
    };

    const triggerSync = async () => {
        if (isSyncing || !navigator.onLine) return;
        setIsSyncing(true);
        const { offlineQueue } = await import('@/lib/offlineQueue');

        try {
            const queue = await offlineQueue.getQueue();
            for (const item of queue) {
                if (!item.id) continue;
                try {
                    const uploadFile = new File([item.file], `offline-${item.id}.${item.mediaType === 'video' ? 'mp4' : 'jpg'}`, { type: item.file.type });
                    await apiClient.uploadPropertyMedia(uploadFile, item.metadata, item.code);
                    await offlineQueue.removeFromQueue(item.id);
                } catch (err) {
                    console.error("Sync failed for item", item.id, err);
                }
            }
            const count = await offlineQueue.count();
            setPendingCount(count);
            if (count === 0) showToast("All offline items synced!", "success");
        } finally {
            setIsSyncing(false);
        }
    };

    // Clean up preview URLs
    useEffect(() => {
        return () => {
            previewUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [previewUrls]);

    const gpsAbortRef = useRef(false);

    const proceedToCamera = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const manualProceed = () => {
        gpsAbortRef.current = true;
        showToast("Proceeding without GPS. Media will be marked as unverified.", "warning");
        setStep('ready_to_capture');
    };

    const acquireGpsAndCapture = () => {
        // Offline Mode: Allow capture without GPS if offline
        if (isOffline) {
            setStep('ready_to_capture');
            return;
        }

        // "Verify Once" Logic: If already verified, skip GPS
        if (isSessionVerified) {
            setStep('ready_to_capture');
            return;
        }

        // Request location first
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser.");
            return;
        }

        setStep('capturing');
        setLocation(null); // Reset for fresh reading
        gpsAbortRef.current = false;

        let resolved = false;
        const onSuccess = (position: GeolocationPosition) => {
            if (resolved || gpsAbortRef.current) return;
            resolved = true;
            setLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            });
            setStep('ready_to_capture');
        };

        const onHighAccuracyError = () => {
            if (resolved || gpsAbortRef.current) return;
            // Fallback: try without high accuracy
            navigator.geolocation.getCurrentPosition(
                onSuccess,
                () => {
                    if (resolved || gpsAbortRef.current) return;
                    resolved = true;
                    showToast("GPS unavailable. Proceeding without location.", "info");
                    setStep('ready_to_capture');
                },
                { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
            );
        };

        // Phase 1: Try high accuracy with a short timeout
        navigator.geolocation.getCurrentPosition(
            onSuccess,
            onHighAccuracyError,
            { enableHighAccuracy: true, timeout: 3000, maximumAge: 30000 }
        );

        // Absolute safety net: if nothing resolved after 6s, just proceed
        setTimeout(() => {
            if (!resolved && !gpsAbortRef.current) {
                resolved = true;
                showToast("GPS took too long. Proceeding without location.", "info");
                setStep('ready_to_capture');
            }
        }, 6000);
    };

    const startCapture = () => {
        // If rooms exist and none selected, don't start
        if (rooms.length > 0 && !selectedRoom) {
            showToast("Please select a room first.", "warning");
            return;
        }
        acquireGpsAndCapture();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newlyCapturedFiles = Array.from(e.target.files);

            // Append new captures to existing list
            setFiles(prev => [...prev, ...newlyCapturedFiles]);
            setPreviewUrls(prev => [
                ...prev,
                ...newlyCapturedFiles.map(f => URL.createObjectURL(f))
            ]);

            setStep('preview');
        } else if (files.length === 0) {
            // Only go back to intro if they cancelled and have NO existing photos
            setStep('intro');
        }
    };

    const handleUpload = async () => {
        if (files.length === 0 || !code) return;

        setStep('uploading');
        let successCount = 0;

        // Use sequential upload to prevent massive spikes
        for (const file of files) {
            const metadataObj: Record<string, any> = {
                latitude: location?.lat || null,
                longitude: location?.lng || null,
                gps_accuracy: location?.accuracy || null,
                captured_at: new Date().toISOString(),
                media_type: file.type.startsWith('video') ? 'video' : 'photo',
                device_id: navigator.userAgent,
                watermark_address: '',
                room_index: selectedRoom?.index ?? null,
                room_label: selectedRoom?.label ?? null,
            };
            const metadata = JSON.stringify(metadataObj);

            // OFFLINE HANDLING
            if (!navigator.onLine) {
                try {
                    const { offlineQueue } = await import('@/lib/offlineQueue');
                    await offlineQueue.addToQueue(file, metadata, code, metadataObj.media_type as any);
                    successCount++;
                } catch (err) {
                    console.error("Offline save failed", err);
                }
                continue;
            }

            // ONLINE UPLOAD
            try {
                const response = await apiClient.uploadPropertyMedia(file, metadata, code);
                if (response.gps_verified) {
                    setIsSessionVerified(true);
                }
                setLastUploadResult({
                    gps_verified: response.gps_verified || false,
                    distance_meters: response.distance_meters || null,
                    gps_accuracy: response.gps_accuracy || null,
                });
                successCount++;
            } catch (error: any) {
                console.error(error);
                // Auto-queue if network error
                if (!error.response || error.code === 'ERR_NETWORK') {
                    const { offlineQueue } = await import('@/lib/offlineQueue');
                    await offlineQueue.addToQueue(file, metadata, code, metadataObj.media_type as any);
                    successCount++;
                }
            }
        }

        if (successCount > 0) {
            setStep('success');
            if (!navigator.onLine) {
                checkQueueHelper();
                showToast(`Saved ${successCount} item(s) to offline queue.`, 'success');
            } else {
                showToast(`Successfully uploaded ${successCount} item(s)!`, 'success');
            }
        } else {
            showToast("Failed to upload media. Please try again.", "error");
            setStep('preview');
        }
    };

    if (step === 'success') {
        const isOfflineSuccess = !navigator.onLine || isSyncing;
        return (
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${isOfflineSuccess ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'bg-teal-50/50 dark:bg-teal-900/10'}`}
            >
                <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-900 shadow-xl rounded-2xl p-8 max-w-sm w-full border border-zinc-100 dark:border-zinc-800">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm ${isOfflineSuccess ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-teal-100 dark:bg-teal-900/30 text-teal-600'}`}>
                        <span className="text-4xl">{isOfflineSuccess ? '💾' : '✅'}</span>
                    </div>
                    <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white mb-3">
                        {isOfflineSuccess ? 'Saved to Queue' : 'Uploaded Successfully!'}
                    </h1>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-4 text-sm">
                        {isOfflineSuccess
                            ? "Your media is safely stored on this device. It will upload automatically when connection returns."
                            : "Your media has been securely uploaded to the landlord dashboard."}
                    </p>

                    {/* GPS Verification Result */}
                    {lastUploadResult && !isOfflineSuccess && (
                        <div className={`mb-6 p-3 rounded-xl text-sm font-medium ${lastUploadResult.gps_verified
                            ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                            : 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                            }`}>
                            {lastUploadResult.gps_verified ? (
                                <>✅ GPS Verified — {lastUploadResult.distance_meters}m from property</>
                            ) : lastUploadResult.distance_meters ? (
                                <>⚠️ {lastUploadResult.distance_meters}m away — outside verification radius</>
                            ) : (
                                <>⚠️ No GPS — media marked as unverified</>
                            )}
                            {lastUploadResult.gps_accuracy !== null && (
                                <div className="mt-1 flex justify-center">
                                    <GpsQualityBadge accuracy={lastUploadResult.gps_accuracy} />
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        onClick={() => {
                            setStep('intro');
                            setFiles([]);
                            setPreviewUrls([]);
                            setLocation(null); // Reset GPS for fresh reading
                            setLastUploadResult(null);
                        }}
                        className={`w-full font-bold py-3.5 px-6 rounded-xl shadow-sm transition-all active:scale-[0.98] ${isOfflineSuccess
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : 'bg-teal-600 hover:bg-teal-500 text-white focus:ring-4 focus:ring-teal-500/20'
                            }`}
                    >
                        {isOfflineSuccess ? '📸 Capture Next Item' : '📸 Take Another Photo'}
                    </button>
                </motion.div>
            </motion.div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
            <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-10 flex justify-between items-center px-6">
                <h1 className="text-lg font-bold text-teal-600 dark:text-teal-400">Property Verification</h1>
                <div className="flex gap-2">
                    {pendingCount > 0 && (
                        <div className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm ${isSyncing ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
                            <span>{isSyncing ? '🔄' : '⏳'}</span> {pendingCount} Pending
                        </div>
                    )}
                    {isSessionVerified && (
                        <div className="bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                            <span className="text-[10px]">✅</span> Verified
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="w-full"
                >
                    {step === 'intro' && (
                        <div className="text-center w-full bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
                            <motion.div variants={itemVariants}>
                                {isSessionVerified ? (
                                    <div className="mb-6">
                                        <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-teal-100 dark:border-teal-900/30">
                                            <span className="text-4xl">🔓</span>
                                        </div>
                                        <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white mb-2">You are verified!</h2>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                            You can now move freely indoors. GPS is no longer required for this session.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
                                            <span className="text-4xl text-zinc-700 dark:text-zinc-300">📸</span>
                                        </div>
                                        <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white mb-3">Verify Location</h2>

                                        {sessionDetails?.target_address && (
                                            <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 text-zinc-800 dark:text-zinc-200 px-4 py-3 rounded-xl mb-6 text-sm font-medium shadow-inner">
                                                📍 {sessionDetails.target_address}
                                            </div>
                                        )}

                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                                            Please take photos/videos while physically at the property. This ensures authenticity.
                                        </p>
                                    </>
                                )}

                                {/* GPS quality indicator if we have a reading */}
                                {location && (
                                    <div className="flex items-center justify-center gap-2 mb-4">
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">GPS accuracy:</span>
                                        <GpsQualityBadge accuracy={location.accuracy} />
                                    </div>
                                )}

                                {locationError && (
                                    <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 text-sm font-medium">
                                        {locationError} <br />
                                        <button onClick={() => setLocationError(null)} className="underline hover:text-red-800 dark:hover:text-red-300 mt-2 transition-colors">Try Again</button>
                                    </div>
                                )}

                                {/* Room Selector */}
                                {rooms.length > 0 && (
                                    <div className="mb-6">
                                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3 text-left">Select Room</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setSelectedRoom(null)}
                                                className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${selectedRoom === null
                                                    ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-500/25'
                                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-teal-300 dark:hover:border-teal-700'
                                                    }`}
                                            >
                                                🏠 Common Area
                                            </button>
                                            {rooms.map(room => (
                                                <button
                                                    key={room.index}
                                                    onClick={() => setSelectedRoom(room)}
                                                    className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${selectedRoom?.index === room.index
                                                        ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-500/25'
                                                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-teal-300 dark:hover:border-teal-700'
                                                        }`}
                                                >
                                                    🛏️ {room.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={startCapture}
                                    className="w-full bg-teal-600 text-white font-bold py-4 px-6 rounded-xl shadow-sm hover:bg-teal-500 focus:ring-4 focus:ring-teal-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <span className="text-lg">📷</span>
                                    <span>
                                        {selectedRoom ? `Capture ${selectedRoom.label}` : 'Capture Media'}
                                    </span>
                                </button>
                                <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1.5">
                                    <span>🔒</span> Live capture prevents fraud
                                </p>
                            </motion.div>
                        </div>
                    )}

                    {step === 'capturing' && (
                        <motion.div variants={itemVariants} className="text-center bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 py-12">
                            <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-6" />
                            <p className="text-zinc-800 dark:text-zinc-200 font-semibold mb-2">Acquiring precise location...</p>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">This should only take a few seconds</p>
                            <button
                                onClick={manualProceed}
                                className="text-teal-600 dark:text-teal-400 hover:text-teal-500 underline text-sm font-medium transition-colors"
                            >
                                Taking too long? Proceed anyway (unverified)
                            </button>
                        </motion.div>
                    )}

                    {step === 'ready_to_capture' && (
                        <motion.div variants={itemVariants} className="text-center bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
                            <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-teal-100 dark:border-teal-900/30">
                                <span className="text-4xl">📸</span>
                            </div>
                            <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white mb-6">Ready to Capture</h2>

                            {selectedRoom && (
                                <div className="bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800/50 text-teal-800 dark:text-teal-200 px-4 py-3 rounded-xl mb-6 text-sm font-bold shadow-inner flex items-center justify-center gap-2">
                                    🛏️ Capturing: {selectedRoom.label}
                                </div>
                            )}

                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
                                You can now open your camera and start taking photos or videos.
                            </p>

                            <button
                                onClick={proceedToCamera}
                                className="w-full bg-teal-600 text-white font-bold py-4 px-6 rounded-xl shadow-sm hover:bg-teal-500 focus:ring-4 focus:ring-teal-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <span className="text-lg">📷</span>
                                <span>Open Camera</span>
                            </button>

                            <button
                                onClick={() => { setStep('intro'); setLocation(null); gpsAbortRef.current = true; }}
                                className="mt-6 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    )}

                    {step === 'preview' && files.length > 0 && (
                        <motion.div variants={containerVariants} className="w-full flex-1 flex flex-col pt-2">
                            <motion.div variants={itemVariants} className="relative w-full bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl mb-6 flex flex-col">
                                <div className="p-2 gap-2 flex flex-col overflow-y-auto max-h-[60vh]">
                                    {files.map((file, idx) => (
                                        <div key={idx} className="relative w-full h-72 bg-black rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                                            {file.type.startsWith('video') ? (
                                                <video src={previewUrls[idx]} controls className="w-full h-full object-contain" />
                                            ) : (
                                                <img src={previewUrls[idx]} alt={`Preview ${idx + 1}`} className="w-full h-full object-contain" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none z-10">
                                    <div className="bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-white/10">
                                        {files.length} item{files.length > 1 ? 's' : ''} captured
                                    </div>
                                    {location && (
                                        <GpsQualityBadge accuracy={location.accuracy} />
                                    )}
                                </div>
                                {selectedRoom && (
                                    <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex justify-center z-10">
                                        <div className="bg-teal-600/90 backdrop-blur-md text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg border border-teal-500/50">
                                            🛏️ Capturing: {selectedRoom.label}
                                        </div>
                                    </div>
                                )}
                            </motion.div>

                            <motion.div variants={itemVariants} className="flex flex-col gap-3">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 font-bold py-3.5 px-4 rounded-xl shadow-sm border border-teal-200 dark:border-teal-900/50 hover:bg-teal-50 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <span>➕</span> Add Another Photo/Video {selectedRoom ? `for ${selectedRoom.label}` : ''}
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setStep('intro'); setFiles([]); setPreviewUrls([]); }}
                                        className="w-1/3 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold py-3.5 px-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        onClick={handleUpload}
                                        className="w-2/3 bg-teal-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-sm hover:bg-teal-500 focus:ring-4 focus:ring-teal-500/20 transition-all active:scale-[0.98]"
                                    >
                                        Confirm & Upload
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {step === 'uploading' && (
                        <motion.div variants={itemVariants} className="text-center bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 py-12">
                            <div className="w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-6" />
                            <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mb-2">Securely Uploading...</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 text-sm">Encrypting and verifying authenticity</p>
                        </motion.div>
                    )}
                </motion.div>

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    capture="environment" // Force native camera capture
                    multiple
                    className="hidden"
                />
            </main>
        </div>
    );
}
