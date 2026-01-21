import Link from 'next/link';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white shadow rounded-lg p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        Terms of Service
                    </h1>
                    <p className="text-sm text-gray-500 mb-8">
                        Last updated: January 2026
                    </p>

                    <div className="prose prose-blue max-w-none">
                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            1. Acceptance of Terms
                        </h2>
                        <p className="text-gray-700 mb-4">
                            By accessing or using Rental Platform, you agree to be bound by these
                            Terms of Service and all applicable laws and regulations of France
                            and the European Union.
                        </p>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            2. Platform Description
                        </h2>
                        <p className="text-gray-700 mb-4">
                            Rental Platform is a digital service connecting property owners (landlords)
                            with potential tenants. We facilitate property listings, verification,
                            and communication but are not a party to any rental agreements.
                        </p>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            3. User Accounts
                        </h2>
                        <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                            <li>You must provide accurate information during registration</li>
                            <li>You are responsible for maintaining account security</li>
                            <li>You must be at least 18 years old to use the platform</li>
                            <li>One person may only create one account</li>
                        </ul>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            4. Property Listings (Landlords)
                        </h2>
                        <p className="text-gray-700 mb-4">
                            Landlords agree to:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                            <li>Provide accurate property information</li>
                            <li>Comply with French rental laws (Loi ALUR, Loi Carrez)</li>
                            <li>Include required energy performance information (DPE)</li>
                            <li>Not discriminate against tenants as per French law</li>
                            <li>Respect rent control regulations where applicable</li>
                        </ul>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            5. Tenant Responsibilities
                        </h2>
                        <p className="text-gray-700 mb-4">
                            Tenants agree to:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                            <li>Provide truthful information in applications</li>
                            <li>Submit only authentic verification documents</li>
                            <li>Comply with fair use of the platform</li>
                        </ul>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            6. Prohibited Activities
                        </h2>
                        <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                            <li>Fraudulent listings or applications</li>
                            <li>Discrimination based on protected characteristics</li>
                            <li>Harassment of other users</li>
                            <li>Automated scraping or data extraction</li>
                            <li>Circumventing platform security measures</li>
                        </ul>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            7. Liability Limitation
                        </h2>
                        <p className="text-gray-700 mb-4">
                            Rental Platform is not responsible for disputes between landlords
                            and tenants. We do not guarantee the accuracy of listings or
                            successful rental outcomes.
                        </p>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            8. Governing Law
                        </h2>
                        <p className="text-gray-700 mb-4">
                            These terms are governed by French law. Any disputes shall be
                            resolved in the courts of Paris, France.
                        </p>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            9. Contact
                        </h2>
                        <p className="text-gray-700 mb-4">
                            For questions about these terms, contact us at:{' '}
                            <a href="mailto:legal@rentalplatform.fr" className="text-blue-600 hover:underline">
                                legal@rentalplatform.fr
                            </a>
                        </p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <Link
                            href="/"
                            className="text-blue-600 hover:text-blue-500 font-medium"
                        >
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
