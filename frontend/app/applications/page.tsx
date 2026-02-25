'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';

interface Application {
    id: string;
    property_id: string;
    status: string;
    cover_letter: string;
    created_at: string;
    // Expanded if we join property title (would need backend update or separate fetch, 
    // for now we'll just show Date/Status ID, or ideally fetch property details too)
}

export default function ApplicationsPage() {
    const router = useRouter();
    const toast = useToast();
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadApplications();
    }, []);

    const loadApplications = async () => {
        try {
            const response = await apiClient.client.get('/applications/me');
            setApplications(response.data);
        } catch (error) {
            console.error(error);
            toast.error('Error loading applications');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">Pending</span>;
            case 'approved': return <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">Approved ✅</span>;
            case 'rejected': return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">Rejected ❌</span>;
            default: return <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">{status}</span>;
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white shadow">
                    <div className="max-w-7xl mx-auto py-4 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">← Back</button>
                            <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
                        </div>
                        <button onClick={() => router.push('/search')} className="text-blue-600 font-medium hover:underline">
                            + New Search
                        </button>
                    </div>
                </header>
                <main className="max-w-7xl mx-auto py-8 px-4">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2].map(i => (
                                <div key={i} className="animate-pulse bg-white p-6 rounded-xl shadow h-32"></div>
                            ))}
                        </div>
                    ) : applications.length === 0 ? (
                        <div className="text-center bg-white rounded-xl shadow p-12">
                            <span className="text-6xl mb-4 block">📂</span>
                            <h2 className="text-xl font-bold mb-2">No Applications</h2>
                            <p className="text-gray-500 mb-6">You haven't submitted any applications yet.</p>
                            <button onClick={() => router.push('/search')} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:shadow-lg transition-all">
                                Browse Properties
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {applications.map((app) => (
                                <div key={app.id} className="bg-white rounded-xl shadow hover:shadow-md transition-all p-6 border-l-4 border-blue-500">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-bold text-gray-900">
                                                    Application #{app.id.substring(0, 8)}
                                                </h3>
                                                {getStatusBadge(app.status)}
                                            </div>
                                            <p className="text-sm text-gray-500 mb-2">
                                                Submitted on {new Date(app.created_at).toLocaleDateString()}
                                            </p>
                                            {app.cover_letter && (
                                                <div className="mt-4 bg-gray-50 p-4 rounded-lg text-gray-700 italic border border-gray-100">
                                                    "{app.cover_letter}"
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => router.push(`/properties/${app.property_id}`)}
                                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                        >
                                            View Property →
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </ProtectedRoute>
    );
}
