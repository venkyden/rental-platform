'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileText, Calendar, Info, ArrowLeft, Eye } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import { useAuth } from '@/lib/useAuth';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import { useLanguage } from '@/lib/LanguageContext';

interface Application {
    id: string;
    tenant_id: string;
    property_id: string;
    status: string;
    tenant?: {
        full_name: string;
        email: string;
    };
    property?: {
        id: string;
        title: string;
        address_line1: string;
        city: string;
        monthly_rent: number;
        charges: number;
    };
}

export default function LeaseGeneratorPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const toast = useToast();
    const { t } = useLanguage();

    const [application, setApplication] = useState<Application | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

    // Form state
    const [leaseType, setLeaseType] = useState('meuble');
    const [startDate, setStartDate] = useState('');
    const [durationMonths, setDurationMonths] = useState(12);
    const [guarantorName, setGuarantorName] = useState('');
    const [depositAmount, setDepositAmount] = useState<number>(0);
    const [rentAmount, setRentAmount] = useState<number>(0);
    const [chargesAmount, setChargesAmount] = useState<number>(0);

    useEffect(() => {
        document.title = "Create Lease Protocol | Roomivo";
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', 'Generate and review legal lease agreements compliant with French rental law (Loi ALUR) for your approved tenants.');

        loadApplication();
    }, [id]);

    const loadApplication = async () => {
        try {
            const response = await apiClient.client.get(`/applications/${id}`);
            const appData = response.data;
            setApplication(appData);

            if (appData.property) {
                setRentAmount(appData.property.monthly_rent || 0);
                setChargesAmount(appData.property.charges || 0);
                // Default deposit for meublé = 2 months rent
                setDepositAmount((appData.property.monthly_rent || 0) * 2);
            }

            // Default start date to 1st of next month
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            nextMonth.setDate(1);
            setStartDate(nextMonth.toISOString().split('T')[0]);
        } catch (error) {
            console.error('Error loading application:', error);
            toast.error('Failed to load application details');
        } finally {
            setLoading(false);
        }
    };

    // French Law Lease Type Constraints
    useEffect(() => {
        if (!application?.property) return;
        const rent = rentAmount;

        switch (leaseType) {
            case 'vide':
                setDurationMonths(36); // standard 3 years
                setDepositAmount(rent * 1); // Loi Alur: max 1 month deposit for unfurnished
                break;
            case 'meuble':
                setDurationMonths(12); // standard 12 months
                setDepositAmount(rent * 2); // Loi Alur: max 2 months deposit for furnished
                break;
            case 'etudiant':
                setDurationMonths(9); // standard 9 months student lease
                setDepositAmount(rent * 2); // max 2 months
                break;
            case 'mobilite':
                setDurationMonths(10); // max 10 months mobility lease
                setDepositAmount(0); // Loi Alur: deposit is FORBIDDEN for mobility lease!
                break;
            default:
                setDurationMonths(12);
                setDepositAmount(rent * 2);
        }
    }, [leaseType, rentAmount]);

    const validateForm = () => {
        const today = new Date().toISOString().split('T')[0];
        if (startDate < today) {
            toast.error('Lease start date cannot be in the past');
            return false;
        }
        if (rentAmount <= 0) {
            toast.error('Rent must be greater than 0');
            return false;
        }
        if (chargesAmount < 0) {
            toast.error('Charges cannot be negative');
            return false;
        }

        // Validate deposit limits according to French law
        if (leaseType === 'vide' && depositAmount > rentAmount * 1) {
            toast.error('Loi ALUR compliance: Deposit for unfurnished lease cannot exceed 1 month rent');
            return false;
        }
        if (leaseType === 'meuble' && depositAmount > rentAmount * 2) {
            toast.error('Loi ALUR compliance: Deposit for furnished lease cannot exceed 2 months rent');
            return false;
        }
        if (leaseType === 'mobilite' && depositAmount > 0) {
            toast.error('Loi ALUR compliance: Guarantee deposit is strictly forbidden for mobility leases');
            return false;
        }
        if (leaseType === 'mobilite' && (durationMonths < 1 || durationMonths > 10)) {
            toast.error('Bail Mobilité compliance: Duration must be between 1 and 10 months');
            return false;
        }

        return true;
    };

    const handlePreview = async () => {
        if (!application || !validateForm()) return;
        setGenerating(true);

        try {
            const response = await apiClient.client.post('/leases/generate', {
                application_id: application.id,
                lease_type: leaseType,
                start_date: startDate,
                duration_months: durationMonths,
                rent_override: rentAmount,
                charges_override: chargesAmount,
                deposit_override: depositAmount,
                guarantor_name: guarantorName || undefined
            }, {
                responseType: 'text'
            });
            setPreviewHtml(response.data);
            toast.success(t('lease.success') || 'Preview generated!');
        } catch (error) {
            console.error('Error generating preview:', error);
            toast.error(t('lease.error.generationFailed') || 'Failed to generate preview');
        } finally {
            setGenerating(false);
        }
    };

    const handleCreateLease = async () => {
        if (!application || !validateForm()) return;
        setGenerating(true);

        try {
            const response = await apiClient.client.post('/leases/create', {
                application_id: application.id,
                lease_type: leaseType,
                start_date: startDate,
                duration_months: durationMonths,
                rent_override: rentAmount,
                charges_override: chargesAmount,
                deposit_override: depositAmount,
                guarantor_name: guarantorName || undefined
            });

            toast.success('Bail enregistré avec succès !');
            // Redirect into the e-sign flow for the newly created lease, or dashboard
            if (response.data?.lease_id) {
                router.push(`/leases/${response.data.lease_id}/sign`);
            } else {
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Error creating lease:', error);
            toast.error('Failed to create lease contract');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-zinc-200 dark:border-zinc-800 border-t-zinc-950 dark:border-t-white rounded-full animate-spin" />
                </div>
            </ProtectedRoute>
        );
    }

    if (!application || application.status !== 'approved') {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl text-center border border-zinc-150 dark:border-zinc-800 max-w-sm w-full shadow-lg">
                        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/20 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-4">
                            <Info className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-tight">{t('lease.error.applicationInvalid')}</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">{t('lease.error.onlyApprovedCandidates')}</p>
                        <button
                            onClick={() => router.back()}
                            className="w-full py-3 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                        >
                            {t('lease.error.back')}
                        </button>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <PremiumLayout withNavbar={true}>
                <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                    <header className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <button
                                onClick={() => router.back()}
                                className="text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-2 mb-3"
                            >
                                <ArrowLeft className="w-4 h-4" /> {t('onboarding.back')}
                            </button>
                            <h1 className="text-3xl font-black text-zinc-950 dark:text-white uppercase tracking-tight">
                                {t('lease.title')}
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mt-1">
                                {t('dashboard.landlord.welcome').replace('{{name}}', '')} {t('verify.guarantor.physical')} ({application.tenant?.full_name || 'Locataire'})
                            </p>
                        </div>
                    </header>

                    <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Configuration Form */}
                        <div className="bg-white dark:bg-zinc-900/60 rounded-3xl shadow-sm p-8 border border-zinc-150 dark:border-zinc-800/80 lg:col-span-5 space-y-6">
                            <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
                                <FileText className="w-5 h-5 text-zinc-400" />
                                {t('lease.error.setupTitle')}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                                        {t('lease.leaseType')}
                                    </label>
                                    <select
                                        value={leaseType}
                                        onChange={(e) => setLeaseType(e.target.value)}
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-950 text-sm font-semibold"
                                    >
                                        {/* Only `meuble` generates today — backend refuses (422) the rest:
                                            vide/étudiant/colocation await the official model wiring (Path A —
                                            the annexes cover colocation); mobilité lacks art. 25-13 mentions;
                                            code_civil is outside loi 89 (no contrat-type published).
                                            See app/services/lease_generator.py. */}
                                        <option value="meuble">{t('lease.meuble.name')} (Loi 89)</option>
                                        <option value="vide" disabled>{t('lease.vide.name')} (Loi 89) — {t('lease.type.unavailable', undefined, 'bientôt disponible')}</option>
                                        <option value="mobilite" disabled>{t('lease.mobilite.name')} — {t('lease.type.unavailable', undefined, 'bientôt disponible')}</option>
                                        <option value="etudiant" disabled>{t('lease.etudiant.name')} — {t('lease.type.unavailable', undefined, 'bientôt disponible')}</option>
                                        <option value="colocation" disabled>Colocation Meublée — {t('lease.type.unavailable', undefined, 'bientôt disponible')}</option>
                                        <option value="code_civil" disabled>Bail Code Civil — {t('lease.type.unavailable', undefined, 'bientôt disponible')}</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                                        {t('lease.startDate')}
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-950 text-sm font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                                        {t('lease.duration')} (mois)
                                    </label>
                                    {leaseType === 'mobilite' ? (
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={durationMonths}
                                            onChange={(e) => setDurationMonths(Math.max(1, Math.min(10, Number(e.target.value))))}
                                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-950 text-sm font-semibold"
                                        />
                                    ) : (
                                        <select
                                            value={durationMonths}
                                            onChange={(e) => setDurationMonths(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-950 text-sm font-semibold"
                                            disabled={leaseType === 'etudiant' || leaseType === 'meuble' || leaseType === 'vide'}
                                        >
                                            <option value={9}>9 mois (Étudiant)</option>
                                            <option value={12}>12 mois (1 An)</option>
                                            <option value={36}>36 mois (3 Ans)</option>
                                        </select>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                                        {t('lease.monthlyRent')} (€)
                                    </label>
                                    <input
                                        type="number"
                                        value={rentAmount}
                                        onChange={(e) => setRentAmount(Number(e.target.value))}
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-950 text-sm font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                                        {t('lease.charges')} (€)
                                    </label>
                                    <input
                                        type="number"
                                        value={chargesAmount}
                                        onChange={(e) => setChargesAmount(Number(e.target.value))}
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-950 text-sm font-semibold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                                        {t('lease.securityDeposit')} (€)
                                    </label>
                                    <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(Number(e.target.value))}
                                        disabled={leaseType === 'mobilite'}
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-950 text-sm font-semibold disabled:opacity-50"
                                    />
                                    {leaseType === 'mobilite' && (
                                        <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mt-1.5">
                                            {t('lease.mobilite.depositInfo')}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                                        {t('verify.guarantor.title')} (Optionnel)
                                    </label>
                                    <input
                                        type="text"
                                        value={guarantorName}
                                        onChange={(e) => setGuarantorName(e.target.value)}
                                        placeholder="E.g., John Doe"
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-950 text-sm font-semibold"
                                    />
                                </div>
                            </div>

                            {/* Property Details Summary */}
                            <div className="p-5 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-100 dark:border-zinc-850 text-xs font-medium space-y-2">
                                <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-2">{t('lease.propertySummary')}</h3>
                                <p><strong className="text-zinc-400">{t('dashboard.landlord.widgets.visits.date')}:</strong> {application.property?.title}</p>
                                <p><strong className="text-zinc-400">{t('lease.address')}:</strong> {application.property?.address_line1}, {application.property?.city}</p>
                                <p><strong className="text-zinc-400">{t('lease.alurCompliance')}</strong></p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={handlePreview}
                                    disabled={generating}
                                    className="flex-1 py-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold uppercase tracking-widest rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Eye className="w-4 h-4" /> {generating ? '...' : t('lease.preview')}
                                </button>
                                <button
                                    onClick={handleCreateLease}
                                    disabled={generating}
                                    className="flex-1 py-4 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold uppercase tracking-widest rounded-xl disabled:opacity-50 transition-colors shadow-lg"
                                >
                                    {generating ? '...' : t('lease.generateButton')}
                                </button>
                            </div>
                        </div>

                        {/* Preview Iframe */}
                        <div className="bg-white dark:bg-zinc-900/60 rounded-3xl shadow-sm p-8 border border-zinc-150 dark:border-zinc-800/80 lg:col-span-7 h-full min-h-[600px] flex flex-col">
                            <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
                                <Eye className="w-5 h-5 text-zinc-400" />
                                {t('lease.contractPreview')}
                            </h2>

                            {previewHtml ? (
                                <div className="border border-zinc-150 dark:border-zinc-800 rounded-2xl overflow-hidden flex-1 bg-white">
                                    <iframe
                                        srcDoc={previewHtml}
                                        className="w-full h-[650px]"
                                        title="Lease Preview"
                                        sandbox=""
                                    />
                                </div>
                            ) : (
                                <div className="flex-1 min-h-[500px] bg-zinc-50 dark:bg-zinc-950/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                                    <div className="text-center max-w-sm p-6">
                                        <FileText className="w-12 h-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
                                        <p className="text-sm font-semibold uppercase tracking-wider">{t('lease.clickPreview')}</p>
                                        <p className="text-xs text-zinc-400 mt-2">{t('lease.alurNote')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
