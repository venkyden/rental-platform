import { useState, useEffect, useRef } from 'react';
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
                <div className="text-center mb-12">
                    <h3 className="text-4xl font-black tracking-tighter mb-4">{t('dashboard.verification.verification.tabs.identity', undefined, 'Identity Verification')}</h3>
                    <p className="text-zinc-500 font-medium max-w-md mx-auto">For security, capture live photos of your ID using your phone's camera.</p>
                </div>

                {qrLoading && (
                    <div className="py-12 flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mb-4" />
                        <p className="text-zinc-400 font-black text-xs uppercase tracking-widest">Securing Session...</p>
                    </div>
                )}

                {qrSession && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                        <div className="flex justify-center">
                            <div className="p-8 bg-white dark:bg-zinc-800 rounded-[2.5rem] shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 border border-zinc-100 dark:border-zinc-700/30">
                                <QRCodeSVG value={qrSession.captureUrl} size={220} level="H" includeMargin={true} />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="glass-card !p-8">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 mb-6">Instructions</h4>
                                <ul className="space-y-4">
                                    {[
                                        'Scan QR code with your phone',
                                        'Select your ID type',
                                        'Capture clear photos',
                                        'Watch this screen update'
                                    ].map((step, i) => (
                                        <li key={i} className="flex items-center gap-4 text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                            <span className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 text-[10px] font-black">{i + 1}</span>
                                            {step}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="glass-card !p-8 flex flex-col justify-center">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-6">Waiting for capture</h4>
                                <div className="flex items-center gap-4 py-4">
                                    <div className="relative flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-teal-500"></span>
                                    </div>
                                    <p className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white animate-pulse">Live Sync Active</p>
                                </div>
                                <p className="mt-auto text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    Session Expires: {new Date(qrSession.expiresAt).toLocaleTimeString()}
                                </p>
                            </div>
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

            <div className="text-center mb-12">
                <h3 className="text-3xl font-black tracking-tighter mb-4">
                    {verificationType === 'identity' ? 'Identity Verification' : verificationType === 'property' ? 'Ownership Verification' : 'Resource Verification'}
                </h3>
                <p className="text-zinc-500 font-medium max-w-md mx-auto">
                    {verificationType === 'identity' ? 'Capture live photos of your government-issued ID.' : verificationType === 'property' ? 'Upload proof of ownership for this listing.' : 'Upload your professional or financial documents.'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">
                <div className="glass-card !p-8 border-none shadow-xl">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block mb-4">Document Type</label>
                    <select
                        value={documentType}
                        onChange={(e) => { setDocumentType(e.target.value); setFiles([]); }}
                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-teal-500/50 transition-all"
                        required
                    >
                        <option value="">Select type...</option>
                        {documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                </div>

                <div className="glass-card !p-8 border-none shadow-xl">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block mb-6">File Upload</label>
                    
                    {verificationType === 'identity' ? (
                        <button
                            type="button"
                            onClick={() => documentType ? setShowCamera(true) : setError('Select type first')}
                            className="w-full py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-700/50 rounded-[2rem] hover:border-teal-500/50 hover:bg-teal-50/5 dark:hover:bg-teal-900/5 transition-all group"
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-teal-500 group-hover:text-white transition-all">
                                    <Camera className="w-8 h-8" />
                                </div>
                                <p className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">Capture ID Photo</p>
                            </div>
                        </button>
                    ) : (
                        <div className="relative">
                            <input
                                type="file"
                                onChange={handleFileChange}
                                accept="image/*,application/pdf"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                required
                            />
                            <div className="w-full py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-700/50 rounded-[2rem] flex flex-col items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">{files.length > 0 ? files[0].name : 'Select or drop file'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {error && <p className="text-center text-red-500 text-[10px] font-black uppercase tracking-widest">{error}</p>}

                <button
                    type="submit"
                    disabled={uploading || files.length === 0}
                    className="btn-primary !w-full !py-5 !rounded-2xl !text-sm uppercase tracking-[0.2em] shadow-2xl shadow-teal-500/20 active:scale-95 transition-all"
                >
                    {uploading ? 'Processing Securely...' : 'Submit Verification'}
                </button>
            </form>
        </div>
    );
}
