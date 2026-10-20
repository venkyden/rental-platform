'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * What the furnished-housing decree asks for, read from the owner's own answers.
 * A student sees a note only when the owner marked a required item missing or broken
 * (the listing is then not listed as furnished). The owner also sees what is still
 * unanswered. Nothing here is checked by Roomivo, and nothing says "verified".
 */
export default function FurnishedNotice({
    propertyId,
    furnished,
    missing,
    unanswered,
    isOwner,
}: {
    propertyId: string;
    furnished: boolean;
    missing?: string[];
    unanswered?: string[];
    isOwner: boolean;
}) {
    const { t } = useLanguage();
    if (!furnished) return null;
    const names = (keys: string[]) => keys.map((key) => t(`walkthrough.legal.${key}`, undefined, key)).join(', ');
    const marked = missing ?? [];
    const open = unanswered ?? [];

    if (!isOwner) {
        if (!marked.length) return null;
        return (
            <p data-testid="furnished-notice" className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-medium leading-relaxed text-amber-900">
                {t('walkthrough.furnished.public', { items: names(marked) },
                    `Offered furnished by the owner, who marked these required items as missing or not working: ${names(marked)}. Until they are there, the home is not listed as furnished.`)}
            </p>
        );
    }

    if (!marked.length && !open.length) return null;
    return (
        <div data-testid="furnished-notice-owner" className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm font-medium leading-relaxed text-amber-900">
            {marked.length > 0 && (
                <p>
                    {t('walkthrough.furnished.ownerMissing', { items: names(marked) },
                        `Your listing is not shown as furnished: you marked ${names(marked)} as missing or not working. Update your answers once they are there, or offer the home unfurnished (the deposit limit is then one month's rent).`)}
                </p>
            )}
            {open.length > 0 && (
                <p>
                    {t('walkthrough.furnished.ownerUnanswered', { items: names(open) },
                        `A furnished home must have eleven kinds of items. Not answered yet: ${names(open)}. Answer them so students know what is there.`)}
                </p>
            )}
            <Link href={`/properties/${propertyId}/edit`} className="inline-block font-black underline underline-offset-4">
                {t('walkthrough.furnished.ownerAction', undefined, 'Update the answers')}
            </Link>
        </div>
    );
}
