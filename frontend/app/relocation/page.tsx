'use client';

import { useRouter } from 'next/navigation';

export default function RelocationPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-white/50 text-center">
                <div className="text-6xl mb-6 animate-bounce">🌍</div>
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 mb-2">
                    Relocation Services
                </h1>
                <p className="text-gray-500 mb-8">
                    Simplify your move to a new city.
                    <br />
                    <span className="text-sm px-2 py-1 bg-purple-100 text-purple-700 rounded-full mt-2 inline-block font-medium">
                        D3 Exclusive (Flex & Nomads)
                    </span>
                </p>

                <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-left flex items-center gap-3">
                        <span>📦</span>
                        <span className="text-gray-700 font-medium">Moving</span>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-left flex items-center gap-3">
                        <span>🛂</span>
                        <span className="text-gray-700 font-medium">Assistance Visa</span>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-left flex items-center gap-3">
                        <span>🏫</span>
                        <span className="text-gray-700 font-medium">School Search</span>
                    </div>
                </div>

                <button
                    onClick={() => router.back()}
                    className="mt-8 w-full py-3 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
}
