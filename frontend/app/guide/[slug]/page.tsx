'use client';

import { useRouter } from 'next/navigation';

export default function GuidePage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-white">
            <header className="border-b">
                <div className="max-w-7xl mx-auto py-4 px-4 flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">← Retour</button>
                    <h1 className="text-2xl font-bold text-gray-900">Centre de Ressources</h1>
                </div>
            </header>
            <main className="max-w-4xl mx-auto py-12 px-4">
                <div className="prose lg:prose-xl mx-auto">
                    <h1>Guides & Conseils</h1>
                    <p>Découvrez nos articles pour réussir votre projet immobilier.</p>

                    <div className="grid gap-6 not-prose mt-8">
                        <div className="border rounded-xl p-6">
                            <h3 className="font-bold text-xl mb-2">📖 Guide du Locataire</h3>
                            <p className="text-gray-600">Comprendre le dossier, les garants et le bail.</p>
                        </div>
                        <div className="border rounded-xl p-6">
                            <h3 className="font-bold text-xl mb-2">💰 Guide des Prix (Propriétaire)</h3>
                            <p className="text-gray-600">Tendances du marché et estimation des loyers.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
