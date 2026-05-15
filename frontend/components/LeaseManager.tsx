'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';
import { Loader2, FileText } from 'lucide-react';

interface LeaseManagerProps {
    propertyId: string;
    monthlyRent: number;
    deposit?: number;
    charges?: number;
}

interface LeaseTypeInfo {
    name: string;
    description: string;
    duration: string;
    tenantNotice: string;
    landlordNotice: string;
    depositInfo: string;
}

const getLeaseTypes = (t: any): Record<string, LeaseTypeInfo> => ({
    meuble: {
        name: t('lease.meuble.name', undefined, 'Furnished Rental'),
        description: t('lease.meuble.desc', undefined, 'Standard lease for furnished property'),
        duration: t('lease.meuble.duration', undefined, '1 year (renewable)'),
        tenantNotice: t('lease.meuble.tenantNotice', undefined, '1 month'),
        landlordNotice: t('lease.meuble.landlordNotice', undefined, '3 months'),
        depositInfo: t('lease.meuble.depositInfo', undefined, '2 months max')
    },
    vide: {
        name: t('lease.vide.name', undefined, 'Unfurnished Rental'),
        description: t('lease.vide.desc', undefined, 'Lease for unfurnished property'),
        duration: t('lease.vide.duration', undefined, '3 years (renewable)'),
        tenantNotice: t('lease.vide.tenantNotice', undefined, '3 months'),
        landlordNotice: t('lease.vide.landlordNotice', undefined, '6 months'),
        depositInfo: t('lease.vide.depositInfo', undefined, '1 month max')
    },
    mobilite: {
        name: t('lease.mobilite.name', undefined, 'Mobility Lease'),
        description: t('lease.mobilite.desc', undefined, 'Short term (students, interns, relocation)'),
        duration: t('lease.mobilite.duration', undefined, '1-10 months (non-renewable)'),
        tenantNotice: t('lease.mobilite.tenantNotice', undefined, '1 month'),
        landlordNotice: t('lease.mobilite.landlordNotice', undefined, 'Not applicable'),
        depositInfo: t('lease.mobilite.depositInfo', undefined, 'Forbidden')
    },
    etudiant: {
        name: t('lease.etudiant.name', undefined, 'Student Lease'),
        description: t('lease.etudiant.desc', undefined, 'Specific for students'),
        duration: t('lease.etudiant.duration', undefined, '9 months (non-renewable)'),
        tenantNotice: t('lease.etudiant.tenantNotice', undefined, '1 month'),
        landlordNotice: t('lease.etudiant.landlordNotice', undefined, 'Not applicable'),
        depositInfo: t('lease.etudiant.depositInfo', undefined, '2 months max')
    }
});

export default function LeaseManager({ propertyId, monthlyRent, deposit, charges }: LeaseManagerProps) {
    const { t } = useLanguage();
    const LEASE_TYPES = getLeaseTypes(t);
    const [tenantEmail, setTenantEmail] = useState('');
    const [startDate, setStartDate] = useState('');
    const [leaseType, setLeaseType] = useState('meuble');
    const [durationMonths, setDurationMonths] = useState<number>(10);
    const [customDeposit, setCustomDeposit] = useState<number | undefined>(deposit);
    const [customCharges, setCustomCharges] = useState<number | undefined>(charges);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ downloadUrl?: string; leaseType?: string } | null>(null);
    const [error, setError] = useState('');

    const selectedType = LEASE_TYPES[leaseType];

    const handleGenerate = async () => {
        if (!tenantEmail || !startDate) {
            setError(t('lease.error.missingFields', undefined, 'Please fill all required fields'));
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await apiClient.client.post(`/visits/leases/generate?property_id=${propertyId}`, {
                tenant_email: tenantEmail,
                rent_amount: monthlyRent,
                start_date: startDate,
                lease_type: leaseType,
                deposit_amount: leaseType === 'mobilite' ? 0 : customDeposit,
                charges_amount: customCharges,
                duration_months: leaseType === 'mobilite' ? durationMonths : undefined
            });

            setResult({
                downloadUrl: response.data.download_url,
                leaseType: response.data.lease_type
            });
        } catch (err: any) {
            setError(err.response?.data?.detail || t('lease.error.generationFailed', undefined, 'Error generating lease'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-6 border-t border-zinc-100 pt-10">
            <h3 className="text-2xl font-black text-zinc-900 mb-8 flex items-center gap-4 uppercase tracking-tighter">
                <FileText className="w-6 h-6" />
                {t('lease.title', undefined, 'Generate a Lease')}
            </h3>

            {/* Lease Type Selection */}
            <div className="mb-8">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">
                    {t('lease.leaseType', undefined, 'Lease Type')} *
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(LEASE_TYPES).map(([key, info]) => (
                        <button
                            key={key}
                            onClick={() => setLeaseType(key)}
                            className={`p-5 rounded-2xl border-2 text-left transition-all ${leaseType === key
                                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-xl shadow-zinc-900/20'
                                    : 'border-zinc-100 bg-zinc-50/50 hover:border-zinc-200'
                                }`}
                        >
                            <div className="font-black text-sm uppercase tracking-tight">{info.name}</div>
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1 group-hover:text-zinc-500">{info.duration}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected Lease Info */}
            <div className="mb-8 p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100">
                <div className="font-black text-zinc-900 mb-4 uppercase tracking-tighter">{selectedType.name}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('lease.duration', undefined, 'Duration')}:</span>
                        <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight">{selectedType.duration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('lease.deposit', undefined, 'Deposit')}:</span>
                        <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight">{selectedType.depositInfo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('lease.tenantNotice', undefined, 'Tenant Notice')}:</span>
                        <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight">{selectedType.tenantNotice}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('lease.landlordNotice', undefined, 'Landlord Notice')}:</span>
                        <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight">{selectedType.landlordNotice}</span>
                    </div>
                </div>
            </div>

            {/* Duration for Bail Mobilité */}
            {leaseType === 'mobilite' && (
                <div className="mb-6">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                        {t('lease.mobiliteDuration', undefined, 'Duration (1-10 months)')} *
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="10"
                        value={isNaN(durationMonths) ? '' : durationMonths}
                        onChange={(e) => setDurationMonths(e.target.value === '' ? 1 : parseInt(e.target.value) || 1)}
                        className="w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-900/10 font-bold shadow-inner"
                    />
                </div>
            )}

            {/* Tenant Email */}
            <div className="mb-6">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                    {t('lease.tenantEmail', undefined, 'Tenant Email')} *
                </label>
                <input
                    type="email"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    placeholder={t('common.placeholders.tenantEmail')}
                    className="w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-900/10 font-bold shadow-inner"
                />
            </div>

            {/* Start Date */}
            <div className="mb-10">
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                    {t('lease.startDate', undefined, 'Lease Start Date')} *
                </label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-zinc-900/10 font-bold shadow-inner"
                />
            </div>

            {/* Financial Details */}
            <div className="mb-4 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <div className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">{t('lease.financialConditions', undefined, 'Financial Conditions')}</div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">{t('lease.monthlyRent', undefined, 'Monthly Rent')}</label>
                        <div className="text-lg font-black text-zinc-900">{monthlyRent} €</div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">{t('lease.charges', undefined, 'Charges')}</label>
                        <input
                            type="number"
                            value={(customCharges === undefined || isNaN(customCharges)) ? '' : customCharges}
                            onChange={(e) => setCustomCharges(e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900/10"
                        />
                    </div>
                    {leaseType !== 'mobilite' && (
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">
                                {t('lease.securityDeposit', undefined, 'Security Deposit')} ({selectedType.depositInfo})
                            </label>
                            <input
                                type="number"
                                value={(customDeposit === undefined || isNaN(customDeposit)) ? '' : customDeposit}
                                onChange={(e) => setCustomDeposit(e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)}
                                placeholder={`${monthlyRent * 2}`}
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900/10"
                            />
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest text-center">
                    {error}
                </div>
            )}

            <button
                onClick={handleGenerate}
                disabled={loading || !tenantEmail || !startDate}
                className="w-full py-6 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden relative"
            >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                <span className="relative z-10 flex items-center justify-center gap-3">
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('lease.generating', undefined, 'Transmitting...')}
                        </>
                    ) : (
                        t('lease.generateButton', undefined, 'Initialize Lease Protocol')
                    )}
                </span>
            </button>

            {result?.downloadUrl && (
                <div className="mt-4 p-6 bg-zinc-900 text-white rounded-2xl border border-zinc-800">
                    <div className="flex items-center gap-3 font-black uppercase tracking-widest mb-3">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        {t('lease.success', undefined, 'Lease generated!')}
                    </div>
                    <p className="text-xs font-bold text-zinc-400 mb-6 leading-relaxed">
                        {t('lease.successDesc', undefined, 'The contract includes all required clauses: notice periods, end of lease conditions, security deposit, obligations of both parties, inventory, and termination clause.')}
                    </p>
                    <a
                        href={result.downloadUrl ? (
                            result.downloadUrl.startsWith('http') 
                                ? `${result.downloadUrl}?token=${typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''}` 
                                : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${result.downloadUrl}?token=${typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''}`
                        ) : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full px-6 py-4 bg-white text-zinc-900 rounded-xl font-black uppercase tracking-widest hover:bg-zinc-100 transition-all active:scale-95"
                    >
                         {t('lease.downloadPdf', undefined, 'Download PDF')}
                    </a>
                </div>
            )}
        </div>
    );
}
