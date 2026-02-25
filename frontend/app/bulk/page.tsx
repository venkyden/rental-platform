'use client';

import { useRouter } from 'next/navigation';

export default function BulkImportPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700 text-center">
                <div className="text-6xl mb-6">📤</div>
                <h1 className="text-2xl font-bold text-white mb-2">Bulk Import</h1>
                <p className="text-gray-400 mb-8">
                    Import your properties and tenants via CSV or XML.
                    <br />
                    <span className="text-sm px-2 py-1 bg-purple-900 text-purple-200 rounded mt-2 inline-block">
                        Enterprise Feature (S3)
                    </span>
                </p>
                <div className="space-y-3">
                    <button className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors">
                        Download CSV Template
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="w-full py-3 text-gray-400 hover:text-white transition-colors"
                    >
                        Back
                    </button>
                </div>
            </div>
        </div>
    );
}
