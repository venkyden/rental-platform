'use client';

import { PROPERTY_TYPES, PropertyFormData, TFn } from './types';

interface Props {
    formData: PropertyFormData;
    updateFormData: (u: Partial<PropertyFormData>) => void;
    t: TFn;
}

export default function Step1Identity({ formData, updateFormData, t }: Props) {
    return (
        <div className="space-y-10">
            <div className="space-y-6">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('properties.new.steps.identity.label')}
                </label>
                <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateFormData({ title: e.target.value })}
                    placeholder={t('properties.new.steps.identity.titlePlaceholder')}
                    className="w-full bg-transparent text-3xl sm:text-6xl font-black tracking-tighter text-zinc-900 placeholder:text-zinc-200 border-none focus:ring-0"
                />
            </div>
            <div className="grid grid-cols-2 gap-8">
                {PROPERTY_TYPES.map((type) => (
                    <button
                        key={type}
                        onClick={() => updateFormData({ property_type: type })}
                        className={`p-8 rounded-[2.5rem] border-2 transition-all text-left group ${
                            formData.property_type === type
                                ? 'bg-zinc-900 border-zinc-900 shadow-2xl'
                                : 'border-zinc-100 hover:border-zinc-300'
                        }`}
                    >
                        <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${
                            formData.property_type === type ? 'text-zinc-400' : 'text-zinc-500'
                        }`}>
                            {type}
                        </div>
                        <div className={`text-xl font-black ${
                            formData.property_type === type ? 'text-white' : 'text-zinc-900'
                        }`}>
                            {t(`properties.new.types.${type}`)}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
