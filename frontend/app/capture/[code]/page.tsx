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
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

    // Clean up preview URL
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const startCapture = () => {
        // Offline Mode: Allow capture without GPS if offline
        if (isOffline) {
            setStep('capturing');
            if (fileInputRef.current) fileInputRef.current.click();
            return;
        }

        // "Verify Once" Logic: If already verified, skip GPS
        if (isSessionVerified) {
            setStep('capturing');
            if (fileInputRef.current) {
                fileInputRef.current.click();
            }
            return;
        }

        // Request location first
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser.");
            return;
        }

        setStep('capturing');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
                // Once location is found, trigger file input
                if (fileInputRef.current) {
                    fileInputRef.current.click();
                }
            },
            (error) => {
                let msg = "Unable to retrieve your location.";
                if (error.code === 1) msg = "Location permission denied. Please enable it to verify property.";

                // Offline fallback logic for timeouts
                if (error.code === 3) {
                    showToast("GPS timeout. Proceeding with limited verification.", "info");
                    if (fileInputRef.current) fileInputRef.current.click();
                    return;
                }

                setLocationError(msg);
                showToast(msg, 'error');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setStep('preview');
        } else {
            setStep('intro'); // User cancelled
        }
    };

    const handleUpload = async () => {
        if (!file || !code) return;
        // Require location ONLY if online, not verified, and have location
        if (navigator.onLine && !isSessionVerified && !location) return;

        setStep('uploading');

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
                setStep('success');
                checkQueueHelper();
                showToast('Saved to Offline Queue. Will sync when online.', 'success');
            } catch (err) {
                console.error("Offline save failed", err);
                showToast("Failed to save offline.", "error");
                setStep('preview');
            }
            return;
        }

        // ONLINE UPLOAD
        try {
            const response = await apiClient.uploadPropertyMedia(file, metadata, code);
            if (response.property_verified || response.distance_verified) {
                setIsSessionVerified(true);
            }
            setStep('success');
            showToast('Media uploaded successfully!', 'success');
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.detail || "Upload failed.";

            // Auto-queue if network error
            if (!error.response || error.code === 'ERR_NETWORK') {
                const { offlineQueue } = await import('@/lib/offlineQueue');
                await offlineQueue.addToQueue(file, metadata, code, metadataObj.media_type as any);
                setStep('success');
                checkQueueHelper();
                showToast('Network unstable. Saved to Queue.', 'warning');
                return;
            }

            showToast(msg, 'error');
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
                        setFile(null);
                        setPreviewUrl(null);
                    }}
                    className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-indigo-700 transition"
                >
                    {isOfflineSuccess ? '📸 Capture Next Item' : '📸 Take Another Photo'}
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <header className="bg-white shadow p-4 sticky top-0 z-10 flex justify-between items-center">
                <h1 className="text-lg font-bold text-indigo-600">Property Verification</h1>
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
                            className="w-full bg-indigo-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:bg-indigo-700 transition transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span>📍 Enable Location & Camera</span>
                        </button>
                    </div>
                )}

                {step === 'capturing' && (
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Acquiring high-accuracy GPS...</p>
                    </div>
                )}

                {step === 'preview' && previewUrl && (
                    <div className="w-full flex-1 flex flex-col">
                        <div className="relative flex-1 bg-black rounded-lg overflow-hidden shadow-xl mb-6">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                            {location && (
                                <div className="absolute bottom-4 left-4 right-4 bg-black/50 text-white text-xs p-2 rounded backdrop-blur-sm">
                                    📍 Location acquired (Accuracy: {Math.round(location.accuracy)}m)
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('intro')}
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
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-6"></div>
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
                    capture="environment"
                    className="hidden"
                />
            </main>
        </div>
    );
}
