'use client';

import { useRouter } from 'next/navigation';

export default function GLIPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700 text-center">
                <div className="text-6xl mb-6">🛡️</div>
                <h1 className="text-2xl font-bold text-white mb-2">Garantie Loyers Impayés</h1>
                <p className="text-gray-400 mb-8">
                    Obtenez des devis instantanés pour vos portefeuilles.
                    <br />
                    <span className="text-sm px-2 py-1 bg-green-900 text-green-200 rounded mt-2 inline-block">
                        Partenariat AXA / Allianz
                    </span>
                </p>
                <button
                    onClick={() => router.back()}
                    className="px-6 py-2 border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
                >
                    Retour au tableau de bord
                </button>
            </div>
        </div>
    );
}
