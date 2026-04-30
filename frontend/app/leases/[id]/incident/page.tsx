"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { disputeApi, DisputeCategory } from '@/app/lib/api/dispute';
import { leaseApi, Lease } from '@/app/lib/api/lease';
import { mediaApi } from '@/app/lib/api/media';
import { 
    Camera, 
    AlertTriangle, 
    Building, 
    Wrench, 
    CheckCircle2, 
    Info, 
    Sparkles,
    ChevronLeft,
    Shield,
    Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';

export default function IncidentReportingPage() {
    const { t } = useLanguage();
    const params = useParams();
    const leaseId = params.id as string;
    const router = useRouter();

    const [lease, setLease] = useState<Lease | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [category, setCategory] = useState<string>('appliance_failure');
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [estimatedCost, setEstimatedCost] = useState("");
    const [photos, setPhotos] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadLease = async () => {
            try {
                const data = await leaseApi.get(leaseId);
                setLease(data);
            } catch (err) {
                console.error(err);
                toast.error(t('disputes.incident.messages.loadLeaseError'));
            } finally {
                setLoading(false);
            }
        };
        loadLease();
    }, [leaseId, t]);

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (photos.length >= 5) {
                toast.error(t('disputes.incident.messages.maxPhotos'));
                return;
            }
            setPhotos([...photos, file]);
            setPreviews([...previews, URL.createObjectURL(file)]);
        }
    };

    const handleSubmit = async () => {
        if (!title || !description) {
            toast.error(t('disputes.incident.messages.requiredFields'));
            return;
        }

        setSubmitting(true);
        try {
            // 1. Upload photos
            const evidenceUrls: string[] = [];
            for (const photo of photos) {
                const url = await mediaApi.upload(photo, 'incidents');
                evidenceUrls.push(url);
            }

            // 2. Submit report
            await disputeApi.create({
                lease_id: leaseId,
                accused_id: lease?.landlord_id || "",
                title,
                description,
                category,
                amount_claimed: estimatedCost ? parseFloat(estimatedCost) : undefined,
                evidence_urls: evidenceUrls
            });

            router.push('/disputes?success=true');
        } catch (err) {
            console.error(err);
            toast.error(t('disputes.messages.addEvidenceError'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            </div>
        );
    }

    const categories = [
        { id: 'appliance_failure', icon: <Wrench className="w-5 h-5" /> },
        { id: 'damage', icon: <AlertTriangle className="w-5 h-5" /> },
        { id: 'cleaning', icon: <Sparkles className="w-5 h-5" /> },
        { id: 'shared_liability', icon: <Building className="w-5 h-5" /> },
        { id: 'other', icon: <Info className="w-5 h-5" /> },
    ];

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-extrabold tracking-tight">{t('disputes.incident.title')}</h1>
                    <div className="w-10"></div>
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
                {/* Legal Banner */}
                <section className="bg-zinc-900 dark:bg-white text-white dark:text-black rounded-3xl p-6 shadow-xl shadow-zinc-900/10 dark:shadow-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 dark:bg-black/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2 text-teal-400 dark:text-teal-600">
                            <Shield className="w-5 h-5" />
                            <span className="text-[10px] font-extrabold uppercase tracking-widest">{t('disputes.incident.dutyTitle')}</span>
                        </div>
                        <p className="text-sm text-zinc-300 dark:text-zinc-600 leading-relaxed font-medium">
                            {t('disputes.incident.dutyDesc')}
                        </p>
                    </div>
                </section>

                {/* Step 1: Category */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold px-1">{t('disputes.incident.step1')}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setCategory(cat.id)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                                    category === cat.id 
                                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-900/10' 
                                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300'
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${category === cat.id ? 'bg-teal-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                                    {cat.icon}
                                </div>
                                <div>
                                    <div className="font-bold">{t(`disputes.incident.categories.${cat.id}.label` as any)}</div>
                                    <div className="text-xs text-zinc-500">{t(`disputes.incident.categories.${cat.id}.desc` as any)}</div>
                                </div>
                                {category === cat.id && <CheckCircle2 className="w-5 h-5 ml-auto text-teal-600" />}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Step 2: Details */}
                <section className="space-y-6">
                    <h2 className="text-xl font-bold px-1">{t('disputes.incident.step2')}</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block px-1">{t('disputes.incident.form.title')}</label>
                            <input 
                                type="text"
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 font-bold outline-none focus:border-zinc-900 dark:focus:border-white transition-all shadow-sm"
                                placeholder={t('disputes.incident.form.titlePlaceholder')}
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block px-1">{t('disputes.incident.form.desc')}</label>
                            <textarea 
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 font-medium outline-none focus:border-zinc-900 dark:focus:border-white transition-all shadow-sm min-h-[120px]"
                                placeholder={t('disputes.incident.form.descPlaceholder')}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block px-1">{t('disputes.incident.form.cost')}</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">€</span>
                                <input 
                                    type="number"
                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 pl-8 font-bold outline-none focus:border-zinc-900 dark:focus:border-white transition-all shadow-sm"
                                    placeholder={t('disputes.incident.form.costPlaceholder')}
                                    value={estimatedCost}
                                    onChange={e => setEstimatedCost(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Step 3: Evidence */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold px-1">{t('disputes.incident.step3')}</h2>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {previews.map((src, i) => (
                            <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative group">
                                <img src={src} className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => {
                                        setPhotos(photos.filter((_, idx) => idx !== i));
                                        setPreviews(previews.filter((_, idx) => idx !== i));
                                    }}
                                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Plus className="w-4 h-4 rotate-45" />
                                </button>
                            </div>
                        ))}
                        
                        {photos.length < 5 && (
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-2 hover:bg-white dark:hover:bg-zinc-900 transition-all text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                            >
                                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-bold uppercase">{t('disputes.detail.addPhoto')}</span>
                            </button>
                        )}
                    </div>

                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden"
                        onChange={handlePhotoCapture}
                    />

                    <div className="flex gap-2 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-2xl">
                        <Info className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                            {t('disputes.incident.form.photoTip')}
                        </p>
                    </div>
                </section>

                {/* Submit */}
                <div className="pt-8">
                    <button 
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full py-5 bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-300 text-white rounded-3xl font-bold shadow-2xl shadow-teal-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
                    >
                        {submitting ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                <span>{t('disputes.incident.messages.loading')}</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-6 h-6" />
                                <span>{t('disputes.incident.form.submit')}</span>
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-zinc-400 text-center mt-4 font-bold uppercase tracking-widest">
                        {t('disputes.incident.form.sharingNotice')}
                    </p>
                </div>
            </main>
        </div>
    );
}
