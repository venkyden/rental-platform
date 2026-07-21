'use client';

import { useEffect } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error Boundary caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-white px-6 relative overflow-hidden font-sans">
        <div className="relative z-10 max-w-lg w-full text-center">
          {/* Animated Warning Icon */}
          <div className="w-24 h-24 rounded-[2rem] bg-zinc-950 flex items-center justify-center mx-auto mb-10 shadow-2xl border border-zinc-800 animate-pulse">
            <ShieldAlert className="w-12 h-12 text-white" strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-900 tracking-tight uppercase italic mb-4">
            Critical System Error
          </h1>

          {/* Description */}
          <p className="text-zinc-400 font-bold uppercase text-xs tracking-widest leading-relaxed max-w-md mx-auto mb-16">
            A critical system error has occurred. The application is attempting to recover. Please try again or refresh your browser.
          </p>

          {/* Action Buttons */}
          <div className="flex justify-center">
            <button
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-zinc-900 hover:bg-zinc-800 text-white font-black rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>

          {/* Developer Details */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-16 text-left max-w-lg mx-auto">
              <details className="group cursor-pointer">
                <summary className="text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors select-none">
                  Critical Error Stack Trace
                </summary>
                <pre className="mt-4 p-6 bg-zinc-950 border border-zinc-900 text-red-400 font-mono text-xs rounded-3xl overflow-auto max-h-48 leading-relaxed">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
