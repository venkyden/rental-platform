'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ShieldCheck, 
    ChevronLeft, 
    Upload, 
    Link as LinkIcon, 
    FileText, 
    CheckCircle, 
    User, 
    Loader2, 
    ExternalLink, 
    Trash2, 
    AlertTriangle,
    Eye
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import PremiumLayout from '@/components/PremiumLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/useAuth';

type GuarantorType = 'selection' | 'visale' | 'garantme' | 'physical' | 'none';

interface GuarantorFile {
    document_type: string;
    filename: string;
    file_url: string;
    storage_key?: string;
    uploaded_at: string;
}

export default function GuarantorVerifyPage() {
    const router = useRouter();
    const toast = useToast();
    const { t } = useLanguage();
    const { checkAuth, user } = useAuth();
    const isFrenchResident = !user?.preferences?.nationality || user.preferences.nationality === 'france' || user.preferences.nationality === 'fr';
    
    const [currentStep, setCurrentStep] = useState<GuarantorType>('selection');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Existing guarantor status state
    const [existingType, setExistingType] = useState<string | null>(null);
    const [existingStatus, setExistingStatus] = useState<string | null>(null);
    const [existingData, setExistingData] = useState<any | null>(null);
    
    // Visale / Garantme certificate upload
    const [visaleFile, setVisaleFile] = useState<File | null>(null);
    const [garantmeFile, setGarantmeFile] = useState<File | null>(null);
    
    // Physical guarantor upload progress
    const [uploadedDocs, setUploadedDocs] = useState<Record<string, GuarantorFile>>({});
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
    const [consentChecked, setConsentChecked] = useState(false);
    
    // Refs for file inputs
    const visaleFileRef = useRef<HTMLInputElement>(null);
    const garantmeFileRef = useRef<HTMLInputElement>(null);
    const physicalFileRefs = {
        id_card: useRef<HTMLInputElement>(null),
        payslip: useRef<HTMLInputElement>(null),
        tax_assessment: useRef<HTMLInputElement>(null),
        proof_address: useRef<HTMLInputElement>(null)
    };

    // Load initial guarantor state
    const fetchGuarantorStatus = async () => {
        try {
            setLoading(true);
            const response = await apiClient.client.get('/verification/status');
            const data = response.data;
            setExistingType(data.guarantor_type);
            setExistingStatus(data.guarantor_status);
            setExistingData(data.guarantor_data);
            
            if (data.guarantor_type === 'physical' && data.guarantor_data?.files) {
                const docMap: Record<string, GuarantorFile> = {};
                data.guarantor_data.files.forEach((f: GuarantorFile) => {
                    docMap[f.document_type] = f;
                });
                setUploadedDocs(docMap);
            }
        } catch (error) {
            console.error('Error fetching guarantor status:', error);
            toast.error(t('common.error.genericTitle', undefined, 'Something went wrong'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGuarantorStatus();
    }, []);

    // Initialize or reset guarantor type flow
    const handleSelectType = async (type: GuarantorType) => {
        try {
            setSubmitting(true);
            await apiClient.client.post('/verification/guarantor/init', {
                guarantor_type: type
            });
            setCurrentStep(type);
            if (type === 'none') {
                toast.success(t('verify.guarantor.success', undefined, 'Guarantor successfully registered!'));
                await checkAuth();
                router.push('/dashboard');
            }
        } catch (error: any) {
            console.error('Error initializing guarantor type:', error);
            toast.error(error.response?.data?.detail || 'Failed to initialize guarantor flow');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitVisale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!visaleFile) {
            toast.error(t('verify.guarantor.uploadCertificate', undefined, 'Upload Guarantee Certificate'));
            return;
        }
        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('file', visaleFile);
            await apiClient.client.post('/verification/guarantor/visale', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(t('verify.guarantor.success', undefined, 'Guarantor successfully registered!'));
            await checkAuth();
            router.push('/dashboard');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || t('verify.guarantor.verificationFailed', undefined, 'Certificate could not be verified.'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitGarantme = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!garantmeFile) {
            toast.error(t('verify.guarantor.uploadCertificate', undefined, 'Upload Guarantee Certificate'));
            return;
        }
        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('file', garantmeFile);
            await apiClient.client.post('/verification/guarantor/garantme', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(t('verify.guarantor.success', undefined, 'Guarantor successfully registered!'));
            await checkAuth();
            router.push('/dashboard');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || t('verify.guarantor.verificationFailed', undefined, 'Certificate could not be verified.'));
        } finally {
            setSubmitting(false);
        }
    };

    // Physical guarantor file upload
    const handleUploadPhysicalDoc = async (docType: string, file: File) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'image/heic', 'image/heif'];
        if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.heic') && !file.name.toLowerCase().endsWith('.heif')) {
            toast.error('Invalid file type. Please upload JPEG, PNG, HEIC, or PDF');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error('File exceeds maximum size of 10MB.');
            return;
        }

        try {
            setUploadingDocType(docType);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('document_type', docType);

            const response = await apiClient.client.post('/verification/guarantor/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const updatedFilesList: GuarantorFile[] = response.data.files;
            const newDocMap = { ...uploadedDocs };
            const uploadedItem = updatedFilesList.find(f => f.document_type === docType);
            if (uploadedItem) {
                newDocMap[docType] = uploadedItem;
            }
            setUploadedDocs(newDocMap);
            toast.success('Document uploaded successfully!');
        } catch (error: any) {
            console.error('Error uploading guarantor document:', error);
            toast.error(error.response?.data?.detail || 'Failed to upload document');
        } finally {
            setUploadingDocType(null);
        }
    };

    // Remove guarantor
    const handleRemoveGuarantor = async () => {
        if (!window.confirm(t('verify.guarantor.deleteConfirm', undefined, 'Are you sure you want to remove this guarantor?'))) {
            return;
        }

        try {
            setSubmitting(true);
            await apiClient.client.delete('/verification/guarantor');
            toast.success(t('verify.guarantor.removed', undefined, 'Guarantor removed successfully.'));
            setExistingType(null);
            setExistingStatus(null);
            setExistingData(null);
            setUploadedDocs({});
            setCurrentStep('selection');
            await checkAuth();
        } catch (error: any) {
            console.error('Error deleting guarantor:', error);
            toast.error(error.response?.data?.detail || 'Failed to remove guarantor');
        } finally {
            setSubmitting(false);
        }
    };

    const isPhysicalComplete = 
        uploadedDocs['id_card'] && 
        uploadedDocs['payslip'] && 
        uploadedDocs['tax_assessment'] &&
        uploadedDocs['proof_address'];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 text-zinc-900 animate-spin" />
            </div>
        );
    }

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={false}>
                <meta name="robots" content="noindex" />
                <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-slate-50">
                    <div className="absolute inset-0 z-0">
                        <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100/50 via-zinc-50 to-white"></div>
                        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10"></div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="max-w-2xl w-full relative z-10"
                    >
                        <div className="glass-card !p-10 sm:!p-14 rounded-[3.5rem] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.15)] border-zinc-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-900/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                            {/* Back Button */}
                            {currentStep === 'selection' ? (
                                <button
                                    onClick={() => router.back()}
                                    className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] hover:text-zinc-900 transition-all mb-8 group"
                                >
                                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                    {t('common.actions.back', undefined, 'Back')}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setCurrentStep('selection')}
                                    className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] hover:text-zinc-900 transition-all mb-8 group"
                                    disabled={submitting}
                                >
                                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                    {t('common.actions.back', undefined, 'Back')}
                                </button>
                            )}

                            {/* Existing Guarantor View */}
                            {existingType && currentStep === 'selection' ? (
                                <div className="space-y-8">
                                    <div className="text-center space-y-4 mb-8">
                                        <div className="w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-zinc-900/10">
                                            <ShieldCheck className="w-10 h-10 text-white" />
                                        </div>
                                        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase leading-none">
                                            {t('verify.guarantor.title', undefined, 'Guarantor Status')}
                                        </h1>
                                        <p className="text-zinc-500 font-medium max-w-sm mx-auto">
                                            You currently have a registered guarantor configuration.
                                        </p>
                                    </div>

                                    <div className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Type</span>
                                            <span className="font-bold text-zinc-900 capitalize">
                                                {existingType === 'visale' && 'Garantie Visale'}
                                                {existingType === 'garantme' && 'Garantme'}
                                                {existingType === 'physical' && 'Physical Person'}
                                                {existingType === 'none' && 'No Guarantor'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Status</span>
                                            <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                                                existingStatus === 'verified' ? 'bg-emerald-50 text-emerald-700' :
                                                existingStatus === 'pending' ? 'bg-amber-50 text-amber-700' :
                                                'bg-zinc-100 text-zinc-600'
                                            }`}>
                                                {existingStatus}
                                            </span>
                                        </div>
                                        {(existingType === 'visale' || existingType === 'garantme') && existingData?.file_url && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Certificate</span>
                                                <a href={existingData.file_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-950 flex items-center gap-1 text-xs font-bold transition-all">
                                                    <Eye className="w-3.5 h-3.5" /> View
                                                </a>
                                            </div>
                                        )}
                                        {existingType === 'physical' && existingData?.files && (
                                            <div className="space-y-2 pt-2 border-t border-zinc-200/60">
                                                <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider block mb-2">Uploaded Documents</span>
                                                {existingData.files.map((file: GuarantorFile, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-sm py-1">
                                                        <span className="text-zinc-600 font-medium capitalize">{file.document_type.replace('_', ' ')}</span>
                                                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-950 flex items-center gap-1 text-xs font-bold transition-all">
                                                            <Eye className="w-3.5 h-3.5" /> View
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-4">
                                        <button
                                            onClick={handleRemoveGuarantor}
                                            className="w-full py-5 rounded-3xl border border-rose-100 hover:bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                            disabled={submitting}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            {t('common.delete', undefined, 'Remove')}
                                        </button>
                                        <button
                                            onClick={() => router.push('/dashboard')}
                                            className="w-full py-5 rounded-3xl bg-zinc-950 hover:bg-zinc-900 text-white font-black text-xs uppercase tracking-widest transition-all"
                                        >
                                            {t('navigation.home', undefined, 'Go Home')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <AnimatePresence mode="wait">
                                    {/* Selection Stage */}
                                    {currentStep === 'selection' && (
                                        <motion.div
                                            key="selection"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="space-y-10"
                                        >
                                            <div className="text-center space-y-4 mb-8">
                                                <div className="w-20 h-20 bg-zinc-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                                                    <ShieldCheck className="w-10 h-10 text-zinc-900" />
                                                </div>
                                                <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase leading-none text-zinc-950">
                                                    {t('verify.guarantor.title', undefined, 'Guarantor Verification')}
                                                </h1>
                                                <p className="text-lg text-zinc-500 font-medium max-w-sm mx-auto leading-relaxed">
                                                    {t('verify.guarantor.description', undefined, 'French landlords typically require a rent guarantee.')}
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4">
                                                {/* Visale Card */}
                                                <button
                                                    onClick={() => handleSelectType('visale')}
                                                    className="w-full p-6 text-left border border-zinc-200/80 rounded-3xl hover:border-zinc-900 hover:bg-zinc-50/50 flex justify-between items-center transition-all group active:scale-[0.99] cursor-pointer"
                                                >
                                                    <div className="flex gap-4 items-start pr-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-zinc-950 group-hover:text-white transition-colors shrink-0">
                                                            <LinkIcon className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-bold text-zinc-900 text-base">{t('verify.guarantor.visale', undefined, 'Visale (Action Logement)')}</h3>
                                                                {!isFrenchResident && (
                                                                    <span className="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{t('verify.guarantor.visaleFranceOnly', undefined, 'France only')}</span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-zinc-500 font-medium leading-normal mt-1">{t('verify.guarantor.visaleDesc', undefined, 'Free government guarantee for students and CDI < 1500€/mo.')}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-zinc-900 font-bold text-xs uppercase tracking-widest shrink-0 transition-transform group-hover:translate-x-1">&rarr;</span>
                                                </button>

                                                {/* Garantme Card */}
                                                <button
                                                    onClick={() => handleSelectType('garantme')}
                                                    className="w-full p-6 text-left border border-zinc-200/80 rounded-3xl hover:border-zinc-900 hover:bg-zinc-50/50 flex justify-between items-center transition-all group active:scale-[0.99] cursor-pointer"
                                                >
                                                    <div className="flex gap-4 items-start pr-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-zinc-950 group-hover:text-white transition-colors shrink-0">
                                                            <ShieldCheck className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-zinc-900 text-base">{t('verify.guarantor.garantme', undefined, 'Garantme (Private Guarantee)')}</h3>
                                                            <p className="text-sm text-zinc-500 font-medium leading-normal mt-1">{t('verify.guarantor.garantmeDesc', undefined, 'Private guarantee with a 3.5% premium.')}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-zinc-900 font-bold text-xs uppercase tracking-widest shrink-0 transition-transform group-hover:translate-x-1">&rarr;</span>
                                                </button>

                                                {/* Physical Guarantor */}
                                                <button
                                                    onClick={() => handleSelectType('physical')}
                                                    className="w-full p-6 text-left border border-zinc-200/80 rounded-3xl hover:border-zinc-900 hover:bg-zinc-50/50 flex justify-between items-center transition-all group active:scale-[0.99] cursor-pointer"
                                                >
                                                    <div className="flex gap-4 items-start pr-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-zinc-950 group-hover:text-white transition-colors shrink-0">
                                                            <User className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-zinc-900 text-base">{t('verify.guarantor.physical', undefined, 'Physical Guarantor')}</h3>
                                                            <p className="text-sm text-zinc-500 font-medium leading-normal mt-1">{t('verify.guarantor.physicalDesc', undefined, 'A physical person living in France who will co-sign your lease.')}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-zinc-900 font-bold text-xs uppercase tracking-widest shrink-0 transition-transform group-hover:translate-x-1">&rarr;</span>
                                                </button>

                                                {/* None */}
                                                <button
                                                    onClick={() => handleSelectType('none')}
                                                    className="w-full p-6 text-left border border-zinc-200/80 rounded-3xl hover:border-zinc-900 hover:bg-zinc-50/50 flex justify-between items-center transition-all group active:scale-[0.99] cursor-pointer"
                                                >
                                                    <div className="flex gap-4 items-start pr-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-rose-950 group-hover:text-rose-100 transition-colors shrink-0">
                                                            <AlertTriangle className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-zinc-900 text-base">{t('verify.guarantor.none', undefined, 'No Guarantor')}</h3>
                                                            <p className="text-sm text-zinc-500 font-medium leading-normal mt-1">{t('verify.guarantor.noneDesc', undefined, 'Proceed without a guarantor (only if landlord explicitly allows).')}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-zinc-900 font-bold text-xs uppercase tracking-widest shrink-0 transition-transform group-hover:translate-x-1">&rarr;</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Visale Stage */}
                                    {currentStep === 'visale' && (
                                        <motion.div
                                            key="visale"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="space-y-8"
                                        >
                                            <div className="text-center space-y-4">
                                                <h2 className="text-3xl font-black text-zinc-950 uppercase tracking-tighter">
                                                    {t('verify.guarantor.visale', undefined, 'Visale (Action Logement)')}
                                                </h2>
                                                <p className="text-zinc-500 max-w-sm mx-auto font-medium">
                                                    {t('verify.guarantor.uploadCertificateInstruction', undefined, 'Upload the certificate issued by Visale. The name on the document must match your account.')}
                                                </p>
                                            </div>

                                            {!isFrenchResident && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
                                                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                    <p className="text-sm font-medium text-amber-800">
                                                        {t('verify.guarantor.visaleNotEligibleInternational', undefined, 'Visale is only available to residents working or studying in France. Consider Garantme as an alternative — it accepts international profiles.')}
                                                    </p>
                                                </div>
                                            )}

                                            <form onSubmit={handleSubmitVisale} className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-xs uppercase font-black text-zinc-400 tracking-wider block">
                                                        {t('verify.guarantor.uploadCertificate', undefined, 'Upload Guarantee Certificate')}
                                                    </label>
                                                    <div
                                                        onClick={() => visaleFileRef.current?.click()}
                                                        className={`w-full p-6 border-2 border-dashed rounded-3xl cursor-pointer flex flex-col items-center justify-center gap-2 transition-all ${
                                                            visaleFile ? 'border-emerald-300 bg-emerald-50/30' : 'border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50/50'
                                                        }`}
                                                    >
                                                        {visaleFile ? (
                                                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                                                        ) : (
                                                            <Upload className="w-6 h-6 text-zinc-400" />
                                                        )}
                                                        <span className="text-sm font-bold text-zinc-800">
                                                            {visaleFile ? visaleFile.name : 'Select PDF, JPG, or PNG'}
                                                        </span>
                                                        <span className="text-xs text-zinc-400 font-medium">Max 10MB</span>
                                                        <input
                                                            type="file"
                                                            ref={visaleFileRef}
                                                            className="hidden"
                                                            accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                                                            onChange={(e) => setVisaleFile(e.target.files?.[0] || null)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-between">
                                                    <span className="text-xs text-zinc-500 font-bold">Don't have a Visale certificate yet?</span>
                                                    <a
                                                        href="https://www.visale.fr"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-zinc-950 font-black hover:underline inline-flex items-center gap-1 uppercase tracking-wider"
                                                    >
                                                        {t('verify.guarantor.visaleLinkText', undefined, 'visale.fr')}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={submitting || !visaleFile}
                                                    className="w-full py-5 bg-zinc-950 hover:bg-zinc-900 text-white font-black text-xs uppercase tracking-widest transition-all rounded-3xl flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                                                >
                                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                    {t('common.submit', undefined, 'Submit')}
                                                </button>
                                            </form>
                                        </motion.div>
                                    )}

                                    {/* Garantme Stage */}
                                    {currentStep === 'garantme' && (
                                        <motion.div
                                            key="garantme"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="space-y-8"
                                        >
                                            <div className="text-center space-y-4">
                                                <h2 className="text-3xl font-black text-zinc-950 uppercase tracking-tighter">
                                                    {t('verify.guarantor.garantme', undefined, 'Garantme Guarantee')}
                                                </h2>
                                                <p className="text-zinc-500 max-w-sm mx-auto font-medium">
                                                    {t('verify.guarantor.uploadCertificateInstruction', undefined, 'Upload the certificate issued by Garantme. The name on the document must match your account.')}
                                                </p>
                                            </div>

                                            <form onSubmit={handleSubmitGarantme} className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-xs uppercase font-black text-zinc-400 tracking-wider block">
                                                        {t('verify.guarantor.uploadCertificate', undefined, 'Upload Guarantee Certificate')}
                                                    </label>
                                                    <div
                                                        onClick={() => garantmeFileRef.current?.click()}
                                                        className={`w-full p-6 border-2 border-dashed rounded-3xl cursor-pointer flex flex-col items-center justify-center gap-2 transition-all ${
                                                            garantmeFile ? 'border-emerald-300 bg-emerald-50/30' : 'border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50/50'
                                                        }`}
                                                    >
                                                        {garantmeFile ? (
                                                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                                                        ) : (
                                                            <Upload className="w-6 h-6 text-zinc-400" />
                                                        )}
                                                        <span className="text-sm font-bold text-zinc-800">
                                                            {garantmeFile ? garantmeFile.name : 'Select PDF, JPG, or PNG'}
                                                        </span>
                                                        <span className="text-xs text-zinc-400 font-medium">Max 10MB</span>
                                                        <input
                                                            type="file"
                                                            ref={garantmeFileRef}
                                                            className="hidden"
                                                            accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                                                            onChange={(e) => setGarantmeFile(e.target.files?.[0] || null)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-between">
                                                    <span className="text-xs text-zinc-500 font-bold">Don't have a Garantme certificate yet?</span>
                                                    <a
                                                        href="https://garantme.fr"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-zinc-950 font-black hover:underline inline-flex items-center gap-1 uppercase tracking-wider"
                                                    >
                                                        {t('verify.guarantor.garantmeLinkText', undefined, 'garantme.fr')}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={submitting || !garantmeFile}
                                                    className="w-full py-5 bg-zinc-950 hover:bg-zinc-900 text-white font-black text-xs uppercase tracking-widest transition-all rounded-3xl flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                                                >
                                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                    {t('common.submit', undefined, 'Submit')}
                                                </button>
                                            </form>
                                        </motion.div>
                                    )}

                                    {/* Physical Guarantor Uploads Stage */}
                                    {currentStep === 'physical' && (
                                        <motion.div
                                            key="physical"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="space-y-8"
                                        >
                                            <div className="text-center space-y-4">
                                                <h2 className="text-3xl font-black text-zinc-950 uppercase tracking-tighter">
                                                    {t('verify.guarantor.physical', undefined, 'Physical Guarantor')}
                                                </h2>
                                                <p className="text-zinc-500 max-w-sm mx-auto font-medium">
                                                    Please upload the required dossiers for your physical guarantor. Under French Alur law, the landlord can check these.
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Document checklist */}
                                                {[
                                                    { id: 'id_card', title: 'Guarantor Identity Document', desc: 'Passport, CNI, or Titre de séjour' },
                                                    { id: 'payslip', title: 'Last 3 Payslips', desc: 'Bulletins de paie' },
                                                    { id: 'tax_assessment', title: 'Avis d’Imposition', desc: 'Last tax assessment statement' },
                                                    { id: 'proof_address', title: 'Proof of Address', desc: 'Utility bill, rent receipt (less than 3 mos)' }
                                                ].map((doc) => {
                                                    const isUploaded = !!uploadedDocs[doc.id];
                                                    const isUploading = uploadingDocType === doc.id;

                                                    return (
                                                        <div 
                                                            key={doc.id}
                                                            className={`p-5 border rounded-3xl flex justify-between items-center transition-all ${
                                                                isUploaded ? 'border-emerald-100 bg-emerald-50/20' : 'border-zinc-200 bg-white'
                                                            }`}
                                                        >
                                                            <div className="flex gap-4 items-center">
                                                                {isUploaded ? (
                                                                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                                                                ) : (
                                                                    <FileText className="w-5 h-5 text-zinc-400 shrink-0" />
                                                                )}
                                                                <div className="text-left">
                                                                    <h4 className="font-bold text-zinc-900 text-sm">{doc.title}</h4>
                                                                    <p className="text-xs text-zinc-400 font-medium">{doc.desc}</p>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <button
                                                                    onClick={() => physicalFileRefs[doc.id as keyof typeof physicalFileRefs].current?.click()}
                                                                    disabled={!!uploadingDocType}
                                                                    className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all inline-flex items-center gap-1.5 ${
                                                                        isUploaded 
                                                                            ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900' 
                                                                            : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                                                                    }`}
                                                                >
                                                                    {isUploading ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : isUploaded ? (
                                                                        'Replace'
                                                                    ) : (
                                                                        'Upload'
                                                                    )}
                                                                </button>
                                                                <input
                                                                    type="file"
                                                                    ref={physicalFileRefs[doc.id as keyof typeof physicalFileRefs]}
                                                                    className="hidden"
                                                                    accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleUploadPhysicalDoc(doc.id, file);
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Consent and GDPR information */}
                                            <div className="space-y-4 pt-4 border-t border-zinc-100 text-left">
                                                <label className="flex items-start gap-3 cursor-pointer">
                                                    <input 
                                                        type="checkbox"
                                                        checked={consentChecked}
                                                        onChange={(e) => setConsentChecked(e.target.checked)}
                                                        className="mt-1 h-4.5 w-4.5 rounded-lg border-zinc-300 focus:ring-zinc-950 text-zinc-950" 
                                                    />
                                                    <span className="text-xs text-zinc-500 font-medium leading-relaxed">
                                                        I confirm that I have my guarantor's explicit consent to upload their personal details and documents to Roomivo, in compliance with GDPR guidelines and CNIL regulations.
                                                    </span>
                                                </label>
                                            </div>

                                            <button
                                                onClick={async () => {
                                                    if (!consentChecked) {
                                                        toast.error('You must confirm consent to submit the guarantor dossier.');
                                                        return;
                                                    }
                                                    setSubmitting(true);
                                                    await checkAuth();
                                                    toast.success(t('verify.guarantor.success', undefined, 'Guarantor successfully registered!'));
                                                    router.push('/dashboard');
                                                }}
                                                disabled={!isPhysicalComplete || submitting || !consentChecked}
                                                className="w-full py-5 bg-zinc-950 hover:bg-zinc-900 text-white font-black text-xs uppercase tracking-widest transition-all rounded-3xl flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                                            >
                                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                Complete Registration
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            )}
                        </div>
                    </motion.div>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
