'use client';

import { useRouter } from 'next/navigation';

export default function IdentityVerifyPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                <div className="text-6xl mb-6 text-center">🛂</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Identité & Visa</h1>

                <div className="space-y-4 mb-8">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                        <h3 className="font-bold text-blue-900 mb-1">Passeport / CNI</h3>
                        <p className="text-sm text-blue-800">Scan automatique via caméra sécurisée.</p>
                        <button className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                            Scanner le document 📷
                        </button>
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl opacity-75">
                        <h3 className="font-bold text-gray-900 mb-1">Titre de Séjour / Visa</h3>
                        <p className="text-sm text-gray-600">Requis pour les passeports non-UE.</p>
                        <button className="mt-3 w-full py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-white">
                            Importer PDF
                        </button>
                    </div>
                </div>

                <div className="text-center">
                    <button
                        onClick={() => router.back()}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        Je le ferai plus tard
                    </button>
                </div>
            </div>
        </div>
    );
}
