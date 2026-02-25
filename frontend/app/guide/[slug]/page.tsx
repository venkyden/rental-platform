'use client';

import { useRouter } from 'next/navigation';

export default function GuidePage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-white">
            <header className="border-b">
                <div className="max-w-7xl mx-auto py-4 px-4 flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">← Back</button>
                    <h1 className="text-2xl font-bold text-gray-900">Resource Center</h1>
                </div>
            </header>
            <main className="max-w-4xl mx-auto py-12 px-4">
                <div className="prose lg:prose-xl mx-auto">
                    <h1>Guides & Tips</h1>
                    <p>Discover our articles to help with your real estate project.</p>

                    <div className="grid gap-6 not-prose mt-8">
                        <div className="border rounded-xl p-6">
                            <h3 className="font-bold text-xl mb-2">📖 Tenant's Guide</h3>
                            <p className="text-gray-600">Understanding the application, guarantors, and lease.</p>
                        </div>
                        <div className="border rounded-xl p-6">
                            <h3 className="font-bold text-xl mb-2">💰 Pricing Guide (Landlord)</h3>
                            <p className="text-gray-600">Market trends and rent estimation.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
