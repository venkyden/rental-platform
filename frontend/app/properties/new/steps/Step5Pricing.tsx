
import { motion } from 'framer-motion';
import { PropertyFormData, TFn } from './types';

interface Props {
    formData: PropertyFormData;
    updateFormData: (u: Partial<PropertyFormData>) => void;
    t: TFn;
    showRentControl: boolean;
    setShowRentControl: (v: boolean) => void;
}

export default function Step5Pricing({ formData, updateFormData, t, showRentControl, setShowRentControl }: Props) {
    const baseRent = formData.monthly_rent || 0;
    const chargesAmount = formData.charges || 0;
    const totalRent = formData.charges_included ? baseRent : baseRent + chargesAmount;
    const maxDepositMonths = formData.furnished ? 2 : 1;
    const maxDeposit = Math.max(baseRent, totalRent) * maxDepositMonths;

    return (
        <div className="space-y-12">
            {/* Live Financial Breakdown Summary Card */}
            <div className="p-6 sm:p-8 rounded-[2.5rem] bg-zinc-900 text-white space-y-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">
                        {t('property.create.pricing.financialBreakdown', undefined, 'Financial Breakdown (Décompte Financier)')}
                    </span>
                    <span className="text-xs font-bold px-3 py-1 bg-zinc-800 rounded-full text-zinc-300">
                        {formData.charges_included ? 'Charges Comprises (CC)' : 'Hors Charges (HC)'}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            {t('property.create.pricing.baseRentHC', undefined, 'Loyer Hors Charges')}
                        </p>
                        <p className="text-3xl font-black tracking-tight text-white">€{baseRent}</p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            {t('property.create.pricing.monthlyCharges', undefined, 'Charges Mensuelles')}
                        </p>
                        <p className="text-3xl font-black tracking-tight text-zinc-300">
                            {formData.charges_included ? 'Incluses' : `+ €${chargesAmount}`}
                        </p>
                    </div>

                    <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-zinc-800 pt-4 sm:pt-0 sm:pl-6">
                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                            {t('property.create.pricing.totalMonthlyRent', undefined, 'Total Mensuel (CC)')}
                        </p>
                        <p className="text-3xl font-black tracking-tight text-emerald-400">€{totalRent} <span className="text-xs font-medium text-emerald-300">/ mois</span></p>
                    </div>
                </div>
            </div>

            {/* Monthly rent */}
            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                    <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                        {t('properties.new.steps.pricing.monthlyRent')} (HC)
                    </label>
                    <div className="flex items-baseline gap-4">
                        <span className="text-4xl font-black text-zinc-300">€</span>
                        <input
                            type="number"
                            value={isNaN(formData.monthly_rent) ? '' : formData.monthly_rent}
                            onChange={(e) =>
                                updateFormData({ monthly_rent: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })
                            }
                            className="bg-transparent text-5xl sm:text-8xl font-black tracking-tighter border-none focus:ring-0 w-full"
                            aria-label={t('property.create.pricing.monthlyRent', undefined, 'Monthly rent')}
                        />
                    </div>
                </div>
                <div className="space-y-6">
                    <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                        {t('properties.new.steps.pricing.leaseDuration', undefined, 'Lease Duration (Months)')}
                    </label>
                    <input
                        type="number"
                        value={formData.lease_duration_months === undefined ? '' : formData.lease_duration_months}
                        onChange={(e) =>
                            updateFormData({ lease_duration_months: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })
                        }
                        placeholder={t('property.create.pricing.flexibleDuration', undefined, 'Flexible / Open-ended')}
                        className="bg-transparent text-4xl sm:text-6xl font-black tracking-tighter border-none focus:ring-0 w-full"
                        aria-label={t('property.create.pricing.leaseDuration', undefined, 'Lease duration')}
                    />
                </div>
            </div>

            {/* Charges + deposit */}
            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                        {t('property.create.pricing.charges', undefined, 'Monthly Charges')}
                    </label>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-zinc-300">€</span>
                        <input
                            type="number"
                            value={formData.charges || ''}
                            onChange={(e) => updateFormData({ charges: parseInt(e.target.value) || 0 })}
                            placeholder={t('property.create.pricing.chargesPlaceholder', undefined, 'ex: 75')}
                            className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                            aria-label={t('property.create.pricing.charges', undefined, 'Charges')}
                        />
                    </div>
                </div>
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                        {t('property.create.pricing.deposit', undefined, 'Security Deposit (Caution)')}
                    </label>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-zinc-300">€</span>
                        <input
                            type="number"
                            value={formData.deposit || ''}
                            onChange={(e) => updateFormData({ deposit: parseInt(e.target.value) || 0 })}
                            className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                            aria-label={t('property.create.pricing.deposit', undefined, 'Security deposit')}
                        />
                    </div>

                    {/* Deposit Quick-Fill Presets */}
                    <div className="flex flex-wrap gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => updateFormData({ deposit: totalRent })}
                            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold rounded-lg transition-all"
                        >
                            {t('property.create.pricing.preset1mTotal', undefined, `1 mois CC (${totalRent}€)`)}
                        </button>
                        {baseRent !== totalRent && (
                            <button
                                type="button"
                                onClick={() => updateFormData({ deposit: baseRent })}
                                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold rounded-lg transition-all"
                            >
                                {t('property.create.pricing.preset1mBase', undefined, `1 mois HC (${baseRent}€)`)}
                            </button>
                        )}
                        {formData.furnished && (
                            <button
                                type="button"
                                onClick={() => updateFormData({ deposit: totalRent * 2 })}
                                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold rounded-lg transition-all"
                            >
                                {t('property.create.pricing.preset2mTotal', undefined, `2 mois CC (${totalRent * 2}€)`)}
                            </button>
                        )}
                    </div>

                    <p className="text-xs text-zinc-400 font-medium">
                        {t('property.create.pricing.depositLimit', undefined, 'Max 1 month rent (Unfurnished) or 2 months (Furnished)')}
                    </p>
                    {formData.deposit !== undefined &&
                        baseRent > 0 &&
                        formData.deposit > maxDeposit && (
                            <p className="text-amber-500 text-xs font-bold mt-1" role="alert">
                                ⚠️ {t(formData.furnished
                                    ? 'properties.new.steps.pricing.depositWarningFurnished'
                                    : 'properties.new.steps.pricing.depositWarningUnfurnished')}
                            </p>
                        )}
                </div>
            </div>

            {/* Charges-included / CAF */}
            <div className="grid grid-cols-2 gap-8">
                <button
                    type="button"
                    onClick={() => updateFormData({ charges_included: !formData.charges_included })}
                    className={`p-8 rounded-[3rem] border-2 text-left transition-all ${
                        formData.charges_included ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'
                    }`}
                    aria-pressed={formData.charges_included}
                >
                    <div className={`text-xs font-black uppercase tracking-[0.2em] mb-2 ${formData.charges_included ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {t('properties.new.steps.pricing.chargesLabel')}
                    </div>
                    <div className="text-xl font-black">{t('properties.new.steps.pricing.allInclusive')}</div>
                </button>
                <button
                    type="button"
                    onClick={() => updateFormData({ caf_eligible: !formData.caf_eligible })}
                    className={`p-8 rounded-[3rem] border-2 text-left transition-all ${
                        formData.caf_eligible ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'
                    }`}
                    aria-pressed={formData.caf_eligible}
                >
                    <div className={`text-xs font-black uppercase tracking-[0.2em] mb-2 ${formData.caf_eligible ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {t('properties.new.steps.pricing.complianceLabel')}
                    </div>
                    <div className="text-xl font-black">{t('properties.new.steps.pricing.cafEligible')}</div>
                </button>
            </div>

            {/* Guarantor */}
            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => updateFormData({ guarantor_required: !formData.guarantor_required })}
                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                        formData.guarantor_required ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100'
                    }`}
                    aria-pressed={formData.guarantor_required}
                >
                    <div className="text-xs font-black uppercase tracking-[0.2em] mb-1">
                        {t('property.create.pricing.guarantor.title', undefined, 'Guarantor Required')}
                    </div>
                    <div className="text-sm font-bold">
                        {t('property.create.pricing.guarantor.elanNotice', undefined, 'ELAN Law Compliant')}
                    </div>
                </button>
                {formData.guarantor_required && (
                    <div className="flex flex-wrap gap-3 pl-4">
                        {['physical', 'visale', 'garantme', 'organisation'].map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => {
                                    const types = formData.accepted_guarantor_types.includes(type)
                                        ? formData.accepted_guarantor_types.filter((t) => t !== type)
                                        : [...formData.accepted_guarantor_types, type];
                                    updateFormData({ accepted_guarantor_types: types });
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    formData.accepted_guarantor_types.includes(type) ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
                                }`}
                                aria-pressed={formData.accepted_guarantor_types.includes(type)}
                            >
                                {t(`property.guarantor.${type}`, undefined, type)}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Rent control (Loi ELAN) */}
            <div className="space-y-6">
                <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('properties.new.steps.pricing.rentControlTitle')}
                </label>
                <button
                    type="button"
                    onClick={() => {
                        const next = !showRentControl;
                        setShowRentControl(next);
                        if (!next) {
                            updateFormData({
                                loyer_reference: undefined,
                                loyer_reference_majore: undefined,
                                complement_de_loyer: undefined,
                                complement_de_loyer_justification: '',
                            });
                        }
                    }}
                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                        showRentControl ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100 hover:border-zinc-300'
                    }`}
                    aria-pressed={showRentControl}
                >
                    <div className="text-xs font-black uppercase tracking-[0.2em] mb-1">
                        {t('properties.new.steps.pricing.rentControlToggle')}
                    </div>
                    <div className={`text-xs ${showRentControl ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {t('properties.new.steps.pricing.rentControlToggleDesc')}
                    </div>
                </button>

                {showRentControl && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6 pl-4 border-l-2 border-zinc-200"
                    >
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                                    {t('properties.new.steps.pricing.loyerReferenceLabel')}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.loyer_reference ?? ''}
                                    onChange={(e) =>
                                        updateFormData({ loyer_reference: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })
                                    }
                                    placeholder="e.g. 25.50"
                                    className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                    aria-label={t('properties.new.steps.pricing.loyerReferenceLabel')}
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                                    {t('properties.new.steps.pricing.loyerReferenceMajoreLabel')}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.loyer_reference_majore ?? ''}
                                    onChange={(e) =>
                                        updateFormData({ loyer_reference_majore: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })
                                    }
                                    placeholder="e.g. 30.60"
                                    className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                    aria-label={t('properties.new.steps.pricing.loyerReferenceMajoreLabel')}
                                />
                            </div>
                        </div>

                        {formData.monthly_rent > 0 &&
                            formData.size_sqm > 0 &&
                            formData.loyer_reference_majore !== undefined &&
                            formData.monthly_rent / formData.size_sqm > formData.loyer_reference_majore && (
                                <div className="space-y-6">
                                    <div className="p-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-bold space-y-2" role="alert">
                                        <p>
                                            ⚠️{' '}
                                            {t('properties.new.steps.pricing.rentControlWarning', {
                                                rentPerSqm: (formData.monthly_rent / formData.size_sqm).toFixed(2),
                                                maxRentPerSqm: formData.loyer_reference_majore.toFixed(2),
                                            })}
                                        </p>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                                            {t('properties.new.steps.pricing.complementLoyerLabel')}
                                        </label>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-black text-zinc-300">€</span>
                                            <input
                                                type="number"
                                                value={formData.complement_de_loyer ?? ''}
                                                onChange={(e) =>
                                                    updateFormData({ complement_de_loyer: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })
                                                }
                                                placeholder="e.g. 150"
                                                className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                                                aria-label={t('properties.new.steps.pricing.complementLoyerLabel')}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                                            {t('properties.new.steps.pricing.complementLoyerJustificationLabel')}
                                            {formData.complement_de_loyer && formData.complement_de_loyer > 0 ? (
                                                <span className="text-red-500 ml-1">*</span>
                                            ) : null}
                                        </label>
                                        <textarea
                                            value={formData.complement_de_loyer_justification ?? ''}
                                            onChange={(e) => updateFormData({ complement_de_loyer_justification: e.target.value })}
                                            placeholder={t('properties.new.steps.pricing.complementLoyerJustificationPlaceholder')}
                                            className="w-full h-32 bg-zinc-50 p-4 rounded-xl border-none font-medium text-sm text-zinc-600 resize-none"
                                            aria-label={t('properties.new.steps.pricing.complementLoyerJustificationLabel')}
                                        />
                                    </div>
                                </div>
                            )}
                    </motion.div>
                )}
            </div>

            {/* Natural risks (ERP / Loi ALUR) */}
            <div className="space-y-6">
                <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('properties.new.steps.pricing.naturalRisksTitle')}
                </label>
                <button
                    type="button"
                    onClick={() => updateFormData({ natural_risks_compliant: !formData.natural_risks_compliant })}
                    className={`w-full p-6 rounded-2xl border-2 text-left transition-all ${
                        formData.natural_risks_compliant ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' : 'border-zinc-100 hover:border-zinc-300'
                    }`}
                    aria-pressed={formData.natural_risks_compliant}
                >
                    <div className="text-xs font-black uppercase tracking-[0.2em] mb-1">
                        {t('properties.new.steps.pricing.naturalRisksLabel')}
                    </div>
                    <div className={`text-xs ${formData.natural_risks_compliant ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {t('properties.new.steps.pricing.naturalRisksDesc')}
                    </div>
                </button>
            </div>
        </div>
    );
}
