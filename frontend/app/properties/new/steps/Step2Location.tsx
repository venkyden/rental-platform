
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { PropertyFormData, TFn } from './types';

interface Props {
    formData: PropertyFormData;
    updateFormData: (u: Partial<PropertyFormData>) => void;
    t: TFn;
    enriching: boolean;
    onEnrich: () => void;
}

export default function Step2Location({ formData, updateFormData, t, enriching, onEnrich }: Props) {
    return (
        <div className="space-y-10">
            <div className="space-y-6">
                <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('properties.new.steps.geolocation.label')}
                </label>
                <div className="glass-card !p-8 rounded-[3rem] border-zinc-100">
                    <AddressAutocomplete
                        onSelectAction={(result) => {
                            updateFormData({
                                address_line1: result.address,
                                city: result.city,
                                postal_code: result.postal_code,
                                latitude: result.lat,
                                longitude: result.lng,
                            });
                        }}
                        countryCode="fr"
                        initialValue={formData.address_line1}
                        variant="form"
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                        {t('properties.new.steps.geolocation.city')}
                    </label>
                    <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => updateFormData({ city: e.target.value })}
                        className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-xl"
                    />
                </div>
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                        {t('properties.new.steps.geolocation.zip')}
                    </label>
                    <input
                        type="text"
                        value={formData.postal_code}
                        onChange={(e) => updateFormData({ postal_code: e.target.value })}
                        className="w-full bg-zinc-50 p-6 rounded-2xl border-none font-black text-xl"
                    />
                </div>
            </div>
            <button
                onClick={onEnrich}
                disabled={enriching}
                className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
            >
                {enriching
                    ? t('properties.new.steps.geolocation.enriching')
                    : t('properties.new.steps.geolocation.enrichButton')}
            </button>
        </div>
    );
}
