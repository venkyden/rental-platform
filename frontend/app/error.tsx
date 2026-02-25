'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Unhandled error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden bg-slate-50">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white"></div>
            </div>
            <div className="z-10 max-w-md w-full text-center">
                <div className="text-6xl mb-6">⚠️</div>
                <h1 className="text-2xl font-bold text-zinc-900 mb-3">Something went wrong</h1>
                <p className="text-zinc-500 mb-8 leading-relaxed">
                    An unexpected error occurred. Our team has been notified. Please try again.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={() => reset()}
                        className="px-6 py-3 text-sm font-semibold text-white rounded-xl shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, #3DD6D0, #22B8B8)' }}
                    >
                        Try again
                    </button>
                    <a
                        href="/"
                        className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-all"
                    >
                        Go home
                    </a>
                </div>
                {process.env.NODE_ENV === 'development' && (
                    <details className="mt-8 text-left">
                        <summary className="text-sm text-gray-400 cursor-pointer">Error Details</summary>
                        <pre className="mt-2 p-4 bg-gray-900 text-red-400 rounded-lg text-xs overflow-auto max-h-48">
                            {error.message}
                            {error.stack && `\n\n${error.stack}`}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
}
