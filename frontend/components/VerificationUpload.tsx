import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import DocumentCapture from './DocumentCapture';
import { QRCodeSVG } from 'qrcode.react';
import { motion, Variants } from 'framer-motion';

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
    verificationType: 'identity' | 'employment';
    onSuccess: () => void;
    user?: any; // Contains user.preferences.contract_type etc.
}

function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

export default function VerificationUpload({ verificationType, onSuccess, user }: VerificationUploadProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [documentType, setDocumentType] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

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
                { value: 'student_id', label: '🎓 Carte d\'Étudiant / Certificat de scolarité', captures: 1 },
                { value: 'internship_contract', label: '📝 Convention de stage', captures: 1 },
                { value: 'scholarship', label: '💶 Avis d\'attribution de bourse', captures: 1 },
                { value: 'caf', label: '🏠 Simulation d\'aides (CAF/MSA)', captures: 1 },
            ];
        } else if (contractType === 'self_employed' || situation === 'flexibility_relocation') {
            return [
                { value: 'kbis', label: '🏢 Extrait K/Kbis (moins de 3 mois)', captures: 1 },
                { value: 'tax_return', label: '📄 Dernier avis d\'imposition', captures: 1 },
                { value: 'accounting', label: '📊 Dernier bilan comptable', captures: 1 },
            ];
        } else if (contractType === 'other' || situation === 'other') {
            return [
                { value: 'tax_return', label: '📄 Dernier avis d\'imposition', captures: 1 },
                { value: 'benefits', label: '💶 Prestations sociales / familiales', captures: 1 },
                { value: 'pension', label: '👴 Justificatif de pension/retraite', captures: 1 },
            ];
        }
        
        // Default to employee
        return [
            { value: 'payslip', label: '📄 3 Derniers bulletins de salaire', captures: 3 },
            { value: 'contract', label: '💼 Contrat de travail / Attestation employeur', captures: 1 },
            { value: 'tax_return', label: '📄 Dernier avis d\'imposition', captures: 1 },
        ];
    };

    const documentTypes = verificationType === 'identity'
        ? [
            { value: 'passport', label: '📘 Passport / Passeport', captures: 1 },
            { value: 'id_card', label: '🪪 Carte Nationale d\'Identité', captures: 2 },
            { value: 'drivers_license', label: '🚗 Permis de conduire', captures: 2 },
            { value: 'residence_permit', label: '🌍 Titre de séjour', captures: 2 },
        ]
        : getEmploymentDocumentTypes();

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
                    : '/verification/employment/upload';

                await apiClient.client.post(endpoint, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    params: {
                        document_type: documentType
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
                    <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">Identity Verification</h3>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        🔒 For security, capture live photos of your ID using your phone's camera
                    </p>
                </motion.div>

                {qrLoading && (
                    <motion.div variants={itemVariants} className="text-center py-12">
                        <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-zinc-500 dark:text-zinc-400">Generating secure session...</p>
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
                            <p className="text-sm font-semibold text-teal-800 dark:text-teal-300 mb-3">📱 How it works:</p>
                            <ol className="text-sm text-teal-700/80 dark:text-teal-400/80 space-y-2 list-decimal list-inside ml-1">
                                <li>Scan the QR code with your phone camera</li>
                                <li>Select your document type</li>
                                <li>Take a clear photo of your document</li>
                                <li>This page will update automatically</li>
                            </ol>
                        </motion.div>

                        {/* Waiting indicator */}
                        <motion.div variants={itemVariants} className="flex items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400 text-sm font-medium py-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                            </span>
                            Waiting for mobile capture...
                        </motion.div>

                        {/* Expiry */}
                        <motion.p variants={itemVariants} className="text-xs text-zinc-400 dark:text-zinc-500 text-center font-medium">
                            Session expires: {new Date(qrSession.expiresAt).toLocaleTimeString()}
                        </motion.p>
                    </motion.div>
                )}

                <motion.div variants={itemVariants} className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed text-center sm:text-left">
                        🔒 Your documents are encrypted and stored securely. We use industry-standard security practices to protect your privacy.
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
                        {verificationType === 'identity' ? 'Identity Verification' : 'Employment Verification'}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {verificationType === 'identity'
                            ? '🔒 For security, please capture live photos of your government-issued ID'
                            : 'Upload a recent payslip or employment document'}
                    </p>
                </motion.div>

                <motion.form variants={containerVariants} onSubmit={handleSubmit} className="space-y-6">
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
                                            <span className="text-2xl">📷</span>
                                        </div>
                                        <span className="font-semibold text-teal-700 dark:text-teal-400">Take Photo of Document</span>
                                    </button>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-teal-50/50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-900/30 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                                    ✓
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
                                    <span>🔒</span> Live capture prevents fraud and ensures document authenticity
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
                                    📎
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
                        🔒 Your documents are encrypted and stored securely. We use industry-standard security practices to protect your privacy.
                    </p>
                </motion.div>
            </motion.div>
        </>
    );
}
