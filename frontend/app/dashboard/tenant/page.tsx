'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSegment, QuickActions, SegmentBadge, FeatureGate } from '@/lib/SegmentContext';

export default function TenantDashboard() {
    const { user, loading: authLoading } = useAuth();
    const { config, loading: segmentLoading } = useSegment();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
        }
    }, [user, authLoading, router]);

    if (authLoading || segmentLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Bienvenue, {user?.full_name || 'Locataire'}
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <SegmentBadge />
                            <span className="text-sm text-gray-500">Tableau de bord locataire</span>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/auth/logout')}
                        className="text-gray-600 hover:text-gray-900"
                    >
                        Déconnexion
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Verification prompt for D1 */}
                {/* Contextual Verification Prompts (v3) */}
                <FeatureGate feature="verification">
                    {!user?.identity_verified && (
                        <>
                            {/* D1: Guarantor Focus */}
                            {config?.settings.verification_flow === 'guarantor' && (
                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🤝</span>
                                        <div>
                                            <h3 className="font-medium text-indigo-900">Ajouter un Garant</h3>
                                            <p className="text-sm text-indigo-700">
                                                Multipliez vos chances par 3 avec un dossier complet.
                                                <span className="block text-xs mt-1 text-indigo-500">Compatible Visale & Garantme</span>
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => router.push('/verify/guarantor')}
                                            className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                                        >
                                            Ajouter
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* D2: Income Focus */}
                            {config?.settings.verification_flow === 'income' && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">💼</span>
                                        <div>
                                            <h3 className="font-medium text-green-900">Justificatifs de Revenus</h3>
                                            <p className="text-sm text-green-700">
                                                Prouvez votre stabilité financière pour rassurer les propriétaires.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => router.push('/verify/income')}
                                            className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                                        >
                                            Importer
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* D3: Identity Focus */}
                            {config?.settings.verification_flow === 'identity' && (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🛂</span>
                                        <div>
                                            <h3 className="font-medium text-purple-900">Identité & Visa</h3>
                                            <p className="text-sm text-purple-700">
                                                Validez votre statut de résident pour accéder aux locations.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => router.push('/verify/identity')}
                                            className="ml-auto px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                                        >
                                            Vérifier
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Fallback for legacy D1 logic if settings are missing */}
                            {config?.settings.show_verification_prompt && !config?.settings.verification_flow && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">⚠️</span>
                                        <div>
                                            <h3 className="font-medium text-yellow-800">Complétez votre profil</h3>
                                            <p className="text-sm text-yellow-700">
                                                Vérifiez votre identité pour accéder à plus de logements
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => router.push('/verify')}
                                            className="ml-auto px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm"
                                        >
                                            Vérifier maintenant
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </FeatureGate>

                {/* Quick Actions */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
                    <QuickActions />
                </section>

                {/* Stats for experienced tenants */}
                <FeatureGate feature="history">
                    <section className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mon activité</h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm">
                                <div className="text-2xl font-bold text-blue-600">0</div>
                                <div className="text-sm text-gray-500">Candidatures</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm">
                                <div className="text-2xl font-bold text-green-600">0</div>
                                <div className="text-sm text-gray-500">Visites prévues</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm">
                                <div className="text-2xl font-bold text-purple-600">0</div>
                                <div className="text-sm text-gray-500">Favoris</div>
                            </div>
                        </div>
                    </section>
                </FeatureGate>

                {/* Premium badge for D3 */}
                <FeatureGate feature="relocation">
                    <section className="mb-8">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">⭐</span>
                                <h2 className="text-lg font-semibold">Services Premium</h2>
                            </div>
                            <p className="text-purple-100 mb-4">
                                Profitez de nos services de relocation pour votre mobilité professionnelle
                            </p>
                            <button
                                onClick={() => router.push('/relocation')}
                                className="px-4 py-2 bg-white text-purple-600 rounded-lg font-medium"
                            >
                                Découvrir
                            </button>
                        </div>
                    </section>
                </FeatureGate>

                {/* Recent searches */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Recherches récentes</h2>
                    <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
                        <p>Aucune recherche récente</p>
                        <button
                            onClick={() => router.push('/search')}
                            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg"
                        >
                            Chercher un logement
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}
