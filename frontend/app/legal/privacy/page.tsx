import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy & CNIL | Roomivo',
    description: 'Learn how Roomivo protects your privacy, secures your data, and complies with French and European data protection regulations.',
};

export default function PrivacyPage() {
    return (
        <div className="prose prose-zinc prose-a:text-teal-600 hover:prose-a:text-teal-500 max-w-none">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl mb-6">
                Privacy Policy & CNIL
            </h1>
            <p className="text-lg text-zinc-500 mb-12 border-b border-zinc-100 pb-8">
                At Roomivo, trust is built on transparency. We take your privacy seriously and are fully committed to protecting the personal data of our tenants and landlords.
            </p>

            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-4">1. Information We Collect</h2>
                <p>
                    We collect information strictly necessary to facilitate secure, verified rental agreements. This includes:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-4 text-zinc-700">
                    <li><strong className="text-zinc-900">Identity Data:</strong> Name, contact details, and government-issued ID for KYC processes.</li>
                    <li><strong className="text-zinc-900">Financial Data:</strong> Tax notices, employment contracts, and payslips used to calculate your Roomivo Trust Score.</li>
                    <li><strong className="text-zinc-900">Property Data:</strong> Details provided by landlords to list properties accurately.</li>
                </ul>
            </section>

            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-4">2. How We Use Your Data</h2>
                <p>
                    Your data is never sold. It is exclusively used to:
                </p>
                <ul className="list-disc pl-6 space-y-2 mt-4 text-zinc-700">
                    <li>Verify identity and eliminate rental fraud from the ecosystem.</li>
                    <li>Generate secure, tamper-proof rental applications (Dossier Facile compatible).</li>
                    <li>Facilitate direct communication between verified tenants and landlords.</li>
                </ul>
            </section>

            <section className="mb-12 border-l-4 border-teal-500 pl-6 py-2 bg-teal-50/50 rounded-r-lg">
                <h2 className="text-xl font-bold tracking-tight text-teal-900 mb-2">3. Zero Data Selling Guarantee</h2>
                <p className="text-teal-800 m-0">
                    Roomivo is a SaaS platform, not a data broker. We do not sell your personal data to third parties, advertisers, or marketing agencies. Your rental dossier is shared <strong>only</strong> with the landlords you explicitly apply to.
                </p>
            </section>

            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-4">4. Data Retention & Security</h2>
                <p>
                    Documents uploaded for verification are processed securely. Once your Trust Score is generated and verified,
                    we aggressively minimize the retention of sensitive files (like payslips and tax returns) to reduce risk,
                    relying instead on the verified cryptographic proofs.
                </p>
            </section>

            <div className="mt-16 pt-8 border-t border-zinc-100 text-sm text-zinc-400">
                Last updated: February 28, 2026
            </div>
        </div>
    );
}
