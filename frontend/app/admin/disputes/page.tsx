'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import { disputeApi, DisputeStatus } from '@/app/lib/api/dispute';
import Navbar from '@/components/Navbar';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { 
    Shield, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    Gavel, 
    ExternalLink, 
    MessageSquare, 
    Camera, 
    User,
    Calendar,
    Euro,
    X,
    Info,
    MapPin,
    ArrowRight,
    ChevronLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface DisputeDetail {
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    evidence_urls: string[];
    response_description?: string;
    response_evidence_urls?: string[];
    responded_at?: string;
    amount_claimed?: number;
    admin_observations?: string;
    mediation_redirect_url?: string;
    location_verified?: string;
    report_distance_meters?: number;
    created_at: string;
    raised_by?: { full_name: string; email: string };
    accused?: { full_name: string; email: string };
    is_late_filing?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
    open: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    awaiting_response: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    under_review: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
};

const CONDITION_COLORS: Record<string, string> = {
    new: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    good: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    fair: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
    poor: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
    damaged: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    missing: 'text-gray-600 bg-gray-100 dark:bg-gray-800',
};

export default function AdminDisputesPage() {
    const router = useRouter();
    const [disputes, setDisputes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
    const [disputeDetail, setDisputeDetail] = useState<DisputeDetail | null>(null);
    const [diffData, setDiffData] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'evidence' | 'diff'>('evidence');
    
    const [observations, setObservations] = useState("");
    const [mediationUrl, setMediationUrl] = useState("");
    const [newStatus, setNewStatus] = useState<DisputeStatus | "">("");
    const [submitting, setSubmitting] = useState(false);
    
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [photoModal, setPhotoModal] = useState<{ url: string; label: string } | null>(null);

    useEffect(() => {
        loadDisputes();
    }, [statusFilter]);

    const loadDisputes = async () => {
        setLoading(true);
        try {
            const data = await disputeApi.listMyDisputes(); // Admin gets all via this endpoint if backend handles it, or use admin list
            // Check if admin list exists
            try {
                const adminData = await apiClient.client.get('/disputes/admin/list', { 
                    params: { status_filter: statusFilter } 
                });
                setDisputes(adminData.data);
            } catch {
                setDisputes(data);
            }
        } catch (err) {
            console.error('Failed to load disputes:', err);
            toast.error("Failed to load disputes");
        } finally {
            setLoading(false);
        }
    };

    const loadDetail = async (id: string) => {
        setSelectedDisputeId(id);
        setLoading(true);
        try {
            const detailResponse = await apiClient.client.get(`/disputes/${id}/detail`);
            setDisputeDetail(detailResponse.data);
            setObservations(detailResponse.data.admin_observations || "");
            setMediationUrl(detailResponse.data.mediation_redirect_url || "");
            setNewStatus(detailResponse.data.status);
            
            // Auto-load diff if category is damage
            if (detailResponse.data.category === 'damage' || detailResponse.data.inventory_id) {
                const diffResponse = await apiClient.client.get(`/disputes/${id}/diff`);
                setDiffData(diffResponse.data);
            }
        } catch (err) {
            console.error('Failed to load detail:', err);
            toast.error("Error loading dispute details");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (close: boolean = false) => {
        if (!selectedDisputeId) return;
        setSubmitting(true);
        try {
            await disputeApi.adminUpdate(selectedDisputeId, {
                admin_observations: observations,
                status: newStatus as any || undefined,
                mediation_redirect_url: mediationUrl || undefined,
                close
            });
            toast.success(close ? "Dispute closed" : "Observations updated");
            if (close) {
                setSelectedDisputeId(null);
                setDisputeDetail(null);
                loadDisputes();
            } else {
                loadDetail(selectedDisputeId);
            }
        } catch (err) {
            console.error('Update failed:', err);
            toast.error("Failed to update dispute");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100">
                <Navbar />

                <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black">
                                    <Shield className="w-6 h-6" />
                                </div>
                                <h1 className="text-3xl font-extrabold tracking-tight">Facilitation Panel</h1>
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Preserve evidence and redirect parties to official mediation.
                                <span className="block font-bold text-teal-600 dark:text-teal-400 mt-1">Roomivo is a neutral facilitator. No verdicts.</span>
                            </p>
                        </div>

                        <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-x-auto no-scrollbar">
                            {['', 'open', 'awaiting_response', 'under_review', 'closed'].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setStatusFilter(f)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                                        statusFilter === f 
                                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md' 
                                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                    }`}
                                >
                                    {f || 'All'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {!selectedDisputeId ? (
                        /* Dispute List View */
                        <div className="grid gap-4">
                            {loading ? (
                                <div className="py-20 flex justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-zinc-900 dark:border-white rounded-full"></div></div>
                            ) : disputes.length === 0 ? (
                                <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-16 text-center border border-zinc-200 dark:border-zinc-800">
                                    <Clock className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold">All clear</h3>
                                    <p className="text-zinc-500">No active disputes to facilitate.</p>
                                </div>
                            ) : (
                                disputes.map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => loadDetail(d.id)}
                                        className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center gap-6 hover:shadow-xl hover:scale-[1.01] transition-all text-left"
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 ${STATUS_STYLES[d.status] || 'bg-zinc-100 text-zinc-500'}`}>
                                            {d.status === 'closed' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${STATUS_STYLES[d.status]}`}>
                                                    {d.status.replace('_', ' ')}
                                                </span>
                                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                                    {new Date(d.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                                {d.title}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-2 text-[10px] font-bold uppercase text-zinc-400">
                                                <span>{d.category.replace('_', ' ')}</span>
                                                {d.amount_claimed && <span className="text-red-500">€{d.amount_claimed.toLocaleString()}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">Review Details</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        /* Dispute Detail View */
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <button 
                                    onClick={() => { setSelectedDisputeId(null); setDisputeDetail(null); }}
                                    className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                    Back to List
                                </button>
                                
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setViewMode('evidence')}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'evidence' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md' : 'text-zinc-500'}`}
                                    >
                                        Evidence
                                    </button>
                                    {diffData && (
                                        <button 
                                            onClick={() => setViewMode('diff')}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'diff' ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md' : 'text-zinc-500'}`}
                                        >
                                            Inventory Diff
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Main Content: Evidence or Diff */}
                                <div className="lg:col-span-2 space-y-8">
                                    {viewMode === 'evidence' && disputeDetail && (
                                        <div className="space-y-8">
                                            {/* Summary Card */}
                                            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h2 className="text-2xl font-extrabold tracking-tight">{disputeDetail.title}</h2>
                                                    {disputeDetail.is_late_filing && (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            Late Filing
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                                                    {disputeDetail.description}
                                                </p>
                                                
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                                                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Reporter</div>
                                                        <div className="font-bold">{disputeDetail.raised_by?.full_name || 'Unknown'}</div>
                                                        <div className="text-xs text-zinc-500">{disputeDetail.raised_by?.email}</div>
                                                    </div>
                                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                                                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Accused</div>
                                                        <div className="font-bold">{disputeDetail.accused?.full_name || 'N/A'}</div>
                                                        <div className="text-xs text-zinc-500">{disputeDetail.accused?.email || 'General issue'}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Evidence Galleries */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Reporter Side */}
                                                <div className="space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                        <Camera className="w-4 h-4" />
                                                        Reporter Evidence
                                                    </h3>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {disputeDetail.evidence_urls?.map((url: string, i: number) => (
                                                            <button 
                                                                key={i} 
                                                                onClick={() => setPhotoModal({ url, label: `Evidence ${i+1}` })}
                                                                className="aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:scale-105 transition-transform"
                                                            >
                                                                <img src={resolveMediaUrl(url)} className="w-full h-full object-cover" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Accused Side */}
                                                <div className="space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                        <MessageSquare className="w-4 h-4" />
                                                        Counter-Response
                                                    </h3>
                                                    {disputeDetail.responded_at ? (
                                                        <>
                                                            <p className="text-xs bg-teal-50 dark:bg-teal-900/20 p-4 rounded-2xl border border-teal-100 dark:border-teal-800 text-teal-900 dark:text-teal-100 italic">
                                                                "{disputeDetail.response_description}"
                                                            </p>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {disputeDetail.response_evidence_urls?.map((url: string, i: number) => (
                                                                    <button 
                                                                        key={i} 
                                                                        onClick={() => setPhotoModal({ url, label: `Counter Evidence ${i+1}` })}
                                                                        className="aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:scale-105 transition-transform"
                                                                    >
                                                                        <img src={resolveMediaUrl(url)} className="w-full h-full object-cover" />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="p-8 text-center bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 text-xs">
                                                            No response submitted yet.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {viewMode === 'diff' && diffData && (
                                        <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                            <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                                                <h3 className="font-bold uppercase tracking-widest text-xs">Condition Comparison</h3>
                                                <div className="flex gap-4 text-[10px] font-bold">
                                                    <span className="text-zinc-500">MOVE-IN: {new Date(diffData.move_in.date).toLocaleDateString('fr-FR', { month: 'short', day: '2-digit' })}</span>
                                                    <span className="text-zinc-500">MOVE-OUT: {new Date(diffData.move_out.date).toLocaleDateString('fr-FR', { month: 'short', day: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-left opacity-60">
                                                        <th className="p-4 font-bold uppercase tracking-widest">Item</th>
                                                        <th className="p-4 font-bold uppercase tracking-widest">Before</th>
                                                        <th className="p-4 font-bold uppercase tracking-widest">After</th>
                                                        <th className="p-4 font-bold uppercase tracking-widest text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                    {diffData.diff.map((row: any, idx: number) => (
                                                        <tr key={idx} className={row.changed ? 'bg-red-50/30 dark:bg-red-900/10' : ''}>
                                                            <td className="p-4">
                                                                <div className="font-bold">{row.name}</div>
                                                                <div className="text-[10px] text-zinc-400">{row.category}</div>
                                                            </td>
                                                            <td className="p-4">
                                                                {row.before ? (
                                                                    <span className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-tighter ${CONDITION_COLORS[row.before.condition]}`}>
                                                                        {row.before.condition}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                            <td className="p-4">
                                                                {row.after ? (
                                                                    <span className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-tighter ${CONDITION_COLORS[row.after.condition]}`}>
                                                                        {row.after.condition}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                {row.changed ? (
                                                                    <AlertTriangle className="w-4 h-4 text-red-500 mx-auto" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Sidebar: Facilitation Actions */}
                                <div className="space-y-6">
                                    {/* Observations & Status */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-xl">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                                            <Gavel className="w-4 h-4" />
                                            Facilitation
                                        </h3>
                                        
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Observations (Internal/Neutral)</label>
                                                <textarea 
                                                    className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 text-xs min-h-[100px] outline-none focus:border-zinc-900 dark:focus:border-white transition-all"
                                                    placeholder="Enter factual observations about the evidence..."
                                                    value={observations}
                                                    onChange={e => setObservations(e.target.value)}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Update Status</label>
                                                <select 
                                                    className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-xs outline-none"
                                                    value={newStatus}
                                                    onChange={e => setNewStatus(e.target.value as any)}
                                                >
                                                    <option value="open">Open</option>
                                                    <option value="awaiting_response">Awaiting Response</option>
                                                    <option value="under_review">Under Review</option>
                                                    <option value="closed">Closed</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Mediation Link (Redirect)</label>
                                                <div className="relative">
                                                    <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                                    <input 
                                                        type="text"
                                                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 pr-10 text-[10px] outline-none"
                                                        placeholder="https://ec.europa.eu/consumers/odr"
                                                        value={mediationUrl}
                                                        onChange={e => setMediationUrl(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-4 space-y-3">
                                                <button 
                                                    onClick={() => handleUpdate(false)}
                                                    disabled={submitting}
                                                    className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                                                >
                                                    {submitting ? 'Saving...' : 'Update Observations'}
                                                </button>
                                                <button 
                                                    onClick={() => handleUpdate(true)}
                                                    disabled={submitting}
                                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:shadow-emerald-600/20 shadow-lg transition-all"
                                                >
                                                    Finalize & Close
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Geo-Verification */}
                                    <div className="bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-200 dark:border-zinc-800">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            Geo-Verification
                                        </h4>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold">Status</span>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${disputeDetail?.location_verified === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {disputeDetail?.location_verified || 'Unverified'}
                                            </span>
                                        </div>
                                        {disputeDetail?.report_distance_meters && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold">Distance</span>
                                                <span className="text-xs text-zinc-500">{disputeDetail.report_distance_meters.toFixed(0)}m from property</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Compliance Check */}
                                    <div className="p-6 bg-indigo-50 dark:bg-indigo-950/20 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/50">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Loi ALUR Check</h4>
                                        <p className="text-[10px] text-indigo-800/80 dark:text-indigo-200/80 leading-relaxed">
                                            Deductions for normal wear & tear are prohibited. 
                                            Landlords have 2 months max to return deposit if discrepancies exist.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* Photo Modal */}
                {photoModal && (
                    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPhotoModal(null)}>
                        <button className="absolute top-8 right-8 text-white p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-8 h-8" />
                        </button>
                        <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
                            <img src={resolveMediaUrl(photoModal.url)} alt={photoModal.label} className="w-full max-h-[85vh] object-contain rounded-3xl" />
                            <p className="text-center text-white mt-4 font-bold uppercase tracking-widest text-xs">{photoModal.label}</p>
                        </div>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
