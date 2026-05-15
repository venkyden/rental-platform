'use client';

import { useRouter } from 'next/navigation';

export default function WebhooksPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-50 via-white to-white"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zinc-900/5 rounded-full blur-[100px] pointer-events-none"></div>
            </div>

            <div className="z-10 max-w-md w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 p-8 text-center">
                <div className="text-6xl mb-6"></div>
                <h1 className="text-4xl font-black text-zinc-900 mb-2 uppercase tracking-tighter leading-none">ERP Integration</h1>
                <p className="text-zinc-500 font-medium mb-8">
                    Configure your webhooks for real-time synchronization.
                    <br />
                    <span className="text-[10px] font-black bg-zinc-900 text-white px-3 py-1 rounded-full mt-4 inline-block uppercase tracking-[0.2em]">
                        Endpoint Security Active
                    </span>
                </p>
                <button
                    onClick={() => router.back()}
                    className="w-full py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl"
                >
                    Manage API Keys
                </button>
            </div>
        </div>
    );
}
