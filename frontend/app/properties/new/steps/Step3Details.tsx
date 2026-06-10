
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
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
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
                        <span className="text-6xl font-black tracking-tighter">{formData.bedrooms}</span>
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
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                        {t('properties.new.steps.details.surface')}
                    </label>
                    <input
                        type="number"
                        value={isNaN(formData.size_sqm) ? '' : formData.size_sqm}
                        onChange={(e) =>
                            updateFormData({ size_sqm: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })
                        }
                        className="w-full bg-transparent text-6xl font-black tracking-tighter border-none focus:ring-0"
                        aria-label={t('property.create.details.size', undefined, 'Surface area in square meters')}
                    />
                    {formData.size_sqm > 0 && formData.size_sqm < 9 * formData.accommodation_capacity && (
                        <p className="text-amber-500 text-xs font-bold" role="alert">
                            ⚠️ {t('properties.new.steps.pricing.decencyWarning')}
                        </p>
                    )}
                </div>
            </div>
            <div className="space-y-10">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
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
                                    ? 'bg-red-50 text-red-300 line-through'
                                    : 'bg-zinc-100 text-zinc-400'
                            }`}
                            aria-label={`DPE rating ${r}${r === 'G' ? ' (banned)' : ''}`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
                {formData.dpe_rating === 'G' && (
                    <p className="text-red-500 text-xs font-bold" role="alert">
                        ⚠️ {t('property.create.errors.dpeGBan', undefined, 'Properties with DPE G rating are banned from rental since January 2023.')}
                    </p>
                )}
            </div>
        </div>
    );
}
