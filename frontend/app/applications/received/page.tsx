'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import VerificationGate from '@/components/VerificationGate';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import NotificationBell from '@/components/NotificationBell';

interface Application {
    id: string;
    property_id: string;
    tenant_id: string;
    status: string;
    cover_letter: string;
    created_at: string;
    property?: {
        title: string;
        city: string;
    };
    // In a real app we'd join Tenant info too, 
    // for now we'll just show IDs or need to fetch tenant details separately 
    // or update backend response model to include tenant info
}

export default function ReceivedApplicationsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const toast = useToast();
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [verificationRequired, setVerificationRequired] = useState(false);

    useEffect(() => {
        // Check if user is identity verified before loading
        if (user && !user.identity_verified) {
            setVerificationRequired(true);
            setLoading(false);
        } else if (user) {
            loadApplications();
        }
    }, [user]);

    const loadApplications = async () => {
        try {
            const response = await apiClient.client.get('/applications/received');
            setApplications(response.data);
        } catch (error: any) {
            console.error(error);
            if (error.response?.status === 403) {
                setVerificationRequired(true);
            } else {
                toast.error('Error loading received applications');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            await apiClient.client.patch(`/applications/${id}`, { status: newStatus });
            toast.success(`Application ${newStatus === 'approved' ? 'approved' : 'rejected'}!`);
            loadApplications(); // Refresh list
        } catch (error) {
            toast.error("Error updating");
        }
    };

    // Verification required screen
    if (verificationRequired) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6">
                            🔐
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">
                            Verify Your Identity
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Tenants only share their verified profiles with verified landlords.
                            Complete ID verification to view applications.
                        </p>

                        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2 text-gray-700">
                                    <span className="text-green-600">✓</span>
                                    <span>Access full tenant profiles and documents</span>
                                </li>
                                <li className="flex items-start gap-2 text-gray-700">
                                    <span className="text-green-600">✓</span>
                                    <span>Get a "Verified Landlord" badge on your listings</span>
                                </li>
                                <li className="flex items-start gap-2 text-gray-700">
                                    <span className="text-green-600">✓</span>
                                    <span>Build trust with prospective tenants</span>
                                </li>
                            </ul>
                        </div>

                        <button
                            onClick={() => router.push('/verification/identity')}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
                        >
                            Verify Now
                        </button>

                        <p className="text-xs text-gray-400 mt-4">
                            🔒 Your data is encrypted and never shared without consent
                        </p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">← Back</button>
                            <h1 className="text-2xl font-bold text-gray-900">Received Applications</h1>
                        </div>
                        <NotificationBell />
                    </div>
                </header>
                <main className="max-w-7xl mx-auto py-8 px-4">
                    {loading ? (
                        <div className="animate-pulse space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="bg-white h-24 rounded-xl shadow"></div>)}
                        </div>
                    ) : applications.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl shadow">
                            <span className="text-4xl block mb-2">📭</span>
                            <h3 className="text-lg font-medium text-gray-900">No new applications</h3>
                            <p className="text-gray-500">Your listings might be too quiet?</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {applications.map((app) => (
                                <div key={app.id} className="bg-white rounded-xl shadow p-6 flex flex-col md:flex-row justify-between gap-6">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-lg text-gray-900">
                                                    Rental Application
                                                    {app.property && <span className="text-gray-500 font-normal"> • {app.property.title} ({app.property.city})</span>}
                                                </h3>
                                                <div className="text-sm text-gray-500">
                                                    Received on {new Date(app.created_at).toLocaleDateString('en-US')}
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${app.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                app.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                {app.status.toUpperCase()}
                                            </span>
                                        </div>

                                        {app.cover_letter && (
                                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 italic text-gray-700 mb-4">
                                                "{app.cover_letter}"
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-sm font-medium text-gray-700">Applicant ID:</span>
                                            <code className="bg-gray-100 px-2 py-1 rounded text-xs">{app.tenant_id}</code>
                                            {/* In future version: Add link to View Tenant Profile */}
                                        </div>
                                    </div>

                                    {app.status === 'pending' && (
                                        <div className="flex md:flex-col gap-2 justify-center min-w-[140px]">
                                            <button
                                                onClick={() => handleStatusUpdate(app.id, 'approved')}
                                                className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                            >
                                                ✅ Accept
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(app.id, 'rejected')}
                                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                                            >
                                                ❌ Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </ProtectedRoute>
    );
}
