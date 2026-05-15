'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import VerificationGate from '@/components/VerificationGate';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import NotificationBell from '@/components/NotificationBell';
import { Shield } from 'lucide-react';

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
                <div className="min-h-screen bg-white flex items-center justify-center p-4">
                    <div className="bg-white border border-zinc-100 rounded-[2.5rem] shadow-2xl max-w-md w-full p-12 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
                             <Shield className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-3xl font-black text-zinc-900 mb-4 uppercase tracking-tighter">
                            Identity Protocol
                        </h2>
                        <p className="text-zinc-500 font-medium mb-8 leading-relaxed">
                            Tenants only share their verified profiles with verified landlords.
                            Complete ID verification to unlock applications.
                        </p>

                        <div className="bg-zinc-50 rounded-2xl p-6 mb-8 text-left border border-zinc-100">
                            <ul className="space-y-4">
                                {[
                                    'Access full tenant profiles and documents',
                                    'Get a "Verified Landlord" badge on your listings',
                                    'Build trust with prospective tenants'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 mt-1.5" />
                                        <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest leading-tight">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <button
                            onClick={() => router.push('/verification/identity')}
                            className="w-full py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl"
                        >
                            Execute Verification
                        </button>

                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-6">
                             End-to-end encryption active
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
                            <span className="text-4xl block mb-2"></span>
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
                                                    {app.property && <span className="text-zinc-400 font-normal"> • {app.property.title} ({app.property.city})</span>}
                                                </h3>
                                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-1">
                                                    Received {new Date(app.created_at).toLocaleDateString('en-US')}
                                                </div>
                                            </div>
                                             <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] bg-zinc-900 text-white border border-zinc-900 shadow-sm">
                                                {app.status}
                                            </span>
                                        </div>

                                        {app.cover_letter && (
                                            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-zinc-600 text-sm italic mb-4">
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
                                        <div className="flex md:flex-col gap-3 justify-center min-w-[160px]">
                                            <button
                                                onClick={() => handleStatusUpdate(app.id, 'approved')}
                                                className="px-6 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                                            >
                                                 Approve
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(app.id, 'rejected')}
                                                className="px-6 py-3 bg-white border border-zinc-200 text-zinc-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-50 transition-all"
                                            >
                                                 Decline
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
