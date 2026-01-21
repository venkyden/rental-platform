'use client';

import { useState, useRef } from 'react';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
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
            setError('Camera access denied. Please allow camera access to verify your identity.');
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
            <div className="bg-white rounded-lg max-w-2xl w-full p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">
                        📸 Capture Identity Document
                    </h3>
                    <button
                        onClick={handleCancel}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {!capturing && !error && (
                    <div className="text-center py-8">
                        <div className="text-6xl mb-4">📷</div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                            Live Document Capture
                        </h4>
                        <p className="text-gray-600 mb-6">
                            For security, we require a live photo of your ID document.
                            <br />
                            <span className="text-sm">Position your document clearly and ensure all text is readable.</span>
                        </p>
                        <button
                            onClick={startCamera}
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all"
                        >
                            Open Camera
                        </button>
                    </div>
                )}

                {capturing && (
                    <div className="space-y-4">
                        <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full"
                                style={{ transform: 'scaleX(-1)' }} // Mirror for natural selfie view
                            />
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 border-4 border-blue-500 opacity-50 m-8 rounded-lg"></div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCancel}
                                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={capturePhoto}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all"
                            >
                                📸 Capture Photo
                            </button>
                        </div>

                        <div className="p-3 bg-blue-50 rounded-md">
                            <p className="text-xs text-blue-800">
                                💡 Tip: Ensure your document is well-lit and all corners are visible within the blue frame.
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
