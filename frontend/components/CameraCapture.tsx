'use client';

import { useState, useRef } from 'react';
import { useLanguage } from '@/lib/LanguageContext';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
    const { t } = useLanguage();
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [error, setError] = useState('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const startCamera = async () => {
        try {
            setError('');
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Prefer back camera on mobile
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setCapturing(true);
        } catch (err: any) {
            setError(t('cameraCapture.accessDenied', undefined, 'Camera access denied. Please allow camera access to verify your identity.'));
            console.error('Camera error:', err);
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0);

            // Convert canvas to blob
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `id-document-${Date.now()}.jpg`, {
                        type: 'image/jpeg'
                    });

                    // Stop camera
                    stopCamera();

                    // Send captured image
                    onCapture(file);
                }
            }, 'image/jpeg', 0.95);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setCapturing(false);
    };

    const handleCancel = () => {
        stopCamera();
        onCancel();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter">
                         {t('cameraCapture.title', undefined, 'Capture Identity Document')}
                    </h3>
                    <button
                        onClick={handleCancel}
                        className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors text-2xl font-light"
                    >
                        ×
                    </button>
                </div>

                 {error && (
                    <div className="mb-6 p-5 bg-zinc-900 text-white rounded-2xl flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
                    </div>
                )}

                {!capturing && !error && (
                    <div className="text-center py-8">
                        <div className="text-6xl mb-4"></div>
                         <h4 className="text-xl font-black text-zinc-900 uppercase tracking-tight mb-4">
                            {t('cameraCapture.liveCaptureTitle', undefined, 'Live Document Capture')}
                        </h4>
                        <p className="text-zinc-500 font-medium mb-10 max-w-md mx-auto">
                            {t('cameraCapture.liveCaptureDesc', undefined, 'For security, we require a live photo of your ID document.')}
                            <br />
                            <span className="text-sm opacity-60">{t('cameraCapture.liveCaptureTip', undefined, 'Position your document clearly and ensure all text is readable.')}</span>
                        </p>
                        <button
                            onClick={startCamera}
                            className="px-10 py-4 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl"
                        >
                            {t('cameraCapture.openCamera', undefined, 'Open Camera')}
                        </button>
                    </div>
                )}

                {capturing && (
                    <div className="space-y-4">
                         <div className="relative bg-zinc-900 rounded-3xl overflow-hidden shadow-inner">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full opacity-90"
                                style={{ transform: 'scaleX(-1)' }} // Mirror for natural selfie view
                            />
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-8 border-2 border-white/20 rounded-2xl"></div>
                            </div>
                        </div>

                         <div className="flex gap-4">
                            <button
                                onClick={handleCancel}
                                className="flex-1 py-4 bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-zinc-200 transition-colors"
                            >
                                {t('cameraCapture.cancel', undefined, 'Cancel')}
                            </button>
                            <button
                                onClick={capturePhoto}
                                className="flex-1 py-4 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl"
                            >
                                 {t('cameraCapture.captureButton', undefined, 'Capture Photo')}
                            </button>
                        </div>

                         <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest text-center">
                                 {t('cameraCapture.frameTip', undefined, 'Tip: Ensure your document is well-lit and all corners are visible within the frame.')}
                            </p>
                        </div>
                    </div>
                )}

                {/* Hidden canvas for capturing */}
                <canvas ref={canvasRef} className="hidden" />
            </div>
        </div>
    );
}
