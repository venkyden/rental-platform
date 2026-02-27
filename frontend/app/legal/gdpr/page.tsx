import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'GDPR & Data Rights | Roomivo',
    description: 'Exercise your rights under the GDPR. Discover how Roomivo handles data portability, rectification, and your right to be forgotten.',
};

export default function GDPRPage() {
    return (
        <div className="prose prose-zinc prose-a:text-teal-600 hover:prose-a:text-teal-500 max-w-none">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl mb-6">
                GDPR & Data Rights
            </h1>
            <p className="text-lg text-zinc-500 mb-12 border-b border-zinc-100 pb-8">
                Roomivo operates entirely within the European Union and is built from the ground up to comply
                with the General Data Protection Regulation (GDPR). Your data belongs to you.
            </p>

            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-4">Your Fundamental Rights</h2>
                <p>
                    We provide transparent, automated mechanisms to exercise your rights:
                </p>

                <div className="grid sm:grid-cols-2 gap-6 mt-6 not-prose">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-700">🔍</span>
                            <h3 className="text-lg font-bold text-zinc-900">Access & Portability</h3>
                        </div>
                        <p className="text-zinc-600 text-sm">
                            Extract a machine-readable archive (JSON/ZIP) of all personal data and verification proofs tied to your account.
                        </p>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-700">✏️</span>
                            <h3 className="text-lg font-bold text-zinc-900">Rectification</h3>
                        </div>
                        <p className="text-zinc-600 text-sm">
                            Instantly update inaccurate information. Note that modifying documents may trigger a mandatory re-verification of your Trust Score.
                        </p>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 sm:col-span-2">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700">🗑️</span>
                            <h3 className="text-lg font-bold text-zinc-900">The Right to be Forgotten</h3>
                        </div>
                        <p className="text-zinc-600 text-sm">
                            You can request the permanent deletion of your account and associated dossiers.
                            <strong>Please note:</strong> If you are currently in an active lease managed through Roomivo, legal retention requirements regarding financial transactions may temporarily override deletion requests until the lease is terminated.
                        </p>
                    </div>
                </div>
            </section>

            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-4">How to Exercise Your Rights</h2>
                <p>
                    Most rights can be exercised directly from your dashboard's security settings. For complex inquiries or manual deletion requests,
                    our dedicated Data Protection Officer is available. We legally mandate a response to all GDPR requests within 30 days.
                </p>
                <div className="bg-zinc-900 text-zinc-50 p-4 rounded-lg mt-4 font-mono text-sm inline-block">
                    dpo@roomivo.eu
                </div>
            </section>

            <div className="mt-16 pt-8 border-t border-zinc-100 text-sm text-zinc-400">
                Last updated: February 28, 2026
            </div>
        </div>
    );
}
