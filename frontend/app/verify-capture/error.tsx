'use client';

import { useEffect } from 'react';
import { Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function VerifyCaptureError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Verify-capture route error:', error);
    }, [error]);

    const { t } = useLanguage();

    return (
        <div className="min-h-[100dvh] bg-white flex flex-col font-sans">
            <header className="px-6 py-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-2xl">
                    <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900">
                    {t('verify.capture.title', undefined, 'Secure Capture')}
                </span>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto w-full">
                <div className="w-20 h-20 bg-zinc-900 text-white rounded-3xl flex items-center justify-center mb-8">
                    <AlertCircle className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tighter mb-4 text-zinc-900">
                    Error
                </h1>
                <p className="text-zinc-500 font-bold mb-8 px-4">
                    An unexpected error occurred. Please try again.
                </p>
                <button
                    onClick={() => reset()}
                    className="w-full py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-transform"
                >
                    <RefreshCw className="w-4 h-4" />
                    {t('errors.tryAgain', undefined, 'Try Again')}
                </button>

                {process.env.NODE_ENV === 'development' && (
                    <details className="text-left w-full mt-8">
                        <summary className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 cursor-pointer select-none">
                            Error details
                        </summary>
                        <pre className="mt-3 p-4 bg-zinc-950 text-red-400 font-mono text-[10px] rounded-2xl overflow-auto max-h-40">
                            {error.message}
                            {error.stack && `\n\n${error.stack}`}
                        </pre>
                    </details>
                )}
            </main>
        </div>
    );
}
