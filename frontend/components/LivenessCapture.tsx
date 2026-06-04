'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface LivenessCaptureProps {
    onCapture: (blob: Blob) => void;
    onError: (msg: string) => void;
    language: string;
}

type State = 'loading' | 'ready' | 'watching' | 'captured';

// EAR (Eye Aspect Ratio) threshold — below this = closed, above = open
const BLINK_CLOSE = 0.55;
const BLINK_OPEN  = 0.20;

// CDN base for MediaPipe WASM (keeps the bundle lean)
const MP_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm';
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export default function LivenessCapture({ onCapture, onError, language }: LivenessCaptureProps) {
    const videoRef  = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef    = useRef<number>(0);
    const landmarkerRef = useRef<any>(null);
    const eyeStateRef   = useRef<'open' | 'closed'>('open');
    const streamRef     = useRef<MediaStream | null>(null);

    const [uiState, setUiState] = useState<State>('loading');

    const fr = language === 'fr';

    const labels: Record<State, string> = {
        loading:  fr ? 'Préparation de la caméra...' : 'Preparing camera...',
        ready:    fr ? 'Regardez droit vers la caméra' : 'Look straight at the camera',
        watching: fr ? 'Clignez des yeux pour confirmer votre présence' : 'Blink to confirm liveness',
        captured: fr ? 'Parfait !' : 'Got it!',
    };

    const stopStream = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }, []);

    const captureFrame = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Mirror the image back to natural orientation before sending
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        setUiState('captured');
        canvas.toBlob(blob => {
            if (blob) {
                stopStream();
                onCapture(blob);
            }
        }, 'image/jpeg', 0.92);
    }, [onCapture, stopStream]);

    const runDetection = useCallback(() => {
        const video     = videoRef.current;
        const landmarker = landmarkerRef.current;
        if (!video || !landmarker || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(runDetection);
            return;
        }

        const results = landmarker.detectForVideo(video, performance.now());
        const shapes  = results?.faceBlendshapes?.[0]?.categories as Array<{ categoryName: string; score: number }> | undefined;

        if (shapes) {
            const left  = shapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score  ?? 0;
            const right = shapes.find(b => b.categoryName === 'eyeBlinkRight')?.score ?? 0;
            const avg   = (left + right) / 2;

            if (eyeStateRef.current === 'open' && avg > BLINK_CLOSE) {
                eyeStateRef.current = 'closed';
            } else if (eyeStateRef.current === 'closed' && avg < BLINK_OPEN) {
                // eyes reopened → blink complete
                captureFrame();
                return;
            }
        }

        rafRef.current = requestAnimationFrame(runDetection);
    }, [captureFrame]);

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            try {
                const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
                const resolver = await FilesetResolver.forVisionTasks(MP_CDN);
                const lm = await FaceLandmarker.createFromOptions(resolver, {
                    baseOptions: { modelAssetPath: MP_MODEL, delegate: 'GPU' },
                    outputFaceBlendshapes: true,
                    runningMode: 'VIDEO',
                    numFaces: 1,
                });
                if (cancelled) { lm.close(); return; }
                landmarkerRef.current = lm;

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;

                const video = videoRef.current!;
                video.srcObject = stream;
                await video.play();

                setUiState('ready');
                setTimeout(() => {
                    if (!cancelled) {
                        setUiState('watching');
                        runDetection();
                    }
                }, 800);
            } catch (err: any) {
                if (!cancelled) onError(err?.message ?? 'Camera access failed');
            }
        };

        init();

        return () => {
            cancelled = true;
            cancelAnimationFrame(rafRef.current);
            stopStream();
            landmarkerRef.current?.close?.();
        };
    }, [onError, runDetection, stopStream]);

    return (
        <div className="flex flex-col items-center gap-5 w-full">
            {/* Video frame with oval guide */}
            <div className="relative w-full aspect-[4/3] bg-zinc-900 rounded-[2rem] overflow-hidden">
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                    playsInline
                    muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Oval face guide */}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                    <div className="w-40 h-52 rounded-full border-[3px] border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                </div>

                {uiState === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                )}
            </div>

            <p
                role="status"
                aria-live="polite"
                className="text-center font-black text-sm text-zinc-900 uppercase tracking-tight px-4"
            >
                {labels[uiState]}
            </p>
        </div>
    );
}
