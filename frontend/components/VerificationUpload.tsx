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
            // Start polling for completion
            startPolling(data.verification_code);
        } catch (err) {
            console.error('Failed to create verification session', err);
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
                // Session expired or error — stop polling
                if (pollRef.current) clearInterval(pollRef.current);
            }
        }, 3000);
    };

    const copyToClipboard = (url: string) => {
        navigator.clipboard.writeText(url);
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
        
        // Default to employee
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
            // Upload all files
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append('file', files[i]);
                formData.append('document_type', documentType);
                formData.append('side', i === 0 ? 'front' : 'back');

                const endpoint = verificationType === 'identity'
                    ? '/verification/identity/upload'
                    : verificationType === 'property' 
                        ? '/verification/property/upload'
                        : '/verification/employment/upload';

                await apiClient.client.post(endpoint, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    params: {
                        document_type: documentType,
                        ...(verificationType === 'property' && { property_id: propertyId })
                    }
                });
            }

            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    // ─── Desktop Identity: show QR code ───
    if (verificationType === 'identity' && !isMobile) {
        return (
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="w-full bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 md:p-8"
            >
                <motion.div variants={itemVariants} className="text-center sm:text-left mb-6">
                    <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">{t('dashboard.verification.verification.tabs.identity', undefined, 'Identity Verification')}</h3>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                         {t('cameraCapture.liveCaptureDesc', undefined, 'For security, capture live photos of your ID using your phone\'s camera')}
                    </p>
                </motion.div>

                {qrLoading && (
                    <motion.div variants={itemVariants} className="text-center py-12">
                        <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-zinc-500 dark:text-zinc-400">{t('dashboard.verification.verification.actions.generatingSession', undefined, 'Generating secure session...')}</p>
                    </motion.div>
                )}

                {error && (
                    <motion.div variants={itemVariants} className="mb-6 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-4">
                        <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
                    </motion.div>
                )}

                {qrSession && (
                    <motion.div variants={containerVariants} className="space-y-6 flex flex-col items-center sm:items-stretch">
                        {/* QR Code */}
                        <motion.div variants={itemVariants} className="flex justify-center">
                            <div className="p-4 bg-white rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                                <QRCodeSVG
                                    value={qrSession.captureUrl}
                                    size={200}
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>
                        </motion.div>

                        {/* Copy Link */}
                        <motion.div variants={itemVariants} className="w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Or copy this link:</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={qrSession.captureUrl}
                                    readOnly
                                    className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-600 dark:text-zinc-300 focus:outline-none"
                                />
                                <button
                                    onClick={() => copyToClipboard(qrSession.captureUrl)}
                                    className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors text-sm shadow-sm"
                                >
                                    Copy
                                </button>
                            </div>
                        </motion.div>

                        {/* Instructions */}
                        <motion.div variants={itemVariants} className="w-full bg-teal-50/50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/30 rounded-xl p-5">
                            <p className="text-sm font-semibold text-teal-800 dark:text-teal-300 mb-3"> {t('dashboard.verification.verification.actions.howItWorks', undefined, 'How it works:')}</p>
                            <ol className="text-sm text-teal-700/80 dark:text-teal-400/80 space-y-2 list-decimal list-inside ml-1">
                                <li>{t('dashboard.verification.verification.actions.scanQr', undefined, 'Scan the QR code with your phone camera')}</li>
                                <li>{t('dashboard.verification.verification.actions.selectDoc', undefined, 'Select your document type')}</li>
                                <li>{t('dashboard.verification.verification.actions.takePhoto', undefined, 'Take a clear photo of your document')}</li>
                                <li>{t('dashboard.verification.verification.actions.autoUpdate', undefined, 'This page will update automatically')}</li>
                            </ol>
                        </motion.div>

                        {/* Waiting indicator */}
                        <motion.div variants={itemVariants} className="flex items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400 text-sm font-medium py-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                            </span>
                            {t('dashboard.verification.verification.actions.mobileWaiting', undefined, 'Waiting for mobile capture...')}
                        </motion.div>

                        {/* Expiry */}
                        <motion.p variants={itemVariants} className="text-xs text-zinc-400 dark:text-zinc-500 text-center font-medium">
                            Session expires: {new Date(qrSession.expiresAt).toLocaleTimeString()}
                        </motion.p>
                    </motion.div>
                )}

                <motion.div variants={itemVariants} className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed text-center sm:text-left">
                         {t('dashboard.verification.verification.legalDisclaimerDesc', undefined, 'Your documents are encrypted and stored securely. We use industry-standard security practices to protect your privacy.')}
                    </p>
                </motion.div>
            </motion.div>
        );
    }

    // ─── Mobile Identity / Employment: standard flow ───
    return (
        <>
            {showCamera && (
                <DocumentCapture
                    documentType={documentType}
                    onComplete={handleCameraCapture}
                    onCancel={() => setShowCamera(false)}
                />
            )}

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="w-full bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 md:p-8"
            >
                <motion.div variants={itemVariants} className="text-center sm:text-left mb-8">
                    <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                        {verificationType === 'identity' 
                            ? t('dashboard.verification.verification.tabs.identity', undefined, 'Identity Verification')
                            : verificationType === 'property' 
                                ? t('dashboard.verification.verification.property_title', undefined, 'Property Ownership Verification')
                                : t('dashboard.verification.verification.tabs.employment', undefined, 'Employment & Resource Verification')}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {verificationType === 'identity'
                            ? t('dashboard.verification.verification.identity_desc', undefined, 'For security, please capture live photos of your government-issued ID')
                            : verificationType === 'property'
                                ? t('dashboard.verification.verification.property_desc', undefined, 'Please upload proof that you own this property (Deed or Tax Notice)')
                                : t('dashboard.verification.verification.employment_desc', undefined, 'Upload your professional or financial documents')}
                    </p>
                </motion.div>

                {/* Guarantor Prompt Logic for Employment/Resources */}
                {verificationType === 'employment' && hasGuarantor === null && (
                    <motion.div variants={itemVariants} className="mb-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700">
                        <h4 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Do you have a guarantor?</h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">A guarantor is highly recommended in France. If you don't have one, you can use institutional services.</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setHasGuarantor(true)}
                                className="flex-1 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Yes, I have documents
                            </button>
                            <button
                                onClick={() => setHasGuarantor(false)}
                                className="flex-1 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                            >
                                No, I need options
                            </button>
                        </div>
                    </motion.div>
                )}

                {verificationType === 'employment' && hasGuarantor === false && (
                    <motion.div variants={itemVariants} className="mb-8 grid gap-4 sm:grid-cols-2">
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-xl p-5 flex flex-col">
                            <h5 className="font-bold text-blue-900 dark:text-blue-300 mb-1">Visale (Free)</h5>
                            <p className="text-xs text-blue-700 dark:text-blue-400 mb-4 flex-1">A free state guarantee for under 30s or new hires. Obtain your certificate and upload it here.</p>
                            <a href="https://www.visale.fr/" target="_blank" rel="noopener noreferrer" className="text-center py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                                Apply on Visale
                            </a>
                        </div>
                        <div className="bg-teal-50/50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-900/30 rounded-xl p-5 flex flex-col">
                            <h5 className="font-bold text-teal-900 dark:text-teal-300 mb-1">Garantme (Paid)</h5>
                            <p className="text-xs text-teal-700 dark:text-teal-400 mb-4 flex-1">Ideal for international students or freelancers. Get approved in 24h.</p>
                            <a href="https://garantme.fr/" target="_blank" rel="noopener noreferrer" className="text-center py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors">
                                Apply on Garantme
                            </a>
                        </div>
                        <div className="col-span-full pt-2">
                            <p className="text-xs text-center text-zinc-500">Already have your certificate? Select it from the dropdown below to upload.</p>
                        </div>
                    </motion.div>
                )}

                <motion.form variants={containerVariants} onSubmit={handleSubmit} className={`space-y-6 ${(verificationType === 'employment' && hasGuarantor === null) ? 'opacity-50 pointer-events-none' : ''}`}>
                    {error && (
                        <motion.div variants={itemVariants} className="rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-4">
                            <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
                        </motion.div>
                    )}

                    <motion.div variants={itemVariants}>
                        <label htmlFor="documentType" className="block text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-1.5">
                            Document Type
                        </label>
                        <select
                            id="documentType"
                            value={documentType}
                            onChange={(e) => {
                                setDocumentType(e.target.value);
                                setFiles([]); // Reset files when document type changes
                            }}
                            className="block w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all shadow-sm"
                            required
                        >
                            <option value="">Select document type...</option>
                            {documentTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        {verificationType === 'identity' ? (
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-300">
                                    Capture Document {selectedDocType && <span className="text-zinc-500 font-normal">({selectedDocType.captures} photo{selectedDocType.captures > 1 ? 's' : ''})</span>}
                                </label>
                                {files.length === 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!documentType) {
                                                setError('Please select a document type first');
                                                return;
                                            }
                                            setShowCamera(true);
                                        }}
                                        disabled={!documentType}
                                        className="w-full py-8 border-2 border-dashed border-teal-300 dark:border-teal-900/50 rounded-xl hover:bg-teal-50/50 dark:hover:bg-teal-900/10 hover:border-teal-500 transition-all flex flex-col items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                                    >
                                        <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <span className="text-2xl"></span>
                                        </div>
                                        <span className="font-semibold text-teal-700 dark:text-teal-400">Take Photo of Document</span>
                                    </button>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-teal-50/50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-900/30 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                                    
                                                </div>
                                                <p className="text-sm font-semibold text-teal-900 dark:text-teal-300">
                                                    {files.length} photo{files.length > 1 ? 's' : ''} captured
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                {files.map((file, index) => (
                                                    <div key={index} className="flex justify-between items-center bg-white dark:bg-zinc-900/60 p-2.5 rounded-lg border border-teal-100 dark:border-teal-900/20">
                                                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{index + 1}. {file.name}</span>
                                                        <span className="text-xs text-zinc-500">{(file.size / 1024).toFixed(0)} KB</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFiles([]);
                                                    setShowCamera(true);
                                                }}
                                                className="text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                                            >
                                                ↻ Retake photos
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 pt-1">
                                    <span></span> Live capture prevents fraud and ensures document authenticity
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label htmlFor="file" className="block text-sm font-medium text-zinc-800 dark:text-zinc-300">
                                    Upload Document
                                </label>
                                <input
                                    type="file"
                                    id="file"
                                    onChange={handleFileChange}
                                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                                    className="block w-full text-sm text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700/80 focus:outline-none transition-all cursor-pointer"
                                    required
                                />
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                    Accepted formats: JPEG, PNG, PDF (Max 10MB)
                                </p>
                            </div>
                        )}
                    </motion.div>

                    {files.length > 0 && verificationType === 'employment' && (
                        <motion.div variants={itemVariants} className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
                                    
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate max-w-[200px]">
                                        {files[0].name}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {(files[0].size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <motion.div variants={itemVariants} className="pt-2">
                        <button
                            type="submit"
                            disabled={uploading || files.length === 0}
                            className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98]"
                        >
                            {uploading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Uploading & Verifying...
                                </span>
                            ) : (
                                'Upload & Verify Securely'
                            )}
                        </button>
                    </motion.div>
                </motion.form>

                <motion.div variants={itemVariants} className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center sm:text-left leading-relaxed">
                         {t('dashboard.verification.verification.legalDisclaimerDesc', undefined, 'Your documents are encrypted and stored securely. We use industry-standard security practices to protect your privacy.')}
                    </p>
                </motion.div>
            </motion.div>
        </>
    );
}
