'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import TeamManager from '@/components/TeamManager';

export default function TeamPage() {
    const router = useRouter();

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50">
                {/* Header */}
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                         <div className="flex items-center gap-8">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="text-[10px] font-black text-zinc-400 hover:text-zinc-900 uppercase tracking-widest transition-colors"
                            >
                                ← Dashboard
                            </button>
                            <h1 className="text-4xl font-black text-zinc-900 uppercase tracking-tighter">
                                 Team Management
                            </h1>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    <TeamManager />
                </main>
            </div>
        </ProtectedRoute>
    );
}
