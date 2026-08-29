'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { apiClient } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { ShieldCheck, Clock, CheckCircle2, XCircle, RotateCcw, ChevronLeft } from 'lucide-react';

interface PendingVerification {
    id: string;
    user_name: string;
    type: string; // identity_stalled | identity_pending_review | property
    status: string;
    upload_date: string;
    minutes_stalled: number;
    checks: Record<string, boolean> | null;
}

const TYPE_LABELS: Record<string, string> = {
    identity_pending_review: 'Needs manual review',
    identity_stalled: 'Stalled upload',
    property: 'Property',
};

export default function AdminVerificationsPage() {
    const [items, setItems] = useState<PendingVerification[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [selected, setSelected] = useState<PendingVerification | null>(null);
    const [docUrl, setDocUrl] = useState<string | null>(null);
    const [docLoading, setDocLoading] = useState(false);
    const [docError, setDocError] = useState<string | null>(null);
    const [reason, setReason] = useState('');

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const res = await apiClient.client.get('/admin/verifications/pending');
            setItems(res.data);
        } catch {
            toast.error('Failed to load the verification queue');
        } finally {
            setLoading(false);
        }
    };

    const openItem = async (item: PendingVerification) => {
        setSelected(item);
        setDocUrl(null);
        setDocError(null);
        setReason('');
        if (item.type !== 'identity_pending_review') return;

        setDocLoading(true);
        try {
            const res = await apiClient.client.get(`/admin/verifications/${item.id}/identity-document`, {
                responseType: 'blob',
            });
            setDocUrl(window.URL.createObjectURL(res.data));
        } catch (err: any) {
            setDocError(err.response?.data?.detail || 'Could not load the document');
        } finally {
            setDocLoading(false);
        }
    };

    const closeItem = () => {
        if (docUrl) window.URL.revokeObjectURL(docUrl);
        setSelected(null);
        setDocUrl(null);
        setDocError(null);
    };

    const approve = async () => {
        if (!selected) return;
        setSubmitting(true);
        try {
            await apiClient.client.post(`/admin/verifications/${selected.id}/approve`, null, {
                params: { type: 'identity' },
            });
            toast.success('Approved — the user can now complete the selfie step');
            closeItem();
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Approve failed');
        } finally {
            setSubmitting(false);
        }
    };

    const reject = async () => {
        if (!selected) return;
        setSubmitting(true);
        try {
            await apiClient.client.post(
                `/admin/verifications/${selected.id}/reject`,
                { reason: reason || null },
                { params: { type: 'identity' } }
            );
            toast.success('Rejected');
            closeItem();
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Reject failed');
        } finally {
            setSubmitting(false);
        }
    };

    const resetStalled = async (item: PendingVerification) => {
        setSubmitting(true);
        try {
            await apiClient.client.post(`/admin/verifications/${item.id}/reset`, null, {
                params: { type: 'identity' },
            });
            toast.success('Reset — the user can re-upload');
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Reset failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 text-zinc-900">
                <Navbar />

                <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-white">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight">Verification Queue</h1>
                            <p className="text-sm text-zinc-500">Identity documents the AI couldn't verify, plus stalled uploads.</p>
                        </div>
                    </div>

                    {!selected ? (
                        <div className="grid gap-4">
                            {loading ? (
                                <div className="py-20 flex justify-center">
                                    <div className="animate-spin h-8 w-8 border-b-2 border-zinc-900 rounded-full" />
                                </div>
                            ) : items.length === 0 ? (
                                <div className="bg-white rounded-[2rem] p-16 text-center border border-zinc-200">
                                    <CheckCircle2 className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold">All clear</h3>
                                    <p className="text-zinc-500">Nothing needs attention right now.</p>
                                </div>
                            ) : (
                                items.map((item) => (
                                    <div
                                        key={`${item.type}-${item.id}`}
                                        className="bg-white border border-zinc-200 rounded-3xl p-6 flex flex-col md:flex-row md:items-center gap-6"
                                    >
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 bg-zinc-100 text-zinc-500 border-zinc-200">
                                            <Clock className="w-6 h-6" />
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border bg-zinc-100 text-zinc-900 border-zinc-200">
                                                    {TYPE_LABELS[item.type] || item.type}
                                                </span>
                                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                                    {item.minutes_stalled}m
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold truncate">{item.user_name}</h3>
                                        </div>
                                        <div className="flex gap-2">
                                            {item.type === 'identity_pending_review' && (
                                                <button
                                                    onClick={() => openItem(item)}
                                                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-zinc-900 text-white hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                >
                                                    Review
                                                </button>
                                            )}
                                            {item.type === 'identity_stalled' && (
                                                <button
                                                    onClick={() => resetStalled(item)}
                                                    disabled={submitting}
                                                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <button
                                onClick={closeItem}
                                className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" /> Back to queue
                            </button>

                            <div className="bg-white rounded-[2rem] p-8 border border-zinc-200 shadow-sm space-y-6">
                                <div>
                                    <h2 className="text-2xl font-extrabold tracking-tight">{selected.user_name}</h2>
                                    <p className="text-sm text-zinc-500">{TYPE_LABELS[selected.type] || selected.type}</p>
                                </div>

                                <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 flex items-center justify-center min-h-[300px]">
                                    {docLoading ? (
                                        <div className="animate-spin h-8 w-8 border-b-2 border-zinc-900 rounded-full" />
                                    ) : docUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={docUrl} alt="Identity document" className="max-w-full max-h-[60vh] object-contain" />
                                    ) : (
                                        <p className="text-zinc-400 text-sm p-8 text-center">{docError || 'No document available.'}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
                                        Rejection reason (optional)
                                    </label>
                                    <textarea
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xs min-h-[80px] outline-none focus:border-zinc-900 transition-all"
                                        placeholder="e.g. Not a legible government ID"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={approve}
                                        disabled={submitting || !docUrl}
                                        className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Approve
                                    </button>
                                    <button
                                        onClick={reject}
                                        disabled={submitting}
                                        className="flex-1 py-4 bg-white border-2 border-zinc-900 text-zinc-900 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <XCircle className="w-4 h-4" /> Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </ProtectedRoute>
    );
}
