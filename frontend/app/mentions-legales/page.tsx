import Link from 'next/link';

export default function MentionsLegalesPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white shadow rounded-lg p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        Mentions Légales
                    </h1>

                    <div className="prose prose-blue max-w-none space-y-6">
                        {/* Éditeur */}
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                                1. Éditeur du Site
                            </h2>
                            <div className="text-gray-700 space-y-2">
                                <p><strong>Raison sociale :</strong> Rental Platform SAS</p>
                                <p><strong>Forme juridique :</strong> Société par Actions Simplifiée</p>
                                <p><strong>Capital social :</strong> 10 000 €</p>
                                <p><strong>Siège social :</strong> [Adresse à compléter]</p>
                                <p><strong>RCS :</strong> [Numéro RCS à compléter]</p>
                                <p><strong>SIRET :</strong> [Numéro SIRET à compléter]</p>
                                <p><strong>TVA intracommunautaire :</strong> [Numéro TVA à compléter]</p>
                            </div>
                        </section>

                        {/* Directeur de publication */}
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                                2. Directeur de la Publication
                            </h2>
                            <p className="text-gray-700">
                                <strong>Nom :</strong> [Nom du directeur à compléter]<br />
                                <strong>Qualité :</strong> Président
                            </p>
                        </section>

                        {/* Hébergeur */}
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                                3. Hébergeur
                            </h2>
                            <div className="text-gray-700 space-y-2">
                                <p><strong>Frontend :</strong> Vercel Inc.</p>
                                <p>440 N Barranca Ave #4133, Covina, CA 91723, USA</p>
                                <p><strong>Backend :</strong> Railway Corporation</p>
                                <p>548 Market St, San Francisco, CA 94104, USA</p>
                            </div>
                        </section>

                        {/* Contact */}
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                                4. Contact
                            </h2>
                            <div className="text-gray-700 space-y-2">
                                <p>
                                    <strong>Email :</strong>{' '}
                                    <a href="mailto:contact@rentalplatform.fr" className="text-blue-600 hover:underline">
                                        contact@rentalplatform.fr
                                    </a>
                                </p>
                                <p><strong>Téléphone :</strong> [Numéro à compléter]</p>
                            </div>
                        </section>

                        {/* Propriété intellectuelle */}
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                                5. Propriété Intellectuelle
                            </h2>
                            <p className="text-gray-700">
                                L&apos;ensemble du contenu de ce site (textes, images, vidéos, logos, icônes)
                                est protégé par le droit d&apos;auteur et le droit des marques. Toute reproduction,
                                représentation, modification, publication, adaptation ou exploitation de tout
                                ou partie des éléments du site est interdite sans autorisation écrite préalable.
                            </p>
                        </section>

                        {/* Données personnelles */}
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                                6. Protection des Données Personnelles
                            </h2>
                            <p className="text-gray-700">
                                Conformément au Règlement Général sur la Protection des Données (RGPD) et à la
                                loi Informatique et Libertés, vous disposez de droits sur vos données personnelles.
                                Pour plus d&apos;informations, consultez notre{' '}
                                <Link href="/privacy" className="text-blue-600 hover:underline">
                                    Politique de Confidentialité
                                </Link>.
                            </p>
                            <p className="text-gray-700 mt-2">
                                <strong>Délégué à la Protection des Données (DPO) :</strong>{' '}
                                <a href="mailto:dpo@rentalplatform.fr" className="text-blue-600 hover:underline">
                                    dpo@rentalplatform.fr
                                </a>
                            </p>
                        </section>

                        {/* Cookies */}
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                                7. Cookies
                            </h2>
                            <p className="text-gray-700">
                                Ce site utilise des cookies pour améliorer votre expérience. Vous pouvez gérer
                                vos préférences via le bandeau de consentement affiché lors de votre première visite.
                            </p>
                        </section>

                        {/* Médiation */}
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                                8. Médiation et Litiges
                            </h2>
                            <p className="text-gray-700">
                                Conformément aux dispositions du Code de la consommation, en cas de litige,
                                vous pouvez recourir gratuitement au service de médiation.
                                <br /><br />
                                <strong>Médiateur :</strong> [Nom du médiateur à compléter]<br />
                                <strong>Site :</strong> [URL du médiateur]
                            </p>
                        </section>

                        {/* Loi applicable */}
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
                                9. Droit Applicable
                            </h2>
                            <p className="text-gray-700">
                                Les présentes mentions légales sont soumises au droit français.
                                Tout litige relatif à l&apos;utilisation du site sera soumis à la compétence
                                exclusive des tribunaux de Paris.
                            </p>
                        </section>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-200 flex gap-4">
                        <Link href="/" className="text-blue-600 hover:text-blue-500 font-medium">
                            ← Accueil
                        </Link>
                        <Link href="/privacy" className="text-blue-600 hover:text-blue-500 font-medium">
                            Confidentialité
                        </Link>
                        <Link href="/terms" className="text-blue-600 hover:text-blue-500 font-medium">
                            CGU
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
