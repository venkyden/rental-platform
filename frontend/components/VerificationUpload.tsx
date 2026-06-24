"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Camera, Upload, ArrowRight, RefreshCcw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { motion, Variants } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

interface VerificationUploadProps {
    verificationType: 'identity' | 'employment' | 'property';
    propertyId?: string;
    onSuccessAction: () => void;
    user?: any;
}

function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

// ─── Document type helpers ───────────────────────────────────────────────────

const IDENTITY_DOC_TYPES = [
    { value: 'passport',         label: 'Passport',                   icon: '🌍' },
    { value: 'id_card',          label: 'National ID Card',            icon: '🆔' },
    { value: 'drivers_license',  label: "Driver's License",            icon: '🚗' },
    { value: 'residence_permit', label: 'Residence Permit / Receipt',  icon: '🏠' },
];

// ─── Inline selfie-with-ID guide illustration ────────────────────────────────

function IdSelfieIllustration() {
    return (
        <div className="relative w-full aspect-video bg-zinc-900 rounded-3xl overflow-hidden flex items-center justify-center">
            <div className="absolute top-4 left-4 w-7 h-7 border-t-2 border-l-2 border-white/40 rounded-tl-md" />
            <div className="absolute top-4 right-4 w-7 h-7 border-t-2 border-r-2 border-white/40 rounded-tr-md" />
            <div className="absolute bottom-4 left-4 w-7 h-7 border-b-2 border-l-2 border-white/40 rounded-bl-md" />
            <div className="absolute bottom-4 right-4 w-7 h-7 border-b-2 border-r-2 border-white/40 rounded-br-md" />

            <div className="flex items-center gap-5">
                {/* Face silhouette */}
                <div className="flex flex-col items-center gap-1">
                    <div className="w-16 h-16 rounded-full bg-zinc-700 border-2 border-white/20 flex items-center justify-center overflow-hidden relative">
                        <div className="absolute top-3 w-12 h-8 rounded-full bg-zinc-600" />
                        <div className="absolute bottom-0 w-full h-7 rounded-t-[50%] bg-zinc-600" />
                        <div className="absolute top-5 flex gap-3">
                            <div className="w-2 h-2 rounded-full bg-white/50" />
                            <div className="w-2 h-2 rounded-full bg-white/50" />
                        </div>
                    </div>
                    <div className="w-20 h-4 rounded-t-full bg-zinc-700 border-t-2 border-x-2 border-white/20" />
                </div>
                <div className="text-white/30 text-xl font-black">+</div>
                {/* ID card mockup */}
                <div className="w-28 h-[4.5rem] bg-zinc-700 rounded-xl border-2 border-white/40 p-2 flex gap-2">
                    <div className="w-10 h-full rounded-lg bg-zinc-600 border border-white/20 flex items-center justify-center shrink-0">
                        <div className="w-5 h-5 rounded-full bg-white/20" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-1.5">
                        <div className="h-1.5 bg-white/40 rounded-full w-full" />
                        <div className="h-1.5 bg-white/25 rounded-full w-3/4" />
                        <div className="h-1.5 bg-white/25 rounded-full w-full" />
                        <div className="h-1 bg-white/15 rounded-full mt-1 w-full" />
                        <div className="h-1 bg-white/15 rounded-full w-full" />
                    </div>
                </div>
            </div>

            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full">
                <span className="text-[8px] font-black text-white uppercase tracking-[0.25em]">Example</span>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VerificationUpload({ verificationType, propertyId, onSuccessAction, user }: VerificationUploadProps) {
    const { t } = useLanguage();

    // Common state
    const [files, setFiles] = useState<File[]>([]);
    const [documentType, setDocumentType] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [consent, setConsent] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Identity mobile selfie-with-ID flow
    const [idStep, setIdStep] = useState<'select' | 'guide' | 'preview' | null>(null);
    const [idFile, setIdFile] = useState<File | Blob | null>(null);
    const [idPreviewUrl, setIdPreviewUrl] = useState<string | null>(null);
    const [idUploading, setIdUploading] = useState(false);
    const idFileInputRef = useRef<HTMLInputElement>(null);

    // QR code session (desktop identity)
    const [qrSession, setQrSession] = useState<{ code: string; captureUrl: string; expiresAt: string } | null>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Property verification
    const [properties, setProperties] = useState<any[]>([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId || '');
    const [loadingProps, setLoadingProps] = useState(false);

    useEffect(() => { setIsMobile(isMobileDevice()); }, []);

    useEffect(() => {
        if (verificationType === 'property' && !propertyId) {
            setLoadingProps(true);
            apiClient.getProperties()
                .then(data => {
                    setProperties(data);
                    if (data.length === 1) setSelectedPropertyId(data[0].id);
                })
                .catch(() => setError('Failed to load your properties. Please refresh and try again.'))
                .finally(() => setLoadingProps(false));
        }
    }, [verificationType, propertyId]);

    useEffect(() => {
        if (verificationType === 'identity' && !isMobile && !qrSession) {
            createQrSession();
        }
        if (!documentType) {
            const types = getDocumentTypes();
            const recommended = types.find(t => (t as any).recommended);
            if (recommended) setDocumentType(recommended.value);
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (eventSourceRef.current) eventSourceRef.current.close();
        };
    }, [verificationType, isMobile, user]);

    useEffect(() => {
        return () => { if (idPreviewUrl) URL.revokeObjectURL(idPreviewUrl); };
    }, [idPreviewUrl]);

    // ── QR session helpers ────────────────────────────────────────────────

    const createQrSession = async () => {
        setQrLoading(true);
        try {
            const res = await apiClient.client.post('/verification/identity/session');
            const data = res.data;
            setQrSession({ code: data.verification_code, captureUrl: data.capture_url, expiresAt: data.expires_at });
            startSseConnection(data.verification_code);
        } catch {
            setError('Failed to create verification session');
        } finally {
            setQrLoading(false);
        }
    };

    const startSseConnection = (code: string) => {
        if (eventSourceRef.current) eventSourceRef.current.close();
        if (pollRef.current) clearInterval(pollRef.current);
        const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/verification/identity/session/${code}/stream`;
        const es = new EventSource(url);
        eventSourceRef.current = es;
        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.completed) { es.close(); eventSourceRef.current = null; onSuccessAction(); }
            } catch {}
        };
        es.onerror = () => { es.close(); eventSourceRef.current = null; startPolling(code); };
    };

    const startPolling = (code: string) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await apiClient.client.get(`/verification/identity/session/${code}/status`);
                if (res.data.completed) { clearInterval(pollRef.current!); onSuccessAction(); }
            } catch { clearInterval(pollRef.current!); setError('Verification session expired. Please refresh the QR code.'); }
        }, 3000);
    };

    const copyToClipboard = (url: string) => {
        navigator.clipboard.writeText(url);
        toast.success('Link copied');
    };

    // ── Identity mobile selfie-with-ID handlers ───────────────────────────

    const handleIdFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.files?.[0];
        if (!raw) return;
        const isHeic = /\.heic|\.heif$/i.test(raw.name);
        try {
            const processed: Blob = isHeic ? raw : await compressImage(raw);
            setIdFile(processed);
            setIdPreviewUrl(URL.createObjectURL(processed));
            setIdStep('preview');
        } catch {
            toast.error('Failed to process image. Please try again.');
        }
        if (e.target) e.target.value = '';
    }, []);

    const compressImage = (f: File): Promise<Blob> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = ev => {
                const img = new Image();
                img.src = ev.target?.result as string;
                img.onload = () => {
                    const MAX = 1800;
                    let w = img.width, h = img.height;
                    if (w > MAX || h > MAX) {
                        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                        else       { w = Math.round(w * MAX / h); h = MAX; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression failed')), 'image/jpeg', 0.88);
                };
            };
            reader.onerror = reject;
        });

    const requireConsent = () => {
        if (!consent) {
            setError(t('verification.upload.consentRequired', undefined,
                'Please consent to automated document analysis to continue'));
            return false;
        }
        return true;
    };

    const handleIdUpload = async () => {
        if (!idFile) return;
        if (!requireConsent()) return;
        setIdUploading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', idFile, 'selfie_with_id.jpg');
            formData.append('side', 'selfie_with_id');
            await apiClient.client.post('/verification/identity/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: { document_type: documentType },
            });
            onSuccessAction();
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Upload failed. Please try again.');
            setIdStep('preview');
        } finally {
            setIdUploading(false);
        }
    };

    // ── Document type lists ───────────────────────────────────────────────

    const getEmploymentDocumentTypes = () => {
        const role = user?.role || 'tenant';
        const rolePrefs = user?.preferences?.[role] || user?.preferences || {};
        const contractType = rolePrefs?.contract_type;
        const situation = rolePrefs?.situation;

        if (situation === 'young_professional' || contractType === 'cdi' || contractType === 'cdd' || contractType === 'interim') {
            return [
                { value: 'payslip', label: t('docs.payslip', undefined, 'Last 3 Payslips'), captures: 3, recommended: true },
                { value: 'employer_certificate', label: t('docs.employer_cert', undefined, 'Employer Certificate / Job Promise'), captures: 1, recommended: situation === 'young_professional' || contractType === 'cdd' },
                { value: 'contract', label: t('docs.contract', undefined, 'Employment Contract'), captures: 1 },
                { value: 'tax_return', label: t('docs.tax_return', undefined, 'Latest Tax Return'), captures: 1, recommended: true },
            ];
        }
        if (situation === 'student' || contractType === 'student' || contractType === 'internship') {
            return [
                { value: 'student_id', label: t('docs.student_id', undefined, 'Student ID / Enrollment Certificate'), captures: 1, recommended: true },
                { value: 'internship_contract', label: t('docs.internship_contract', undefined, 'Internship Agreement'), captures: 1, recommended: contractType === 'internship' },
                { value: 'scholarship', label: t('docs.scholarship', undefined, 'Scholarship Notice'), captures: 1 },
                { value: 'visale_certificate', label: t('docs.visale', undefined, 'Visale Guarantee Certificate'), captures: 1, recommended: true },
                { value: 'garantme_certificate', label: t('docs.garantme', undefined, 'Garantme Certificate'), captures: 1 },
            ];
        }
        if (situation === 'self_employed' || contractType === 'self_employed') {
            return [
                { value: 'kbis', label: t('docs.kbis', undefined, 'Kbis Extract / Auto-entrepreneur cert'), captures: 1, recommended: true },
                { value: 'tax_return', label: t('docs.tax_return', undefined, 'Last 2 Tax Returns'), captures: 1, recommended: true },
                { value: 'accounting', label: t('docs.accounting', undefined, 'Latest Accounting Balance'), captures: 1 },
                { value: 'professional_card', label: t('docs.professional_card', undefined, 'Professional Card / Identity Certificate'), captures: 1 },
            ];
        }
        if (situation === 'retired') {
            return [
                { value: 'pension', label: t('docs.pension', undefined, 'Pension / Retirement Proof'), captures: 1, recommended: true },
                { value: 'tax_return', label: t('docs.tax_return', undefined, 'Latest Tax Return'), captures: 1, recommended: true },
                { value: 'bank_statement', label: t('docs.bank_statement', undefined, 'Last 3 Bank Statements'), captures: 3 },
            ];
        }
        if (situation === 'other' || contractType === 'other') {
            return [
                { value: 'tax_return', label: t('docs.tax_return', undefined, 'Latest Tax Return'), captures: 1, recommended: true },
                { value: 'benefits', label: t('docs.benefits', undefined, 'Social / Family Benefits'), captures: 1 },
                { value: 'bank_funds_certificate', label: t('docs.bank_funds', undefined, 'Bank Funds / Wealth Certificate'), captures: 1 },
                { value: 'foreign_tax_return', label: t('docs.foreign_tax', undefined, 'Foreign Tax Return'), captures: 1 },
            ];
        }
        return [
            { value: 'payslip', label: t('docs.payslip', undefined, 'Last 3 Payslips'), captures: 3, recommended: true },
            { value: 'contract', label: t('docs.contract', undefined, 'Employment Contract / Certificate'), captures: 1 },
            { value: 'tax_return', label: t('docs.tax_return', undefined, 'Latest Tax Return'), captures: 1 },
        ];
    };

    const getDocumentTypes = () => {
        if (verificationType === 'identity') {
            return IDENTITY_DOC_TYPES;
        }
        if (verificationType === 'property') {
            const landlordPrefs = user?.preferences?.landlord || {};
            const isProfessional = landlordPrefs.property_count === '5_100' || landlordPrefs.property_count === '100_plus';
            return [
                { value: 'property_deed', label: t('docs.property_deed', undefined, 'Property Deed (Titre de propriété)'), captures: 1, recommended: !isProfessional },
                { value: 'property_tax_notice', label: t('docs.property_tax_notice', undefined, 'Property Tax Notice (Taxe foncière)'), captures: 1, recommended: true },
                ...(isProfessional ? [
                    { value: 'kbis', label: t('docs.company_kbis', undefined, 'Company Kbis (Professional Landlord)'), captures: 1, recommended: true },
                    { value: 'management_mandate', label: t('docs.management_mandate', undefined, 'Management Mandate (for Agencies)'), captures: 1 },
                ] : []),
            ];
        }
        return getEmploymentDocumentTypes();
    };

    const documentTypes = getDocumentTypes();
    const selectedDocType = documentTypes.find(dt => dt.value === documentType);

    // ── File upload for employment / property ────────────────────────────

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            const hasHeic = selectedFiles.some(f => /\.heic|\.heif$/i.test(f.name));
            if (hasHeic) toast.success('HEIC image detected. Uploading directly.');
            setFiles(selectedFiles);
            setError('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!files.length || !documentType) {
            setError('Please select a document type and upload all required files');
            return;
        }
        if (!requireConsent()) return;
        setUploading(true);
        setError('');
        try {
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append('file', files[i]);
                formData.append('document_type', documentType);
                formData.append('side', i === 0 ? 'front' : 'back');
                const endpoint = verificationType === 'property' ? '/verification/property/upload' : '/verification/income/upload';
                await apiClient.client.post(endpoint, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    params: { document_type: documentType, ...(verificationType === 'property' && { property_id: selectedPropertyId }) }
                });
            }
            onSuccessAction();
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            const errorMessage = typeof detail === 'string'
                ? detail
                : Array.isArray(detail)
                    ? detail[0]?.msg || 'Validation error'
                    : typeof detail === 'object' && detail !== null
                        ? detail.msg || JSON.stringify(detail)
                        : 'Upload failed. Please try again.';
            setError(errorMessage);
        } finally {
            setUploading(false);
        }
    };

    // ════════════════════════════════════════════════════════════════════════
    // RENDER — desktop identity: QR code
    // ════════════════════════════════════════════════════════════════════════

    if (verificationType === 'identity' && !isMobile) {
        return (
            <div className="w-full">
                <div className="text-center mb-16">
                    <h3 className="text-4xl sm:text-5xl font-black tracking-tighter mb-6 uppercase leading-none">
                        {t('dashboard.verification.verification.identityTitle', undefined, 'Identity Verification')}
                    </h3>
                    <p className="text-zinc-500 font-medium max-w-md mx-auto text-lg leading-relaxed">
                        {t('dashboard.verification.verification.identityDesc', undefined, 'For ultimate security, capture live photos of your government ID using your smartphone.')}
                    </p>
                </div>

                {qrLoading && (
                    <div className="py-20 flex flex-col items-center">
                        <div className="w-16 h-16 border-4 border-zinc-900/20 border-t-zinc-900 rounded-full animate-spin mb-6" />
                        <p className="text-zinc-400 font-black text-[10px] uppercase tracking-[0.4em] animate-pulse">
                            {t('dashboard.verification.verification.actions.generatingSession', undefined, 'Establishing Secure Link...')}
                        </p>
                    </div>
                )}

                {qrSession && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-16">
                        <div className="flex justify-center relative">
                            <div className="absolute inset-0 bg-zinc-900/5 rounded-full blur-[100px] animate-pulse" />
                            <div className="p-10 bg-white rounded-[3rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,0.2)] border border-white/40 relative z-10 group">
                                <QRCodeSVG value={qrSession.captureUrl} size={240} level="H" includeMargin={false} />
                                <div className="mt-8 flex items-center justify-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-zinc-900 animate-ping" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900">
                                        {t('dashboard.verification.verification.status.live', undefined, 'Live Connection Active')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-10">
                            <motion.div whileHover={{ y: -8 }} className="glass-card !p-10 border-none shadow-xl">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-900 mb-8">
                                    {t('dashboard.verification.verification.instructions.title', undefined, 'Instructions')}
                                </h4>
                                <ul className="space-y-6">
                                    {[
                                        t('dashboard.verification.verification.instructions.step1', undefined, 'Open your phone camera & scan QR'),
                                        t('dashboard.verification.verification.instructions.step2', undefined, 'Choose your document type'),
                                        t('dashboard.verification.verification.instructions.step3', undefined, 'Take one photo: hold your ID beside your face'),
                                        t('dashboard.verification.verification.instructions.step4', undefined, 'Wait for this screen to auto-sync'),
                                    ].map((step, i) => (
                                        <li key={i} className="flex items-start gap-5 text-base font-bold text-zinc-700">
                                            <span className="w-8 h-8 shrink-0 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 text-xs font-black">{i + 1}</span>
                                            <span className="pt-1">{step}</span>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>

                            <motion.div whileHover={{ y: -8 }} className="glass-card !p-10 flex flex-col justify-center border-none shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-900/5 rounded-bl-[100%] group-hover:scale-110 transition-transform duration-700" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-8">
                                    {t('dashboard.verification.verification.status.title', undefined, 'Session Status')}
                                </h4>
                                <div className="flex items-center gap-6 py-6 px-8 rounded-3xl bg-zinc-50 mb-8 border border-zinc-100">
                                    <div className="relative flex h-5 w-5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-5 w-5 bg-zinc-900"></span>
                                    </div>
                                    <div>
                                        <p className="text-lg font-black uppercase tracking-widest text-zinc-900 leading-none mb-1">
                                            {t('dashboard.verification.verification.status.awaiting', undefined, 'Awaiting Capture')}
                                        </p>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                            {t('dashboard.verification.verification.status.synced', undefined, 'Synchronized with Cloud')}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-auto flex items-center justify-between">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                        {t('dashboard.verification.verification.status.expiresAt', undefined, 'Expires at')} <span className="text-zinc-900">{new Date(qrSession.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </p>
                                    <button onClick={() => copyToClipboard(qrSession.captureUrl)}
                                        className="text-[10px] font-black uppercase tracking-widest text-zinc-900 hover:text-zinc-700 transition-colors">
                                        {t('dashboard.verification.verification.actions.copy', undefined, 'Copy Link')}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // RENDER — mobile identity: selfie-with-ID guided flow
    // ════════════════════════════════════════════════════════════════════════

    if (verificationType === 'identity' && isMobile) {
        // Guide step
        if (idStep === 'guide') {
            return (
                <div className="w-full space-y-8">
                    <div className="text-center">
                        <h3 className="text-3xl font-black tracking-tighter uppercase leading-none mb-2">
                            {t('dashboard.verification.verification.identityTitle', undefined, 'Identity Verification')}
                        </h3>
                        <p className="text-zinc-500 font-medium text-sm">
                            Hold your <strong>{IDENTITY_DOC_TYPES.find(d => d.value === documentType)?.label ?? 'document'}</strong> next to your face
                        </p>
                    </div>

                    <IdSelfieIllustration />

                    <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Tips</p>
                        {[
                            'Hold your ID clearly visible beside your face',
                            'Good lighting — avoid glare on the document',
                            'Both your face and the ID face must be visible',
                            "Don't cover text or photos with your fingers",
                        ].map((tip, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                                <p className="text-sm font-medium text-zinc-600">{tip}</p>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-2xl bg-zinc-900 text-white text-center shadow-xl">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">{error}</p>
                        </motion.div>
                    )}

                    <div className="flex gap-3">
                        <button onClick={() => setIdStep('select')}
                            className="flex-1 py-5 bg-zinc-100 text-zinc-900 font-black rounded-2xl text-[10px] uppercase tracking-[0.3em]">
                            Back
                        </button>
                        <button
                            onClick={() => { setError(''); idFileInputRef.current?.click(); }}
                            className="flex-[2] bg-zinc-900 text-white font-black py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-[0.4em]">
                            <Camera className="w-5 h-5" /> Take Photo
                        </button>
                    </div>

                    <input ref={idFileInputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif"
                        capture="environment" onChange={handleIdFileChange} className="hidden" />
                </div>
            );
        }

        // Preview step
        if (idStep === 'preview' && idPreviewUrl) {
            return (
                <div className="w-full space-y-6">
                    <div>
                        <h3 className="text-3xl font-black tracking-tighter uppercase leading-none mb-1">
                            {t('dashboard.verification.verification.identityTitle', undefined, 'Identity Verification')}
                        </h3>
                        <p className="text-zinc-500 font-medium text-sm">Are both your face and ID clearly visible?</p>
                    </div>

                    <div className="relative w-full aspect-video bg-zinc-100 rounded-3xl overflow-hidden border border-zinc-200">
                        <img src={idPreviewUrl} alt="Preview" className="w-full h-full object-contain" />
                    </div>

                    {error && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="p-4 rounded-2xl bg-zinc-900 text-white text-center shadow-xl">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">{error}</p>
                        </motion.div>
                    )}

                    {idUploading ? (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <div className="w-12 h-12 border-4 border-zinc-900/20 border-t-zinc-900 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Verifying...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* AI-processing consent (GDPR — ID analysed by Google Gemini, then discarded) */}
                            <label className="flex items-start gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={consent}
                                    onChange={(e) => setConsent(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900"
                                />
                                <span className="text-xs text-zinc-500 leading-relaxed">
                                    {t('verification.upload.consent', undefined,
                                        'I consent to automated analysis of my document by Google Gemini to extract only the facts needed for verification. The document is not retained afterwards.')}{' '}
                                    <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline text-zinc-700 hover:text-zinc-900">
                                        {t('verification.upload.consentLink', undefined, 'Privacy Policy')}
                                    </a>
                                </span>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => { setIdFile(null); setIdPreviewUrl(null); setError(''); idFileInputRef.current?.click(); }}
                                    className="flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.3em]">
                                    <RefreshCcw className="w-4 h-4" /> Retake
                                </button>
                                <button onClick={handleIdUpload} disabled={!consent}
                                    className="flex items-center justify-center gap-2 bg-zinc-900 text-white font-black py-5 rounded-2xl shadow-xl text-[10px] uppercase tracking-[0.3em] disabled:opacity-50">
                                    Submit <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    <input ref={idFileInputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif"
                        capture="environment" onChange={handleIdFileChange} className="hidden" />
                </div>
            );
        }

        // Default: document type selection (idStep === 'select' or null)
        return (
            <div className="w-full space-y-8">
                <div className="text-center">
                    <h3 className="text-3xl font-black tracking-tighter uppercase leading-none mb-2">
                        {t('dashboard.verification.verification.identityTitle', undefined, 'Identity Verification')}
                    </h3>
                    <p className="text-zinc-500 font-medium text-sm">
                        Which document will you use?
                    </p>
                </div>

                <div className="grid gap-3">
                    {IDENTITY_DOC_TYPES.map(doc => (
                        <button key={doc.value} onClick={() => setDocumentType(doc.value)}
                            className={`p-5 rounded-[2rem] border-2 text-left transition-all flex items-center justify-between ${
                                documentType === doc.value
                                    ? 'border-zinc-900 bg-zinc-900 text-white'
                                    : 'border-zinc-100 bg-white hover:border-zinc-300'
                            }`}>
                            <div className="flex items-center gap-4">
                                <span className="text-2xl">{doc.icon}</span>
                                <div className={`font-black text-[10px] uppercase tracking-widest ${documentType === doc.value ? 'text-white' : 'text-zinc-900'}`}>
                                    {doc.label}
                                </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${documentType === doc.value ? 'border-white bg-white' : 'border-zinc-200'}`}>
                                {documentType === doc.value && <div className="w-1.5 h-1.5 rounded-full bg-zinc-900" />}
                            </div>
                        </button>
                    ))}
                </div>

                <motion.button
                    whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }}
                    disabled={!documentType}
                    onClick={() => setIdStep('guide')}
                    className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] disabled:opacity-50 transition-all flex items-center justify-center gap-3">
                    Continue <ArrowRight className="w-5 h-5" />
                </motion.button>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // RENDER — employment & property: standard file upload form
    // ════════════════════════════════════════════════════════════════════════

    return (
        <div className="w-full">
            <div className="text-center mb-16">
                <h3 className="text-4xl font-black tracking-tighter mb-6 uppercase leading-none">
                    {verificationType === 'property'
                        ? t('dashboard.verification.verification.propertyTitle', undefined, 'Ownership Verification')
                        : t('dashboard.verification.verification.resourceTitle', undefined, 'Resource Verification')}
                </h3>
                <p className="text-zinc-500 font-medium max-w-md mx-auto text-lg leading-relaxed">
                    {verificationType === 'property'
                        ? t('dashboard.verification.verification.propertyDesc', undefined, 'Upload proof of ownership for this listing.')
                        : t('dashboard.verification.verification.resourceDesc', undefined, 'Upload your professional or financial documents.')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-12 max-w-2xl mx-auto">
                <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-12">

                    <motion.div variants={itemVariants} className="glass-card !p-10 border-none shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-900/5 rounded-bl-full" />

                        {verificationType === 'property' && !propertyId && (
                            <div className="mb-8">
                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 block mb-2">
                                    {loadingProps ? 'Loading properties...' : 'Select Property'}
                                </label>
                                {properties.length > 0 ? (
                                    <select value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)} required
                                        className="w-full bg-zinc-50 border-none rounded-2xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10 transition-all outline-none appearance-none">
                                        <option value="">Choose a property...</option>
                                        {properties.map(p => <option key={p.id} value={p.id}>{p.title} - {p.city}</option>)}
                                    </select>
                                ) : !loadingProps && (
                                    <p className="text-xs text-zinc-900 font-bold uppercase tracking-widest">No properties found. Please add a property first.</p>
                                )}
                            </div>
                        )}

                        {/* Profile situation display */}
                        <div className="mb-8">
                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 block mb-2">
                                {t('dashboard.verification.verification.steps.detectedProfile', undefined, 'Current Profile Situation')}
                            </label>
                            <p className="text-sm font-black text-zinc-900 uppercase tracking-widest">
                                {(() => {
                                    const role = user?.role || 'tenant';
                                    const rolePrefs = user?.preferences?.[role] || user?.preferences || {};
                                    let questionId = 'contract_type';
                                    if (role === 'landlord' || role === 'property_manager') questionId = 'property_count';
                                    else if (rolePrefs.situation) questionId = 'situation';
                                    else if (rolePrefs.contract_type) questionId = 'contract_type';
                                    const value = rolePrefs[questionId] || 'Standard';
                                    if (value === '1_4') return '1 - 4 Properties';
                                    if (value === '5_100') return '5 - 100 Properties';
                                    if (value === '100_plus') return '100+ Properties';
                                    const translationRole = (role === 'landlord' || role === 'property_manager') ? 'landlord' : 'tenant';
                                    const translated = t(`onboarding.questions.${translationRole}.${questionId}.options.${value}`, undefined, '');
                                    if (translated) return translated;
                                    return typeof value === 'string' ? value.replace(/_/g, ' ') : String(value);
                                })()}
                            </p>
                        </div>

                        <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 block mb-6">
                            {t('dashboard.verification.verification.steps.selectType', undefined, '1. Select Document Type')}
                        </label>
                        <select value={documentType} onChange={e => { setDocumentType(e.target.value); setFiles([]); }}
                            className="w-full bg-zinc-50 border-2 border-transparent focus:border-zinc-900/10 rounded-2xl px-8 py-5 text-base font-black text-zinc-900 focus:ring-0 transition-all appearance-none cursor-pointer"
                            required>
                            <option value="">Choose a document...</option>
                            {documentTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label} {(type as any).recommended ? ` (Recommended)` : ''}
                                </option>
                            ))}
                        </select>
                    </motion.div>

                    <motion.div variants={itemVariants} className="glass-card !p-10 border-none shadow-2xl">
                        <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 block mb-8">
                            {t('dashboard.verification.verification.steps.secureCapture', undefined, '2. Upload Document')}
                        </label>
                        <div className="relative group">
                            <input type="file" onChange={handleFileChange} accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer z-20" required />
                            <div className="w-full py-16 border-2 border-dashed border-zinc-200 rounded-[2.5rem] flex flex-col items-center gap-6 group-hover:border-zinc-900/50 group-hover:bg-zinc-900/5 transition-all duration-500">
                                <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-all duration-500 shadow-lg">
                                    <Upload className="w-8 h-8" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black uppercase tracking-widest text-zinc-900 mb-2">
                                        {files.length > 0 ? files[0].name : 'Select or Drop Document'}
                                    </p>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">PDF, JPG, or PNG max 10MB</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            className="p-6 rounded-2xl bg-zinc-900 text-white text-center shadow-2xl">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">{error}</p>
                        </motion.div>
                    )}

                    {/* AI-processing consent (GDPR — documents analysed by Google Gemini, then discarded) */}
                    <label className="flex items-start gap-3 px-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900"
                        />
                        <span className="text-xs text-zinc-500 leading-relaxed">
                            {t('verification.upload.consent', undefined,
                                'I consent to automated analysis of my document by Google Gemini to extract only the facts needed for verification. The document is not retained afterwards.')}{' '}
                            <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline text-zinc-700 hover:text-zinc-900">
                                {t('verification.upload.consentLink', undefined, 'Privacy Policy')}
                            </a>
                        </span>
                    </label>

                    <motion.button whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }}
                        type="submit" disabled={uploading || files.length === 0 || !consent}
                        className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] disabled:opacity-50 transition-all">
                        {uploading ? 'Uploading...' : 'Submit for Verification'}
                    </motion.button>
                </motion.div>
            </form>
        </div>
    );
}
