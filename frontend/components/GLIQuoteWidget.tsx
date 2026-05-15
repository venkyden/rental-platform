'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';
import { X, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface GLIQuoteWidgetProps {
    monthlyRent: number;
    propertyId: string;
}

const getEmploymentTypes = (t: any) => [
    { value: 'cdi', label: t('auth.register.role.cdi', undefined, 'CDI (Permanent Contract)') },
    { value: 'cdd', label: t('auth.register.role.cdd', undefined, 'CDD (Fixed-term Contract)') },
    { value: 'freelance', label: t('auth.register.role.self_employed', undefined, 'Self-employed / Freelance') },
    { value: 'retired', label: t('auth.register.role.retired', undefined, 'Retired') },
    { value: 'student', label: t('auth.register.role.student', undefined, 'Student') },
];

export default function GLIQuoteWidget({ monthlyRent, propertyId }: GLIQuoteWidgetProps) {
    const { t } = useLanguage();
    const EMPLOYMENT_TYPES = getEmploymentTypes(t);
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
                className="w-full py-3 px-4 bg-zinc-900 text-white rounded-xl hover:shadow-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
                {t('dashboard.widgets.gli.button', undefined, '️ Get GLI Quote')}
            </button>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {/* Header */}
            <div className="bg-zinc-900 text-white p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold">{t('dashboard.widgets.gli.title', undefined, 'Rent Guarantee Insurance')}</h3>
                            <p className="text-xs text-white/60">{t('dashboard.widgets.gli.subtitle', undefined, 'Protection against unpaid rent')}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(false)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white/70" />
                    </button>
                </div>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4">
                {/* Rent display */}
                <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">{t('dashboard.widgets.gli.rent', undefined, 'Monthly Rent')}</div>
                    <div translate="no" className="notranslate text-2xl font-black text-zinc-900">{monthlyRent.toLocaleString('fr-FR')} €</div>
                </div>

                {/* Tenant income */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">
                        {t('dashboard.widgets.gli.income', undefined, 'Tenant Monthly Income')}
                    </label>
                    <div className="relative group">
                        <input
                            type="number"
                            value={isNaN(tenantIncome) ? '' : tenantIncome}
                            onChange={(e) => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                setTenantIncome(val);
                            }}
                            className="w-full px-4 py-3 bg-zinc-50 border-none rounded-xl font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">€</span>
                    </div>
                    <p translate="no" className="notranslate text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-2">
                        {t('dashboard.widgets.gli.ratio', { ratio: monthlyRent > 0 ? (tenantIncome / monthlyRent).toFixed(1) : '0.0' }, `Ratio: ${monthlyRent > 0 ? (tenantIncome / monthlyRent).toFixed(1) : '0.0'}x rent`)}
                        {monthlyRent > 0 && tenantIncome / monthlyRent < 3 && <span className="text-zinc-900 ml-2 font-black">{t('dashboard.widgets.gli.min_ratio', undefined, '(min 3x)')}</span>}
                    </p>
                </div>

                {/* Employment type */}
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">
                        {t('dashboard.widgets.gli.contract', undefined, 'Employment Type')}
                    </label>
                    <select
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 border-none rounded-xl font-bold text-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition-all appearance-none cursor-pointer"
                    >
                        {EMPLOYMENT_TYPES.map(type => (
                            <option key={type.value} value={type.value} className="bg-white">
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
                    className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50 shadow-xl"
                >
                    {loading ? t('dashboard.widgets.gli.calculating', undefined, 'Calculating...') : t('dashboard.widgets.gli.calculate', undefined, 'Calculate Quote')}
                </button>

                {/* Error */}
                {error && (
                    <div className="bg-zinc-900 text-white rounded-xl p-4 text-xs font-black uppercase tracking-widest text-center">
                        {error}
                    </div>
                )}

                {/* Quote result */}
                {quote && (
                    <div className={`rounded-2xl p-6 ${quote.eligible ? 'bg-zinc-900 text-white' : 'bg-white border-2 border-zinc-200'}`}>
                        {quote.eligible ? (
                            <>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                        <CheckCircle2 className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="font-black uppercase tracking-widest text-white">
                                        {t('dashboard.widgets.gli.eligible', undefined, 'Eligible for GLI')}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-white/10 rounded-2xl p-4 text-center border border-white/10">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">
                                            {t('dashboard.widgets.gli.premium_monthly', undefined, 'Monthly Premium')}
                                        </div>
                                        <div translate="no" className="notranslate text-2xl font-black text-white">
                                            {quote.monthly_premium?.toLocaleString('fr-FR')} €
                                        </div>
                                    </div>
                                    <div className="bg-white/10 rounded-2xl p-4 text-center border border-white/10">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">
                                            {t('dashboard.widgets.gli.premium_annual', undefined, 'Annual Premium')}
                                        </div>
                                        <div translate="no" className="notranslate text-2xl font-black text-white">
                                            {quote.annual_premium?.toLocaleString('fr-FR')} €
                                        </div>
                                    </div>
                                </div>

                                <div translate="no" className="notranslate text-xs font-bold text-white/50 space-y-2 mb-8">
                                    <div className="flex justify-between"><span>Rate:</span> <span className="text-white">{quote.premium_rate}%</span></div>
                                    <div className="flex justify-between"><span>Coverage:</span> <span className="text-white">{quote.coverage_amount?.toLocaleString('fr-FR')} €</span></div>
                                    <div className="flex justify-between"><span>Validity:</span> <span className="text-white">{quote.quote_valid_until}</span></div>
                                </div>

                                <button
                                    onClick={handleApply}
                                    disabled={loading}
                                    className="w-full py-4 bg-white text-zinc-900 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-zinc-100 active:scale-[0.98] transition-all"
                                >
                                    {t('dashboard.widgets.gli.subscribe', undefined, 'Subscribe Now')}
                                </button>
                            </>
                        ) : (
                            <div className="flex items-start gap-4 p-4 bg-zinc-50 rounded-xl">
                                <div className="text-2xl">⚠️</div>
                                <div>
                                    <div className="font-black uppercase tracking-widest text-zinc-900">{t('dashboard.widgets.gli.notEligible', undefined, 'Not Eligible')}</div>
                                    <p className="text-xs font-bold text-zinc-500 mt-2 leading-relaxed">{quote.eligibility_reason}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
