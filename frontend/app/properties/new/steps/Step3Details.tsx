
import { PropertyFormData, TFn } from './types';

interface Props {
    formData: PropertyFormData;
    updateFormData: (u: Partial<PropertyFormData>) => void;
    t: TFn;
}

export default function Step3Details({ formData, updateFormData, t }: Props) {
    return (
        <div className="space-y-12">
            <div className="grid grid-cols-2 gap-12">
                <div className="space-y-6">
                    <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                        {t('properties.new.steps.details.bedrooms')}
                    </label>
                    <div className="flex items-center gap-8">
                        <button
                            onClick={() => updateFormData({ bedrooms: Math.max(0, formData.bedrooms - 1) })}
                            className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black"
                            aria-label={t('property.create.details.bedrooms', undefined, 'Decrease bedrooms')}
                        >
                            -
                        </button>
                        <span className="text-4xl sm:text-6xl font-black tracking-tighter">{formData.bedrooms}</span>
                        <button
                            onClick={() => updateFormData({ bedrooms: formData.bedrooms + 1 })}
                            className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-black"
                            aria-label={t('property.create.details.bedrooms', undefined, 'Increase bedrooms')}
                        >
                            +
                        </button>
                    </div>
                </div>
                <div className="space-y-6">
                    <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                        {t('properties.new.steps.details.surface')}
                    </label>
                    <input
                        type="number"
                        value={isNaN(formData.size_sqm) ? '' : formData.size_sqm}
                        onChange={(e) =>
                            updateFormData({ size_sqm: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })
                        }
                        className="w-full bg-transparent text-4xl sm:text-6xl font-black tracking-tighter border-none focus:ring-0"
                        aria-label={t('property.create.details.size', undefined, 'Surface area in square meters')}
                    />
                    {formData.size_sqm > 0 && formData.size_sqm < 9 * formData.accommodation_capacity && (
                        <p className="text-amber-500 text-xs font-bold" role="alert">
                            ⚠️ {t('properties.new.steps.pricing.decencyWarning')}
                        </p>
                    )}
                </div>
            </div>

            {/* Furnished toggle */}
            <button
                onClick={() => updateFormData({ furnished: !formData.furnished })}
                aria-label={t('property.create.details.furnished', undefined, 'Furnished Property')}
                className={`w-full p-8 rounded-[3rem] border-2 text-left transition-all ${formData.furnished ? 'bg-zinc-900 border-zinc-900 text-white shadow-2xl' : 'border-zinc-100'}`}
            >
                <div className={`text-xs font-black uppercase tracking-[0.2em] mb-2 ${formData.furnished ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {t('property.create.details.furnished', undefined, 'Furnished')}
                </div>
                <div className="text-xl font-black">
                    {formData.furnished ? t('property.yes', undefined, 'Yes') : t('property.no', undefined, 'No')}
                </div>
            </button>

            <div className="space-y-10">
                <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('properties.new.steps.details.energyProtocol')}
                </label>
                <div className="flex flex-wrap gap-4">
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((r) => (
                        <button
                            key={r}
                            onClick={() => updateFormData({ dpe_rating: r })}
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl transition-all ${
                                formData.dpe_rating === r
                                    ? 'bg-zinc-900 text-white shadow-2xl scale-110'
                                    : r === 'G'
                                    ? 'bg-amber-50 text-amber-500'
                                    : 'bg-zinc-100 text-zinc-400'
                            }`}
                            aria-label={`DPE rating ${r}${r === 'G' ? ' (warning — requires acknowledgement)' : ''}`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
                
                <div className="grid grid-cols-2 gap-8 mt-6">
                    <div className="space-y-4">
                        <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                            {t('property.create.details.dpeValue', undefined, 'DPE Value (kWh/m²/year)')}
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="number"
                            value={formData.dpe_value === undefined ? '' : formData.dpe_value}
                            onChange={(e) => updateFormData({ dpe_value: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })}
                            placeholder="e.g. 150"
                            className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                        />
                    </div>
                    <div className="space-y-4">
                        <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                            {t('property.create.details.gesValue', undefined, 'GES Value (kg CO₂/m²/year)')}
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                            type="number"
                            value={formData.ges_value === undefined ? '' : formData.ges_value}
                            onChange={(e) => updateFormData({ ges_value: e.target.value === '' ? undefined : parseInt(e.target.value) || 0 })}
                            placeholder="e.g. 35"
                            className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-xl"
                        />
                    </div>
                </div>
                {formData.dpe_rating === 'G' && (
                    <p className="text-amber-600 text-xs font-bold" role="alert">
                        ⚠️ {t('property.create.dpe.decenceG', undefined, 'A class G dwelling cannot be leased as a primary residence (new or renewed lease) under the loi Climat. You may still publish this listing with its class shown.')}
                    </p>
                )}
            </div>
        </div>
    );
}
