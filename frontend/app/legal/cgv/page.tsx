'use client';

import Link from 'next/link';
import React, { useState } from 'react';

const content = {
    en: {
        title: 'General Terms of Sale',
        subtitle: '(Conditions Générales de Vente — CGV)',
        updated: 'Last updated: February 2026',
        langSwitch: '🇫🇷 Français',
        backHome: '← Back to Home',
        sections: [
            {
                title: '1. Scope & Definitions',
                paragraphs: [
                    'These General Terms of Sale ("CGV") govern the sale of paid services offered by Roomivo ("the Platform", "we", "us") to its users ("Clients", "you"). By purchasing any service on Roomivo, you accept these CGV in full.',
                ],
                definitions: [
                    { term: 'Booking Fee', def: 'A one-time service fee charged to a Tenant when their rental application is confirmed by the Landlord through the Platform.' },
                    { term: 'Premium Listing', def: 'A paid upgrade that gives Landlords enhanced visibility, priority placement in search results, and featured badges on their property listings.' },
                    { term: 'Verification Service', def: 'An enhanced identity, income, and document verification service providing a Roomivo-certified trust badge on user profiles.' },
                    { term: 'Subscription Plan', def: 'A recurring monthly or annual plan providing access to premium features for Landlords or property managers.' },
                ],
            },
            {
                title: '2. Services & Pricing',
                paragraphs: [
                    'Roomivo offers free and paid services. Free services include basic property browsing, profile creation, and standard messaging. Paid services include:',
                ],
                table: {
                    headers: ['Service', 'Who Pays', 'Pricing Model'],
                    rows: [
                        ['Booking Fee', 'Tenant', 'Percentage of first month\'s rent or flat fee — displayed before confirmation'],
                        ['Premium Listing', 'Landlord', 'Per-listing fee or monthly package — displayed at checkout'],
                        ['Enhanced Verification', 'Tenant or Landlord', 'Flat fee per verification — displayed before purchase'],
                        ['Subscription Plan', 'Landlord / Property Manager', 'Monthly or annual — displayed on pricing page'],
                    ],
                },
                postTable: 'All prices are displayed in Euros (€) and include applicable VAT. Prices may be updated at any time; the price in effect at the time of purchase applies to your order.',
            },
            {
                title: '3. Ordering Process',
                paragraphs: [
                    'To purchase a paid service on Roomivo:',
                ],
                steps: [
                    'Select the desired service on the Platform.',
                    'Review the service description, price (including VAT), and these CGV.',
                    'Confirm your order by clicking the payment button.',
                    'Complete payment through our secure payment processor.',
                    'Receive an order confirmation by email with your invoice.',
                ],
                postSteps: 'Your order is binding once payment is confirmed. You will receive a confirmation email with a unique order reference and downloadable invoice.',
            },
            {
                title: '4. Payment',
                paragraphs: [
                    'Payments are processed securely by our third-party payment processor. Roomivo never stores or directly handles your payment card details. Accepted payment methods include credit/debit cards (Visa, Mastercard) and other methods supported by the payment processor.',
                    'In the event of a failed payment, the service will not be activated. You may retry or contact support for assistance.',
                ],
            },
            {
                title: '5. Right of Withdrawal (14-Day Cooling-Off Period)',
                paragraphs: [
                    'In accordance with the EU Consumer Rights Directive (2011/83/EU) and the French Consumer Code (Articles L221-18 to L221-28), you have the right to withdraw from your purchase within 14 calendar days of the order date, without giving any reason.',
                ],
                subSections: [
                    {
                        subtitle: 'How to exercise your right of withdrawal',
                        body: 'Send a clear, unambiguous statement (email or letter) to legal@roomivo.com, including your name, order reference, date of purchase, and a statement that you wish to withdraw. You may use the withdrawal form at the bottom of this page.',
                    },
                    {
                        subtitle: 'Refund',
                        body: 'If you exercise your right of withdrawal, we will reimburse all payments received from you within 14 days of receiving your withdrawal notice, using the same payment method as the original transaction. No fees will be charged for the refund.',
                    },
                    {
                        subtitle: 'Exceptions',
                        body: 'The right of withdrawal does not apply if you have expressly consented to the immediate performance of the service and acknowledged that you lose your right of withdrawal once the service has been fully provided. This applies to: one-time verification services fully completed, and booking confirmations where the landlord has already been notified and the tenancy process has begun.',
                    },
                ],
            },
            {
                title: '6. Service Delivery & Activation',
                paragraphs: [
                    'Paid services are activated immediately upon payment confirmation unless otherwise stated:',
                ],
                list: [
                    { label: 'Premium Listings', detail: 'Activated within minutes of payment. Duration as described at purchase.' },
                    { label: 'Enhanced Verification', detail: 'Document review initiated within 24 hours. Results typically within 48 hours.' },
                    { label: 'Subscription Plans', detail: 'Access granted immediately. Billing cycle starts on the purchase date.' },
                    { label: 'Booking Fee', detail: 'Charged upon booking confirmation. Non-refundable once landlord has been notified, unless the booking is cancelled by the landlord.' },
                ],
            },
            {
                title: '7. Subscription Terms',
                paragraphs: [
                    'Subscription plans auto-renew at the end of each billing period (monthly or annually) unless cancelled. You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period — no partial refunds are provided for unused time.',
                    'Roomivo reserves the right to modify subscription pricing with at least 30 days\' notice before the next billing cycle. If you do not accept the new pricing, you may cancel before the renewal date.',
                ],
            },
            {
                title: '8. Invoicing',
                paragraphs: [
                    'An electronic invoice is generated for each purchase and sent to your registered email address. All invoices are also available for download in your account settings. Invoices include all legally required information (service description, price excluding VAT, VAT rate and amount, total including VAT, and Roomivo\'s company details).',
                ],
            },
            {
                title: '9. Liability',
                paragraphs: [
                    'Roomivo provides a technology platform for connecting landlords and tenants. We are not a party to any rental agreement and do not guarantee the outcome of any rental transaction. Our paid services enhance the user experience but do not constitute a guarantee of finding a rental property or tenant.',
                    'Roomivo\'s total liability for any claim arising from paid services shall not exceed the amount paid by you for the specific service in question.',
                ],
            },
            {
                title: '10. Complaints & Mediation',
                paragraphs: [
                    'For any complaint regarding a paid service, contact us at legal@roomivo.com. We will acknowledge your complaint within 48 hours and aim to resolve it within 15 business days.',
                    'If we are unable to resolve your complaint, you may refer the dispute to the consumer mediation service designated in our Legal Notice (Mentions Légales). You may also use the EU Online Dispute Resolution platform at https://ec.europa.eu/consumers/odr.',
                ],
            },
            {
                title: '11. Governing Law',
                paragraphs: [
                    'These CGV are governed by French law. In the event of a dispute, the parties agree to seek amicable resolution before any legal proceedings. The competent courts of Paris, France shall have jurisdiction, without prejudice to your rights as an EU consumer to bring proceedings before the courts of your place of residence.',
                ],
            },
            {
                title: '12. Contact',
                contact: { email: 'legal@roomivo.com' },
            },
        ],
        withdrawalForm: {
            title: 'Withdrawal Form Template',
            note: 'Complete and return this form only if you wish to withdraw from your purchase.',
            fields: [
                'To: Roomivo — legal@roomivo.com',
                'I hereby notify you that I withdraw from my purchase of the following service:',
                'Service: _______________',
                'Order reference: _______________',
                'Date of order: _______________',
                'Client name: _______________',
                'Client email: _______________',
                'Date: _______________',
                'Signature (if paper): _______________',
            ],
        },
    },
    fr: {
        title: 'Conditions Générales de Vente',
        subtitle: '(CGV)',
        updated: 'Dernière mise à jour : février 2026',
        langSwitch: '🇬🇧 English',
        backHome: '← Accueil',
        sections: [
            {
                title: '1. Objet et Définitions',
                paragraphs: [
                    'Les présentes Conditions Générales de Vente (« CGV ») régissent la vente des services payants proposés par Roomivo (« la Plateforme », « nous ») à ses utilisateurs (« Clients », « vous »). En achetant un service sur Roomivo, vous acceptez les présentes CGV dans leur intégralité.',
                ],
                definitions: [
                    { term: 'Frais de réservation', def: 'Frais de service uniques facturés au Locataire lors de la confirmation de sa candidature par le Bailleur via la Plateforme.' },
                    { term: 'Annonce Premium', def: 'Une mise en avant payante offrant aux Bailleurs une visibilité accrue, un placement prioritaire dans les résultats de recherche et des badges de mise en avant.' },
                    { term: 'Service de Vérification', def: 'Un service de vérification avancée d\'identité, de revenus et de documents fournissant un badge de confiance certifié Roomivo.' },
                    { term: 'Abonnement', def: 'Formule mensuelle ou annuelle donnant accès aux fonctionnalités premium pour les Bailleurs ou gestionnaires immobiliers.' },
                ],
            },
            {
                title: '2. Services et Tarifs',
                paragraphs: [
                    'Roomivo propose des services gratuits et payants. Les services gratuits incluent la navigation, la création de profil et la messagerie standard. Les services payants incluent :',
                ],
                table: {
                    headers: ['Service', 'Qui paie', 'Modèle tarifaire'],
                    rows: [
                        ['Frais de réservation', 'Locataire', 'Pourcentage du premier loyer ou forfait — affiché avant confirmation'],
                        ['Annonce Premium', 'Bailleur', 'Par annonce ou mensuel — affiché lors du paiement'],
                        ['Vérification avancée', 'Locataire ou Bailleur', 'Forfait par vérification — affiché avant achat'],
                        ['Abonnement', 'Bailleur / Gestionnaire', 'Mensuel ou annuel — affiché sur la page de tarifs'],
                    ],
                },
                postTable: 'Tous les prix sont affichés en euros (€) et incluent la TVA applicable. Les prix peuvent être modifiés à tout moment ; le prix en vigueur au moment de l\'achat s\'applique.',
            },
            {
                title: '3. Processus de Commande',
                paragraphs: [
                    'Pour acheter un service payant sur Roomivo :',
                ],
                steps: [
                    'Sélectionnez le service souhaité sur la Plateforme.',
                    'Consultez la description du service, le prix (TTC) et les présentes CGV.',
                    'Confirmez votre commande en cliquant sur le bouton de paiement.',
                    'Effectuez le paiement via notre processeur de paiement sécurisé.',
                    'Recevez une confirmation de commande par email avec votre facture.',
                ],
                postSteps: 'Votre commande est engageante dès la confirmation du paiement. Vous recevrez un email de confirmation avec une référence unique et une facture téléchargeable.',
            },
            {
                title: '4. Paiement',
                paragraphs: [
                    'Les paiements sont traités de manière sécurisée par notre prestataire de paiement tiers. Roomivo ne stocke ni ne traite directement vos données de carte bancaire. Les moyens de paiement acceptés incluent les cartes de crédit/débit (Visa, Mastercard) et autres méthodes proposées par le prestataire.',
                    'En cas d\'échec de paiement, le service ne sera pas activé. Vous pouvez réessayer ou contacter le support.',
                ],
            },
            {
                title: '5. Droit de Rétractation (Délai de 14 jours)',
                paragraphs: [
                    'Conformément à la Directive européenne sur les droits des consommateurs (2011/83/UE) et au Code de la consommation (Articles L221-18 à L221-28), vous disposez d\'un droit de rétractation de 14 jours calendaires à compter de la date de commande, sans avoir à justifier de motifs.',
                ],
                subSections: [
                    {
                        subtitle: 'Comment exercer votre droit de rétractation',
                        body: 'Envoyez une déclaration claire et sans ambiguïté (email ou courrier) à legal@roomivo.com, incluant votre nom, référence de commande, date d\'achat et une déclaration de rétractation. Vous pouvez utiliser le formulaire de rétractation en bas de cette page.',
                    },
                    {
                        subtitle: 'Remboursement',
                        body: 'Si vous exercez votre droit de rétractation, nous vous rembourserons tous les paiements reçus dans un délai de 14 jours à compter de la réception de votre demande, en utilisant le même moyen de paiement. Aucun frais ne vous sera facturé pour le remboursement.',
                    },
                    {
                        subtitle: 'Exceptions',
                        body: 'Le droit de rétractation ne s\'applique pas si vous avez expressément consenti à l\'exécution immédiate du service et reconnu perdre votre droit de rétractation une fois le service pleinement fourni. Cela concerne : les vérifications uniques pleinement réalisées et les confirmations de réservation où le bailleur a déjà été notifié.',
                    },
                ],
            },
            {
                title: '6. Livraison et Activation des Services',
                paragraphs: [
                    'Les services payants sont activés immédiatement après confirmation du paiement, sauf indication contraire :',
                ],
                list: [
                    { label: 'Annonces Premium', detail: 'Activées dans les minutes suivant le paiement. Durée telle que décrite lors de l\'achat.' },
                    { label: 'Vérification avancée', detail: 'Examen des documents initié sous 24h. Résultats généralement sous 48h.' },
                    { label: 'Abonnements', detail: 'Accès immédiat. Le cycle de facturation commence à la date d\'achat.' },
                    { label: 'Frais de réservation', detail: 'Facturés à la confirmation. Non remboursables une fois le bailleur notifié, sauf annulation par le bailleur.' },
                ],
            },
            {
                title: '7. Conditions d\'Abonnement',
                paragraphs: [
                    'Les abonnements se renouvellent automatiquement à la fin de chaque période (mensuelle ou annuelle), sauf résiliation. Vous pouvez résilier à tout moment via vos paramètres de compte. La résiliation prend effet à la fin de la période en cours — aucun remboursement partiel n\'est prévu.',
                    'Roomivo se réserve le droit de modifier les tarifs d\'abonnement avec un préavis d\'au moins 30 jours avant le prochain cycle. Si vous n\'acceptez pas le nouveau tarif, vous pouvez résilier avant la date de renouvellement.',
                ],
            },
            {
                title: '8. Facturation',
                paragraphs: [
                    'Une facture électronique est générée pour chaque achat et envoyée à votre adresse email. Toutes les factures sont disponibles au téléchargement dans vos paramètres de compte. Les factures incluent toutes les mentions légales (description du service, prix HT, taux et montant de TVA, total TTC, et coordonnées de Roomivo).',
                ],
            },
            {
                title: '9. Responsabilité',
                paragraphs: [
                    'Roomivo fournit une plateforme technologique de mise en relation entre bailleurs et locataires. Nous ne sommes pas partie à un contrat de location et ne garantissons pas le résultat d\'une transaction locative. Nos services payants améliorent l\'expérience mais ne constituent pas une garantie de résultat.',
                    'La responsabilité totale de Roomivo pour toute réclamation liée aux services payants ne saurait excéder le montant payé pour le service concerné.',
                ],
            },
            {
                title: '10. Réclamations et Médiation',
                paragraphs: [
                    'Pour toute réclamation relative à un service payant, contactez legal@roomivo.com. Nous accuserons réception sous 48 heures et viserons une résolution sous 15 jours ouvrés.',
                    'À défaut, vous pouvez saisir le service de médiation désigné dans nos Mentions Légales. Vous pouvez également utiliser la plateforme de résolution en ligne de l\'UE : https://ec.europa.eu/consumers/odr.',
                ],
            },
            {
                title: '11. Droit Applicable',
                paragraphs: [
                    'Les présentes CGV sont régies par le droit français. En cas de litige, les parties s\'engagent à chercher une résolution amiable avant toute procédure judiciaire. Les tribunaux compétents de Paris auront juridiction, sans préjudice de vos droits en tant que consommateur européen.',
                ],
            },
            {
                title: '12. Contact',
                contact: { email: 'legal@roomivo.com' },
            },
        ],
        withdrawalForm: {
            title: 'Formulaire de Rétractation',
            note: 'Complétez et renvoyez ce formulaire uniquement si vous souhaitez vous rétracter.',
            fields: [
                'À : Roomivo — legal@roomivo.com',
                'Je vous notifie par la présente ma rétractation du contrat portant sur le service suivant :',
                'Service : _______________',
                'Référence de commande : _______________',
                'Date de commande : _______________',
                'Nom du client : _______________',
                'Email : _______________',
                'Date : _______________',
                'Signature (si papier) : _______________',
            ],
        },
    },
};

type Section = (typeof content)['en']['sections'][number];

function SectionRenderer({ section }: { section: Section }) {
    return (
        <section>
            <h2 className="text-xl font-black text-zinc-900 mt-8 mb-4 uppercase tracking-tighter">{section.title}</h2>

            {section.paragraphs?.map((p, i) => (
                <p key={i} className="text-zinc-600 mb-4">{p}</p>
            ))}

            {'definitions' in section && section.definitions && (
                <dl className="border-l-2 border-zinc-900 pl-4 space-y-3 mb-4 bg-zinc-50/50 p-4 rounded-r-xl">
                    {(section.definitions as Array<{ term: string; def: string }>).map((d, i) => (
                        <div key={i}>
                            <dt className="font-black text-zinc-900 uppercase tracking-tight text-xs">{d.term}</dt>
                            <dd className="text-zinc-600 text-sm mt-1">{d.def}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {'table' in section && section.table && (
                <>
                    <div className="overflow-x-auto mb-4">
                        <table className="min-w-full border border-zinc-100 text-sm">
                            <thead className="bg-zinc-50">
                                <tr>
                                    {(section.table as { headers: string[]; rows: string[][] }).headers.map((h, i) => (
                                        <th key={i} className="px-4 py-2 text-left font-black text-zinc-900 uppercase text-[10px] border-b border-zinc-100">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(section.table as { headers: string[]; rows: string[][] }).rows.map((row, i) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                                        {row.map((cell, j) => (
                                            <td key={j} className="px-4 py-2 text-zinc-600 border-b border-zinc-100">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {'postTable' in section && (
                        <p className="text-zinc-600 text-xs mb-4 italic">{(section as { postTable: string }).postTable}</p>
                    )}
                </>
            )}

            {'steps' in section && (
                <>
                    <ol className="list-decimal pl-6 text-zinc-600 space-y-2 mb-4 text-sm">
                        {(section as { steps: string[] }).steps.map((s, i) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ol>
                    {'postSteps' in section && (
                        <p className="text-zinc-600 text-xs mb-4">{(section as { postSteps: string }).postSteps}</p>
                    )}
                </>
            )}

            {'list' in section && section.list && (
                <ul className="list-none pl-0 text-zinc-600 space-y-4 mb-4">
                    {(section.list as Array<{ label: string; detail: string }>).map((item, j) => (
                        <li key={j} className="text-sm">
                            <strong className="text-zinc-900 font-black block uppercase text-xs tracking-tight">{item.label}</strong> 
                            {item.detail}
                        </li>
                    ))}
                </ul>
            )}

            {'subSections' in section && (section as { subSections: Array<{ subtitle: string; body: string }> }).subSections.map((sub, i) => (
                <div key={i} className="ml-0 mb-6 border-l border-zinc-200 pl-4">
                    <h3 className="font-black text-zinc-900 uppercase text-xs mb-2 tracking-tight">{sub.subtitle}</h3>
                    <p className="text-zinc-600 text-sm">{sub.body}</p>
                </div>
            ))}

            {'contact' in section && (section as { contact: { email: string } }).contact && (
                <p className="text-zinc-600 mb-4">
                    <a href={`mailto:${(section as { contact: { email: string } }).contact.email}`} className="text-zinc-900 font-black underline hover:text-zinc-500 transition-colors">
                        {(section as { contact: { email: string } }).contact.email}
                    </a>
                </p>
            )}
        </section>
    );
}

export default function LegalPage() {
    const [lang, setLang] = React.useState('en');
    const t = content[lang as keyof typeof content];

    return (
        <div className="min-h-screen bg-zinc-50 py-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="glass-card !p-12 rounded-[3rem] border-zinc-100 shadow-2xl">
                    <div className="flex justify-between items-start mb-12">
                        <div>
                            <h1 className="text-5xl font-black text-zinc-900 tracking-tighter uppercase">{t.title}</h1>
                            <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em] mt-4">{t.subtitle}</p>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mt-2">{t.updated}</p>
                        </div>
                        <button
                            onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
                            className="text-[10px] px-4 py-2 bg-zinc-900 text-white rounded-full transition-all font-black uppercase tracking-widest hover:scale-105 active:scale-95 shadow-xl"
                        >
                            {t.langSwitch}
                        </button>
                    </div>

                    <div className="prose prose-zinc max-w-none prose-headings:uppercase prose-headings:tracking-tighter prose-headings:font-black">
                        {t.sections.map((section, i) => (
                            <SectionRenderer key={i} section={section} />
                        ))}
                    </div>

                    {/* Withdrawal Form */}
                    <div className="mt-16 pt-12 border-t border-zinc-100">
                        <h2 className="text-xl font-black text-zinc-900 mb-4 uppercase tracking-tighter">{t.withdrawalForm.title}</h2>
                        <p className="text-sm text-zinc-500 mb-8">{t.withdrawalForm.note}</p>
                        <div className="bg-zinc-900 text-white border border-zinc-900 rounded-[2rem] p-10 text-xs space-y-4 font-mono shadow-2xl">
                            {t.withdrawalForm.fields.map((f, i) => (
                                <p key={i} className="opacity-80">{f}</p>
                            ))}
                        </div>
                    </div>

                    <div className="mt-16 pt-12 border-t border-zinc-100 flex flex-wrap gap-6">
                        {[
                            { label: t.backHome, path: '/' },
                            { label: 'Terms / CGU', path: '/legal/terms' },
                            { label: 'Privacy', path: '/legal/privacy' },
                            { label: 'Mentions Légales', path: '/legal/mentions-legales' }
                        ].map((link, i) => (
                            <Link key={i} href={link.path} className="text-[10px] font-black text-zinc-400 hover:text-zinc-900 uppercase tracking-widest transition-colors">
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
