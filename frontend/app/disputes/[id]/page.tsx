"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { disputeApi, Dispute, DisputeCategory, DisputeStatus } from '@/app/lib/api/dispute';
import { mediaApi } from '@/app/lib/api/media';
import { useAuth } from '@/lib/useAuth';
import { 
    ChevronLeft, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    Shield, 
    ExternalLink, 
    MessageSquare, 
    Camera, 
    Image as ImageIcon,
    User,
    Calendar,
    Euro,
    X,
    Info,
    Gavel
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useLanguage } from '@/lib/LanguageContext';

export default function DisputeDetailPage() {
    const { t, language } = useLanguage();
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const { user: currentUser } = useAuth();

    const [dispute, setDispute] = useState<Dispute | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Response State
    const [responseDesc, setResponseDesc] = useState("");
    const [responseFiles, setResponseFiles] = useState<File[]>([]);
    const [responsePreviews, setResponsePreviews] = useState<string[]>([]);
    const responseInputRef = useRef<HTMLInputElement>(null);

    // Additional Evidence State (for reporter)
    const [extraFiles, setExtraFiles] = useState<File[]>([]);
    const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
    const extraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadDispute();
    }, [id]);

    const loadDispute = async () => {
        try {
            const data = await disputeApi.getDetail(id);
            setDispute(data);
        } catch (err) {
            console.error(err);
            toast.error(t('disputes.messages.loadDetailError', undefined, undefined));
            router.push('/disputes');
        } finally {
            setLoading(false);
        }
    };

    const handleAddEvidence = async () => {
        if (extraFiles.length === 0) return;
        setSubmitting(true);
        try {
            const urls: string[] = [];
            for (const file of extraFiles) {
                const url = await mediaApi.upload(file, 'disputes');
                urls.push(url);
            }
            await disputeApi.addEvidence(id, urls);
            toast.success(t('disputes.messages.addEvidenceSuccess', undefined, undefined));
            setExtraFiles([]);
            setExtraPreviews([]);
            loadDispute();
        } catch (err) {
            console.error(err);
            toast.error(t('disputes.messages.addEvidenceError', undefined, undefined));
        } finally {
            setSubmitting(false);
        }
    };

    const handleRespond = async () => {
        if (!responseDesc) return;
        setSubmitting(true);
        try {
            const urls: string[] = [];
            for (const file of responseFiles) {
                const url = await mediaApi.upload(file, 'disputes');
                urls.push(url);
            }
            await disputeApi.respond(id, {
                response_description: responseDesc,
                response_evidence_urls: urls
            });
            toast.success(t('disputes.messages.responseSuccess', undefined, undefined));
            setResponseDesc("");
            setResponseFiles([]);
            setResponsePreviews([]);
            loadDispute();
        } catch (err) {
            console.error(err);
            toast.error(t('disputes.messages.responseError', undefined, undefined));
        } finally {
            setSubmitting(false);
        }
    };

    const isReporter = currentUser?.id === dispute?.raised_by_id;
    const isAccused = currentUser?.id === dispute?.accused_id;

    if (loading || !dispute) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
            </div>
        );
    }

    const getStatusLabel = (status: string) => {
        return t(`disputes.status.${status}` as any, undefined, undefined);
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'open': return 'text-zinc-500 bg-zinc-50';
            case 'awaiting_response': return 'text-zinc-900 bg-zinc-100';
            case 'under_review': return 'text-zinc-900 bg-zinc-200';
            case 'closed': return 'text-zinc-400 bg-zinc-50';
            default: return 'text-zinc-600 bg-zinc-50';
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 text-zinc-900 pb-24">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-zinc-200">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button 
                        onClick={() => router.push('/disputes')}
                        className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors flex items-center gap-2"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm font-bold">{t('disputes.detail.back', undefined, undefined)}</span>
                    </button>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border border-current ${getStatusStyles(dispute.status)}`}>
                        {getStatusLabel(dispute.status)}
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 pt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Left Column: Details */}
                <div className="md:col-span-2 space-y-8">
                    {/* Title & Meta */}
                    <section>
                        <h1 className="text-3xl font-extrabold tracking-tight mb-4">{dispute.title}</h1>
                        <div className="flex flex-wrap gap-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                <span>{new Date(dispute.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', day: '2-digit', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Info className="w-4 h-4" />
                                <span>{t(`disputes.incident.categories.${dispute.category}.label` as any, undefined, undefined)}</span>
                            </div>
                            {dispute.amount_claimed && (
                                <div className="flex items-center gap-1.5 text-zinc-900">
                                    <Euro className="w-4 h-4" />
                                    <span>€{dispute.amount_claimed.toLocaleString()} {t('disputes.detail.claimed', undefined, undefined)}</span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Description */}
                    <section className="bg-white rounded-[2rem] p-8 border border-zinc-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 rounded-bl-[2rem] flex items-center justify-center">
                            <MessageSquare className="w-8 h-8 opacity-10" />
                        </div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">{t('disputes.detail.description', undefined, undefined)}</h3>
                        <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap">
                            {dispute.description}
                        </p>
                    </section>

                    {/* Reporter Evidence Gallery */}
                    <section>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4 px-1">{t('disputes.detail.reporterEvidence', undefined, undefined)}</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {dispute.evidence_urls.map((url, idx) => (
                                <a 
                                    key={idx} 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="aspect-square rounded-[1.5rem] overflow-hidden border border-zinc-200 group relative"
                                >
                                    <img src={url} alt={`Evidence ${idx}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ExternalLink className="text-white w-6 h-6" />
                                    </div>
                                </a>
                            ))}
                            
                            {/* Add More Evidence (Reporter only) */}
                            {isReporter && dispute.status !== 'closed' && dispute.evidence_urls.length < 5 && (
                                <div className="space-y-3">
                                    <button 
                                        onClick={() => extraInputRef.current?.click()}
                                        className="w-full aspect-square rounded-[1.5rem] border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-2 hover:bg-white transition-all group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Camera className="w-5 h-5 text-zinc-500" />
                                        </div>
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase">{t('disputes.detail.addPhoto', undefined, undefined)}</span>
                                    </button>
                                    <input 
                                        ref={extraInputRef} type="file" accept="image/*" capture="environment" className="hidden" 
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setExtraFiles([...extraFiles, file]);
                                                setExtraPreviews([...extraPreviews, URL.createObjectURL(file)]);
                                            }
                                        }}
                                    />
                                    {extraFiles.length > 0 && (
                                        <button 
                                            onClick={handleAddEvidence}
                                            disabled={submitting}
                                            className="w-full py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold uppercase"
                                        >
                                            {submitting ? t('disputes.messages.uploading', undefined, undefined) : t('disputes.detail.saveEvidence', undefined, undefined)}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Counter-Response Section */}
                    {(dispute.responded_at || isAccused) && (
                        <section className="bg-zinc-50 border border-zinc-200 rounded-[2rem] p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900">{t('disputes.detail.accusedResponseTitle', undefined, undefined)}</h3>
                            </div>

                            {dispute.responded_at ? (
                                <div className="space-y-6">
                                    <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap">
                                        {dispute.response_description}
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {dispute.response_evidence_urls.map((url, idx) => (
                                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-2xl overflow-hidden border border-zinc-200 group relative">
                                                <img src={url} alt="Counter Evidence" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            </a>
                                        ))}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                        {t('disputes.detail.submittedOn', { date: new Date(dispute.responded_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as any) }, undefined)}
                                    </div>
                                </div>
                            ) : isAccused && dispute.status !== 'closed' ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-zinc-500 mb-4">
                                        {t('disputes.detail.accusedResponsePrompt', undefined, undefined)}
                                    </p>
                                    <textarea 
                                        className="w-full bg-white border border-zinc-200 focus:border-zinc-900 outline-none rounded-2xl p-4 min-h-[120px] transition-all"
                                        placeholder={t('disputes.detail.accusedResponsePlaceholder', undefined, undefined)}
                                        value={responseDesc}
                                        onChange={e => setResponseDesc(e.target.value)}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {responsePreviews.map((p, i) => (
                                            <div key={i} className="w-16 h-16 rounded-xl overflow-hidden border border-zinc-200 relative">
                                                <img src={p} className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                        {responseFiles.length < 5 && (
                                            <button 
                                                onClick={() => responseInputRef.current?.click()}
                                                className="w-16 h-16 rounded-xl border-2 border-dashed border-zinc-200 flex items-center justify-center text-zinc-400 hover:bg-white transition-colors"
                                            >
                                                <Camera className="w-6 h-6" />
                                            </button>
                                        )}
                                    </div>
                                    <input ref={responseInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setResponseFiles([...responseFiles, file]);
                                            setResponsePreviews([...responsePreviews, URL.createObjectURL(file)]);
                                        }
                                    }} />
                                    <button 
                                        onClick={handleRespond}
                                        disabled={!responseDesc || submitting}
                                        className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-bold shadow-lg shadow-zinc-900/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        {submitting ? t('disputes.messages.submitting', undefined, undefined) : t('disputes.detail.submitResponse', undefined, undefined)}
                                    </button>
                                </div>
                            ) : null}
                        </section>
                    )}
                </div>

                {/* Right Column: Status & Facilitation */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <section className="bg-white rounded-[2rem] p-8 border border-zinc-200 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6">{t('disputes.detail.currentStatus', undefined, undefined)}</h3>
                        
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className={`w-1 bg-zinc-100 rounded-full relative`}>
                                    <div className={`absolute top-0 left-0 w-full rounded-full ${getStatusStyles(dispute.status).split(' ')[0]} transition-all duration-1000`} style={{ height: 
                                        dispute.status === 'open' ? '25%' : 
                                        dispute.status === 'awaiting_response' ? '50%' :
                                        dispute.status === 'under_review' ? '75%' : '100%' 
                                    }}></div>
                                </div>
                                <div className="space-y-8 py-2">
                                    {[
                                        { id: 'open' },
                                        { id: 'awaiting_response' },
                                        { id: 'under_review' },
                                        { id: 'closed' }
                                    ].map((step, idx) => {
                                        const isDone = ['open', 'awaiting_response', 'under_review', 'closed'].indexOf(dispute.status) >= idx;
                                        return (
                                            <div key={step.id} className={`flex items-start gap-3 ${isDone ? 'opacity-100' : 'opacity-30'}`}>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isDone ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold tracking-tight">{t(`disputes.detail.steps.${step.id}.label` as any, undefined, undefined)}</div>
                                                    <div className="text-[10px] text-zinc-400">{t(`disputes.detail.steps.${step.id}.desc` as any, undefined, undefined)}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Facilitation Info */}
                    <section className="bg-zinc-900 rounded-[2rem] p-8 text-white shadow-xl shadow-zinc-900/20">
                        <div className="flex items-center gap-3 mb-4">
                            <Gavel className="w-6 h-6 text-zinc-400" />
                            <h3 className="text-lg font-bold">{t('disputes.detail.facilitationTitle', undefined, undefined)}</h3>
                        </div>
                        
                        {dispute.admin_observations ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-white/10 rounded-2xl border border-white/10 text-xs leading-relaxed italic">
                                    "{dispute.admin_observations}"
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                {t('disputes.detail.facilitationDesc', undefined, undefined)}
                            </p>
                        )}

                        {dispute.mediation_redirect_url && (
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">{t('disputes.detail.recommendedAction', undefined, undefined)}</p>
                                <a 
                                    href={dispute.mediation_redirect_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-4 bg-white text-zinc-900 rounded-2xl font-bold text-xs hover:bg-zinc-50 transition-colors border border-zinc-200"
                                >
                                    <span>{t('disputes.detail.proceedMediation', undefined, undefined)}</span>
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <p className="text-[9px] text-zinc-500 mt-3 text-center opacity-80 uppercase tracking-tighter">
                                    {t('disputes.detail.mediationPlatform', undefined, undefined)}
                                </p>
                            </div>
                        )}
                    </section>

                    {/* Legal Context */}
                    <section className="bg-zinc-100 rounded-[2rem] p-8 border border-zinc-200">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-zinc-400 mb-4">{t('disputes.detail.legalDisclaimerTitle', undefined, undefined)}</h4>
                        <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-tighter">
                            {t('disputes.detail.legalDisclaimerDesc', undefined, undefined)}
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
}
