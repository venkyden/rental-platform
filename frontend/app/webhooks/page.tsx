'use client';

import { useRouter } from 'next/navigation';

export default function WebhooksPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-400/10 rounded-full blur-[100px] mix-blend-multiply pointer-events-none"></div>
            </div>

            <div className="z-10 max-w-md w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 p-8 text-center">
                <div className="text-6xl mb-6">🔗</div>
                <h1 className="text-2xl font-bold text-zinc-900 mb-2">ERP Integration</h1>
                <p className="text-zinc-500 mb-8">
                    Configure your webhooks for real-time synchronization.
                    <br />
                    <span className="text-xs font-mono bg-zinc-100 text-zinc-600 px-2 py-1 rounded-lg mt-2 inline-block">
                        POST /api/v1/webhooks/subscribe
                    </span>
                </p>
                <button
                    onClick={() => router.back()}
                    className="px-6 py-3 text-sm font-bold text-white rounded-xl shadow-md transition-all hover:shadow-lg active:scale-[0.98] bg-teal-600 hover:bg-teal-500"
                >
                    Manage API Keys
                </button>
            </div>
        </div>
    );
}
