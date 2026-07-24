'use client';

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';

export default function BulkImportPage() {
    const router = useRouter();
    const { t } = useLanguage();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100/50 via-zinc-50 to-white"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-zinc-900/5 rounded-full blur-[100px] mix-blend-multiply pointer-events-none"></div>
            </div>

            <div className="z-10 max-w-md w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 p-8 text-center">
                <div className="text-6xl mb-6">📂</div>
                <h1 className="text-2xl font-black text-zinc-900 mb-2 uppercase tracking-tight">{t('bulk.title', undefined, 'Bulk Import')}</h1>
                <p className="text-zinc-500 mb-8 font-medium">
                    {t('bulk.description', undefined, 'Import your properties and tenants via CSV or XML.')}
                    <br />
                    <span className="text-xs px-3 py-1 bg-zinc-900 text-white rounded-full mt-3 inline-block font-black uppercase tracking-widest">
                        {t('bulk.enterpriseBadge', undefined, 'Enterprise Feature (S3)')}
                    </span>
                </p>
                <div className="space-y-3">
                    <button
                        className="w-full py-3.5 text-xs font-black text-white uppercase tracking-widest rounded-xl shadow-md transition-all hover:bg-zinc-800 active:scale-[0.98] bg-zinc-900"
                    >
                        {t('bulk.downloadTemplate', undefined, 'Download CSV Template')}
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="w-full py-3 text-zinc-500 hover:text-zinc-700 transition-colors text-xs font-black uppercase tracking-widest"
                    >
                        {t('common.back', undefined, 'Back')}
                    </button>
                </div>
            </div>
        </div>
    );
}
