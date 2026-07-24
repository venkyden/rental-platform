'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumLayout from '@/components/PremiumLayout';
import TeamManager from '@/components/TeamManager';
import { useLanguage } from '@/lib/LanguageContext';

export default function TeamPage() {
    const router = useRouter();
    const { t } = useLanguage();

    return (
        <ProtectedRoute>
            <PremiumLayout>
                <div className="max-w-5xl mx-auto py-6">
                    <div className="flex items-center gap-6 mb-8">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="text-xs font-black text-zinc-400 hover:text-zinc-900 uppercase tracking-widest transition-colors"
                        >
                            ← {t('common.backToDashboard', undefined, 'Back to Dashboard')}
                        </button>
                        <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-tighter">
                            {t('team.title', undefined, 'Team Management')}
                        </h1>
                    </div>
                    <TeamManager />
                </div>
            </PremiumLayout>
        </ProtectedRoute>
    );
}
