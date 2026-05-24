'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';
import SignatureCanvas from 'react-signature-canvas';
import PremiumLayout from '@/components/PremiumLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ArrowRight, ArrowLeft, Printer, Save, Loader2, CheckCircle2, Trash2, Info, ShieldCheck } from 'lucide-react';

interface Property {
    id: string;
    title: string;
    address_line1: string;
    city: string;
    monthly_rent: number;
    charges?: number;
    deposit?: number;
}

interface Application {
    id: string;
    property_id: string;
    tenant_id: string;
    status: string;
    tenant?: {
        full_name: string;
        email: string;
    };
}

export default function LeaseWizard() {
    const { t } = useLanguage();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Data Lists
    const [properties, setProperties] = useState<Property[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);

    // Form State
    const [selectedPropertyId, setSelectedPropertyId] = useState('');
    const [selectedApplicationId, setSelectedApplicationId] = useState('');
    const [leaseType, setLeaseType] = useState('meuble');
    const [startDate, setStartDate] = useState('');
    const [durationMonths, setDurationMonths] = useState(12);
    const [rentAmount, setRentAmount] = useState<number>(0);
    const [chargesAmount, setChargesAmount] = useState<number>(0);
    const [depositAmount, setDepositAmount] = useState<number>(0);
    const [guarantorName, setGuarantorName] = useState('');

    const sigCanvas = useRef<any>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const containerRef = useCallback((node: HTMLDivElement | null) => {
        if (resizeObserverRef.current) {
            resizeObserverRef.current.disconnect();
            resizeObserverRef.current = null;
        }
        if (node !== null) {
            setCanvasWidth(node.clientWidth);
            const observer = new ResizeObserver((entries) => {
                if (entries[0]) {
                    setCanvasWidth(entries[0].contentRect.width);
                }
            });
            observer.observe(node);
            resizeObserverRef.current = observer;
        }
    }, []);

    const [canvasWidth, setCanvasWidth] = useState(600);
    const [landlordSignature, setLandlordSignature] = useState<string | null>(null);

    // Result
    const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);

    useEffect(() => {
        document.title = "New Digital Lease | Roomivo";
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', 'Configure financial terms, secure lessor signatures, and generate legal lease contracts on Roomivo.');

        if (!authLoading && user) {
            if (user.role !== 'landlord') {
                router.push('/dashboard');
                return;
            }
            fetchInitialData();
        }
    }, [user, authLoading]);

    const fetchInitialData = async () => {
        try {
            const [propsRes, appsRes] = await Promise.all([
                apiClient.client.get('/properties', { params: { landlord_only: true } }),
                apiClient.client.get('/applications/received')
            ]);

            setProperties(propsRes.data);
            setApplications(appsRes.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load initial properties and applications');
            setLoading(false);
        }
    };

    const handlePropertySelect = (propId: string) => {
        setSelectedPropertyId(propId);
        setSelectedApplicationId(''); // Reset application selection
        const prop = properties.find(p => p.id === propId);
        if (prop) {
            setRentAmount(prop.monthly_rent);
            setChargesAmount(prop.charges || 0);
            setDepositAmount(prop.deposit || (prop.monthly_rent * 2));
        }
    };

    const handleNextStage = () => {
        if (!selectedPropertyId || !selectedApplicationId || !startDate) return;
        
        const selected = new Date(startDate);
        selected.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selected < today) {
            toast.error(t('lease.error.startDatePast'));
            return;
        }
        setStep(2);
    };

    // Auto-update durations & deposits according to French Law (Loi ALUR)
    useEffect(() => {
        if (!selectedPropertyId) return;
        const prop = properties.find(p => p.id === selectedPropertyId);
        const rent = rentAmount || (prop?.monthly_rent || 0);

        switch (leaseType) {
            case 'vide':
                setDurationMonths(36); // 3 Years renewable
                setDepositAmount(rent * 1); // Unfurnished = 1 month rent limit
                break;
            case 'meuble':
                setDurationMonths(12); // 1 Year renewable
                setDepositAmount(rent * 2); // Furnished = 2 months rent limit
                break;
            case 'etudiant':
                setDurationMonths(9); // 9 Months student lease
                setDepositAmount(rent * 2); // 2 months
                break;
            case 'mobilite':
                setDurationMonths(10); // Bail mobilité: 1 to 10 months max
                setDepositAmount(0); // Deposit is forbidden!
                break;
            default:
                setDurationMonths(12);
                setDepositAmount(rent * 2);
        }
    }, [leaseType, selectedPropertyId, rentAmount]);

    const validateForm = () => {
        const today = new Date().toISOString().split('T')[0];
        if (startDate < today) {
            toast.error('Lease start date cannot be in the past');
            return false;
        }
        if (rentAmount <= 0) {
            toast.error('Rent amount must be greater than 0');
            return false;
        }
        if (chargesAmount < 0) {
            toast.error('Charges cannot be negative');
            return false;
        }

        // French Law Validations
        if (leaseType === 'vide' && depositAmount > rentAmount * 1) {
            toast.error('Loi ALUR Compliance: Unfurnished lease deposit is capped at 1 month of rent');
            return false;
        }
        if (leaseType === 'meuble' && depositAmount > rentAmount * 2) {
            toast.error('Loi ALUR Compliance: Furnished lease deposit is capped at 2 months of rent');
            return false;
        }
        if (leaseType === 'mobilite' && depositAmount > 0) {
            toast.error('Bail Mobilité Compliance: Security deposit is forbidden');
            return false;
        }
        if (leaseType === 'mobilite' && (durationMonths < 1 || durationMonths > 10)) {
            toast.error('Bail Mobilité Compliance: Lease duration must be 1 to 10 months');
            return false;
        }

        return true;
    };

    const handleGenerate = async () => {
        if (!validateForm()) return;
        setGenerating(true);
        let sigData = null;
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            sigData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            setLandlordSignature(sigData);
        }

        try {
            const response = await apiClient.client.post('/leases/generate', {
                application_id: selectedApplicationId,
                start_date: startDate,
                rent_override: rentAmount,
                charges_override: chargesAmount,
                deposit_override: depositAmount,
                lease_type: leaseType,
                duration_months: durationMonths,
                guarantor_name: guarantorName || undefined,
                landlord_signature: sigData
            });

            setGeneratedHtml(response.data);
            setStep(3); // Preview
            toast.success('Bail généré avec succès !');
        } catch (error: any) {
            console.error('Generation error:', error);
            toast.error(error.response?.data?.detail || 'Erreur lors de la génération');
        } finally {
            setGenerating(false);
        }
    };

    const handleCreateLease = async () => {
        if (!validateForm()) return;
        setGenerating(true);
        try {
            const response = await apiClient.client.post('/leases/create', {
                application_id: selectedApplicationId,
                start_date: startDate,
                rent_override: rentAmount,
                charges_override: chargesAmount,
                deposit_override: depositAmount,
                lease_type: leaseType,
                duration_months: durationMonths,
                guarantor_name: guarantorName || undefined,
                landlord_signature: landlordSignature
            });
            toast.success('Bail enregistré avec succès !');
            
            if (response.data?.lease_id) {
                router.push(`/leases/${response.data.lease_id}`);
            } else {
                router.push('/dashboard');
            }
        } catch (error: any) {
            console.error('Creation error:', error);
            toast.error(error.response?.data?.detail || "Erreur lors de l'enregistrement");
        } finally {
            setGenerating(false);
        }
    };

    const printLease = () => {
        if (!generatedHtml) return;
        const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const w = window.open(blobUrl, '_blank');
        if (w) {
            setTimeout(() => {
                w.print();
                URL.revokeObjectURL(blobUrl);
            }, 500);
        }
    };

    if (authLoading || loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-zinc-950 dark:text-white animate-spin" />
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] right-[-10%] w-[55%] h-[55%] bg-zinc-900/5 dark:bg-white/5 rounded-full blur-[110px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[55%] h-[55%] bg-zinc-900/5 dark:bg-white/5 rounded-full blur-[110px]" />
                </div>

                <div className="max-w-4xl mx-auto px-6 py-20 relative z-10">
                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-6 shadow-md"
                        >
                            <FileText className="w-4 h-4" />
                            Digital Lease Protocol
                        </motion.div>
                        <h1 className="text-5xl font-black text-zinc-900 dark:text-white tracking-tight uppercase leading-none">
                            {t('lease.wizard.title')}
                        </h1>
                        <p className="mt-4 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs">
                            {t('lease.wizard.subtitle')}
                        </p>
                    </div>

                    {/* Stepper (3-step flow) */}
                    <div className="mb-12 bg-white dark:bg-zinc-900/60 !p-8 rounded-[2rem] border border-zinc-150 dark:border-zinc-800/80 shadow-sm relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-zinc-100 dark:bg-zinc-850" />
                        <div
                            className="absolute top-0 left-0 h-1 bg-zinc-950 dark:bg-white transition-all duration-500 ease-out"
                            style={{ width: `${((step - 1) / 2) * 100}%` }}
                        />
                        <div className="flex justify-between items-center relative z-10">
                            {[t('lease.steps.configuration'), t('lease.steps.financials'), t('lease.steps.review')].map((s, i) => (
                                <div key={s} className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${
                                        step >= i + 1 ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-md scale-110' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                                    }`}>
                                        {step > i + 1 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : i + 1}
                                    </div>
                                    <span className={`mt-3 text-[10px] font-bold uppercase tracking-widest ${
                                        step >= i + 1 ? 'text-zinc-950 dark:text-white' : 'text-zinc-400'
                                    }`}>{s}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="bg-white dark:bg-zinc-900/60 rounded-[2.5rem] shadow-xl overflow-hidden border border-zinc-150 dark:border-zinc-800/80"
                        >
                            {/* Step 1: Asset selection & Lease Type */}
                            {step === 1 && (
                                <div className="p-12">
                                    <div className="flex items-center gap-4 mb-10">
                                        <div className="w-12 h-12 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-2xl flex items-center justify-center shadow-lg">
                                            <Info className="w-6 h-6" />
                                        </div>
                                        <h2 className="text-2xl font-black text-zinc-950 dark:text-white uppercase tracking-tight">{t('lease.wizard.generalInfo')}</h2>
                                    </div>

                                    <div className="grid gap-8">
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">{t('lease.wizard.assetSelection')}</label>
                                            <select
                                                value={selectedPropertyId}
                                                onChange={(e) => handlePropertySelect(e.target.value)}
                                                className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-950"
                                            >
                                                <option value="">{t('lease.wizard.chooseProperty')}</option>
                                                {properties.map(p => (
                                                    <option key={p.id} value={p.id}>{p.title} - {p.city}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">{t('lease.wizard.approvedCandidate')}</label>
                                            <select
                                                value={selectedApplicationId}
                                                onChange={(e) => setSelectedApplicationId(e.target.value)}
                                                disabled={!selectedPropertyId || applications.filter(a => a.property_id === selectedPropertyId && a.status === 'approved').length === 0}
                                                className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50"
                                            >
                                                <option value="">
                                                    {!selectedPropertyId
                                                        ? t('lease.wizard.selectPropertyFirst')
                                                        : applications.filter(a => a.property_id === selectedPropertyId && a.status === 'approved').length === 0
                                                            ? t('lease.wizard.noApprovedCandidates')
                                                            : t('lease.wizard.selectTenant')}
                                                </option>
                                                {applications.filter(a => a.property_id === selectedPropertyId && a.status === 'approved').map(app => (
                                                    <option key={app.id} value={app.id}>
                                                        {app.tenant?.full_name || 'Anonymous'} ({app.tenant?.email})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">{t('lease.wizard.protocolType')}</label>
                                            <select
                                                value={leaseType}
                                                onChange={(e) => setLeaseType(e.target.value)}
                                                className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-950"
                                            >
                                                <option value="meuble">{t('lease.meuble.name')} (Loi 1989)</option>
                                                <option value="vide">{t('lease.vide.name')} (Loi 1989)</option>
                                                <option value="mobilite">{t('lease.mobilite.name')}</option>
                                                <option value="etudiant">{t('lease.etudiant.name')}</option>
                                                <option value="colocation">Colocation Meublée</option>
                                                <option value="code_civil">Bail Code Civil</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">{t('lease.wizard.effectiveDate')}</label>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-950"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">{t('lease.wizard.duration')}</label>
                                                {leaseType === 'mobilite' ? (
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={10}
                                                        value={durationMonths}
                                                        onChange={(e) => setDurationMonths(Math.max(1, Math.min(10, Number(e.target.value))))}
                                                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-950"
                                                    />
                                                ) : (
                                                    <select
                                                        value={durationMonths}
                                                        onChange={(e) => setDurationMonths(Number(e.target.value))}
                                                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-950"
                                                        disabled={leaseType === 'etudiant' || leaseType === 'meuble' || leaseType === 'vide'}
                                                    >
                                                        <option value={9}>9 mois (Étudiant)</option>
                                                        <option value={12}>12 mois (1 An)</option>
                                                        <option value={36}>36 mois (3 Ans)</option>
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-12 flex justify-end">
                                        <button
                                            onClick={handleNextStage}
                                            disabled={!selectedPropertyId || !selectedApplicationId || !startDate}
                                            className="px-8 py-4 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-xl text-xs font-bold uppercase tracking-widest shadow-md active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                                        >
                                            {t('lease.wizard.nextStage')} <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Financial conditions, guarantor name, signature */}
                            {step === 2 && (
                                <div className="p-12">
                                    <div className="flex items-center gap-4 mb-10">
                                        <div className="w-12 h-12 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-2xl flex items-center justify-center shadow-lg">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <h2 className="text-2xl font-black text-zinc-950 dark:text-white uppercase tracking-tight">{t('lease.wizard.financialTerms')}</h2>
                                    </div>

                                    <div className="grid gap-10">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">{t('lease.wizard.netRent')}</label>
                                                <input
                                                    type="number"
                                                    value={rentAmount}
                                                    onChange={(e) => setRentAmount(Number(e.target.value))}
                                                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-950"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">{t('lease.wizard.charges')}</label>
                                                <input
                                                    type="number"
                                                    value={chargesAmount}
                                                    onChange={(e) => setChargesAmount(Number(e.target.value))}
                                                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-950"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 ml-1">{t('lease.wizard.deposit')}</label>
                                                <input
                                                    type="number"
                                                    value={depositAmount}
                                                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                                                    disabled={leaseType === 'mobilite'}
                                                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-zinc-950 disabled:opacity-50"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-zinc-950 dark:bg-zinc-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16" />
                                            <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                                {t('lease.wizard.guarantorProtocol')}
                                            </h3>
                                            <input
                                                type="text"
                                                value={guarantorName}
                                                onChange={(e) => setGuarantorName(e.target.value)}
                                                placeholder={t('lease.wizard.guarantorFullName')}
                                                className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-xl text-sm font-semibold placeholder:text-white/30 outline-none focus:bg-white/20 transition-all text-white"
                                            />
                                            <p className="text-[10px] font-bold text-white/40 mt-3 uppercase tracking-wider">
                                                {t('lease.wizard.guarantorNote')}
                                            </p>
                                        </div>

                                        <div className="bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800/80 p-8 rounded-[2rem]">
                                            <h3 className="text-lg font-black text-zinc-950 dark:text-white uppercase tracking-tight mb-1">{t('lease.wizard.lessorSignature')}</h3>
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-6">{t('lease.wizard.signatureSubtitle')}</p>
                                            <div ref={containerRef} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm mb-4">
                                                <SignatureCanvas
                                                    ref={sigCanvas}
                                                    penColor="black"
                                                    canvasProps={{ width: canvasWidth, height: 180, className: 'sigCanvas' }}
                                                />
                                            </div>
                                            <button
                                                onClick={() => sigCanvas.current?.clear()}
                                                className="inline-flex items-center gap-2 text-[10px] font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 uppercase tracking-widest transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                {t('lease.wizard.clearSignature')}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-12 flex justify-between">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="px-6 py-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                                        >
                                            <ArrowLeft className="w-4 h-4" /> {t('lease.wizard.goBack')}
                                        </button>
                                        <button
                                            onClick={handleGenerate}
                                            disabled={generating}
                                            className="px-8 py-4 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 rounded-xl text-xs font-bold uppercase tracking-widest shadow-md active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                                        >
                                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {generating ? t('lease.wizard.processing') : t('lease.wizard.generateProtocol')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Review generated HTML & submit */}
                            {step === 3 && generatedHtml && (
                                <div className="flex flex-col h-[750px]">
                                    <div className="bg-zinc-950 dark:bg-zinc-900 text-white p-6 flex flex-wrap justify-between items-center gap-4 border-b border-zinc-800">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shrink-0">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-black uppercase tracking-wider text-xs leading-none">{t('lease.wizard.previewTitle')}</h3>
                                                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Status: Generated</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setStep(2)}
                                                className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                            >
                                                {t('lease.wizard.modify')}
                                            </button>
                                            <button
                                                onClick={printLease}
                                                className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5"
                                            >
                                                <Printer className="w-3.5 h-3.5" /> {t('lease.wizard.print')}
                                            </button>
                                            <button
                                                onClick={handleCreateLease}
                                                disabled={generating}
                                                className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-white hover:bg-zinc-100 text-zinc-950 rounded-lg transition-colors flex items-center gap-1.5 shadow"
                                            >
                                                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                {t('lease.wizard.finalize')}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-zinc-100 overflow-hidden relative">
                                        <iframe
                                            srcDoc={generatedHtml}
                                            className="w-full h-full border-0"
                                            title="Lease Preview"
                                            sandbox=""
                                        />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
