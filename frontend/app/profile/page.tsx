'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/useAuth';

export default function ProfilePage() {
    const router = useRouter();
    const { user, logout } = useAuth();

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 flex items-center gap-4">
                        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">← Retour</button>
                        <h1 className="text-2xl font-bold text-gray-900">Mon Profil</h1>
                    </div>
                </header>
                <main className="max-w-md mx-auto py-8 px-4">
                    <div className="bg-white rounded-xl shadow p-6 mb-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl">👤</div>
                            <div>
                                <h2 className="font-bold text-lg">{user?.full_name}</h2>
                                <p className="text-gray-500">{user?.email}</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <button className="w-full text-left p-3 hover:bg-gray-50 rounded border">⚙️ Paramètres du compte</button>
                            <button className="w-full text-left p-3 hover:bg-gray-50 rounded border">🔔 Notifications</button>
                            <button className="w-full text-left p-3 hover:bg-gray-50 rounded border">🛡️ Confidentialité (GDPR)</button>
                        </div>
                    </div>

                    <button onClick={logout} className="w-full py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 font-medium">
                        Déconnexion
                    </button>
                </main>
            </div>
        </ProtectedRoute>
    );
}
