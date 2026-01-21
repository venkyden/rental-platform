'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DocumentsPage() {
    const router = useRouter();

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 flex items-center gap-4">
                        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">← Retour</button>
                        <h1 className="text-2xl font-bold text-gray-900">Mes Documents</h1>
                    </div>
                </header>
                <main className="max-w-7xl mx-auto py-8 px-4 text-center">
                    <div className="bg-white rounded-xl shadow p-12">
                        <span className="text-6xl mb-4 block">🔒</span>
                        <h2 className="text-xl font-bold mb-2">Coffre-fort Sécurisé</h2>
                        <p className="text-gray-500 mb-6">Gérez vos documents vérifiés (CNI, Revenus, Quittances).</p>
                        <button onClick={() => router.push('/verify/identity')} className="px-6 py-2 bg-green-600 text-white rounded-lg">Mettre à jour mon dossier</button>
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
