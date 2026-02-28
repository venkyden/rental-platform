'use client';

import { useState, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/ToastContext';

export default function CapturePage({ params }: { params: { code: string } }) {
    const { code } = params;
    const router = useRouter();
    const { showToast } = useToast();
    const [step, setStep] = useState<'intro' | 'capturing' | 'preview' | 'uploading' | 'success'>('intro');
    const [files, setFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isSessionVerified, setIsSessionVerified] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [sessionDetails, setSessionDetails] = useState<any>(null); // New state for address
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
        proceedToCamera();
    };

    const startCapture = () => {
        // Offline Mode: Allow capture without GPS if offline
        if (isOffline) {
            setStep('capturing');
            proceedToCamera();
            return;
        }

        // "Verify Once" Logic: If already verified, skip GPS
        if (isSessionVerified) {
            setStep('capturing');
            proceedToCamera();
            return;
        }

        // Request location first
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser.");
            return;
        }

        setStep('capturing');
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
            proceedToCamera();
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
                    proceedToCamera();
                },
                { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
            );
        };

        // Phase 1: Try high accuracy with a short timeout
        navigator.geolocation.getCurrentPosition(
            onSuccess,
            onHighAccuracyError,
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
        );

        // Absolute safety net: if nothing resolved after 8s, just proceed
        setTimeout(() => {
            if (!resolved && !gpsAbortRef.current) {
                resolved = true;
                showToast("GPS took too long. Proceeding without location.", "info");
                proceedToCamera();
            }
        }, 8000);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(selectedFiles);
            setPreviewUrls(selectedFiles.map(f => URL.createObjectURL(f)));
            setStep('preview');
        } else {
            setStep('intro'); // User cancelled
        }
    };

    const handleUpload = async () => {
        if (files.length === 0 || !code) return;

        setStep('uploading');
        let successCount = 0;

        // Use sequential upload to prevent massive spikes
        for (const file of files) {
            const metadataObj = {
                latitude: location?.lat || null,
                longitude: location?.lng || null,
                gps_accuracy: location?.accuracy || null,
                captured_at: new Date().toISOString(),
                media_type: file.type.startsWith('video') ? 'video' : 'photo',
                device_id: navigator.userAgent,
                watermark_address: ''
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
                if (response.property_verified || response.distance_verified) {
                    setIsSessionVerified(true);
                }
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
            <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${isOfflineSuccess ? 'bg-amber-50' : 'bg-green-50'}`}>
                <div className="bg-white rounded-full p-6 shadow-lg mb-6">
                    <span className="text-6xl">{isOfflineSuccess ? '💾' : '✅'}</span>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    {isOfflineSuccess ? 'Saved to Queue' : 'Uploaded!'}
                </h1>
                <p className="text-gray-600 mb-8">
                    {isOfflineSuccess
                        ? "Your media is saved safely. It will upload automatically when connection returns."
                        : "Your media has been securely uploaded to the landlord dashboard."}
                </p>
                <button
                    onClick={() => {
                        setStep('intro');
                        setFiles([]);
                        setPreviewUrls([]);
                    }}
                    className="w-full bg-teal-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-teal-700 transition"
                >
                    {isOfflineSuccess ? '📸 Capture Next Item' : '📸 Take Another Photo'}
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <header className="bg-white shadow p-4 sticky top-0 z-10 flex justify-between items-center">
                <h1 className="text-lg font-bold" style={{ color: '#22B8B8' }}>Property Verification</h1>
                <div className="flex gap-2">
                    {pendingCount > 0 && (
                        <div className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${isSyncing ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
                            <span>{isSyncing ? '🔄' : '⏳'}</span> {pendingCount} Pending
                        </div>
                    )}
                    {isSessionVerified && (
                        <div className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                            <span>✅</span> Verified
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">

                {step === 'intro' && (
                    <div className="text-center">
                        {isSessionVerified ? (
                            <div className="mb-6">
                                <div className="bg-green-100 p-4 rounded-full inline-block mb-4">
                                    <span className="text-4xl">🔓</span>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">You are verified!</h2>
                                <p className="text-gray-600">
                                    You can now move freely indoors. GPS is no longer required for this session.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white p-4 rounded-xl shadow-sm mb-6 inline-block">
                                    <span className="text-4xl">📸</span>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-3">Verify Location</h2>

                                {sessionDetails?.target_address && (
                                    <div className="bg-blue-50 text-blue-900 px-4 py-2 rounded-lg mb-4 text-sm font-medium">
                                        📍 {sessionDetails.target_address}
                                    </div>
                                )}

                                <p className="text-gray-600 mb-8 leading-relaxed">
                                    Please take a photo of the property while you are physically at the location.
                                </p>
                            </>
                        )}

                        {locationError && (
                            <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">
                                {locationError} <br />
                                <button onClick={() => setLocationError(null)} className="underline mt-2">Try Again</button>
                            </div>
                        )}

                        <button
                            onClick={startCapture}
                            className="w-full bg-teal-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:bg-teal-700 transition transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span>📍 Enable Location & Camera</span>
                        </button>
                    </div>
                )}

                {step === 'capturing' && (
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                        <p className="text-gray-600 mb-2">Acquiring GPS location...</p>
                        <p className="text-gray-400 text-sm mb-6">This should only take a few seconds</p>
                        <button
                            onClick={manualProceed}
                            className="text-teal-600 underline text-sm font-medium"
                        >
                            Taking too long? Proceed anyway (unverified)
                        </button>
                    </div>
                )}

                {step === 'preview' && files.length > 0 && (
                    <div className="w-full flex-1 flex flex-col">
                        <div className="relative flex-1 bg-black rounded-lg overflow-y-auto shadow-xl mb-6 flex flex-col gap-2 p-2">
                            {files.map((file, idx) => (
                                <div key={idx} className="relative w-full h-64 bg-gray-900 rounded-md overflow-hidden shrink-0">
                                    {file.type.startsWith('video') ? (
                                        <video src={previewUrls[idx]} controls className="w-full h-full object-contain" />
                                    ) : (
                                        <img src={previewUrls[idx]} alt={`Preview ${idx + 1}`} className="w-full h-full object-contain" />
                                    )}
                                </div>
                            ))}
                            <div className="text-center text-gray-400 text-xs mt-2">
                                {files.length} item(s) selected
                            </div>

                            {location && (
                                <div className="absolute bottom-4 left-4 right-4 bg-black/50 text-white text-xs p-2 rounded backdrop-blur-sm z-10 w-auto text-center mx-auto">
                                    📍 Location acquired (Accuracy: {Math.round(location.accuracy)}m)
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setStep('intro'); setFiles([]); setPreviewUrls([]); }}
                                className="flex-1 bg-white text-gray-700 font-bold py-3 px-4 rounded-xl shadow border border-gray-200"
                            >
                                Retake
                            </button>
                            <button
                                onClick={handleUpload}
                                className="flex-1 bg-green-600 text-white font-bold py-3 px-4 rounded-xl shadow hover:bg-green-700"
                            >
                                Confirm & Upload
                            </button>
                        </div>
                    </div>
                )}

                {step === 'uploading' && (
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600 mx-auto mb-6"></div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Verifying & Uploading...</h3>
                        <p className="text-gray-600">Checking location match...</p>
                    </div>
                )}

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                />
            </main>
        </div>
    );
}
