'use client';

import { PropertyFormData, TFn } from './types';

interface Props {
    formData: PropertyFormData;
    t: TFn;
    declared: boolean;
    setDeclared: (v: boolean) => void;
    loading: boolean;
    onSubmit: () => void;
}

export default function Step8Review({ formData, t, declared, setDeclared, loading, onSubmit }: Props) {
    return (
        <div className="space-y-10">
            <div className="glass-card !p-12 rounded-[4rem] border-zinc-100 space-y-8">
                <h3 className="text-3xl font-black uppercase tracking-tighter italic">
                    {t('properties.new.steps.review.title')}
                </h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                            {t('properties.new.steps.review.asset')}
                        </span>
                        <span className="text-sm font-black uppercase">{formData.title}</span>
                    </div>
                    <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                            {t('properties.new.steps.review.location')}
                        </span>
                        <span className="text-sm font-black uppercase">{formData.city}</span>
                    </div>
                    <div className="flex justify-between items-center py-4">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                            {t('properties.new.steps.review.pricing')}
                        </span>
                        <span className="text-sm font-black uppercase">
                            €{formData.monthly_rent}/{t('properties.new.steps.review.perMonth')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Legal declaration */}
            <label
                htmlFor="declaration-checkbox"
                className={`flex items-start gap-4 p-6 rounded-3xl border-2 cursor-pointer transition-all ${
                    declared ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white hover:border-zinc-400'
                }`}
            >
                <div className="relative mt-0.5 flex-shrink-0">
                    <input
                        id="declaration-checkbox"
                        type="checkbox"
                        checked={declared}
                        onChange={(e) => setDeclared(e.target.checked)}
                        className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        declared ? 'bg-zinc-900 border-zinc-900' : 'border-zinc-300 bg-white'
                    }`}>
                        {declared && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                </div>
                <span className="text-xs font-semibold text-zinc-600 leading-relaxed">
                    {t('properties.new.steps.review.declaration')}
                </span>
            </label>

            <button
                onClick={onSubmit}
                disabled={loading || !declared}
                className="w-full py-8 bg-zinc-900 text-white text-sm font-black uppercase tracking-[0.5em] rounded-[2.5rem] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
                {loading
                    ? t('properties.new.steps.review.initializing')
                    : t('properties.new.steps.review.commitButton')}
            </button>
        </div>
    );
}
