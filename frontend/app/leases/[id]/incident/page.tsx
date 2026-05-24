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
    X
} from 'lucide-react';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';

export default function IncidentReportingPage() {
    const { t } = useLanguage();
    const params = useParams();
    const leaseId = params.id as string;
    const router = useRouter();
    const toast = useToast();

    const [lease, setLease] = useState<Lease | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [category, setCategory] = useState<DisputeCategory>('appliance_failure');
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [estimatedCost, setEstimatedCost] = useState("");
    const [photos, setPhotos] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const CATEGORY_FALLBACKS: Record<DisputeCategory, string> = {
        appliance_failure: 'Appliance Failure / Panne d\'équipement',
        damage: 'Property Damage / Dégradation',
        cleaning: 'Cleaning / Nettoyage',
        shared_liability: 'Shared Space Issue / Sinistre Co-responsabilité',
        other: 'Other / Autre'
    };

    useEffect(() => {
        document.title = "Report an Incident | Roomivo";
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', 'File an official incident report for property maintenance or damage in compliance with French Loi ALUR.');

        const loadLease = async () => {
            try {
                const data = await leaseApi.get(leaseId);
                setLease(data);
            } catch (err) {
                console.error(err);
                toast.error('Failed to load lease details');
            } finally {
                setLoading(false);
            }
        };
        if (leaseId) {
            loadLease();
        }
    }, [leaseId]);

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (photos.length >= 5) {
                toast.error('Maximum of 5 photos is allowed');
                return;
            }
            // Validate size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Each photo must be under 5MB');
                return;
            }
            setPhotos([...photos, file]);
            setPreviews([...previews, URL.createObjectURL(file)]);
        }
    };

    const handleRemovePhoto = (index: number) => {
        setPhotos(photos.filter((_, idx) => idx !== index));
        setPreviews(previews.filter((_, idx) => idx !== index));
    };

    const handleSubmit = async () => {
        if (submitting) return;
        if (!title || !description) {
            toast.error('Please fill in all required fields');
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
                accused_id: lease?.landlord_id || undefined,
                title,
                description,
                category,
                amount_claimed: estimatedCost ? parseFloat(estimatedCost) : undefined,
                evidence_urls: evidenceUrls
            });

            toast.success('Incident reported successfully');
            router.push('/disputes?success=true');
        } catch (err: any) {
            console.error(err);
            if (err.response?.status === 429) {
                toast.error('Rate limit exceeded. Please wait before submitting more reports.');
            } else {
                toast.error('Failed to report incident. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-white"></div>
                </div>
            </ProtectedRoute>
        );
    }

    const categories: { id: DisputeCategory; icon: React.ReactNode }[] = [
        { id: 'appliance_failure', icon: <Wrench className="w-5 h-5" /> },
        { id: 'damage', icon: <AlertTriangle className="w-5 h-5" /> },
        { id: 'cleaning', icon: <Sparkles className="w-5 h-5" /> },
        { id: 'shared_liability', icon: <Building className="w-5 h-5" /> },
        { id: 'other', icon: <Info className="w-5 h-5" /> },
    ];

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white pb-20">
                    {/* Header */}
                    <div className="bg-white dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 backdrop-blur">
                        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                            <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <h1 className="text-lg font-extrabold tracking-tight">{t('disputes.incident.title')}</h1>
                            <div className="w-10"></div>
                        </div>
                    </div>

                    <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
                        {/* Legal Banner with French law citation */}
                        <section className="bg-zinc-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="relative z-10 space-y-2">
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <Shield className="w-5 h-5" />
                                    <span className="text-[10px] font-extrabold uppercase tracking-widest">{t('disputes.incident.dutyTitle') || 'Obligation de Signalement'}</span>
                                </div>
                                <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                                    {t('disputes.incident.dutyDesc') || 'As a tenant, you are legally required to report any property damage or failures promptly to preserve your guarantee and prevent further degradation.'}
                                </p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pt-2 border-t border-zinc-800">
                                    Loi ALUR (Article L.7-1 du décret n°87-712 du 26 août 1987) compliance protocol
                                </p>
                            </div>
                        </section>

                        {/* Step 1: Category */}
                        <section className="space-y-4">
                            <h2 className="text-xl font-bold px-1">{t('disputes.incident.step1') || '1. Select Category'}</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCategory(cat.id)}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                                            category === cat.id 
                                            ? 'border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900/80' 
                                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${category === cat.id ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                                            {cat.icon}
                                        </div>
                                        <div>
                                            <div className="font-bold">{t(`disputes.incident.categories.${cat.id}` as any) || t(`disputes.incident.categories.${cat.id}.label` as any) || CATEGORY_FALLBACKS[cat.id] || cat.id}</div>
                                        </div>
                                        {category === cat.id && <CheckCircle2 className="w-5 h-5 ml-auto text-zinc-950 dark:text-white" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Step 2: Details */}
                        <section className="space-y-6">
                            <h2 className="text-xl font-bold px-1">{t('disputes.incident.step2') || '2. Provide Incident Details'}</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block px-1">{t('disputes.incident.form.title') || 'Issue Title'}</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all shadow-sm text-zinc-900 dark:text-white"
                                        placeholder={t('disputes.incident.titlePlaceholder') || 'Brief description (e.g. Broken Heater)'}
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block px-1">{t('disputes.incident.form.desc') || 'Detailed Description'}</label>
                                    <textarea 
                                        className="w-full bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 font-medium outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all shadow-sm min-h-[120px] text-zinc-900 dark:text-white"
                                        placeholder={t('disputes.incident.descPlaceholder') || 'Explain what happened in detail...'}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 block px-1">Estimated Cost (€)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">€</span>
                                        <input 
                                            type="number"
                                            className="w-full bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 pl-8 font-bold outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition-all shadow-sm text-zinc-900 dark:text-white"
                                            placeholder="Estimated repair cost (optional)"
                                            value={estimatedCost}
                                            onChange={e => setEstimatedCost(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Step 3: Evidence */}
                        <section className="space-y-4">
                            <h2 className="text-xl font-bold px-1">{t('disputes.incident.step3') || '3. Photo Evidence'}</h2>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {previews.map((src, i) => (
                                    <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative group">
                                        <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => handleRemovePhoto(i)}
                                            className="absolute top-2 right-2 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                
                                {photos.length < 5 && (
                                    <>
                                        <button 
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-square rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-2 hover:bg-white dark:hover:bg-zinc-900/40 transition-all text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                                            aria-label="Upload photo from device"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-zinc-150 dark:bg-zinc-800 flex items-center justify-center">
                                                <Camera className="w-5 h-5" />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase">{t('disputes.detail.addPhoto') || 'Upload Photo'}</span>
                                        </button>
                                        
                                        <button 
                                            type="button"
                                            onClick={() => cameraInputRef.current?.click()}
                                            className="aspect-square rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-2 hover:bg-white dark:hover:bg-zinc-900/40 transition-all text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                                            aria-label="Capture photo using camera"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-zinc-150 dark:bg-zinc-800 flex items-center justify-center">
                                                <Camera className="w-5 h-5 animate-pulse" />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase">{t('disputes.detail.takePhoto') || 'Take Photo'}</span>
                                        </button>
                                    </>
                                )}
                            </div>

                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept="image/*" 
                                className="hidden"
                                onChange={handlePhotoCapture}
                            />
                            
                            <input 
                                ref={cameraInputRef}
                                type="file" 
                                accept="image/*" 
                                capture="environment"
                                className="hidden"
                                onChange={handlePhotoCapture}
                            />

                            <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl">
                                <Info className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
                                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                                    Take clear, well-lit photos showing both close-up damage and overall context. Maximum 5 photos under 5MB each.
                                </p>
                            </div>
                        </section>

                        {/* Submit */}
                        <div className="pt-8">
                            <button 
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full py-5 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white dark:text-zinc-950 rounded-2xl font-bold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
                            >
                                {submitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white dark:border-zinc-950"></div>
                                        <span>{t('disputes.incident.submitting') || 'Submitting...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-6 h-6" />
                                        <span>{t('disputes.incident.submitBtn') || 'Submit Incident Report'}</span>
                                    </>
                                )}
                            </button>
                            <p className="text-[10px] text-zinc-400 text-center mt-4 font-bold uppercase tracking-widest">
                                Report is legally watermarked, timestamped and shared with the landlord.
                            </p>
                        </div>
                    </main>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
