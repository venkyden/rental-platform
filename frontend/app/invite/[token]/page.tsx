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
    view_only: 'View Only',
    manage_visits: 'Manage Visits',
    full_access: 'Full Access'
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
            setError(err.response?.data?.detail || 'Invalid invitation link');
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
            setError(err.response?.data?.detail || 'Error accepting invitation');
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
                        Invalid Invitation
                    </h1>
                    <p className="text-gray-500 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Back to Home
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
                        Invitation Accepted!
                    </h1>
                    <p className="text-gray-500 mb-6">
                        You now have access to {invite?.landlord_name}'s properties
                    </p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Go to Dashboard
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
                        Invitation Expired
                    </h1>
                    <p className="text-gray-500 mb-6">
                        This invitation has expired. Ask {invite.landlord_name} to send you a new one.
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Back to Home
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
                        Invitation Already Used
                    </h1>
                    <p className="text-gray-500 mb-6">
                        This invitation has already been accepted or revoked.
                    </p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Go to Dashboard
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
                        You're Invited!
                    </h1>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="text-center mb-6">
                        <p className="text-gray-600">
                            <strong>{invite?.landlord_name}</strong> invites you to join their team
                        </p>
                    </div>

                    {/* Invite Details */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Name</span>
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
                            <span className="text-gray-500">Accessible Properties</span>
                            <span className="font-medium">{invite?.property_count} {invite?.property_count === 1 ? 'property' : 'properties'}</span>
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
                                Logged in as <strong>{user.email}</strong>
                            </p>
                            {user.email.toLowerCase() !== invite?.email.toLowerCase() && (
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-3 text-sm">
                                    ⚠️ This invitation is for {invite?.email}. Please log in with that account.
                                </div>
                            )}
                            <button
                                onClick={handleAccept}
                                disabled={accepting || user.email.toLowerCase() !== invite?.email.toLowerCase()}
                                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                            >
                                {accepting ? 'Accepting...' : '✓ Accept Invitation'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <button
                                onClick={() => router.push(`/auth/login?returnUrl=/invite/${token}`)}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                            >
                                Log in to Accept
                            </button>
                            <button
                                onClick={() => router.push(`/auth/register?returnUrl=/invite/${token}&email=${invite?.email}`)}
                                className="w-full py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                            >
                                Create an Account
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
