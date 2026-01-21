import Link from 'next/link';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white shadow rounded-lg p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        Privacy Policy
                    </h1>
                    <p className="text-sm text-gray-500 mb-8">
                        Last updated: January 2026
                    </p>

                    <div className="prose prose-blue max-w-none">
                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            1. Data Controller
                        </h2>
                        <p className="text-gray-700 mb-4">
                            Rental Platform ("we", "us", "our") is the data controller responsible
                            for your personal data. We are committed to protecting your privacy in
                            accordance with the EU General Data Protection Regulation (GDPR) and
                            French data protection laws (Loi Informatique et Libertés).
                        </p>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            2. Data We Collect
                        </h2>
                        <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                            <li><strong>Identity Data:</strong> Full name, email address</li>
                            <li><strong>Account Data:</strong> Password (encrypted), role preference</li>
                            <li><strong>Property Data:</strong> Property listings, addresses, photos</li>
                            <li><strong>Verification Data:</strong> Identity documents, employment proof</li>
                            <li><strong>Usage Data:</strong> Login history, platform interactions</li>
                        </ul>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            3. Legal Basis for Processing
                        </h2>
                        <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                            <li><strong>Contract:</strong> To provide our rental platform services</li>
                            <li><strong>Consent:</strong> For marketing communications</li>
                            <li><strong>Legitimate Interest:</strong> Platform security and fraud prevention</li>
                            <li><strong>Legal Obligation:</strong> Compliance with French rental laws</li>
                        </ul>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            4. Your Rights (GDPR)
                        </h2>
                        <p className="text-gray-700 mb-4">
                            Under GDPR, you have the following rights:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                            <li><strong>Right of Access:</strong> Request a copy of your personal data</li>
                            <li><strong>Right to Rectification:</strong> Correct inaccurate data</li>
                            <li><strong>Right to Erasure:</strong> Request deletion of your data</li>
                            <li><strong>Right to Portability:</strong> Receive your data in a structured format</li>
                            <li><strong>Right to Object:</strong> Object to certain processing activities</li>
                            <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
                        </ul>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            5. Data Retention
                        </h2>
                        <p className="text-gray-700 mb-4">
                            We retain your personal data for as long as your account is active or as
                            needed to provide services. After account deletion, we retain certain data
                            for up to 5 years for legal compliance (French retention requirements for
                            rental records).
                        </p>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            6. Data Security
                        </h2>
                        <p className="text-gray-700 mb-4">
                            We implement appropriate technical and organizational measures including:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
                            <li>Encryption of passwords using Argon2</li>
                            <li>HTTPS encryption for all data transmission</li>
                            <li>Access controls and authentication</li>
                            <li>Regular security audits</li>
                        </ul>

                        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                            7. Contact & Complaints
                        </h2>
                        <p className="text-gray-700 mb-4">
                            For privacy inquiries or to exercise your rights, contact us at:{' '}
                            <a href="mailto:privacy@rentalplatform.fr" className="text-blue-600 hover:underline">
                                privacy@rentalplatform.fr
                            </a>
                        </p>
                        <p className="text-gray-700 mb-4">
                            You also have the right to lodge a complaint with the French data protection
                            authority (CNIL) at{' '}
                            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                www.cnil.fr
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
