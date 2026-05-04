"use client";

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Camera, Upload } from 'lucide-react';
import { apiClient } from '@/lib/api';
import DocumentCapture from './DocumentCapture';
import { QRCodeSVG } from 'qrcode.react';
import { motion, Variants } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

interface VerificationUploadProps {
    verificationType: 'identity' | 'employment' | 'property';
    propertyId?: string; // For property verification
    onSuccess: () => void;
    user?: any; // Contains user.preferences.contract_type etc.
}

function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

export default function VerificationUpload({ verificationType, propertyId, onSuccess, user }: VerificationUploadProps) {
    const { t } = useLanguage();
    const [files, setFiles] = useState<File[]>([]);
    const [documentType, setDocumentType] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    
    // Support for "No Guarantor" flow
    const [hasGuarantor, setHasGuarantor] = useState<boolean | null>(null);

    // QR code session state (desktop identity only)
    const [qrSession, setQrSession] = useState<{ code: string; captureUrl: string; expiresAt: string } | null>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setIsMobile(isMobileDevice());
    }, []);

    // For identity verification on desktop: auto-create QR session
    useEffect(() => {
        if (verificationType === 'identity' && !isMobile && !qrSession) {
            createQrSession();
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [verificationType, isMobile]);

    const createQrSession = async () => {
        setQrLoading(true);
        try {
            const res = await apiClient.client.post('/verification/identity/session');
            const data = res.data;
            setQrSession({
                code: data.verification_code,
                captureUrl: data.capture_url,
                expiresAt: data.expires_at,
            });
            startPolling(data.verification_code);
        } catch (err) {
            setError('Failed to create verification session');
        } finally {
            setQrLoading(false);
        }
    };

    const startPolling = (code: string) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await apiClient.client.get(`/verification/identity/session/${code}/status`);
                if (res.data.completed) {
                    if (pollRef.current) clearInterval(pollRef.current);
                    onSuccess();
                }
            } catch {
                if (pollRef.current) clearInterval(pollRef.current);
            }
        }, 3000);
    };

    const copyToClipboard = (url: string) => {
        navigator.clipboard.writeText(url);
        toast.success('Link copied');
    };

    const getEmploymentDocumentTypes = () => {
        const contractType = user?.preferences?.contract_type;
        const situation = user?.preferences?.situation;

        if (contractType === 'student' || situation === 'student_budget' || contractType === 'internship') {
            return [
                { value: 'student_id', label: t('docs.student_id', undefined, 'Student ID / Enrollment Certificate'), captures: 1 },
                { value: 'internship_contract', label: t('docs.internship_contract', undefined, 'Internship Agreement'), captures: 1 },
                { value: 'scholarship', label: t('docs.scholarship', undefined, 'Scholarship Notice'), captures: 1 },
                { value: 'caf', label: t('docs.caf', undefined, 'Housing Aid Simulation (CAF/MSA)'), captures: 1 },
                { value: 'visale_certificate', label: t('docs.visale', undefined, 'Visale Guarantee Certificate'), captures: 1 },
                { value: 'garantme_certificate', label: t('docs.garantme', undefined, 'Garantme Certificate'), captures: 1 },
                { value: 'bank_funds_certificate', label: t('docs.bank_funds', undefined, 'Blocked Bank Funds Certificate'), captures: 1 },
            ];
        } else if (contractType === 'self_employed' || situation === 'flexibility_relocation') {
            return [
                { value: 'kbis', label: t('docs.kbis', undefined, 'Kbis Extract (less than 3 months)'), captures: 1 },
                { value: 'tax_return', label: t('docs.tax_return', undefined, 'Latest Tax Return'), captures: 1 },
                { value: 'accounting', label: t('docs.accounting', undefined, 'Latest Accounting Balance'), captures: 1 },
                { value: 'garantme_certificate', label: t('docs.garantme', undefined, 'Garantme Certificate'), captures: 1 },
            ];
        } else if (contractType === 'cdd' || contractType === 'interim') {
            return [
                { value: 'employer_certificate', label: t('docs.employer_cert', undefined, 'Employer Certificate / Job Promise'), captures: 1 },
                { value: 'contract', label: t('docs.contract', undefined, 'Employment Contract'), captures: 1 },
                { value: 'payslip', label: t('docs.payslip', undefined, 'Last 3 Payslips (if available)'), captures: 3 },
            ];
        } else if (contractType === 'other' || situation === 'other') {
            return [
                { value: 'tax_return', label: t('docs.tax_return', undefined, 'Latest Tax Return'), captures: 1 },
                { value: 'benefits', label: t('docs.benefits', undefined, 'Social / Family Benefits'), captures: 1 },
                { value: 'pension', label: t('docs.pension', undefined, 'Pension Proof'), captures: 1 },
                { value: 'foreign_tax_return', label: t('docs.foreign_tax', undefined, 'Foreign Tax Return'), captures: 1 },
            ];
        }
        
        return [
            { value: 'payslip', label: t('docs.payslip', undefined, 'Last 3 Payslips'), captures: 3 },
            { value: 'contract', label: t('docs.contract', undefined, 'Employment Contract / Certificate'), captures: 1 },
            { value: 'tax_return', label: t('docs.tax_return', undefined, 'Latest Tax Return'), captures: 1 },
        ];
    };

    const getDocumentTypes = () => {
        if (verificationType === 'identity') {
            return [
                { value: 'passport', label: t('docs.passport', undefined, 'Passport'), captures: 1 },
                { value: 'id_card', label: t('docs.id_card', undefined, 'National ID Card'), captures: 2 },
                { value: 'drivers_license', label: t('docs.drivers_license', undefined, 'Driver\'s License'), captures: 2 },
                { value: 'residence_permit', label: t('docs.residence_permit', undefined, 'Residence Permit / Receipt'), captures: 2 },
            ];
        } else if (verificationType === 'property') {
            return [
                { value: 'property_deed', label: t('docs.property_deed', undefined, 'Property Deed (Titre de propriété)'), captures: 1 },
                { value: 'property_tax_notice', label: t('docs.property_tax_notice', undefined, 'Property Tax Notice (Taxe foncière)'), captures: 1 },
            ];
        }
        return getEmploymentDocumentTypes();
    };

    const documentTypes = getDocumentTypes();
    const selectedDocType = documentTypes.find(dt => dt.value === documentType);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
            setError('');
        }
    };

    const handleCameraCapture = (capturedFiles: File[]) => {
        setFiles(capturedFiles);
        setShowCamera(false);
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!files.length || !documentType) {
            setError('Please select a document type and capture/upload all required photos');
            return;
        }
        setUploading(true);
        setError('');
        try {
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append('file', files[i]);
                formData.append('document_type', documentType);
                formData.append('side', i === 0 ? 'front' : 'back');
                const endpoint = verificationType === 'identity' ? '/verification/identity/upload' : verificationType === 'property' ? '/verification/property/upload' : '/verification/employment/upload';
                await apiClient.client.post(endpoint, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    params: { document_type: documentType, ...(verificationType === 'property' && { property_id: propertyId }) }
                });
            }
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    if (verificationType === 'identity' && !isMobile) {
        return (
            <div className="w-full">
                <div className="text-center mb-16">
                    <h3 className="text-4xl sm:text-5xl font-black tracking-tighter mb-6 uppercase leading-none">
                        {t('dashboard.verification.verification.tabs.identity', undefined, 'Identity Verification')}
                    </h3>
                    <p className="text-zinc-500 font-medium max-w-md mx-auto text-lg leading-relaxed">
                        For ultimate security, capture live photos of your government ID using your smartphone.
                    </p>
                </div>

                {qrLoading && (
                    <div className="py-20 flex flex-col items-center">
                        <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin mb-6" />
                        <p className="text-zinc-400 font-black text-[10px] uppercase tracking-[0.4em] animate-pulse">Establishing Secure Link...</p>
                    </div>
                )}

                {qrSession && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        className="space-y-16"
                    >
                        <div className="flex justify-center relative">
                            <div className="absolute inset-0 bg-teal-500/5 rounded-full blur-[100px] animate-pulse" />
                            <div className="p-10 bg-white dark:bg-zinc-900 rounded-[3rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,0.2)] dark:shadow-[0_64px_128px_-32px_rgba(0,0,0,0.6)] border border-white/40 dark:border-zinc-800/50 relative z-10 group">
                                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rounded-[3rem]" />
                                <QRCodeSVG 
                                    value={qrSession.captureUrl} 
                                    size={240} 
                                    level="H" 
                                    includeMargin={false}
                                    className="dark:invert dark:brightness-100"
                                />
                                <div className="mt-8 flex items-center justify-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-600 dark:text-teal-400">Live Connection Active</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-10">
                            <motion.div whileHover={{ y: -8 }} className="glass-card !p-10 border-none shadow-xl">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-600 mb-8">Instructions</h4>
                                <ul className="space-y-6">
                                    {[
                                        'Open your phone camera & scan QR',
                                        'Choose your document type',
                                        'Capture clear photos of front & back',
                                        'Wait for this screen to auto-sync'
                                    ].map((step, i) => (
                                        <li key={i} className="flex items-start gap-5 text-base font-bold text-zinc-700 dark:text-zinc-300">
                                            <span className="w-8 h-8 shrink-0 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 text-xs font-black">{i + 1}</span>
                                            <span className="pt-1">{step}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>

                            <motion.div whileHover={{ y: -8 }} className="glass-card !p-10 flex flex-col justify-center border-none shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-bl-[100%] group-hover:scale-110 transition-transform duration-700" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-8">Session Status</h4>
                                <div className="flex items-center gap-6 py-6 px-8 rounded-3xl bg-zinc-50 dark:bg-zinc-800/50 mb-8 border border-zinc-100 dark:border-zinc-800/50">
                                    <div className="relative flex h-5 w-5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-5 w-5 bg-teal-500"></span>
                                    </div>
                                    <div>
                                        <p className="text-lg font-black uppercase tracking-widest text-zinc-900 dark:text-white leading-none mb-1">Awaiting Capture</p>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-500">Synchronized with Cloud</p>
                                    </div>
                                </div>
                                <div className="mt-auto flex items-center justify-between">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                        Expires at <span className="text-zinc-900 dark:text-white">{new Date(qrSession.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </p>
                                    <button 
                                        onClick={() => copyToClipboard(qrSession.captureUrl)}
                                        className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 transition-colors"
                                    >
                                        Copy Link
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full">
            {showCamera && (
                <DocumentCapture
                    documentType={documentType}
                    onComplete={handleCameraCapture}
                    onCancel={() => setShowCamera(false)}
                />
            )}

            <div className="text-center mb-16">
                <h3 className="text-4xl font-black tracking-tighter mb-6 uppercase leading-none">
                    {verificationType === 'identity' ? 'Identity Verification' : verificationType === 'property' ? 'Ownership Verification' : 'Resource Verification'}
                </h3>
                <p className="text-zinc-500 font-medium max-w-md mx-auto text-lg leading-relaxed">
                    {verificationType === 'identity' ? 'Capture live photos of your government-issued ID.' : verificationType === 'property' ? 'Upload proof of ownership for this listing.' : 'Upload your professional or financial documents.'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-12 max-w-2xl mx-auto">
                <motion.div variants={itemVariants} className="glass-card !p-10 border-none shadow-2xl">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 block mb-6">1. Select Document Type</label>
                    <select
                        value={documentType}
                        onChange={(e) => { setDocumentType(e.target.value); setFiles([]); }}
                        className="w-full bg-zinc-50 dark:bg-zinc-800/80 border-2 border-transparent focus:border-teal-500/30 rounded-2xl px-8 py-5 text-base font-black text-zinc-900 dark:text-white focus:ring-0 transition-all appearance-none cursor-pointer"
                        required
                    >
                        <option value="">Choose a document...</option>
                        {documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                </motion.div>

                <motion.div variants={itemVariants} className="glass-card !p-10 border-none shadow-2xl">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 block mb-8">2. Secure Capture</label>
                    
                    {verificationType === 'identity' ? (
                        <button
                            type="button"
                            onClick={() => documentType ? setShowCamera(true) : setError('Select type first')}
                            className="w-full py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-700/50 rounded-[2.5rem] hover:border-teal-500/50 hover:bg-teal-500/5 transition-all group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            <div className="flex flex-col items-center gap-6 relative z-10">
                                <div className="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-zinc-900 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 shadow-xl">
                                    <Camera className="w-10 h-10" />
                                </div>
                                <p className="text-base font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white">Activate ID Camera</p>
                            </div>
                        </button>
                    ) : (
                        <div className="relative group">
                            <input
                                type="file"
                                onChange={handleFileChange}
                                accept="image/*,application/pdf"
                                className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                required
                            />
                            <div className="w-full py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-700/50 rounded-[2.5rem] flex flex-col items-center gap-6 group-hover:border-teal-500/50 group-hover:bg-teal-500/5 transition-all duration-500">
                                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-zinc-900 transition-all duration-500 shadow-lg">
                                    <Upload className="w-8 h-8" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white mb-2">{files.length > 0 ? files[0].name : 'Select or Drop Document'}</p>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">PDF, JPG, or PNG max 10MB</p>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>

                {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
                        <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.3em]">{error}</p>
                    </motion.div>
                )}

                <motion.button
                    whileHover={{ scale: 1.02, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={uploading || files.length === 0}
                    className="w-full py-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] disabled:opacity-50 transition-all"
                >
                    {uploading ? 'Securing Document...' : 'Submit for Verification'}
                </motion.button>
            </form>
        </div>
    );
}
