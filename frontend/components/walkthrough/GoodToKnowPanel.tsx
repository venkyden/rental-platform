'use client';

import { Check, Minus, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import {
    flattenAnswers, formatAnswerDate, hasFlatmates, householdLines, itemsFor, latestAnswerDate, spaceKeys, spaceLabel,
    type Flatmates, type WalkState,
} from '@/lib/walkthrough';

const STATE_FALLBACK: Record<WalkState, string> = {
    working: 'Works',
    not_working: 'Not working',
    absent: 'Not here',
    present: 'Here',
};

/**
 * What the owner answered during the walk-through, grouped by space. A "not working"
 * or "not here" answer is shown as plainly as a good one. Renders nothing when there
 * is nothing to show. These are the owner's statements, so the panel says who answered
 * and when, and never calls anything verified.
 */
export default function GoodToKnowPanel({
    answers,
    flatmates,
    isColocation,
    bedrooms,
}: {
    answers: unknown;
    flatmates?: Flatmates | null;
    isColocation?: boolean;
    bedrooms: number;
}) {
    const { t, language } = useLanguage();
    const bySpace = flattenAnswers(answers);
    const spaces = spaceKeys(bedrooms).filter((key) => bySpace[key]);
    const household = isColocation && hasFlatmates(flatmates) ? flatmates! : null;
    if (spaces.length === 0 && !household) return null;

    const answered = latestAnswerDate(answers, bedrooms, household);
    const lines = household ? householdLines(t, household) : [];

    return (
        <section data-testid="good-to-know" aria-labelledby="good-to-know-title" className="glass-card !p-8 sm:!p-12 rounded-[3rem] border-zinc-100">
            <h2 id="good-to-know-title" className="text-2xl font-black uppercase tracking-tighter mb-2">
                {t('walkthrough.panel.title', undefined, 'Good to know')}
            </h2>
            {answered && (
                <p className="mb-8 text-sm font-medium text-zinc-500" data-testid="good-to-know-source">
                    {t('walkthrough.panel.source', { date: formatAnswerDate(answered, language) }, `Last updated by the owner on ${formatAnswerDate(answered, language)}`)}
                </p>
            )}

            <div className="grid gap-8 sm:grid-cols-2">
                {spaces.map((spaceKey) => (
                    <div key={spaceKey}>
                        <h3 className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-zinc-500">{spaceLabel(t, spaceKey, bedrooms)}</h3>
                        <ul className="space-y-2">
                            {itemsFor(spaceKey).filter((item) => bySpace[spaceKey][item.key]).map((item) => {
                                const state = bySpace[spaceKey][item.key];
                                const good = state === 'working' || state === 'present';
                                const Icon = good ? Check : state === 'absent' ? Minus : X;
                                return (
                                    <li key={item.key} className="flex items-start gap-3 text-sm">
                                        <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md ${good ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                        </span>
                                        <span className={good ? 'font-bold text-zinc-900' : 'font-medium text-zinc-600'}>
                                            {t('walkthrough.panel.line', {
                                                item: t(`walkthrough.items.${item.key}`, undefined, item.key),
                                                state: t(`walkthrough.states.${state}`, undefined, STATE_FALLBACK[state]).toLocaleLowerCase(language),
                                            }, `${item.key}: ${STATE_FALLBACK[state].toLowerCase()}`)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}

                {lines.length > 0 && (
                    <div data-testid="good-to-know-flatmates">
                        <h3 className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-zinc-500">
                            {t('walkthrough.flatmates.title', undefined, 'Who lives here')}
                        </h3>
                        <ul className="space-y-2">
                            {lines.map((line) => (
                                <li key={line} className="text-sm font-medium text-zinc-700">{line}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
}
