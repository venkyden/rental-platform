'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSegment, QuickActions, SegmentBadge, FeatureGate } from '@/lib/SegmentContext';

export default function LandlordDashboard() {
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
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
                            Bienvenue, {user?.full_name || 'Propriétaire'}
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <SegmentBadge />
                            <span className="text-sm text-gray-500">Tableau de bord propriétaire</span>
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
                {/* Onboarding tips for S1 */}
                {config?.settings.show_onboarding_tips && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">💡</span>
                            <div>
                                <h3 className="font-medium text-blue-800">Premiers pas</h3>
                                <p className="text-sm text-blue-700">
                                    Ajoutez votre premier bien pour commencer à recevoir des candidatures
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/properties/new')}
                                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                            >
                                Ajouter un bien
                            </button>
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
                    <QuickActions />
                </section>

                {/* Portfolio Stats */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Mon portfolio</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm">
                            <div className="text-2xl font-bold text-green-600">0</div>
                            <div className="text-sm text-gray-500">Biens actifs</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm">
                            <div className="text-2xl font-bold text-blue-600">0</div>
                            <div className="text-sm text-gray-500">Candidatures</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm">
                            <div className="text-2xl font-bold text-orange-600">0</div>
                            <div className="text-sm text-gray-500">Visites prévues</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm">
                            <div className="text-2xl font-bold text-purple-600">0</div>
                            <div className="text-sm text-gray-500">Messages</div>
                        </div>
                    </div>
                </section>

                {/* Analytics for S2 */}
                <FeatureGate feature="analytics">
                    <section className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analytics</h2>
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-gray-900">0</div>
                                    <div className="text-sm text-gray-500">Vues ce mois</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-gray-900">0%</div>
                                    <div className="text-sm text-gray-500">Taux d'occupation</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-gray-900">0€</div>
                                    <div className="text-sm text-gray-500">Revenus mensuels</div>
                                </div>
                            </div>
                            <button
                                onClick={() => router.push('/analytics')}
                                className="mt-4 w-full py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                            >
                                Voir les analytics détaillés
                            </button>
                        </div>
                    </section>
                </FeatureGate>

                {/* Team for S2 */}
                <FeatureGate feature="team">
                    <section className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Mon équipe</h2>
                            <button
                                onClick={() => router.push('/team')}
                                className="text-sm text-blue-600 hover:text-blue-700"
                            >
                                Gérer →
                            </button>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
                            <p>Invitez des collaborateurs pour gérer vos biens</p>
                            <button
                                onClick={() => router.push('/team')}
                                className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg"
                            >
                                Inviter un membre
                            </button>
                        </div>
                    </section>
                </FeatureGate>

                {/* Inbox for S2 */}
                <FeatureGate feature="inbox">
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Messages récents</h2>
                            <button
                                onClick={() => router.push('/inbox')}
                                className="text-sm text-blue-600 hover:text-blue-700"
                            >
                                Voir tout →
                            </button>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
                            <p>Aucun message</p>
                        </div>
                    </section>
                </FeatureGate>
            </main>
        </div>
    );
}
