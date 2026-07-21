
import { Info, MapPin, Plus } from 'lucide-react';
import { PropertyFormData, STANDARD_AMENITIES, TFn } from './types';

interface Props {
    formData: PropertyFormData;
    updateFormData: (u: Partial<PropertyFormData>) => void;
    t: TFn;
    roomAmenityInputs: Record<number, string>;
    setRoomAmenityInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}

export default function Step6Amenities({ formData, updateFormData, t, roomAmenityInputs, setRoomAmenityInputs }: Props) {
    const CUSTOM_KEY = -1;

    return (
        <div className="space-y-10">
            {/* Standard amenities */}
            <div className="space-y-6">
                <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('property.create.features.amenities', undefined, 'General Amenities')}
                </label>
                <div className="flex flex-wrap gap-3">
                    {STANDARD_AMENITIES.map((amenity) => (
                        <button
                            key={amenity}
                            onClick={() => {
                                const next = formData.amenities.includes(amenity)
                                    ? formData.amenities.filter((a) => a !== amenity)
                                    : [...formData.amenities, amenity];
                                updateFormData({ amenities: next });
                            }}
                            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                                formData.amenities.includes(amenity)
                                    ? 'bg-zinc-900 text-white shadow-lg scale-105'
                                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                            }`}
                            aria-pressed={formData.amenities.includes(amenity)}
                        >
                            {t(`property.amenity_labels.${amenity}`, undefined, amenity)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom amenities */}
            <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('property.create.features.customAmenities', undefined, 'Custom Amenities')}
                </label>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={roomAmenityInputs[CUSTOM_KEY] || ''}
                        onChange={(e) => setRoomAmenityInputs((prev) => ({ ...prev, [CUSTOM_KEY]: e.target.value }))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && roomAmenityInputs[CUSTOM_KEY]?.trim()) {
                                updateFormData({ custom_amenities: [...formData.custom_amenities, roomAmenityInputs[CUSTOM_KEY].trim()] });
                                setRoomAmenityInputs((prev) => ({ ...prev, [CUSTOM_KEY]: '' }));
                            }
                        }}
                        placeholder={t('property.create.features.addAmenity', undefined, 'Add Amenity')}
                        className="flex-1 bg-zinc-50 p-4 rounded-xl border-none font-medium text-sm"
                        aria-label={t('property.create.features.addAmenity', undefined, 'Add custom amenity')}
                    />
                    <button
                        onClick={() => {
                            if (roomAmenityInputs[CUSTOM_KEY]?.trim()) {
                                updateFormData({ custom_amenities: [...formData.custom_amenities, roomAmenityInputs[CUSTOM_KEY].trim()] });
                                setRoomAmenityInputs((prev) => ({ ...prev, [CUSTOM_KEY]: '' }));
                            }
                        }}
                        className="px-6 py-3 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase"
                        aria-label="Add amenity"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                {formData.custom_amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {formData.custom_amenities.map((amenity, idx) => (
                            <span key={idx} className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/5 rounded-xl text-xs font-bold">
                                {amenity}
                                <button
                                    onClick={() => updateFormData({ custom_amenities: formData.custom_amenities.filter((_, i) => i !== idx) })}
                                    className="text-zinc-400 hover:text-red-500 transition-colors"
                                    aria-label={`Remove ${amenity}`}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Transport & landmarks enriched from step 2 */}
            {(formData.public_transport.length > 0 || formData.nearby_landmarks.length > 0) && (
                <div className="grid grid-cols-2 gap-8">
                    {formData.public_transport.length > 0 && (
                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                                {t('property.create.features.transport', undefined, 'Nearby Transport')}
                            </label>
                            <div className="space-y-2">
                                {formData.public_transport.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-zinc-600">
                                        <MapPin className="w-3 h-3 text-zinc-400" />
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {formData.nearby_landmarks.length > 0 && (
                        <div className="space-y-3">
                            <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                                {t('property.create.features.landmarks', undefined, 'Surroundings & Landmarks')}
                            </label>
                            <div className="space-y-2">
                                {formData.nearby_landmarks.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-zinc-600">
                                        <Info className="w-3 h-3 text-zinc-400" />
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
