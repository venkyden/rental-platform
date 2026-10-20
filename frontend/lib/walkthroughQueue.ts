/**
 * Answers saved on the phone while they could not be sent. One entry per space (or for
 * the household card): saving a space again replaces its waiting entry, so an older
 * answer can never be sent after a newer one.
 */

import type { Flatmates, SpaceAnswers } from './walkthrough';

export type AnswersBody = { space?: string; answers?: SpaceAnswers; flatmates?: Flatmates };

/** What a waiting entry is for: a space key, or 'flatmates' for the household card. */
export const targetOf = (body: AnswersBody): string => body.space ?? 'flatmates';

const isEntry = (value: unknown): value is AnswersBody => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const body = value as AnswersBody;
    const space = typeof body.space === 'string' && !!body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers);
    const card = !!body.flatmates && typeof body.flatmates === 'object' && !Array.isArray(body.flatmates);
    return space || card;
};

/** The stored queue, keeping only well-formed entries. Never throws. */
export function parseQueue(raw: string | null): AnswersBody[] {
    try {
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
    } catch {
        return [];
    }
}

/** The queue with this body added, replacing any earlier entry for the same space. */
export const enqueue = (queue: AnswersBody[], body: AnswersBody): AnswersBody[] =>
    [...queue.filter((entry) => targetOf(entry) !== targetOf(body)), body];

/** The queue without anything waiting for this space. */
export const withoutTarget = (queue: AnswersBody[], target: string): AnswersBody[] =>
    queue.filter((entry) => targetOf(entry) !== target);

/** The queue without the entry just sent. A newer entry for the same space, queued while
 *  it was being sent, is kept. */
export const withoutSent = (queue: AnswersBody[], sent: AnswersBody): AnswersBody[] =>
    queue.filter((entry) => targetOf(entry) !== targetOf(sent) || JSON.stringify(entry) !== JSON.stringify(sent));

/**
 * What to do with an entry whose sending failed:
 * - 'retry-later': no answer, a timeout, the rate limit, or a server error. Keep it.
 * - 'link-expired': the capture link no longer works (400/404). Keep it and say so.
 * - 'refused': the server checked it and refused it (422 and other 4xx). Drop it and say so.
 */
export function failureOf(status: number | undefined): 'retry-later' | 'link-expired' | 'refused' {
    if (!status || status === 408 || status === 429 || status >= 500) return 'retry-later';
    if (status === 400 || status === 404 || status === 410) return 'link-expired';
    return 'refused';
}
