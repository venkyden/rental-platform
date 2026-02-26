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
                    "✓ Ensure all text is clearly readable",
                    "✓ Position passport horizontally",
                    "✓ Avoid glare and shadows",
                    "✗ Don't cover any part with your fingers"
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
                    "✓ Ensure photo and all text are visible",
                    "✓ Position card horizontally",
                    "✓ Avoid reflections from overhead lights",
                    "✗ Don't tilt the card"
                ],
                frameType: 'landscape' as const
            },
            {
                title: "Capture Back of ID Card",
                description: "Now flip your ID and capture the back side",
                tips: [
                    "✓ Ensure all information is readable",
                    "✓ Keep card in same orientation",
                    "✓ Good lighting is essential",
                    "✗ Don't rush - take your time"
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
                    "✓ Ensure photo is clearly visible",
                    "✓ All text must be readable",
                    "✓ Avoid glare from plastic coating",
                    "✗ Don't cover barcode area"
                ],
                frameType: 'landscape' as const
            },
            {
                title: "Capture Back of Driver's License",
                description: "Now capture the back of your driver's license",
                tips: [
                    "✓ Barcode must be visible",
                    "✓ Keep card flat and steady",
                    "✓ Ensure good focus",
                    "✗ Don't capture in dim lighting"
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
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">
                            Document Verification
                        </h3>
                        <p className="text-sm text-gray-600">
                            Step {currentStep + 1} of {totalSteps}
                        </p>
                    </div>
                    <button
                        onClick={handleCancel}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 pt-4">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {error && (
                    <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-800">{error}</p>
                        {/* Fallback file upload when camera stream fails */}
                        <div className="mt-3">
                            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
                                📁 Upload from gallery instead
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
                    <div className="p-6">
                        <div className="text-center mb-6">
                            <div className="text-6xl mb-3">
                                {documentType === 'passport' ? '📘' : '🪪'}
                            </div>
                            <h4 className="text-2xl font-bold text-gray-900 mb-2">
                                {currentInstruction.title}
                            </h4>
                            <p className="text-gray-600">
                                {currentInstruction.description}
                            </p>
                        </div>

                        {/* Tips */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-6">
                            <h5 className="font-semibold text-gray-900 mb-3">💡 Guidelines:</h5>
                            <ul className="space-y-2">
                                {currentInstruction.tips.map((tip, index) => (
                                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                        <span className="text-lg leading-none">{tip.startsWith('✓') ? '✓' : '✗'}</span>
                                        <span>{tip.substring(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {isMobile ? (
                            /* Mobile: native camera capture */
                            <button
                                onClick={handleMobileCapture}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="text-2xl">📷</span>
                                Take Photo
                            </button>
                        ) : (
                            /* Desktop: getUserMedia stream */
                            <button
                                onClick={startCamera}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="text-2xl">📷</span>
                                Open Camera
                            </button>
                        )}

                        {/* Fallback upload for all devices */}
                        <div className="mt-3 text-center">
                            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700">
                                📁 Or upload from gallery
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

                        <div className="flex gap-3">
                            <button
                                onClick={handleCancel}
                                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={capturePhoto}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="text-xl">📸</span>
                                Capture
                            </button>
                        </div>
                    </div>
                )}

                {/* Retake Option */}
                {capturedFiles.length > 0 && !capturing && !showGuidelines && (
                    <div className="p-6">
                        <div className="text-center">
                            <div className="text-6xl mb-4">✅</div>
                            <p className="text-lg text-gray-700 mb-4">
                                {capturedFiles.length} of {totalSteps} photo(s) captured
                            </p>
                            <button
                                onClick={handleRetake}
                                className="text-blue-600 hover:text-blue-700 font-medium"
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
