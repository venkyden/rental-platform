'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { apiClient } from '@/lib/api';
import Navbar from '@/components/Navbar';

interface Dispute {
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    verdict: string;
    amount_claimed: number | null;
    created_at: string;
}

interface DiffItem {
    id: string;
    name: string;
    category: string;
    condition: string;
    photos: string[];
    notes: string | null;
}

interface DiffRow {
    name: string;
    category: string;
    before: DiffItem | null;
    after: DiffItem | null;
    changed: boolean;
}

interface DiffData {
    dispute_id: string;
    lease_id: string;
    move_in: { id: string | null; date: string | null; items: DiffItem[] };
    move_out: { id: string | null; date: string | null; items: DiffItem[] };
    diff: DiffRow[];
    total_changes: number;
}

const STATUS_STYLES: Record<string, string> = {
    open: 'bg-red-100 text-red-700',
    evidence_needed: 'bg-amber-100 text-amber-700',
    under_review: 'bg-blue-100 text-blue-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    dismissed: 'bg-gray-100 text-gray-700',
};

const CONDITION_COLORS: Record<string, string> = {
    new: 'text-emerald-600 bg-emerald-50',
    good: 'text-green-600 bg-green-50',
    fair: 'text-yellow-600 bg-yellow-50',
    poor: 'text-orange-600 bg-orange-50',
    damaged: 'text-red-600 bg-red-50',
    missing: 'text-gray-600 bg-gray-100',
};

export default function AdminDisputesPage() {
    const router = useRouter();
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
    const [diffData, setDiffData] = useState<DiffData | null>(null);
    const [diffLoading, setDiffLoading] = useState(false);
    const [verdictForm, setVerdictForm] = useState({ verdict: '', admin_notes: '', resolve: false });
    const [submitting, setSubmitting] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [photoModal, setPhotoModal] = useState<{ url: string; label: string } | null>(null);

    useEffect(() => {
        loadDisputes();
    }, [statusFilter]);

    const loadDisputes = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (statusFilter) params.status_filter = statusFilter;
            const response = await apiClient.client.get('/disputes/admin/list', { params });
            setDisputes(response.data);
        } catch (err) {
            console.error('Failed to load disputes:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadDiff = async (disputeId: string) => {
        setSelectedDispute(disputeId);
        setDiffLoading(true);
        setDiffData(null);
        try {
            const response = await apiClient.client.get(`/disputes/${disputeId}/diff`);
            setDiffData(response.data);
        } catch (err) {
            console.error('Failed to load diff:', err);
        } finally {
            setDiffLoading(false);
        }
    };

    const submitVerdict = async () => {
        if (!selectedDispute || !verdictForm.verdict) return;
        setSubmitting(true);
        try {
            await apiClient.client.put(`/disputes/${selectedDispute}/verdict`, verdictForm);
            setSelectedDispute(null);
            setDiffData(null);
            setVerdictForm({ verdict: '', admin_notes: '', resolve: false });
            loadDisputes();
        } catch (err) {
            console.error('Failed to submit verdict:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const statusFilters = [
        { key: '', label: 'Tous', icon: '📋' },
        { key: 'open', label: 'Ouverts', icon: '🔴' },
        { key: 'evidence_needed', label: 'Preuves', icon: '📸' },
        { key: 'under_review', label: 'En revue', icon: '🔍' },
        { key: 'resolved', label: 'Résolus', icon: '✅' },
    ];

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-[var(--background)]">
                <Navbar />

                <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-3">
                                ⚖️ Litiges — Admin
                            </h1>
                            <p className="text-sm text-[var(--gray-500)] mt-1">
                                Comparez les états des lieux et rendez vos verdicts
                            </p>
                        </div>
                        <span className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold rounded-full">
                            ADMIN
                        </span>
                    </div>

                    {/* Status Filters */}
                    <div className="flex gap-2 mb-6">
                        {statusFilters.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setStatusFilter(f.key)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${statusFilter === f.key
                                        ? 'bg-gradient-to-r from-[var(--primary-500)] to-[var(--primary-600)] text-white shadow-lg'
                                        : 'bg-[var(--card-bg)] text-[var(--gray-600)] hover:bg-[var(--gray-100)] border border-[var(--card-border)]'
                                    }`}
                            >
                                <span>{f.icon}</span> {f.label}
                            </button>
                        ))}
                    </div>

                    {/* ─── Dispute List ─── */}
                    {!selectedDispute && (
                        <>
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-12 h-12 rounded-full border-4 border-[var(--primary-200)] border-t-[var(--primary-600)] animate-spin"></div>
                                </div>
                            ) : disputes.length === 0 ? (
                                <div className="premium-card p-16 text-center">
                                    <span className="text-5xl block mb-4">✅</span>
                                    <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">Aucun litige</h3>
                                    <p className="text-[var(--gray-500)]">Tout est calme pour le moment.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {disputes.map((d) => (
                                        <div
                                            key={d.id}
                                            onClick={() => loadDiff(d.id)}
                                            className="premium-card p-5 cursor-pointer hover:shadow-lg transition-shadow"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="font-bold text-[var(--foreground)]">{d.title}</h3>
                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[d.status] || 'bg-gray-100 text-gray-600'}`}>
                                                            {d.status.replace('_', ' ')}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700">
                                                            {d.category.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-[var(--gray-500)] truncate max-w-xl">{d.description}</p>
                                                </div>
                                                <div className="flex items-center gap-4 pl-4">
                                                    {d.amount_claimed && (
                                                        <span className="text-sm font-semibold text-orange-600">{d.amount_claimed}€</span>
                                                    )}
                                                    <span className="text-xs text-[var(--gray-400)]">{formatDate(d.created_at)}</span>
                                                    <span className="text-[var(--gray-400)]">→</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ─── Diff Viewer ─── */}
                    {selectedDispute && (
                        <div>
                            <button
                                onClick={() => { setSelectedDispute(null); setDiffData(null); }}
                                className="mb-4 text-[var(--primary-600)] hover:text-[var(--primary-800)] font-medium text-sm"
                            >
                                ← Retour à la liste
                            </button>

                            {diffLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-12 h-12 rounded-full border-4 border-[var(--primary-200)] border-t-[var(--primary-600)] animate-spin"></div>
                                </div>
                            ) : diffData ? (
                                <div className="space-y-6">
                                    {/* Diff Summary */}
                                    <div className="premium-card p-5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-lg font-bold text-[var(--foreground)]">Comparaison Avant / Après</h2>
                                                <p className="text-sm text-[var(--gray-500)]">
                                                    Entrée : {diffData.move_in.date ? formatDate(diffData.move_in.date) : 'N/A'} —
                                                    Sortie : {diffData.move_out.date ? formatDate(diffData.move_out.date) : 'N/A'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1.5 bg-red-100 text-red-700 text-sm font-bold rounded-xl">
                                                    {diffData.total_changes} changement{diffData.total_changes !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Diff Table */}
                                    <div className="premium-card overflow-hidden">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Élément</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pièce</th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                                                        <span className="flex items-center justify-center gap-1">📥 Entrée</span>
                                                    </th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                                                        <span className="flex items-center justify-center gap-1">📤 Sortie</span>
                                                    </th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Photos</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {diffData.diff.map((row, idx) => (
                                                    <tr
                                                        key={idx}
                                                        className={row.changed ? 'bg-red-50/50' : 'hover:bg-gray-50'}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                {row.changed && <span className="text-red-500">⚠️</span>}
                                                                <span className="font-medium text-gray-900">{row.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-gray-500">{row.category || '–'}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            {row.before ? (
                                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CONDITION_COLORS[row.before.condition] || 'bg-gray-100 text-gray-600'}`}>
                                                                    {row.before.condition}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {row.after ? (
                                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CONDITION_COLORS[row.after.condition] || 'bg-gray-100 text-gray-600'}`}>
                                                                    {row.after.condition}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex justify-center gap-1">
                                                                {(row.before?.photos || []).map((url, i) => (
                                                                    <button
                                                                        key={`before-${i}`}
                                                                        onClick={() => setPhotoModal({ url, label: `${row.name} — Entrée` })}
                                                                        className="w-8 h-8 rounded bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-xs transition-colors"
                                                                        title="Photo entrée"
                                                                    >📥</button>
                                                                ))}
                                                                {(row.after?.photos || []).map((url, i) => (
                                                                    <button
                                                                        key={`after-${i}`}
                                                                        onClick={() => setPhotoModal({ url, label: `${row.name} — Sortie` })}
                                                                        className="w-8 h-8 rounded bg-orange-100 hover:bg-orange-200 flex items-center justify-center text-xs transition-colors"
                                                                        title="Photo sortie"
                                                                    >📤</button>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {diffData.diff.length === 0 && (
                                            <div className="p-8 text-center text-gray-500">
                                                <span className="text-3xl block mb-2">📭</span>
                                                Aucune donnée d&apos;inventaire disponible pour cette comparaison.
                                            </div>
                                        )}
                                    </div>

                                    {/* Verdict Form */}
                                    <div className="premium-card p-6">
                                        <h3 className="text-lg font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
                                            ⚖️ Rendre le verdict
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Verdict</label>
                                                <select
                                                    value={verdictForm.verdict}
                                                    onChange={(e) => setVerdictForm(v => ({ ...v, verdict: e.target.value }))}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[var(--primary-500)] focus:border-transparent"
                                                >
                                                    <option value="">Sélectionner...</option>
                                                    <option value="tenant_wins">🏠 Locataire gagne</option>
                                                    <option value="landlord_wins">🏢 Propriétaire gagne</option>
                                                    <option value="split">⚖️ Partagé (50/50)</option>
                                                    <option value="none">🚫 Aucun verdict</option>
                                                </select>
                                            </div>
                                            <div className="flex items-end">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={verdictForm.resolve}
                                                        onChange={(e) => setVerdictForm(v => ({ ...v, resolve: e.target.checked }))}
                                                        className="w-4 h-4 rounded text-[var(--primary-600)]"
                                                    />
                                                    <span className="text-sm font-medium text-gray-700">Marquer comme résolu</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes admin</label>
                                            <textarea
                                                value={verdictForm.admin_notes}
                                                onChange={(e) => setVerdictForm(v => ({ ...v, admin_notes: e.target.value }))}
                                                rows={3}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--primary-500)] focus:border-transparent"
                                                placeholder="Justification du verdict, observations..."
                                            />
                                        </div>
                                        <button
                                            onClick={submitVerdict}
                                            disabled={!verdictForm.verdict || submitting}
                                            className="px-6 py-2.5 bg-gradient-to-r from-[var(--primary-600)] to-[var(--primary-700)] text-white font-medium rounded-xl hover:shadow-lg disabled:opacity-50 transition-all"
                                        >
                                            {submitting ? 'Enregistrement...' : '✅ Enregistrer le verdict'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="premium-card p-8 text-center text-red-500">
                                    Erreur lors du chargement de la comparaison.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Photo Modal */}
                    {photoModal && (
                        <div
                            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                            onClick={() => setPhotoModal(null)}
                        >
                            <div className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-gray-900">{photoModal.label}</h3>
                                    <button onClick={() => setPhotoModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                                </div>
                                <img
                                    src={photoModal.url}
                                    alt={photoModal.label}
                                    className="w-full rounded-xl object-contain max-h-[60vh]"
                                />
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </ProtectedRoute>
    );
}
