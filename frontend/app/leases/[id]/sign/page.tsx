'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import EsignManager from '@/components/EsignManager';
import { useLanguage } from '@/lib/LanguageContext';

export default function LeaseSignPage() {
    const { t } = useLanguage();
    const params = useParams();
    const router = useRouter();
    const leaseId = params.id as string;

    useEffect(() => {
        document.title = 'Sign Lease | Roomivo';
    }, []);

    return (
        <ProtectedRoute>
            <PremiumLayout>
                <div className="max-w-4xl mx-auto px-6 py-10">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-900 mb-6"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {t('common.back', undefined, 'Back')}
                    </button>
                    <EsignManager leaseId={leaseId} />
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
