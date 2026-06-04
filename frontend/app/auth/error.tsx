'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function AuthError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const { t } = useLanguage();

    useEffect(() => {
        console.error('Auth route error:', error);
    }, [error]);

    return (
        <div className="w-full text-center space-y-8">
            <div className="w-16 h-16 bg-zinc-950 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-xl shadow-zinc-950/10">
                <ShieldAlert className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>

            <div>
                <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight mb-2">
                    {t('auth.error.title', undefined, 'Something went wrong')}
                </h2>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                    {t('auth.error.description', undefined, 'An unexpected error occurred. Please try again or return to the login page.')}
                </p>
            </div>

            <div className="flex flex-col gap-3">
                <button
                    onClick={() => reset()}
                    className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-black rounded-full text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t('auth.error.retry', undefined, 'Try Again')}
                </button>
                <Link
                    href="/auth/login"
                    className="w-full py-4 bg-zinc-50 border border-zinc-200 text-zinc-900 font-black rounded-full text-[10px] uppercase tracking-widest flex items-center justify-center transition-all hover:border-zinc-300 active:scale-95"
                >
                    {t('auth.error.backToLogin', undefined, 'Back to Login')}
                </Link>
            </div>

            {process.env.NODE_ENV === 'development' && (
                <details className="text-left mt-4">
                    <summary className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 cursor-pointer select-none">
                        {t('auth.error.details', undefined, 'Error details')}
                    </summary>
                    <pre className="mt-3 p-4 bg-zinc-950 text-red-400 font-mono text-[10px] rounded-2xl overflow-auto max-h-40">
                        {error.message}
                        {error.stack && `\n\n${error.stack}`}
                    </pre>
                </details>
            )}
        </div>
    );
}
