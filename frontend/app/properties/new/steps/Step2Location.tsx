
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { PropertyFormData, TFn } from './types';

interface Props {
    formData: PropertyFormData;
    updateFormData: (u: Partial<PropertyFormData>) => void;
    t: TFn;
    enriching: boolean;
    onEnrich: () => void;
    onAddressSelect: (result: { address: string; city: string; postal_code: string; lat?: number; lng?: number }) => void;
}

export default function Step2Location({ formData, updateFormData, t, enriching, onEnrich, onAddressSelect }: Props) {
    const hasEnrichment = formData.public_transport.length > 0 || formData.nearby_landmarks.length > 0;
    return (
        <div className="space-y-10">
            <div className="space-y-6">
                <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('properties.new.steps.geolocation.label')}
                </label>
                <div className="glass-card !p-8 rounded-[3rem] border-zinc-100">
                    <AddressAutocomplete
                        onSelectAction={(result) => onAddressSelect(result)}
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
                    : hasEnrichment
                        ? t('properties.new.steps.geolocation.enrichRetry', undefined, 'Refresh nearby transit & POIs')
                        : t('properties.new.steps.geolocation.enrichButton')}
            </button>

            {(formData.public_transport.length > 0 || formData.nearby_landmarks.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {formData.public_transport.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">
                                {t('property.transport', undefined, 'Public Transit')}
                            </h3>
                            <ul className="space-y-2">
                                {formData.public_transport.map((item: any, i: number) => (
                                    <li key={i} className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                                        {item.line || item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {formData.nearby_landmarks.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em]">
                                {t('property.landmarks', undefined, 'Points of Interest')}
                            </h3>
                            <ul className="space-y-2">
                                {formData.nearby_landmarks.map((item: any, i: number) => (
                                    <li key={i} className="text-xs font-black text-zinc-700 uppercase tracking-wider">
                                        {item.name || item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
