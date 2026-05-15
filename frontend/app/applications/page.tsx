'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { FileText } from 'lucide-react';

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
        return <span className="px-3 py-1 bg-zinc-900 text-white rounded-full text-[8px] font-black uppercase tracking-[0.2em] shadow-sm">{status}</span>;
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
                         <button onClick={() => router.push('/search')} className="text-zinc-900 font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform">
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
                         <div className="text-center bg-white border border-zinc-100 rounded-3xl shadow-2xl p-16">
                            <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-zinc-100 shadow-inner">
                                <FileText className="w-10 h-10 text-zinc-300" />
                            </div>
                            <h2 className="text-2xl font-black text-zinc-900 mb-2 uppercase tracking-tighter">No Applications</h2>
                            <p className="text-zinc-500 font-medium mb-10">Your journey hasn't started yet.</p>
                            <button onClick={() => router.push('/search')} className="px-8 py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl">
                                Browse Properties
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                             {applications.map((app) => (
                                <div key={app.id} className="bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all p-8 border border-zinc-100 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-zinc-900/10 transition-colors" />
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4 mb-3">
                                                <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tighter leading-none">
                                                    Protocol {app.id.substring(0, 8)}
                                                </h3>
                                                {getStatusBadge(app.status)}
                                            </div>
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-6">
                                                Submitted {new Date(app.created_at).toLocaleDateString()}
                                            </p>
                                            {app.cover_letter && (
                                                <div className="bg-zinc-50 p-6 rounded-2xl text-zinc-600 text-sm italic border border-zinc-100">
                                                    "{app.cover_letter}"
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => router.push(`/properties/${app.property_id}`)}
                                            className="text-zinc-900 hover:scale-110 transition-transform font-black text-[10px] uppercase tracking-widest pl-8"
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
