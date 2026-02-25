'use client';

import { useRouter } from 'next/navigation';

export default function AnalyticsPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-400/10 rounded-full blur-[100px] mix-blend-multiply pointer-events-none"></div>
            </div>

            <div className="z-10 max-w-2xl w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 p-8">
                <div className="flex items-center gap-4 mb-8">
                    <span className="text-4xl">📊</span>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">Portfolio Performance</h1>
                        <p className="text-zinc-500">Real-time statistics for investors</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="p-6 bg-teal-50/50 rounded-2xl border border-teal-100 text-center">
                        <div className="text-3xl font-bold text-teal-700 mb-1">98.5%</div>
                        <div className="text-sm text-teal-800">Occupancy Rate</div>
                    </div>
                    <div className="p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-center">
                        <div className="text-3xl font-bold text-emerald-700 mb-1">+4.2%</div>
                        <div className="text-sm text-emerald-800">Annual Yield</div>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-zinc-400 mb-4 text-sm">
                        Full feature available soon for S2 & S3 segments.
                    </p>
                    <button
                        onClick={() => router.back()}
                        className="px-6 py-3 text-sm font-bold text-zinc-700 bg-white border-2 border-zinc-200 rounded-xl hover:border-zinc-300 transition-all active:scale-[0.98]"
                    >
                        Back
                    </button>
                </div>
            </div>
        </div>
    );
}
