"use client";

import { useState, useRef, useEffect } from 'react';

interface DocumentCaptureProps {
    documentType: string; // 'passport', 'id_card', 'drivers_license'
    onComplete: (files: File[]) => void;
    onCancel: () => void;
}

// Document-specific configuration
const DOCUMENT_CONFIG = {
    passport: {
        steps: 1,
        instructions: [
            {
                title: "Capture Passport Bio Page",
                description: "Place your passport's bio page (with photo) within the frame",
                tips: [
                    " Ensure all text is clearly readable",
                    " Position passport horizontally",
                    " Avoid glare and shadows",
                    " Don't cover any part with your fingers"
                ],
                frameType: 'landscape' as const
            }
        ]
    },
    id_card: {
        steps: 2,
        instructions: [
            {
                title: "Capture Front of ID Card",
                description: "Place the front of your ID card within the frame",
                tips: [
                    " Ensure photo and all text are visible",
                    " Position card horizontally",
                    " Avoid reflections from overhead lights",
                    " Don't tilt the card"
                ],
                frameType: 'landscape' as const
            },
            {
                title: "Capture Back of ID Card",
                description: "Now flip your ID and capture the back side",
                tips: [
                    " Ensure all information is readable",
                    " Keep card in same orientation",
                    " Good lighting is essential",
                    " Don't rush - take your time"
                ],
                frameType: 'landscape' as const
            }
        ]
    },
    drivers_license: {
        steps: 2,
        instructions: [
            {
                title: "Capture Front of Driver's License",
                description: "Place the front of your driver's license within the frame",
                tips: [
                    " Ensure photo is clearly visible",
                    " All text must be readable",
                    " Avoid glare from plastic coating",
                    " Don't cover barcode area"
                ],
                frameType: 'landscape' as const
            },
            {
                title: "Capture Back of Driver's License",
                description: "Now capture the back of your driver's license",
                tips: [
                    " Barcode must be visible",
                    " Keep card flat and steady",
                    " Ensure good focus",
                    " Don't capture in dim lighting"
                ],
                frameType: 'landscape' as const
            }
        ]
    }
};

function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

export default function DocumentCapture({ documentType, onComplete, onCancel }: DocumentCaptureProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [error, setError] = useState('');
    const [capturedFiles, setCapturedFiles] = useState<File[]>([]);
    const [showGuidelines, setShowGuidelines] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mobileInputRef = useRef<HTMLInputElement>(null);

    const config = DOCUMENT_CONFIG[documentType as keyof typeof DOCUMENT_CONFIG];
    const currentInstruction = config.instructions[currentStep];
    const totalSteps = config.steps;
    const progress = ((currentStep + 1) / totalSteps) * 100;

    useEffect(() => {
        setIsMobile(isMobileDevice());
    }, []);

    // Cleanup camera stream on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // --- Mobile: use native <input capture> ---
    const handleMobileCapture = () => {
        setShowGuidelines(false);
        if (mobileInputRef.current) {
            mobileInputRef.current.click();
        }
    };

    const handleMobileFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const fileName = `${documentType}-${currentStep === 0 ? 'front' : 'back'}-${Date.now()}.jpg`;
            const file = new File([selectedFile], fileName, { type: selectedFile.type });

            const newCapturedFiles = [...capturedFiles, file];
            setCapturedFiles(newCapturedFiles);

            if (currentStep < totalSteps - 1) {
                // Move to next step (e.g. back of ID card)
                setCurrentStep(currentStep + 1);
                setShowGuidelines(true);
            } else {
                // All captures done
                onComplete(newCapturedFiles);
            }
        } else {
            // User cancelled the camera — go back to guidelines
            setShowGuidelines(true);
        }
        // Reset input value so same file can be re-selected
        if (mobileInputRef.current) {
            mobileInputRef.current.value = '';
        }
    };

    // --- Desktop: use getUserMedia stream ---
    const startCamera = async () => {
        try {
            setError('');
            setShowGuidelines(false);
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
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
            setError('Camera access denied. Please allow camera access or use the file upload option below.');
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    const fileName = `${documentType}-${currentStep === 0 ? 'front' : 'back'}-${Date.now()}.jpg`;
                    const file = new File([blob], fileName, { type: 'image/jpeg' });

                    const newCapturedFiles = [...capturedFiles, file];
                    setCapturedFiles(newCapturedFiles);

                    // Check if we need more captures
                    if (currentStep < totalSteps - 1) {
                        // Move to next step
                        setCurrentStep(currentStep + 1);
                        setCapturing(false);
                        setShowGuidelines(true);
                        stopCamera();
                    } else {
                        // All captures done
                        stopCamera();
                        onComplete(newCapturedFiles);
                    }
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

    const handleRetake = () => {
        setCapturedFiles([]);
        setCurrentStep(0);
        setShowGuidelines(true);
        stopCamera();
    };

    // Fallback file upload (for both mobile and desktop when camera fails)
    const handleFallbackFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const fileName = `${documentType}-${currentStep === 0 ? 'front' : 'back'}-${Date.now()}.jpg`;
            const file = new File([selectedFile], fileName, { type: selectedFile.type });

            const newCapturedFiles = [...capturedFiles, file];
            setCapturedFiles(newCapturedFiles);

            if (currentStep < totalSteps - 1) {
                setCurrentStep(currentStep + 1);
                setShowGuidelines(true);
                setError('');
            } else {
                onComplete(newCapturedFiles);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-100 px-8 py-6 flex justify-between items-center z-10">
                    <div>
                        <h3 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter">
                            Verification
                        </h3>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-1">
                            Step {currentStep + 1} of {totalSteps}
                        </p>
                    </div>
                    <button
                        onClick={handleCancel}
                        className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors text-2xl font-light"
                    >
                        ×
                    </button>
                </div>

                {/* Progress Bar */}
                 <div className="px-8 pt-6">
                    <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-zinc-900 transition-all duration-700 ease-in-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                 {error && (
                    <div className="mx-8 mt-6 p-5 bg-zinc-900 text-white rounded-2xl flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
                        </div>
                        {/* Fallback file upload when camera stream fails */}
                        <div className="mt-2 pt-4 border-t border-white/10">
                            <label className="inline-flex items-center gap-2 cursor-pointer text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
                                 Upload from gallery instead
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/jpg"
                                    onChange={handleFallbackFileChange}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                )}

                {/* Guidelines */}
                 {showGuidelines && (
                    <div className="p-8">
                        <div className="text-center mb-10">
                            <h4 className="text-3xl font-black text-zinc-900 uppercase tracking-tighter mb-2">
                                {currentInstruction.title}
                            </h4>
                            <p className="text-zinc-500 font-medium tracking-tight">
                                {currentInstruction.description}
                            </p>
                        </div>

                        {/* Tips */}
                         <div className="bg-zinc-50 rounded-[2rem] p-8 mb-10 border border-zinc-100">
                            <h5 className="text-[10px] font-black text-zinc-900 uppercase tracking-[0.3em] mb-6"> Protocol:</h5>
                            <ul className="space-y-4">
                                {currentInstruction.tips.map((tip, index) => (
                                    <li key={index} className="text-sm text-zinc-600 font-medium flex items-start gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 mt-1.5 shrink-0" />
                                        <span>{tip.trim()}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>                         {isMobile ? (
                            /* Mobile: native camera capture */
                            <button
                                onClick={handleMobileCapture}
                                className="w-full py-6 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3"
                            >
                                Take Photo
                            </button>
                        ) : (
                            /* Desktop: getUserMedia stream */
                            <button
                                onClick={startCamera}
                                className="w-full py-6 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3"
                            >
                                Open Camera
                            </button>
                        )}

                        {/* Fallback upload for all devices */}
                         <div className="mt-6 text-center">
                            <label className="inline-flex items-center gap-2 cursor-pointer text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors">
                                 Or upload from gallery
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/jpg"
                                    onChange={handleFallbackFileChange}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                )}

                {/* Camera View — Desktop only */}
                {capturing && !isMobile && (
                    <div className="p-6">
                        <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-4">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full"
                            />
                            {/* Alignment Guide */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="relative">
                                    {/* Frame overlay */}
                                    <div className={`border-4 border-blue-500 rounded-lg ${currentInstruction.frameType === 'landscape'
                                        ? 'w-96 h-60'
                                        : 'w-60 h-80'
                                        }`}>
                                        {/* Corner guides */}
                                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
                                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
                                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
                                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
                                    </div>
                                    {/* Center instruction */}
                                    <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                                        Position document within frame
                                    </div>
                                </div>
                            </div>
                        </div>

                         <div className="flex gap-4">
                            <button
                                onClick={handleCancel}
                                className="flex-1 py-4 bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-zinc-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={capturePhoto}
                                className="flex-1 py-4 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-2"
                            >
                                Capture
                            </button>
                        </div>
                    </div>
                )}

                {/* Retake Option */}
                {capturedFiles.length > 0 && !capturing && !showGuidelines && (
                    <div className="p-6">
                        <div className="text-center">
                            <div className="text-6xl mb-4"></div>
                            <p className="text-lg text-gray-700 mb-4">
                                {capturedFiles.length} of {totalSteps} photo(s) captured
                            </p>
                             <button
                                onClick={handleRetake}
                                className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
                            >
                                Start Over
                            </button>
                        </div>
                    </div>
                )}

                {/* Hidden elements */}
                <canvas ref={canvasRef} className="hidden" />
                {/* Native mobile camera input */}
                <input
                    ref={mobileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleMobileFileChange}
                    className="hidden"
                />
            </div>
        </div>
    );
}
