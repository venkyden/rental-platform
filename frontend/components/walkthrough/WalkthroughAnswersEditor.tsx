'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { itemsFor, spaceKeys, spaceLabel, type Flatmates, type SpaceAnswers } from '@/lib/walkthrough';
import TapList from './TapList';
import FlatmatesFields from './FlatmatesFields';

/**
 * The walk-through tap lists on a computer, for a landlord correcting an answer
 * without going back to the home. One collapsible block per space. The parent
 * keeps the values and saves them with the rest of the listing.
 */
export default function WalkthroughAnswersEditor({
    bedrooms,
    isColocation,
    answers,
    flatmates,
    onAnswers,
    onFlatmates,
}: {
    bedrooms: number;
    isColocation: boolean;
    answers: Record<string, SpaceAnswers>;
    flatmates: Flatmates;
    onAnswers: (next: Record<string, SpaceAnswers>) => void;
    onFlatmates: (next: Flatmates) => void;
}) {
    const { t } = useLanguage();
    const [open, setOpen] = useState<string | null>(null);
    const blocks = [...spaceKeys(bedrooms), ...(isColocation ? ['flatmates'] : [])];

    return (
        <div className="space-y-4" data-testid="walkthrough-editor">
            <div>
                <label className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400">
                    {t('walkthrough.editor.title', undefined, 'Quick answers for students')}
                </label>
                <p className="mt-2 text-sm font-medium text-zinc-500">
                    {t('walkthrough.editor.hint', undefined, 'Students ask the same things about every home. Answer once and the listing shows it. Leave a line empty if it does not apply.')}
                </p>
            </div>
            {blocks.map((key) => {
                const isOpen = open === key;
                const title = key === 'flatmates'
                    ? t('walkthrough.flatmates.title', undefined, 'Who lives here')
                    : spaceLabel(t, key, bedrooms);
                const done = key === 'flatmates' ? null : Object.keys(answers[key] ?? {}).length;
                return (
                    <div key={key} className="rounded-3xl border-2 border-zinc-100">
                        <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => setOpen(isOpen ? null : key)}
                            className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                        >
                            <span className="text-sm font-black uppercase tracking-wider text-zinc-900">{title}</span>
                            <span className="flex items-center gap-3 text-xs font-bold text-zinc-500">
                                {done !== null && t('walkthrough.progress', { done, total: itemsFor(key).length }, `${done} of ${itemsFor(key).length} answered`)}
                                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </span>
                        </button>
                        {isOpen && (
                            <div className="px-4 pb-4">
                                {key === 'flatmates'
                                    ? <FlatmatesFields value={flatmates} onChange={onFlatmates} />
                                    : <TapList spaceKey={key} value={answers[key] ?? {}} onChange={(next) => onAnswers({ ...answers, [key]: next })} />}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
