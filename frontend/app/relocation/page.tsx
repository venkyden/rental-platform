'use client';

import { useRouter } from 'next/navigation';

export default function RelocationPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-400/10 rounded-full blur-[100px] mix-blend-multiply pointer-events-none"></div>
            </div>

            <div className="z-10 max-w-md w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 p-8 text-center">
                <div className="text-6xl mb-6 animate-bounce">🌍</div>
                <h1 className="text-2xl font-bold text-zinc-900 mb-2">
                    Relocation Services
                </h1>
                <p className="text-zinc-500 mb-8">
                    Simplify your move to a new city.
                    <br />
                    <span className="text-sm px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full mt-2 inline-block font-medium">
                        D3 Exclusive (Flex & Nomads)
                    </span>
                </p>

                <div className="space-y-3 mb-6">
                    <div className="p-4 bg-white/60 backdrop-blur rounded-xl border border-white/80 text-left flex items-center gap-3">
                        <span>📦</span>
                        <span className="text-zinc-700 font-medium">Moving</span>
                    </div>
                    <div className="p-4 bg-white/60 backdrop-blur rounded-xl border border-white/80 text-left flex items-center gap-3">
                        <span>🛂</span>
                        <span className="text-zinc-700 font-medium">Visa Assistance</span>
                    </div>
                    <div className="p-4 bg-white/60 backdrop-blur rounded-xl border border-white/80 text-left flex items-center gap-3">
                        <span>🏫</span>
                        <span className="text-zinc-700 font-medium">School Search</span>
                    </div>
                </div>

                <button
                    onClick={() => router.back()}
                    className="w-full py-3 text-zinc-500 hover:text-zinc-700 transition-colors text-sm"
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
}
