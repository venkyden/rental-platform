'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import { disputeApi, DisputeStatus } from '@/app/lib/api/dispute';
import { useLanguage } from '@/lib/LanguageContext';
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
    open: 'bg-zinc-900 text-white border-zinc-900',
    awaiting_response: 'bg-zinc-100 text-zinc-900 border-zinc-200',
    under_review: 'bg-zinc-100 text-zinc-500 border-zinc-200',
    closed: 'bg-zinc-50 text-zinc-400 border-zinc-100',
};

const CONDITION_COLORS: Record<string, string> = {
    new: 'text-zinc-900 bg-zinc-100 font-black',
    good: 'text-zinc-700 bg-zinc-50',
    fair: 'text-zinc-500 bg-zinc-50',
    poor: 'text-zinc-400 bg-zinc-50',
    damaged: 'text-white bg-zinc-900',
    missing: 'text-zinc-300 bg-zinc-50 line-through',
};

export default function AdminDisputesPage() {
    const { t, language } = useLanguage();
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
            <div className="min-h-screen bg-zinc-50 text-zinc-900">
                <Navbar />

                <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center text-white">
                                    <Shield className="w-6 h-6" />
                                </div>
                                <h1 className="text-3xl font-extrabold tracking-tight">{t('facilitation.title')}</h1>
                            </div>
                            <p className="text-sm text-zinc-500">
                                {t('facilitation.subtitle')}
                                <span className="block font-black uppercase tracking-widest text-zinc-900 mt-1">{t('facilitation.neutralNotice')}</span>
                            </p>
                        </div>

                        <div className="flex bg-white p-1 rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto no-scrollbar">
                            {['', 'open', 'awaiting_response', 'under_review', 'closed'].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setStatusFilter(f)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                                        statusFilter === f 
                                        ? 'bg-zinc-900 text-white shadow-md' 
                                        : 'text-zinc-500 hover:text-zinc-900'
                                    }`}
                                >
                                    {f ? t(`facilitation.filters.${f === 'under_review' ? 'review' : f === 'awaiting_response' ? 'awaiting' : f}`) : t('facilitation.filters.all')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {!selectedDisputeId ? (
                        /* Dispute List View */
                        <div className="grid gap-4">
                            {loading ? (
                                <div className="py-20 flex justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-zinc-900 rounded-full"></div></div>
                            ) : disputes.length === 0 ? (
                                <div className="bg-white rounded-[2rem] p-16 text-center border border-zinc-200">
                                    <Clock className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold">{t('facilitation.allClear')}</h3>
                                    <p className="text-zinc-500">{t('facilitation.noDisputes')}</p>
                                </div>
                            ) : (
                                disputes.map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => loadDetail(d.id)}
                                        className="group bg-white border border-zinc-200 rounded-3xl p-6 flex flex-col md:flex-row md:items-center gap-6 hover:shadow-xl hover:scale-[1.01] transition-all text-left"
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 ${STATUS_STYLES[d.status] || 'bg-zinc-100 text-zinc-500'}`}>
                                            {d.status === 'closed' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${STATUS_STYLES[d.status]}`}>
                                                    {t(`facilitation.filters.${d.status === 'under_review' ? 'review' : d.status === 'awaiting_response' ? 'awaiting' : d.status}`)}
                                                </span>
                                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                                    {new Date(d.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold truncate group-hover:text-zinc-900 transition-colors">
                                                {d.title}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-2 text-[10px] font-black uppercase text-zinc-900">
                                                <span>{t(`facilitation.categories.${d.category}`)}</span>
                                                {d.amount_claimed && <span>€{d.amount_claimed.toLocaleString()}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-900 transition-colors">
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">{t('facilitation.reviewDetails')}</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <button 
                                    onClick={() => { setSelectedDisputeId(null); setDisputeDetail(null); }}
                                    className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                    {t('facilitation.backToList')}
                                </button>
                                
                                <div className="flex gap-2">
                                        <button 
                                            onClick={() => setViewMode('evidence')}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'evidence' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500'}`}
                                        >
                                            {t('facilitation.evidence')}
                                        </button>
                                    {diffData && (
                                        <button 
                                            onClick={() => setViewMode('diff')}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'diff' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500'}`}
                                        >
                                            {t('facilitation.inventoryDiff')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-8">
                                    {viewMode === 'evidence' && disputeDetail && (
                                        <div className="space-y-8">
                                            <div className="bg-white rounded-[2rem] p-8 border border-zinc-200 shadow-sm">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h2 className="text-2xl font-extrabold tracking-tight">{disputeDetail.title}</h2>
                                                    {disputeDetail.is_late_filing && (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {t('facilitation.lateFiling')}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-zinc-600 leading-relaxed mb-6">
                                                    {disputeDetail.description}
                                                </p>
                                                
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-4 bg-zinc-50 rounded-2xl">
                                                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('facilitation.reporter')}</div>
                                                        <div className="font-bold">{disputeDetail.raised_by?.full_name || 'Unknown'}</div>
                                                        <div className="text-xs text-zinc-500">{disputeDetail.raised_by?.email}</div>
                                                    </div>
                                                    <div className="p-4 bg-zinc-50 rounded-2xl">
                                                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('facilitation.accused')}</div>
                                                        <div className="font-bold">{disputeDetail.accused?.full_name || 'N/A'}</div>
                                                        <div className="text-xs text-zinc-500">{disputeDetail.accused?.email || 'General issue'}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                        <Camera className="w-4 h-4" />
                                                        {t('facilitation.reporterEvidence')}
                                                    </h3>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {disputeDetail.evidence_urls?.map((url: string, i: number) => (
                                                            <button 
                                                                key={i} 
                                                                onClick={() => setPhotoModal({ url, label: `Evidence ${i+1}` })}
                                                                className="aspect-square rounded-2xl overflow-hidden border border-zinc-200 hover:scale-105 transition-transform"
                                                            >
                                                                <img src={resolveMediaUrl(url)} className="w-full h-full object-cover" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                                        <MessageSquare className="w-4 h-4" />
                                                        {t('facilitation.counterResponse')}
                                                    </h3>
                                                    {disputeDetail.responded_at ? (
                                                        <>
                                                            <p className="text-xs bg-zinc-50 p-4 rounded-2xl border border-zinc-200 text-zinc-900 italic">
                                                                "{disputeDetail.response_description}"
                                                            </p>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {disputeDetail.response_evidence_urls?.map((url: string, i: number) => (
                                                                    <button 
                                                                        key={i} 
                                                                        onClick={() => setPhotoModal({ url, label: `Counter Evidence ${i+1}` })}
                                                                        className="aspect-square rounded-2xl overflow-hidden border border-zinc-200 hover:scale-105 transition-transform"
                                                                    >
                                                                        <img src={resolveMediaUrl(url)} className="w-full h-full object-cover" />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="p-8 text-center bg-zinc-100 rounded-2xl border border-dashed border-zinc-300 text-zinc-400 text-xs">
                                                            {t('facilitation.noResponse')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {viewMode === 'diff' && diffData && (
                                        <div className="bg-white rounded-[2rem] border border-zinc-200 overflow-hidden shadow-sm">
                                            <div className="p-6 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center">
                                                <h3 className="font-bold uppercase tracking-widest text-xs">{t('facilitation.conditionComparison')}</h3>
                                                <div className="flex gap-4 text-[10px] font-bold">
                                                    <span className="text-zinc-500">{t('facilitation.moveIn')}: {new Date(diffData.move_in.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: '2-digit' })}</span>
                                                    <span className="text-zinc-500">{t('facilitation.moveOut')}: {new Date(diffData.move_out.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            <table className="w-full text-xs">
                                                <thead>
                                                <tr className="text-left opacity-60">
                                                        <th className="p-4 font-bold uppercase tracking-widest">{t('facilitation.item')}</th>
                                                        <th className="p-4 font-bold uppercase tracking-widest">{t('facilitation.before')}</th>
                                                        <th className="p-4 font-bold uppercase tracking-widest">{t('facilitation.after')}</th>
                                                        <th className="p-4 font-bold uppercase tracking-widest text-center">{t('facilitation.status')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100">
                                                    {diffData.diff.map((row: any, idx: number) => (
                                                        <tr key={idx} className={row.changed ? 'bg-zinc-900/5' : ''}>
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
                                                                    <AlertTriangle className="w-4 h-4 text-zinc-900 mx-auto" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-4 h-4 text-zinc-300 mx-auto" />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-white rounded-[2rem] p-8 border border-zinc-200 shadow-xl">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                                            <Gavel className="w-4 h-4" />
                                            {t('dashboard.sections.facilitation')}
                                        </h3>
                                        
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{t('facilitation.observations')}</label>
                                                <textarea 
                                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-xs min-h-[100px] outline-none focus:border-zinc-900 transition-all"
                                                    placeholder={t('common.placeholders.factualObservations')}
                                                    value={observations}
                                                    onChange={e => setObservations(e.target.value)}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{t('facilitation.updateStatus')}</label>
                                                <select 
                                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs outline-none"
                                                    value={newStatus}
                                                    onChange={e => setNewStatus(e.target.value as any)}
                                                >
                                                    <option value="open">{t('facilitation.filters.open')}</option>
                                                    <option value="awaiting_response">{t('facilitation.filters.awaiting')}</option>
                                                    <option value="under_review">{t('facilitation.filters.review')}</option>
                                                    <option value="closed">{t('facilitation.filters.closed')}</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{t('facilitation.mediationLink')}</label>
                                                <div className="relative">
                                                    <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                                    <input 
                                                        type="text"
                                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 pr-10 text-[10px] outline-none"
                                                        placeholder={t('common.placeholders.url')}
                                                        value={mediationUrl}
                                                        onChange={e => setMediationUrl(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-4 space-y-3">
                                                <button 
                                                    onClick={() => handleUpdate(false)}
                                                    disabled={submitting}
                                                    className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                                                >
                                                    {submitting ? t('common.saving') : t('facilitation.updateObservations')}
                                                </button>
                                                <button 
                                                    onClick={() => handleUpdate(true)}
                                                    disabled={submitting}
                                                    className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all"
                                                >
                                                    {t('facilitation.finalizeClose')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Geo-Verification */}
                                    <div className="bg-zinc-100 rounded-[2rem] p-6 border border-zinc-200">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                                            <MapPin className="w-4 h-4" />
                                            {t('facilitation.geoVerification')}
                                        </h4>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold">{t('facilitation.status')}</span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${disputeDetail?.location_verified === 'verified' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-400 border border-zinc-200'}`}>
                                                {disputeDetail?.location_verified === 'verified' ? t('facilitation.verified') : t('facilitation.unverified')}
                                            </span>
                                        </div>
                                        {disputeDetail?.report_distance_meters && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold">{t('facilitation.distance')}</span>
                                                <span className="text-xs text-zinc-500">{t('facilitation.distanceFromProperty', { distance: disputeDetail.report_distance_meters.toFixed(0) }, `${disputeDetail.report_distance_meters.toFixed(0)}m from property`)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Compliance Check */}
                                    <div className="p-6 bg-zinc-900 rounded-[2rem] border border-zinc-800 shadow-2xl">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">{t('facilitation.alurCheck')}</h4>
                                        <p className="text-[10px] text-zinc-300 leading-relaxed">
                                            {t('facilitation.alurNotice')}
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
