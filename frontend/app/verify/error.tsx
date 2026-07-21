'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function VerifyError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Verify route error:', error);
    }, [error]);

    const router = useRouter();
    const { t } = useLanguage();

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-md w-full text-center space-y-8">
                <div className="w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl">
                    <ShieldAlert className="w-10 h-10 text-white" strokeWidth={1.5} />
                </div>

                <div>
                    <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tighter mb-3">
                        {t('errors.somethingWentWrong', undefined, 'Something went wrong')}
                    </h1>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                        An unexpected error occurred during verification. Please try again or return to your dashboard.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => reset()}
                        className="w-full py-5 bg-zinc-900 hover:bg-zinc-800 text-white font-black rounded-full text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <RefreshCw className="w-4 h-4" />
                        {t('errors.tryAgain', undefined, 'Try Again')}
                    </button>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-full py-5 bg-zinc-50 border border-zinc-200 text-zinc-900 font-black rounded-full text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:border-zinc-300 active:scale-95"
                    >
                        <Home className="w-4 h-4" />
                        {t('errors.goToDashboard', undefined, 'Go to Dashboard')}
                    </button>
                </div>

                {process.env.NODE_ENV === 'development' && (
                    <details className="text-left">
                        <summary className="text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 cursor-pointer select-none">
                            Error details
                        </summary>
                        <pre className="mt-3 p-4 bg-zinc-950 text-red-400 font-mono text-xs rounded-2xl overflow-auto max-h-40">
                            {error.message}
                            {error.stack && `\n\n${error.stack}`}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
}
