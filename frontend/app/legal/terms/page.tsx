import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Terms of Service | Roomivo',
    description: 'Read the Terms of Service for using Roomivo. Understand your rights and responsibilities as a tenant or landlord on our platform.',
};

export default function TermsPage() {
    return (
        <div className="prose prose-zinc prose-a:text-teal-600 hover:prose-a:text-teal-500 max-w-none">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl mb-6">
                Terms of Service
            </h1>
            <p className="text-lg text-zinc-500 mb-12 border-b border-zinc-100 pb-8">
                By accessing or using the Roomivo platform, you agree to be bound by these Terms of Service.
                These terms govern your use of our automated trust and verification ecosystem.
            </p>

            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-4">1. Description of Service</h2>
                <p>
                    Roomivo is a technology platform designed to facilitate secure, transparent, and efficient rental transactions.
                    <strong>We are not a real estate agency.</strong> We provide the digital infrastructure for identity verification,
                    financial assessment, and secure document sharing between tenants and landlords.
                </p>
            </section>

            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-4">2. User Obligations</h2>
                <p>
                    Trust is the foundation of Roomivo. As a user, you agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-4 text-zinc-700">
                    <li>Provide meticulously accurate, current, and complete information.</li>
                    <li>Never upload forged, modified, or deceptive documents. Our AI verification systems actively flag discrepancies.</li>
                    <li>Maintain the confidentiality of your account credentials.</li>
                </ul>
            </section>

            <section className="mb-12 border-l-4 border-amber-500 pl-6 py-2 bg-amber-50/50 rounded-r-lg">
                <h2 className="text-xl font-bold tracking-tight text-amber-900 mb-2">3. Zero Tolerance for Fraud</h2>
                <p className="text-amber-800 m-0">
                    Submitting false documents or attempting to manipulate the Trust Score system will result in immediate,
                    permanent account termination and may be reported to relevant authorities.
                </p>
            </section>

            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-4">4. Limitation of Liability</h2>
                <p>
                    While Roomivo provides robust verification tools, the ultimate decision to enter into a rental agreement
                    rests solely with the landlord and tenant. Roomivo shall not be liable for the outcome of any rental
                    decision or any disputes arising between parties.
                </p>
            </section>

            <div className="mt-16 pt-8 border-t border-zinc-100 text-sm text-zinc-400">
                Last updated: February 28, 2026
            </div>
        </div>
    );
}
