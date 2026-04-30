"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { disputeApi, Dispute } from '@/app/lib/api/dispute';
import { 
    AlertTriangle, 
    Clock, 
    CheckCircle2, 
    ChevronRight, 
    FileText, 
    MessageSquare,
    Image as ImageIcon,
    Filter,
    Plus,
    Search,
    Shield
} from 'lucide-react';
import { toast } from 'react-hot-toast';

function MyDisputesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const success = searchParams.get('success');

    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        if (success) {
            toast.success("Incident reported successfully");
        }
        loadDisputes();
    }, [success]);

    const loadDisputes = async () => {
        try {
            const data = await disputeApi.listMyDisputes();
            setDisputes(data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load your disputes");
        } finally {
            setLoading(true); // Wait, should be false
            setLoading(false);
        }
    };

    const filteredDisputes = disputes.filter(d => {
        if (filter === 'all') return true;
        return d.status === filter;
    });

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'open':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
            case 'awaiting_response':
                return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
            case 'under_review':
                return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
            case 'closed':
                return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
            default:
                return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
        }
    };

    const getStatusLabel = (status: string) => {
        return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight">Incident Reports</h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Track and manage your property disputes</p>
                    </div>
                    <button 
                        onClick={() => router.push('/dashboard')}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <Shield className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-4 py-8">
                {/* Actions & Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-between items-start sm:items-center">
                    <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        {['all', 'open', 'awaiting_response', 'under_review', 'closed'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                                    filter === f 
                                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md' 
                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                            >
                                {f.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={() => toast.error("Select a lease from your dashboard to report an incident")}
                        className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-teal-600/20 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Report Incident</span>
                    </button>
                </div>

                {/* Disputes List */}
                {filteredDisputes.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center shadow-sm">
                        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileText className="w-10 h-10 text-zinc-400" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">No reports found</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-8">
                            You haven't filed any incident reports yet. These reports help protect your deposit by creating a timestamped record of issues.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredDisputes.map((dispute) => (
                            <button
                                key={dispute.id}
                                onClick={() => router.push(`/disputes/${dispute.id}`)}
                                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 hover:border-zinc-900 dark:hover:border-white transition-all hover:shadow-xl hover:scale-[1.01] text-left"
                            >
                                {/* Left: Status & Icon */}
                                <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center border-2 ${getStatusStyles(dispute.status)}`}>
                                    {dispute.status === 'closed' ? <CheckCircle2 className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
                                </div>

                                {/* Center: Info */}
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md border ${getStatusStyles(dispute.status)}`}>
                                            {getStatusLabel(dispute.status)}
                                        </span>
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                            {new Date(dispute.created_at).toLocaleDateString('fr-FR', { month: 'short', day: '2-digit', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                        {dispute.title}
                                    </h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-1">
                                        {dispute.description}
                                    </p>
                                    
                                    <div className="flex items-center gap-4 mt-4 text-[10px] font-bold uppercase tracking-tighter text-zinc-400">
                                        <div className="flex items-center gap-1">
                                            <ImageIcon className="w-3.5 h-3.5" />
                                            <span>{dispute.evidence_urls.length} Evidence</span>
                                        </div>
                                        {dispute.amount_claimed && (
                                            <div className="flex items-center gap-1">
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                <span>€{dispute.amount_claimed.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {dispute.response_description && (
                                            <div className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                                                <MessageSquare className="w-3.5 h-3.5" />
                                                <span>Response received</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Arrow */}
                                <div className="p-2 rounded-full bg-zinc-50 dark:bg-zinc-800 group-hover:bg-zinc-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-all">
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Legal Note Footer */}
                <div className="mt-12 p-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-[2rem] relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-black/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <Shield className="w-6 h-6 text-teal-400 dark:text-teal-600" />
                            <h2 className="text-xl font-bold">Platform Role</h2>
                        </div>
                        <p className="text-zinc-300 dark:text-zinc-600 leading-relaxed max-w-2xl">
                            Roomivo acts as a neutral facilitator to collect and preserve timestamped evidence. 
                            We do not adjudicate disputes or render binding verdicts. For legal assistance, 
                            we recommend contacting the <strong>Conciliateur de Justice</strong> or using the 
                            <strong> EU Online Dispute Resolution</strong> platform.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function MyDisputesPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        }>
            <MyDisputesContent />
        </Suspense>
    );
}
