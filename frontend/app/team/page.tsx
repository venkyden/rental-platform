'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import TeamManager from '@/components/TeamManager';

export default function TeamPage() {
    const router = useRouter();

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
                {/* Header */}
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                                ← Dashboard
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">
                                👥 Gestion d'équipe
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
