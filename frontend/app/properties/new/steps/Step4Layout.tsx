
import { PropertyFormData, TFn } from './types';

interface Props {
    formData: PropertyFormData;
    updateFormData: (u: Partial<PropertyFormData>) => void;
    t: TFn;
    roomAmenityInputs: Record<number, string>;
    setRoomAmenityInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}

export default function Step4Layout({ formData, updateFormData, t, roomAmenityInputs, setRoomAmenityInputs }: Props) {
    return (
        <div className="space-y-10">
            <div className="space-y-6">
                <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('property.create.layout.globalTitle', undefined, 'General Information')}
                </label>
                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                            {t('property.create.layout.capacity', undefined, 'Total Occupancy')}
                        </label>
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => updateFormData({ accommodation_capacity: Math.max(1, formData.accommodation_capacity - 1) })}
                                className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-black"
                                aria-label="Decrease capacity"
                            >
                                -
                            </button>
                            <span className="text-4xl font-black tracking-tighter">{formData.accommodation_capacity}</span>
                            <button
                                onClick={() => updateFormData({ accommodation_capacity: formData.accommodation_capacity + 1 })}
                                className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-black"
                                aria-label="Increase capacity"
                            >
                                +
                            </button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                            {t('property.create.layout.pieces', undefined, 'Total Rooms (Pièces)')}
                        </label>
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => updateFormData({ rooms_count: Math.max(1, formData.rooms_count - 1) })}
                                className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-black"
                                aria-label="Decrease rooms"
                            >
                                -
                            </button>
                            <span className="text-4xl font-black tracking-tighter">{formData.rooms_count}</span>
                            <button
                                onClick={() => updateFormData({ rooms_count: formData.rooms_count + 1 })}
                                className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-black"
                                aria-label="Increase rooms"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                        {t('property.create.layout.livingRoom', undefined, 'Living Room')}
                    </label>
                    <div className="flex gap-3">
                        {(['Private', 'Common', 'None'] as const).map((opt) => (
                            <button
                                key={opt}
                                onClick={() => updateFormData({ living_room_type: opt })}
                                className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                                    formData.living_room_type === opt
                                        ? 'bg-zinc-900 text-white shadow-lg'
                                        : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                                }`}
                                aria-label={`Living room: ${opt}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                        {t('property.create.layout.kitchen', undefined, 'Kitchen Type')}
                    </label>
                    <div className="flex gap-3">
                        {(['Private', 'Municipality', 'None'] as const).map((opt) => (
                            <button
                                key={opt}
                                onClick={() => updateFormData({ kitchen_type: opt })}
                                className={`flex-1 py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                                    formData.kitchen_type === opt
                                        ? 'bg-zinc-900 text-white shadow-lg'
                                        : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                                }`}
                                aria-label={`Kitchen type: ${opt}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {formData.room_details.length > 0 && (
                <div className="space-y-8">
                    {formData.room_details.map((room, idx) => (
                        <div key={idx} className="glass-card !p-8 rounded-[2rem] border-zinc-100 space-y-6">
                            <h4 className="text-sm font-black uppercase tracking-widest text-zinc-500">
                                {t('property.create.layout.bedroomTitle', { number: idx + 1 }, `Bedroom ${idx + 1}`)}
                            </h4>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                        {t('property.create.layout.surface', undefined, 'Surface (m²)')}
                                    </label>
                                    <input
                                        type="number"
                                        value={room.surface || room.surface_sqm || room.size_sqm || ''}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            const updated = [...formData.room_details];
                                            updated[idx] = { ...updated[idx], surface: val, surface_sqm: val, size_sqm: val };
                                            updateFormData({ room_details: updated });
                                        }}
                                        className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-lg"
                                        aria-label={`Bedroom ${idx + 1} surface`}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                        {t('property.create.layout.roomCapacity', undefined, 'Occupancy')}
                                    </label>
                                    <input
                                        type="number"
                                        value={room.capacity}
                                        onChange={(e) => {
                                            const updated = [...formData.room_details];
                                            updated[idx] = { ...updated[idx], capacity: parseInt(e.target.value) || 1 };
                                            updateFormData({ room_details: updated });
                                        }}
                                        className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-lg"
                                        min={1}
                                        aria-label={`Bedroom ${idx + 1} occupancy`}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                        {t('property.create.layout.bedding', undefined, 'Bed Type')}
                                    </label>
                                    <select
                                        value={room.bedding}
                                        onChange={(e) => {
                                            const updated = [...formData.room_details];
                                            updated[idx] = { ...updated[idx], bedding: e.target.value };
                                            updateFormData({ room_details: updated });
                                        }}
                                        className="w-full bg-zinc-50 p-4 rounded-xl border-none font-black text-sm"
                                        aria-label={`Bedroom ${idx + 1} bed type`}
                                    >
                                        <option value="Single">Single</option>
                                        <option value="Double">Double</option>
                                        <option value="Queen">Queen</option>
                                        <option value="King">King</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6 pt-2">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                        Occupancy Status
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updated = [...formData.room_details];
                                                updated[idx] = { ...updated[idx], status: 'available' };
                                                updateFormData({ room_details: updated });
                                            }}
                                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                                room.status !== 'occupied'
                                                    ? 'bg-emerald-800 text-white shadow'
                                                    : 'bg-zinc-100 text-zinc-400'
                                            }`}
                                        >
                                            Available
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updated = [...formData.room_details];
                                                updated[idx] = { ...updated[idx], status: 'occupied' };
                                                updateFormData({ room_details: updated });
                                            }}
                                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                                room.status === 'occupied'
                                                    ? 'bg-zinc-900 text-white shadow'
                                                    : 'bg-zinc-100 text-zinc-400'
                                            }`}
                                        >
                                            Occupied
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                        Available From
                                    </label>
                                    <input
                                        type="date"
                                        value={room.available_from || ''}
                                        disabled={room.status === 'occupied'}
                                        onChange={(e) => {
                                            const updated = [...formData.room_details];
                                            updated[idx] = { ...updated[idx], available_from: e.target.value };
                                            updateFormData({ room_details: updated });
                                        }}
                                        className="w-full bg-zinc-50 p-3 rounded-xl border-none font-black text-sm disabled:opacity-40"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                    {t('property.create.layout.roomDescLabel', undefined, 'Notes (Optional)')}
                                </label>
                                <input
                                    type="text"
                                    value={room.description}
                                    onChange={(e) => {
                                        const updated = [...formData.room_details];
                                        updated[idx] = { ...updated[idx], description: e.target.value };
                                        updateFormData({ room_details: updated });
                                    }}
                                    placeholder={t('property.create.layout.roomDescPlaceholder', undefined, 'ex: View on the garden, built-in closet...')}
                                    className="w-full bg-zinc-50 p-4 rounded-xl border-none font-medium text-sm text-zinc-500"
                                    aria-label={`Bedroom ${idx + 1} description`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {formData.size_sqm > 0 && formData.size_sqm < 9 * formData.accommodation_capacity ? (
                <p className="text-amber-500 text-xs font-bold mt-2" role="alert">
                    ⚠️ {t('properties.new.steps.pricing.decencyWarning')}
                </p>
            ) : (
                <p className="text-xs text-zinc-400 font-medium italic mt-2">
                    {t('property.create.layout.decencyNotice', undefined, 'Roomivo enforces French decency standards (min 9m² per occupant).')}
                </p>
            )}
        </div>
    );
}
