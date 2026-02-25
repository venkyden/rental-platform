'use client';

import { useRouter } from 'next/navigation';

export default function SupportPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto py-4 px-4 flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">← Back</button>
                    <h1 className="text-2xl font-bold text-gray-900">Help & Support</h1>
                </div>
            </header>
            <main className="max-w-3xl mx-auto py-12 px-4 text-center">
                <span className="text-6xl mb-6 block">🛟</span>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">How can we help you?</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <div className="bg-white p-6 rounded-xl shadow border hover:shadow-md cursor-pointer">
                        <h3 className="font-bold text-lg mb-2">FAQ</h3>
                        <p className="text-gray-500">Answers to frequently asked questions</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow border hover:shadow-md cursor-pointer">
                        <h3 className="font-bold text-lg mb-2">Chat Support</h3>
                        <p className="text-gray-500">Talk to an advisor (9am-6pm)</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
