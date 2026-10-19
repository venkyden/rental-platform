'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { FLATMATE_OCCUPATIONS, type Flatmates } from '@/lib/walkthrough';

const OCCUPATION_FALLBACK = { students: 'Students', working: 'Working', both: 'Students and working people' } as const;

/**
 * The household card for a shared home. It describes the household, never a person:
 * there is deliberately no field for a name, an age, a gender or a nationality.
 */
export default function FlatmatesFields({ value, onChange }: { value: Flatmates; onChange: (next: Flatmates) => void }) {
    const { t } = useLanguage();
    const pill = (chosen: boolean) =>
        `min-h-12 flex-1 rounded-2xl border-2 px-3 py-3 text-xs font-black uppercase tracking-wider transition-colors ${chosen ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900'}`;

    const toggle = <K extends 'occupation' | 'smoking' | 'pets'>(field: K, option: Flatmates[K]) => {
        const next = { ...value };
        if (next[field] === option) delete next[field];
        else next[field] = option;
        onChange(next);
    };

    const yesNo = (field: 'smoking' | 'pets', label: string) => (
        <div className="rounded-3xl border border-zinc-100 p-4">
            <div className="mb-3 text-sm font-black text-zinc-900">{label}</div>
            <div role="group" aria-label={label} className="flex gap-2">
                {[true, false].map((option) => (
                    <button
                        key={String(option)}
                        type="button"
                        aria-pressed={value[field] === option}
                        onClick={() => toggle(field, option)}
                        className={pill(value[field] === option)}
                    >
                        {option ? t('walkthrough.yes', undefined, 'Yes') : t('walkthrough.no', undefined, 'No')}
                    </button>
                ))}
            </div>
        </div>
    );

    const countLabel = t('walkthrough.flatmates.countQuestion', undefined, 'How many flatmates live here?');
    const occupationLabel = t('walkthrough.flatmates.occupationQuestion', undefined, 'They are');

    return (
        <div className="space-y-4" data-testid="flatmates-fields">
            <div className="rounded-3xl border border-zinc-100 p-4">
                <label htmlFor="flatmates-count" className="mb-3 block text-sm font-black text-zinc-900">{countLabel}</label>
                <input
                    id="flatmates-count"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={20}
                    value={value.count ?? ''}
                    onChange={(e) => {
                        const next = { ...value };
                        const n = Number(e.target.value);
                        if (e.target.value === '' || !Number.isInteger(n) || n < 0 || n > 20) delete next.count;
                        else next.count = n;
                        onChange(next);
                    }}
                    className="w-28 rounded-2xl border-2 border-zinc-200 px-4 py-3 text-base font-black text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-0"
                />
            </div>
            <div className="rounded-3xl border border-zinc-100 p-4">
                <div className="mb-3 text-sm font-black text-zinc-900">{occupationLabel}</div>
                <div role="group" aria-label={occupationLabel} className="flex flex-wrap gap-2">
                    {FLATMATE_OCCUPATIONS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={value.occupation === option}
                            onClick={() => toggle('occupation', option)}
                            className={pill(value.occupation === option)}
                        >
                            {t(`walkthrough.flatmates.occupation.${option}`, undefined, OCCUPATION_FALLBACK[option])}
                        </button>
                    ))}
                </div>
            </div>
            {yesNo('smoking', t('walkthrough.flatmates.smokingQuestion', undefined, 'Smoking in the home?'))}
            {yesNo('pets', t('walkthrough.flatmates.petsQuestion', undefined, 'Pets in the home?'))}
        </div>
    );
}
