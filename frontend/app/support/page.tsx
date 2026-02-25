'use client';

import { useRouter } from 'next/navigation';

export default function SupportPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white"></div>
            </div>

            <header className="relative z-10 bg-white/80 backdrop-blur-xl border-b border-white/50">
                <div className="max-w-7xl mx-auto py-4 px-4 flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-900 transition-colors">← Back</button>
                    <h1 className="text-2xl font-bold text-zinc-900">Help & Support</h1>
                </div>
            </header>

            <main className="relative z-10 max-w-3xl mx-auto py-12 px-4 text-center flex-1">
                <h1 className="text-3xl font-bold text-zinc-900 mb-4">How can we help you?</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] border border-white/50 hover:shadow-lg cursor-pointer transition-all hover:-translate-y-0.5">
                        <h3 className="font-bold text-lg mb-2">FAQ</h3>
                        <p className="text-zinc-500">Answers to frequently asked questions</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] border border-white/50 hover:shadow-lg cursor-pointer transition-all hover:-translate-y-0.5">
                        <h3 className="font-bold text-lg mb-2">Chat Support</h3>
                        <p className="text-zinc-500">Talk to an advisor (9am-6pm)</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
