'use client';

import { useRouter } from 'next/navigation';

export default function BulkImportPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-400/10 rounded-full blur-[100px] mix-blend-multiply pointer-events-none"></div>
            </div>

            <div className="z-10 max-w-md w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 p-8 text-center">
                <div className="text-6xl mb-6">📤</div>
                <h1 className="text-2xl font-bold text-zinc-900 mb-2">Bulk Import</h1>
                <p className="text-zinc-500 mb-8">
                    Import your properties and tenants via CSV or XML.
                    <br />
                    <span className="text-sm px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full mt-2 inline-block font-medium">
                        Enterprise Feature (S3)
                    </span>
                </p>
                <div className="space-y-3">
                    <button
                        className="w-full py-3 text-sm font-bold text-white rounded-xl shadow-md transition-all hover:shadow-lg active:scale-[0.98] bg-teal-600 hover:bg-teal-500"
                    >
                        Download CSV Template
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="w-full py-3 text-zinc-500 hover:text-zinc-700 transition-colors text-sm"
                    >
                        Back
                    </button>
                </div>
            </div>
        </div>
    );
}
