'use client';

import { useRouter } from 'next/navigation';

export default function AnalyticsPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                <div className="flex items-center gap-4 mb-8">
                    <span className="text-4xl">📊</span>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Portfolio Performance</h1>
                        <p className="text-gray-500">Real-time statistics for investors</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="p-6 bg-blue-50 rounded-xl border border-blue-100 text-center">
                        <div className="text-3xl font-bold text-blue-600 mb-1">98.5%</div>
                        <div className="text-sm text-blue-800">Occupancy Rate</div>
                    </div>
                    <div className="p-6 bg-green-50 rounded-xl border border-green-100 text-center">
                        <div className="text-3xl font-bold text-green-600 mb-1">+4.2%</div>
                        <div className="text-sm text-green-800">Annual Yield</div>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-gray-400 mb-4 text-sm">
                        Full feature available soon for S2 & S3 segments.
                    </p>
                    <button
                        onClick={() => router.back()}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        Back
                    </button>
                </div>
            </div>
        </div>
    );
}
