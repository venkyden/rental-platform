'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';

export default function DocumentsPage() {
    const router = useRouter();

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50 relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-slate-50 to-white"></div>
                </div>

                <div className="relative z-10">
                    <Navbar />
                    <main className="max-w-7xl mx-auto py-8 px-4 text-center">
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 p-12">
                            <span className="text-6xl mb-4 block">🔒</span>
                            <h2 className="text-xl font-bold text-zinc-900 mb-2">Secure Vault</h2>
                            <p className="text-zinc-500 mb-6">Manage your verified documents (ID, Income, Receipts).</p>
                            <button
                                onClick={() => router.push('/verify/identity')}
                                className="px-6 py-3 text-sm font-bold text-white rounded-xl shadow-md transition-all hover:shadow-lg active:scale-[0.98] bg-teal-600 hover:bg-teal-500"
                            >
                                Update My Profile
                            </button>
                        </div>
                    </main>
                </div>
            </div>
        </ProtectedRoute>
    );
}
