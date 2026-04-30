'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';

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
        name: t('lease.meuble.name', 'Furnished Rental'),
        description: t('lease.meuble.desc', 'Standard lease for furnished property'),
        duration: t('lease.meuble.duration', '1 year (renewable)'),
        tenantNotice: t('lease.meuble.tenantNotice', '1 month'),
        landlordNotice: t('lease.meuble.landlordNotice', '3 months'),
        depositInfo: t('lease.meuble.depositInfo', '2 months max')
    },
    vide: {
        name: t('lease.vide.name', 'Unfurnished Rental'),
        description: t('lease.vide.desc', 'Lease for unfurnished property'),
        duration: t('lease.vide.duration', '3 years (renewable)'),
        tenantNotice: t('lease.vide.tenantNotice', '3 months'),
        landlordNotice: t('lease.vide.landlordNotice', '6 months'),
        depositInfo: t('lease.vide.depositInfo', '1 month max')
    },
    mobilite: {
        name: t('lease.mobilite.name', 'Mobility Lease'),
        description: t('lease.mobilite.desc', 'Short term (students, interns, relocation)'),
        duration: t('lease.mobilite.duration', '1-10 months (non-renewable)'),
        tenantNotice: t('lease.mobilite.tenantNotice', '1 month'),
        landlordNotice: t('lease.mobilite.landlordNotice', 'Not applicable'),
        depositInfo: t('lease.mobilite.depositInfo', 'Forbidden')
    },
    etudiant: {
        name: t('lease.etudiant.name', 'Student Lease'),
        description: t('lease.etudiant.desc', 'Specific for students'),
        duration: t('lease.etudiant.duration', '9 months (non-renewable)'),
        tenantNotice: t('lease.etudiant.tenantNotice', '1 month'),
        landlordNotice: t('lease.etudiant.landlordNotice', 'Not applicable'),
        depositInfo: t('lease.etudiant.depositInfo', '2 months max')
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
            setError(t('lease.error.missingFields', 'Please fill all required fields'));
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
            setError(err.response?.data?.detail || t('lease.error.generationFailed', 'Error generating lease'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-6 border-t pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                 {t('lease.title', 'Generate a Lease')}
            </h3>

            {/* Lease Type Selection */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('lease.leaseType', 'Lease Type')} *
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(LEASE_TYPES).map(([key, info]) => (
                        <button
                            key={key}
                            onClick={() => setLeaseType(key)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${leaseType === key
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div className="font-semibold text-sm">{info.name}</div>
                            <div className="text-xs text-gray-500">{info.duration}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Selected Lease Info */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="font-semibold text-gray-900 mb-2">{selectedType.name}</div>
                <div className="grid grid-cols-2 gap-2 text-gray-600">
                    <div>
                        <span className="font-medium">{t('lease.duration', 'Duration')}:</span> {selectedType.duration}
                    </div>
                    <div>
                        <span className="font-medium">{t('lease.deposit', 'Deposit')}:</span> {selectedType.depositInfo}
                    </div>
                    <div>
                        <span className="font-medium">{t('lease.tenantNotice', 'Tenant Notice')}:</span> {selectedType.tenantNotice}
                    </div>
                    <div>
                        <span className="font-medium">{t('lease.landlordNotice', 'Landlord Notice')}:</span> {selectedType.landlordNotice}
                    </div>
                </div>
            </div>

            {/* Duration for Bail Mobilité */}
            {leaseType === 'mobilite' && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('lease.mobiliteDuration', 'Duration (1-10 months)')} *
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="10"
                        value={durationMonths}
                        onChange={(e) => setDurationMonths(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            )}

            {/* Tenant Email */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('lease.tenantEmail', 'Tenant Email')} *
                </label>
                <input
                    type="email"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    placeholder="locataire@email.com"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Start Date */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('lease.startDate', 'Lease Start Date')} *
                </label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Financial Details */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-2">{t('lease.financialConditions', 'Financial Conditions')}</div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-blue-700 mb-1">{t('lease.monthlyRent', 'Monthly Rent')}</label>
                        <div className="font-bold text-blue-900">{monthlyRent} €</div>
                    </div>
                    <div>
                        <label className="block text-xs text-blue-700 mb-1">{t('lease.charges', 'Charges')}</label>
                        <input
                            type="number"
                            value={customCharges || ''}
                            onChange={(e) => setCustomCharges(parseFloat(e.target.value) || undefined)}
                            placeholder="0"
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    {leaseType !== 'mobilite' && (
                        <div className="col-span-2">
                            <label className="block text-xs text-blue-700 mb-1">
                                {t('lease.securityDeposit', 'Security Deposit')} ({selectedType.depositInfo})
                            </label>
                            <input
                                type="number"
                                value={customDeposit || ''}
                                onChange={(e) => setCustomDeposit(parseFloat(e.target.value) || undefined)}
                                placeholder={`${monthlyRent * 2}`}
                                className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            <button
                onClick={handleGenerate}
                disabled={loading || !tenantEmail || !startDate}
                className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-white font-bold rounded-lg hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {t('lease.generating', 'Generating...')}
                    </span>
                ) : (
                    ` ${t('lease.generateButton', 'Generate Lease Contract')}`
                )}
            </button>

            {result?.downloadUrl && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                         {t('lease.success', 'Lease generated!')} ({LEASE_TYPES[result.leaseType || 'meuble'].name})
                    </div>
                    <p className="text-sm text-green-700 mb-3">
                        {t('lease.successDesc', 'The contract includes all required clauses: notice periods, end of lease conditions, security deposit, obligations of both parties, inventory, and termination clause.')}
                    </p>
                    <a
                        href={result.downloadUrl ? (
                            result.downloadUrl.startsWith('http') 
                                ? `${result.downloadUrl}?token=${typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''}` 
                                : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${result.downloadUrl}?token=${typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''}`
                        ) : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                         {t('lease.downloadPdf', 'Download PDF')}
                    </a>
                </div>
            )}
        </div>
    );
}
