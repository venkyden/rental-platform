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

import { useLanguage } from '@/lib/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

function MyDisputesContent() {
    const { t, language } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const success = searchParams.get('success');

    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        if (success) {
            toast.success(t('disputes.incident.messages.success', undefined, undefined));
        }
        loadDisputes();
    }, [success]);

    const loadDisputes = async () => {
        try {
            const data = await disputeApi.listMyDisputes();
            setDisputes(data);
        } catch (err) {
            console.error(err);
            toast.error(t('disputes.messages.loadError', undefined, undefined));
        } finally {
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
                return 'bg-zinc-900 text-white border-zinc-900';
            case 'awaiting_response':
                return 'bg-zinc-100 text-zinc-900 border-zinc-200';
            case 'under_review':
                return 'bg-zinc-100 text-zinc-500 border-zinc-200';
            case 'closed':
                return 'bg-zinc-50 text-zinc-400 border-zinc-100';
            default:
                return 'bg-zinc-100 text-zinc-700 border-zinc-200';
        }
    };

    const getStatusLabel = (status: string) => {
        return t(`disputes.status.${status}` as any, undefined, undefined);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 text-zinc-900 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-zinc-200 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight">{t('disputes.title', undefined, undefined)}</h1>
                        <p className="text-sm text-zinc-500">{t('disputes.subtitle', undefined, undefined)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <LanguageSwitcher />
                        <button 
                            onClick={() => router.push('/dashboard')}
                            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                        >
                            <Shield className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto px-4 py-8">
                {/* Actions & Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-between items-start sm:items-center">
                    <div className="flex bg-white p-1 rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto no-scrollbar">
                        {['all', 'open', 'awaiting_response', 'under_review', 'closed'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                                    filter === f 
                                    ? 'bg-zinc-900 text-white shadow-md' 
                                    : 'text-zinc-500 hover:text-zinc-900'
                                }`}
                            >
                                {f === 'all' ? t('dashboard.inbox.filters.all', undefined, undefined) : t(`disputes.status.${f}` as any, undefined, undefined)}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={() => router.push('/disputes/new')}
                        className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        <span>{t('disputes.report', undefined, undefined)}</span>
                    </button>
                </div>

                {/* Disputes List */}
                {filteredDisputes.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center shadow-sm">
                        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileText className="w-10 h-10 text-zinc-400" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">{t('disputes.noReports', undefined, undefined)}</h2>
                        <p className="text-zinc-500 max-w-sm mx-auto mb-8">
                            {t('disputes.noReportsDesc', undefined, undefined)}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredDisputes.map((dispute) => (
                            <button
                                key={dispute.id}
                                onClick={() => router.push(`/disputes/${dispute.id}`)}
                                className="group bg-white border border-zinc-200 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 hover:border-zinc-900 transition-all hover:shadow-xl hover:scale-[1.01] text-left"
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
                                            {new Date(dispute.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold truncate group-hover:text-zinc-900 transition-colors">
                                        {dispute.title}
                                    </h3>
                                    <p className="text-sm text-zinc-500 line-clamp-1 mt-1">
                                        {dispute.description}
                                    </p>
                                    
                                    <div className="flex items-center gap-4 mt-4 text-[10px] font-bold uppercase tracking-tighter text-zinc-400">
                                        <div className="flex items-center gap-1">
                                            <ImageIcon className="w-3.5 h-3.5" />
                                            <span>{dispute.evidence_urls.length} {t('disputes.evidence', undefined, undefined)}</span>
                                        </div>
                                        {dispute.amount_claimed && (
                                            <div className="flex items-center gap-1">
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                <span>€{dispute.amount_claimed.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {dispute.response_description && (
                                            <div className="flex items-center gap-1 text-zinc-900">
                                                <MessageSquare className="w-3.5 h-3.5" />
                                                <span>{t('disputes.responseReceived', undefined, undefined)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Arrow */}
                                <div className="p-2 rounded-full bg-zinc-50 group-hover:bg-zinc-900 group-hover:text-white transition-all">
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Legal Note Footer */}
                <div className="mt-12 p-8 bg-zinc-900 text-white rounded-[2rem] relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <Shield className="w-6 h-6 text-white" />
                            <h2 className="text-xl font-black uppercase tracking-widest">{t('disputes.platformRoleTitle', undefined, undefined)}</h2>
                        </div>
                        <p className="text-zinc-300 leading-relaxed max-w-2xl">
                            {t('disputes.platformRoleDesc', undefined, undefined)}
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
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
            </div>
        }>
            <MyDisputesContent />
        </Suspense>
    );
}
