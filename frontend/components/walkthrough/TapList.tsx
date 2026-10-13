'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { itemsFor, WALK_STATES, type SpaceAnswers, type WalkState } from '@/lib/walkthrough';

const STATE_FALLBACK: Record<WalkState, string> = {
    working: 'Works',
    not_working: 'Not working',
    absent: 'Not here',
    present: 'Here',
};

/**
 * One space's questions: a row per item, two or three large buttons. Tapping the
 * chosen answer again clears it; an unanswered item is simply not shown on the listing.
 */
export default function TapList({
    spaceKey,
    value,
    onChange,
}: {
    spaceKey: string;
    value: SpaceAnswers;
    onChange: (next: SpaceAnswers) => void;
}) {
    const { t } = useLanguage();

    const choose = (itemKey: string, state: WalkState) => {
        const next = { ...value };
        if (next[itemKey] === state) delete next[itemKey];
        else next[itemKey] = state;
        onChange(next);
    };

    return (
        <ul className="space-y-4" data-testid={`tap-list-${spaceKey}`}>
            {itemsFor(spaceKey).map((item) => {
                const label = t(`walkthrough.items.${item.key}`, undefined, item.key);
                return (
                    <li key={item.key} className="rounded-3xl border border-zinc-100 p-4">
                        <div className="mb-3 text-sm font-black text-zinc-900">{label}</div>
                        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
                            {WALK_STATES[item.kind].map((state) => {
                                const chosen = value[item.key] === state;
                                return (
                                    <button
                                        key={state}
                                        type="button"
                                        role="radio"
                                        aria-checked={chosen}
                                        onClick={() => choose(item.key, state)}
                                        className={`min-h-12 flex-1 rounded-2xl border-2 px-3 py-3 text-xs font-black uppercase tracking-wider transition-colors ${chosen ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900'}`}
                                    >
                                        {t(`walkthrough.states.${state}`, undefined, STATE_FALLBACK[state])}
                                    </button>
                                );
                            })}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
