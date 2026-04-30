'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

interface GLIQuoteWidgetProps {
    monthlyRent: number;
    propertyId: string;
}

const EMPLOYMENT_TYPES = [
    { value: 'cdi', label: 'CDI (Permanent Contract)' },
    { value: 'cdd', label: 'CDD (Fixed-term Contract)' },
    { value: 'freelance', label: 'Self-employed / Freelance' },
    { value: 'retired', label: 'Retired' },
    { value: 'student', label: 'Student' },
];

export default function GLIQuoteWidget({ monthlyRent, propertyId }: GLIQuoteWidgetProps) {
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [quote, setQuote] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [tenantIncome, setTenantIncome] = useState<number>(monthlyRent * 3);
    const [employmentType, setEmploymentType] = useState('cdi');
    const [employmentVerified, setEmploymentVerified] = useState(false);
    const [identityVerified, setIdentityVerified] = useState(false);

    const getQuote = async () => {
        setLoading(true);
        setError(null);
        setQuote(null);

        try {
            const response = await apiClient.client.post('/verification/gli/quote', {
                monthly_rent: monthlyRent,
                tenant_monthly_income: tenantIncome,
                tenant_employment_type: employmentType,
                tenant_employment_verified: employmentVerified,
                tenant_identity_verified: identityVerified
            });
            setQuote(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Error calculating quote');
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        setLoading(true);
        try {
            await apiClient.client.post(`/verification/gli/apply?property_id=${propertyId}`, {
                monthly_rent: monthlyRent,
                tenant_monthly_income: tenantIncome,
                tenant_employment_type: employmentType,
                tenant_employment_verified: employmentVerified,
                tenant_identity_verified: identityVerified
            });
            alert('Application submitted! An advisor will contact you within 24h.');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Error submitting application');
        } finally {
            setLoading(false);
        }
    };

    if (!showForm) {
        return (
            <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 px-4 bg-zinc-900 dark:bg-white text-white rounded-lg hover:from-green-600 hover:to-emerald-700 font-medium flex items-center justify-center gap-2 shadow-md"
            >
                ️ Get GLI Quote
            </button>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {/* Header */}
            <div className="bg-zinc-900 dark:bg-white text-white p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">️</span>
                        <div>
                            <h3 className="font-bold">Rent Guarantee Insurance</h3>
                            <p className="text-sm text-green-100">Protection against unpaid rent</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(false)}
                        className="text-white/70 hover:text-white"
                    >
                        
                    </button>
                </div>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4">
                {/* Rent display */}
                <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-500">Monthly Rent</div>
                    <div className="text-2xl font-bold text-gray-900">{monthlyRent.toLocaleString('fr-FR')} €</div>
                </div>

                {/* Tenant income */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tenant Monthly Income
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={tenantIncome}
                            onChange={(e) => setTenantIncome(Number(e.target.value))}
                            className="w-full px-3 py-2 border rounded-lg pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Ratio: {(tenantIncome / monthlyRent).toFixed(1)}x the rent
                        {tenantIncome / monthlyRent >= 3 ? ' ' : ' ️ (minimum 3x)'}
                    </p>
                </div>

                {/* Employment type */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Employment Type
                    </label>
                    <select
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                    >
                        {EMPLOYMENT_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Verification status */}
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={employmentVerified}
                            onChange={(e) => setEmploymentVerified(e.target.checked)}
                            className="rounded"
                        />
                        <span className="text-sm">Employment Verified</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={identityVerified}
                            onChange={(e) => setIdentityVerified(e.target.checked)}
                            className="rounded"
                        />
                        <span className="text-sm">Identity Verified</span>
                    </label>
                </div>

                {/* Get Quote button */}
                <button
                    onClick={getQuote}
                    disabled={loading}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                >
                    {loading ? 'Calculating...' : 'Calculate Quote'}
                </button>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                        {error}
                    </div>
                )}

                {/* Quote result */}
                {quote && (
                    <div className={`rounded-lg p-4 ${quote.eligible ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                        {quote.eligible ? (
                            <>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xl"></span>
                                    <span className="font-bold text-green-800">Eligible for GLI</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-white rounded-lg p-3 text-center">
                                        <div className="text-sm text-gray-500">Monthly Premium</div>
                                        <div className="text-xl font-bold text-green-700">
                                            {quote.monthly_premium?.toLocaleString('fr-FR')} €
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 text-center">
                                        <div className="text-sm text-gray-500">Annual Premium</div>
                                        <div className="text-xl font-bold text-green-700">
                                            {quote.annual_premium?.toLocaleString('fr-FR')} €
                                        </div>
                                    </div>
                                </div>

                                <div className="text-sm text-gray-600 mb-3">
                                    <div> Rate: {quote.premium_rate}% of rent</div>
                                    <div>️ Coverage: {quote.coverage_amount?.toLocaleString('fr-FR')} € ({quote.coverage_months} months)</div>
                                    <div> Quote valid until: {quote.quote_valid_until}</div>
                                </div>

                                <button
                                    onClick={handleApply}
                                    disabled={loading}
                                    className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                >
                                    Subscribe Now
                                </button>
                            </>
                        ) : (
                            <div className="flex items-start gap-2">
                                <span className="text-xl">️</span>
                                <div>
                                    <div className="font-bold text-yellow-800">Not Eligible</div>
                                    <p className="text-sm text-yellow-700 mt-1">{quote.eligibility_reason}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
