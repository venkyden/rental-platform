'use client';

import { useState, useEffect } from 'react';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import WizardProgress from '@/components/WizardProgress';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';
import SignatureCanvas from 'react-signature-canvas';
import PremiumLayout from '@/components/PremiumLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ArrowRight, ArrowLeft, Printer, Save, Loader2, CheckCircle2, AlertCircle, PenTool, Trash2, Info, ShieldCheck, Shield } from 'lucide-react';

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
    const [landlordSignature, setLandlordSignature] = useState<string | null>(null);

    // Result
    const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
    const [createdLeaseId, setCreatedLeaseId] = useState<string | null>(null);

    useEffect(() => {
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
            // Fetch Properties and Applications concurrently
            const [propsRes, appsRes] = await Promise.all([
                apiClient.client.get('/properties', { params: { landlord_only: true } }),
                apiClient.client.get('/applications/received')
            ]);

            setProperties(propsRes.data);
            setApplications(appsRes.data);

            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load properties');
            setLoading(false);
        }
    };

    const handlePropertySelect = (propId: string) => {
        setSelectedPropertyId(propId);
        setSelectedApplicationId(''); // Reset application when property changes
        const prop = properties.find(p => p.id === propId);
        if (prop) {
            setRentAmount(prop.monthly_rent);
            setChargesAmount(prop.charges || 0);
            setDepositAmount(prop.deposit || (prop.monthly_rent * 2));
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        let sigData = null;
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            sigData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            setLandlordSignature(sigData);
        }

        try {
            const response = await apiClient.client.post(`/leases/generate`, {
                application_id: selectedApplicationId,
                start_date: startDate,
                rent_override: rentAmount,
                charges_override: chargesAmount,
                deposit_override: depositAmount,
                lease_type: leaseType,
                duration_months: durationMonths,
                guarantor_name: guarantorName,
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
                guarantor_name: guarantorName,
                landlord_signature: landlordSignature
            });
            toast.success('Bail enregistré avec succès !');
            router.push('/dashboard/leases'); // Redirect somewhere after creation
        } catch (error: any) {
            console.error('Creation error:', error);
            toast.error(error.response?.data?.detail || 'Erreur lors de l’enregistrement');
        } finally {
            setGenerating(false);
        }
    };

    const printLease = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow && generatedHtml) {
            printWindow.document.write(generatedHtml);
            printWindow.document.close();
            // Wait for resources to load then print
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center font-black uppercase tracking-[0.4em] text-zinc-400 animate-pulse">
                <Loader2 className="w-12 h-12 text-zinc-900 animate-spin mb-6" />
            </div>
        );
    }

    return (
        <PremiumLayout withNavbar={true}>
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-zinc-900/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-zinc-900/5 rounded-full blur-[100px]" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02]" />
            </div>

            <div className="max-w-4xl mx-auto px-6 py-20 relative z-10">
                <div className="text-center mb-16">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-6 shadow-xl"
                    >
                        <FileText className="w-4 h-4" />
                        Digital Lease Protocol
                    </motion.div>
                    <h1 className="text-5xl font-black text-zinc-900 tracking-tighter uppercase leading-none">
                        New Lease <span className="text-zinc-400">Creation</span>
                    </h1>
                    <p className="mt-4 text-zinc-500 font-bold uppercase tracking-widest text-sm">Legally compliant contracts in seconds</p>
                </div>

                {/* Stepper */}
                <div className="mb-12 glass-card !p-8 !rounded-[2.5rem] border-zinc-100 shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-zinc-100" />
                    <div 
                        className="absolute top-0 left-0 h-1 bg-zinc-900 transition-all duration-500 ease-out" 
                        style={{ width: `${(step / 4) * 100}%` }}
                    />
                    <div className="flex justify-between items-center relative z-10">
                        {['Configuration', 'Financials', 'Review', 'Execution'].map((s, i) => (
                            <div key={s} className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-[10px] transition-all duration-300 ${
                                    step >= i + 1 ? 'bg-zinc-900 text-white shadow-xl scale-110' : 'bg-zinc-100 text-zinc-400'
                                }`}>
                                    {step > i + 1 ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                                </div>
                                <span className={`mt-3 text-[9px] font-black uppercase tracking-widest ${
                                    step >= i + 1 ? 'text-zinc-900' : 'text-zinc-400'
                                }`}>{s}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="glass-card !p-0 !rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] overflow-hidden border-zinc-100"
                    >
                        {/* Step 1: Property & Tenant */}
                        {step === 1 && (
                            <div className="p-12">
                                <div className="flex items-center gap-4 mb-10">
                                    <div className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                                        <Info className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter">General Info</h2>
                                </div>
                                
                                <div className="grid gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Asset Selection</label>
                                        <select
                                            value={selectedPropertyId}
                                            onChange={(e) => handlePropertySelect(e.target.value)}
                                            className="w-full px-6 py-5 bg-zinc-50 border-2 border-transparent focus:border-zinc-900 rounded-2xl text-sm font-black transition-all outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="">-- Choose Property --</option>
                                            {properties.map(p => (
                                                <option key={p.id} value={p.id}>{p.title} - {p.city}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Approved Candidate</label>
                                        <select
                                            value={selectedApplicationId}
                                            onChange={(e) => setSelectedApplicationId(e.target.value)}
                                            disabled={!selectedPropertyId || applications.filter(a => a.property_id === selectedPropertyId && a.status === 'approved').length === 0}
                                            className="w-full px-6 py-5 bg-zinc-50 border-2 border-transparent focus:border-zinc-900 rounded-2xl text-sm font-black transition-all outline-none appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <option value="">
                                                {!selectedPropertyId
                                                    ? "-- Select property first --"
                                                    : applications.filter(a => a.property_id === selectedPropertyId && a.status === 'approved').length === 0
                                                        ? "No approved candidates"
                                                        : "-- Select tenant --"}
                                            </option>
                                            {applications.filter(a => a.property_id === selectedPropertyId && a.status === 'approved').map(app => (
                                                <option key={app.id} value={app.id}>
                                                    {app.tenant?.full_name || 'Anonymous'} ({app.tenant?.email})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Protocol Type</label>
                                        <select
                                            value={leaseType}
                                            onChange={(e) => setLeaseType(e.target.value)}
                                            className="w-full px-6 py-5 bg-zinc-50 border-2 border-transparent focus:border-zinc-900 rounded-2xl text-sm font-black transition-all outline-none appearance-none cursor-pointer"
                                        >
                                            <option value="meuble">Furnished Standard (Loi 1989)</option>
                                            <option value="colocation">Co-living (Non-solidarity)</option>
                                            <option value="code_civil">Code Civil (Secondary)</option>
                                            <option value="simple">Simple Contract</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Effective Date</label>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full px-6 py-5 bg-zinc-50 border-2 border-transparent focus:border-zinc-900 rounded-2xl text-sm font-black transition-all outline-none"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Duration (Months)</label>
                                            <input
                                                type="number"
                                                value={durationMonths}
                                                onChange={(e) => setDurationMonths(parseInt(e.target.value))}
                                                className="w-full px-6 py-5 bg-zinc-50 border-2 border-transparent focus:border-zinc-900 rounded-2xl text-sm font-black transition-all outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-12 flex justify-end">
                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!selectedPropertyId || !selectedApplicationId || !startDate}
                                        className="px-10 py-5 bg-zinc-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center gap-3"
                                    >
                                        Next Stage <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Financials & Garant */}
                        {step === 2 && (
                            <div className="p-12">
                                <div className="flex items-center gap-4 mb-10">
                                    <div className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                                        <PenTool className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tighter">Financial Terms</h2>
                                </div>

                                <div className="grid gap-10">
                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Net Rent (€)</label>
                                            <input
                                                type="number"
                                                value={rentAmount}
                                                onChange={(e) => setRentAmount(parseFloat(e.target.value))}
                                                className="w-full px-6 py-5 bg-zinc-50 border-2 border-transparent focus:border-zinc-900 rounded-2xl text-sm font-black transition-all outline-none"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Charges (€)</label>
                                            <input
                                                type="number"
                                                value={chargesAmount}
                                                onChange={(e) => setChargesAmount(parseFloat(e.target.value))}
                                                className="w-full px-6 py-5 bg-zinc-50 border-2 border-transparent focus:border-zinc-900 rounded-2xl text-sm font-black transition-all outline-none"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Deposit (€)</label>
                                            <input
                                                type="number"
                                                value={depositAmount}
                                                onChange={(e) => setDepositAmount(parseFloat(e.target.value))}
                                                className="w-full px-6 py-5 bg-zinc-50 border-2 border-transparent focus:border-zinc-900 rounded-2xl text-sm font-black transition-all outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-zinc-900 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16" />
                                        <h3 className="text-lg font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <ShieldCheck className="w-5 h-5" />
                                            Guarantor Protocol
                                        </h3>
                                        <input
                                            type="text"
                                            value={guarantorName}
                                            onChange={(e) => setGuarantorName(e.target.value)}
                                            placeholder="Enter Full Name"
                                            className="w-full px-6 py-5 bg-white/10 border border-white/20 rounded-2xl text-sm font-black placeholder:text-white/30 outline-none focus:bg-white/20 transition-all"
                                        />
                                        <p className="text-[10px] font-bold text-white/40 mt-4 uppercase tracking-[0.2em]">Optional: Leave blank if no guarantor required.</p>
                                    </div>

                                    <div className="bg-zinc-50 border border-zinc-100 p-10 rounded-[2.5rem] shadow-inner">
                                        <h3 className="text-lg font-black text-zinc-900 uppercase tracking-tighter mb-2">Lessor Signature</h3>
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-6">Digital validation of protocol authenticity</p>
                                        <div className="bg-white border-2 border-zinc-100 rounded-3xl overflow-hidden shadow-sm mb-4">
                                            <SignatureCanvas
                                                ref={sigCanvas}
                                                penColor="black"
                                                canvasProps={{ width: 800, height: 200, className: 'sigCanvas max-w-full' }}
                                            />
                                        </div>
                                        <button
                                            onClick={() => sigCanvas.current?.clear()}
                                            className="inline-flex items-center gap-2 text-[10px] font-black text-zinc-400 hover:text-zinc-900 uppercase tracking-widest transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            Clear Signature
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-12 flex justify-between">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="px-8 py-5 text-zinc-400 hover:text-zinc-900 text-[11px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> Go Back
                                    </button>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={generating}
                                        className="px-10 py-5 bg-zinc-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-all disabled:opacity-30 flex items-center gap-3"
                                    >
                                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {generating ? 'Processing...' : 'Generate Protocol'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Preview */}
                        {step === 3 && generatedHtml && (
                            <div className="flex flex-col h-[800px]">
                                <div className="bg-zinc-900 text-white p-8 flex justify-between items-center shadow-xl relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-black uppercase tracking-widest text-sm leading-none">Protocol Preview</h3>
                                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-1">Status: Generated</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setStep(2)}
                                            className="px-6 py-3 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                                        >
                                            Modify
                                        </button>
                                        <button
                                            onClick={printLease}
                                            className="px-6 py-3 text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center gap-2"
                                        >
                                            <Printer className="w-4 h-4" /> Print
                                        </button>
                                        <button
                                            onClick={handleCreateLease}
                                            disabled={generating}
                                            className="px-8 py-3 text-[10px] font-black uppercase tracking-widest bg-white text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all shadow-xl flex items-center gap-2 disabled:opacity-30"
                                        >
                                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Finalize Protocol
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 bg-zinc-100 overflow-hidden relative">
                                    <iframe
                                        srcDoc={generatedHtml}
                                        className="w-full h-full border-0 shadow-2xl"
                                        title="Lease Preview"
                                    />
                                    <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.1)]" />
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </PremiumLayout>
    );
}
