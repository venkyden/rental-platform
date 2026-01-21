'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

interface InviteInfo {
    email: string;
    name: string;
    status: string;
    landlord_name: string;
    permission_level: string;
    property_count: number;
    expired: boolean;
}

const PERMISSION_LABELS: Record<string, string> = {
    view_only: 'Lecture seule',
    manage_visits: 'Gérer les visites',
    full_access: 'Accès complet'
};

export default function InviteAcceptPage() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const token = params?.token as string;

    const [invite, setInvite] = useState<InviteInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (token) {
            loadInvite();
        }
    }, [token]);

    const loadInvite = async () => {
        try {
            const response = await apiClient.client.get(`/team/invite/${token}`);
            setInvite(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Lien d\'invitation invalide');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        if (!user) {
            // Redirect to login with return URL
            router.push(`/auth/login?returnUrl=/invite/${token}`);
            return;
        }

        setAccepting(true);
        setError(null);

        try {
            await apiClient.client.post(`/team/invite/accept/${token}`);
            setSuccess(true);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erreur lors de l\'acceptation');
        } finally {
            setAccepting(false);
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (error && !invite) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
                    <span className="text-6xl mb-4 block">❌</span>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        Invitation invalide
                    </h1>
                    <p className="text-gray-500 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Retour à l'accueil
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
                    <span className="text-6xl mb-4 block">🎉</span>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        Invitation acceptée !
                    </h1>
                    <p className="text-gray-500 mb-6">
                        Vous avez maintenant accès aux biens de {invite?.landlord_name}
                    </p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Aller au Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (invite?.expired) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
                    <span className="text-6xl mb-4 block">⏰</span>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        Invitation expirée
                    </h1>
                    <p className="text-gray-500 mb-6">
                        Cette invitation a expiré. Demandez à {invite.landlord_name} de vous envoyer une nouvelle invitation.
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Retour à l'accueil
                    </button>
                </div>
            </div>
        );
    }

    if (invite?.status !== 'pending') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
                    <span className="text-6xl mb-4 block">ℹ️</span>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        Invitation déjà utilisée
                    </h1>
                    <p className="text-gray-500 mb-6">
                        Cette invitation a déjà été acceptée ou révoquée.
                    </p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Aller au Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 text-center">
                    <span className="text-5xl mb-3 block">📨</span>
                    <h1 className="text-2xl font-bold">
                        Vous êtes invité !
                    </h1>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="text-center mb-6">
                        <p className="text-gray-600">
                            <strong>{invite?.landlord_name}</strong> vous invite à rejoindre son équipe
                        </p>
                    </div>

                    {/* Invite Details */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nom</span>
                            <span className="font-medium">{invite?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Email</span>
                            <span className="font-medium">{invite?.email}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Permission</span>
                            <span className="font-medium">
                                {PERMISSION_LABELS[invite?.permission_level || ''] || invite?.permission_level}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Biens accessibles</span>
                            <span className="font-medium">{invite?.property_count} bien(s)</span>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Action */}
                    {user ? (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-500 text-center">
                                Connecté en tant que <strong>{user.email}</strong>
                            </p>
                            {user.email.toLowerCase() !== invite?.email.toLowerCase() && (
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-3 text-sm">
                                    ⚠️ Cette invitation est pour {invite?.email}. Veuillez vous connecter avec ce compte.
                                </div>
                            )}
                            <button
                                onClick={handleAccept}
                                disabled={accepting || user.email.toLowerCase() !== invite?.email.toLowerCase()}
                                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                            >
                                {accepting ? 'Acceptation...' : '✓ Accepter l\'invitation'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <button
                                onClick={() => router.push(`/auth/login?returnUrl=/invite/${token}`)}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                            >
                                Se connecter pour accepter
                            </button>
                            <button
                                onClick={() => router.push(`/auth/register?returnUrl=/invite/${token}&email=${invite?.email}`)}
                                className="w-full py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                            >
                                Créer un compte
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
