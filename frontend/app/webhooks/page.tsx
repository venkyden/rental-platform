'use client';

import { useRouter } from 'next/navigation';

export default function WebhooksPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700 text-center">
                <div className="text-6xl mb-6">🔗</div>
                <h1 className="text-2xl font-bold text-white mb-2">ERP Integration</h1>
                <p className="text-gray-400 mb-8">
                    Configure your webhooks for real-time synchronization.
                    <br />
                    <span className="text-xs font-mono bg-gray-900 px-2 py-1 rounded mt-2 inline-block text-blue-400">
                        POST /api/v1/webhooks/subscribe
                    </span>
                </p>
                <button
                    onClick={() => router.back()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                    Manage API Keys
                </button>
            </div>
        </div>
    );
}
