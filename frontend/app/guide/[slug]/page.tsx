'use client';

import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';

export default function GuidePage() {
    const router = useRouter();
    const params = useParams();
    const { t } = useLanguage();
    const slug = params?.slug;

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-100/50 via-slate-50 to-white"></div>
            </div>

            <header className="relative z-10 bg-white/80 backdrop-blur-xl border-b border-white/50">
                <div className="max-w-7xl mx-auto py-4 px-4 flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-900 transition-colors">← {t('guide.back', undefined, 'Back')}</button>
                    <h1 className="text-2xl font-bold text-zinc-900">{t('guide.resourceCenter', undefined, 'Resource Center')}</h1>
                </div>
            </header>

            <main className="relative z-10 max-w-4xl mx-auto py-12 px-4 flex-1">
                <div className="prose max-w-none">
                    {slug === 'tenant' ? (
                        <div>
                            <h1 className="text-3xl font-bold mb-4">{t('guide.tenant.title', undefined, "Tenant's Guide")}</h1>
                            <p className="text-lg text-zinc-600 mb-6">{t('guide.tenant.description', undefined, 'Understanding the application, guarantors, and lease.')}</p>
                            <div className="bg-white p-6 rounded-xl border border-zinc-200 space-y-4 not-prose">
                                <h2 className="text-xl font-semibold text-zinc-800">1. Prepare Your Dossier</h2>
                                <p className="text-zinc-600">Gather your identity document, proof of income, tax notice, and proof of residence before applying for properties.</p>
                                <h2 className="text-xl font-semibold text-zinc-800">2. Verification</h2>
                                <p className="text-zinc-600">Verify your identity and documents using Roomivo Automated Dossier verification to build trust with landlords.</p>
                                <h2 className="text-xl font-semibold text-zinc-800">3. Apply & Sign</h2>
                                <p className="text-zinc-600">Submit complete applications with 1-click and sign your digital lease securely online.</p>
                            </div>
                        </div>
                    ) : slug === 'landlord' ? (
                        <div>
                            <h1 className="text-3xl font-bold mb-4">{t('guide.landlord.title', undefined, 'Pricing & Landlord Guide')}</h1>
                            <p className="text-lg text-zinc-600 mb-6">{t('guide.landlord.description', undefined, 'Market trends and rent estimation.')}</p>
                            <div className="bg-white p-6 rounded-xl border border-zinc-200 space-y-4 not-prose">
                                <h2 className="text-xl font-semibold text-zinc-800">1. Property Listing</h2>
                                <p className="text-zinc-600">Add detailed photos, amenities, location, and precise rental prices matching local regulations.</p>
                                <h2 className="text-xl font-semibold text-zinc-800">2. Review Verified Applications</h2>
                                <p className="text-zinc-600">Receive verified applicant dossiers with financial check badges and solvency scoring.</p>
                                <h2 className="text-xl font-semibold text-zinc-800">3. Automated Leases</h2>
                                <p className="text-zinc-600">Generate compliant rental contracts in minutes and automate monthly rent collection.</p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h1>{t('guide.title', undefined, 'Guides & Tips')}</h1>
                            <p>{t('guide.subtitle', undefined, 'Discover our articles to help with your real estate project.')}</p>

                            <div className="grid gap-6 not-prose mt-8">
                                <div 
                                    onClick={() => router.push('/guide/tenant')}
                                    className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] border border-white/50 hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5"
                                >
                                    <h3 className="font-bold text-xl mb-2"> {t('guide.tenant.title', undefined, "Tenant's Guide")}</h3>
                                    <p className="text-zinc-600">{t('guide.tenant.description', undefined, 'Understanding the application, guarantors, and lease.')}</p>
                                </div>
                                <div 
                                    onClick={() => router.push('/guide/landlord')}
                                    className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] border border-white/50 hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5"
                                >
                                    <h3 className="font-bold text-xl mb-2"> {t('guide.landlord.title', undefined, 'Pricing Guide (Landlord)')}</h3>
                                    <p className="text-zinc-600">{t('guide.landlord.description', undefined, 'Market trends and rent estimation.')}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

