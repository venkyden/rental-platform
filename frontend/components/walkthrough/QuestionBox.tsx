'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useLanguage } from '@/lib/LanguageContext';
import { householdLine, latestAnswerDate, formatAnswerDate, spaceLabel, type Flatmates } from '@/lib/walkthrough';
import { matchQuestion } from '@/lib/questionMatch';

/**
 * The question box, step 1. As the student types, the owner's walk-through
 * answers that match are shown; a question they do not cover goes to the owner
 * privately and the reply arrives in the inbox. Nothing is published.
 */

const STATE_FALLBACK: Record<string, string> = {
    working: 'Working', not_working: 'Not working', absent: 'Not here', present: 'Here',
};

type Outcome =
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'sent'; conversationId: string }
    | { kind: 'whoMayRent' }
    | { kind: 'error'; key: 'tooMany' | 'failed' };

export default function QuestionBox({
    propertyId, answers, flatmates, isColocation, bedrooms, withAuth,
}: {
    propertyId: string;
    answers: unknown;
    flatmates?: Flatmates | null;
    isColocation?: boolean;
    bedrooms: number;
    withAuth: (action: () => void) => void;
}) {
    const { t, language } = useLanguage();
    const [question, setQuestion] = useState('');
    const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

    const household = isColocation ? flatmates : null;
    const matches = useMemo(
        () => matchQuestion(question, answers, bedrooms, household),
        [question, answers, bedrooms, household],
    );
    const answered = latestAnswerDate(answers, bedrooms, household);
    const hasMatches = matches.items.length > 0 || matches.household.length > 0;
    const canSend = question.trim().length >= 5 && outcome.kind !== 'sending';

    const send = () => withAuth(async () => {
        setOutcome({ kind: 'sending' });
        try {
            const r = await apiClient.client.post(`/properties/${propertyId}/questions`, { question: question.trim() });
            setOutcome({ kind: 'sent', conversationId: r.data.conversation_id });
            setQuestion('');
        } catch (e: any) {
            const detail = e?.response?.data?.detail;
            if (detail === 'who_may_rent') setOutcome({ kind: 'whoMayRent' });
            else setOutcome({ kind: 'error', key: e?.response?.status === 429 ? 'tooMany' : 'failed' });
        }
    });

    return (
        <section data-testid="question-box" aria-labelledby="question-box-title" className="glass-card !p-8 sm:!p-12 rounded-[3rem] border-zinc-100 space-y-6">
            <h2 id="question-box-title" className="text-2xl font-black tracking-tight text-zinc-900">
                {t('questionBox.title')}
            </h2>
            <label htmlFor="question-box-input" className="sr-only">{t('questionBox.title')}</label>
            <textarea
                id="question-box-input"
                rows={2}
                maxLength={500}
                value={question}
                placeholder={t('questionBox.placeholder')}
                onChange={(e) => {
                    setQuestion(e.target.value);
                    if (outcome.kind !== 'sending') setOutcome({ kind: 'idle' });
                }}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none"
            />

            {hasMatches && (
                <div data-testid="question-box-matches" className="space-y-2">
                    <p className="text-sm font-bold text-zinc-900">{t('questionBox.matchedTitle')}</p>
                    <ul className="space-y-1 text-sm text-zinc-700">
                        {matches.items.map((m) => (
                            <li key={`${m.spaceKey}-${m.key}`}>
                                {spaceLabel(t, m.spaceKey, bedrooms)} ·{' '}
                                {t('walkthrough.panel.line', {
                                    item: t(`walkthrough.items.${m.key}`, undefined, m.key),
                                    state: t(`walkthrough.states.${m.state}`, undefined, STATE_FALLBACK[m.state]).toLocaleLowerCase(language),
                                })}
                            </li>
                        ))}
                        {matches.household.map((topic) => (
                            <li key={topic}>{householdLine(t, household, topic)}</li>
                        ))}
                    </ul>
                    {answered && (
                        <p className="text-xs text-zinc-500">
                            {t('walkthrough.panel.source', { date: formatAnswerDate(answered, language) })}
                        </p>
                    )}
                    <p className="text-sm text-zinc-600">{t('questionBox.notCovered')}</p>
                </div>
            )}

            {outcome.kind === 'whoMayRent' && (
                <div role="alert" data-testid="question-box-who-may-rent" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
                    <p>{t('questionBox.whoMayRent')}</p>
                    <Link href={`/report?listing=${propertyId}`} className="font-bold underline">{t('report.link')}</Link>
                </div>
            )}
            {outcome.kind === 'error' && (
                <p role="alert" className="text-sm font-bold text-red-700">{t(`questionBox.errors.${outcome.key}`)}</p>
            )}
            {outcome.kind === 'sent' ? (
                <p role="status" className="text-sm text-zinc-700">
                    {t('questionBox.sent')}{' '}
                    <Link href={`/inbox?conversation=${outcome.conversationId}`} className="font-bold underline">
                        {t('questionBox.openConversation')}
                    </Link>
                </p>
            ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <button
                        type="button"
                        onClick={send}
                        disabled={!canSend}
                        className="px-6 py-3 bg-zinc-900 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl disabled:opacity-40"
                    >
                        {outcome.kind === 'sending' ? t('questionBox.sending') : t('questionBox.ask')}
                    </button>
                    <p className="text-xs text-zinc-500">{t('questionBox.privacy')}</p>
                </div>
            )}
        </section>
    );
}
