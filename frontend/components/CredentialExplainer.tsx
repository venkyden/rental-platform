'use client';

import Link from 'next/link';
import { ShieldCheck, Share2, EyeOff, Clock } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface Props {
    role: 'tenant' | 'landlord';
    /** Compact card that links to the Verification page (for the guarantor flow). */
    compact?: boolean;
}

/**
 * Explains what the credential (verified-profile certificate) is and why it
 * exists, in the reader's language. The credential is the product's core —
 * without this context it reads as a dead button.
 */
export default function CredentialExplainer({ role, compact = false }: Props) {
    const { language } = useLanguage();
    const fr = language === 'fr';
    const tenant = role === 'tenant';

    if (compact) {
        return (
            <div className="p-6 rounded-3xl bg-zinc-900 text-white space-y-3">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <p className="text-xs font-black uppercase tracking-widest">
                        {fr ? 'Pas de garant ? Vous avez mieux.' : 'No guarantor? You have something better.'}
                    </p>
                </div>
                <p className="text-sm text-zinc-300 font-medium leading-relaxed">
                    {fr
                        ? "Votre profil vérifié remplace le dossier papier : une attestation signée par Roomivo prouve votre identité et vos revenus, sans transmettre un seul document. C'est le signal le plus fort que vous puissiez offrir à un bailleur."
                        : 'Your verified profile stands in for the paper dossier: a certificate signed by Roomivo proves your identity and income without handing over a single document. It is the strongest signal you can offer a landlord.'}
                </p>
                <Link
                    href="/verification"
                    className="inline-block text-xs font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                    {fr ? 'Générer mon attestation →' : 'Generate my certificate →'}
                </Link>
            </div>
        );
    }

    const bullets = tenant
        ? [
              {
                  icon: EyeOff,
                  text: fr
                      ? "Fini l'envoi de votre carte d'identité et de votre avis d'imposition par e-mail : l'attestation partage des résultats vérifiés, jamais vos documents."
                      : 'No more emailing your ID card and tax notice: the certificate shares verified results, never your documents.',
              },
              {
                  icon: Share2,
                  text: fr
                      ? 'Elle fonctionne partout — Roomivo, Leboncoin, PAP. Le bailleur la vérifie en quelques secondes, sans créer de compte.'
                      : 'It works everywhere — Roomivo, Leboncoin, PAP. The landlord checks it in seconds, no account needed.',
              },
              {
                  icon: ShieldCheck,
                  text: fr
                      ? "Sans garant ? Un profil vérifié est l'alternative la plus crédible que vous puissiez présenter."
                      : "No guarantor? A verified profile is the most credible alternative you can present.",
              },
          ]
        : [
              {
                  icon: ShieldCheck,
                  text: fr
                      ? "Vérifiez un candidat en quelques secondes : valide, expirée ou révoquée — signée par Roomivo, infalsifiable."
                      : 'Check an applicant in seconds: valid, expired or revoked — signed by Roomivo, tamper-evident.',
              },
              {
                  icon: EyeOff,
                  text: fr
                      ? "Vous ne stockez plus les documents de personne : moins de paperasse, aucune exposition RGPD liée aux dossiers papier."
                      : "You never store anyone's documents: less paperwork, no GDPR exposure from paper dossiers.",
              },
              {
                  icon: Share2,
                  text: fr
                      ? 'Votre propre attestation prouve aux candidats que le dépôt de garantie va bien au vrai propriétaire — la protection anti-arnaque qui rassure.'
                      : 'Your own certificate proves to applicants that the deposit goes to the real landlord — the anti-scam reassurance they look for.',
              },
          ];

    return (
        <div className="p-8 rounded-[2.5rem] bg-zinc-50 border border-zinc-100 space-y-6 text-left">
            <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">
                    {fr ? 'Attestation vérifiée' : 'Verified certificate'}
                </div>
                <h3 className="text-xl font-black text-zinc-900 tracking-tight">
                    {tenant
                        ? (fr ? 'Votre dossier, sans transmettre vos documents' : 'Your dossier, without handing over your documents')
                        : (fr ? 'Demandez une preuve, pas des documents' : 'Ask for proof, not paperwork')}
                </h3>
                <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                    {tenant
                        ? (fr
                            ? "Une fois votre identité — et si vous le souhaitez vos revenus — vérifiés, Roomivo émet une attestation signée : un lien, un QR code et un code court. Elle énonce des faits vérifiés (« identité vérifiée », « revenus vérifiés ») sans jamais montrer vos documents."
                            : 'Once your identity — and, if you wish, your income — are verified, Roomivo issues a signed certificate: a link, a QR code and a short code. It states verified facts ("identity verified", "income verified") without ever showing your documents.')
                        : (fr
                            ? "Les candidats vous envoient un lien ou un code court au lieu d'un dossier papier. Ouvrez-le pour voir ce que Roomivo a vérifié — identité, revenus — sans manipuler les documents de qui que ce soit."
                            : 'Applicants send you a link or a short code instead of a paper dossier. Open it to see what Roomivo verified — identity, income — without handling anyone\'s documents.')}
                </p>
            </div>

            <div className="space-y-3">
                {bullets.map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-zinc-600" />
                        </div>
                        <p className="text-sm text-zinc-600 font-medium leading-relaxed">{text}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-start gap-2 pt-2 border-t border-zinc-200/60">
                <Clock className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                    {fr
                        ? "L'attestation expire après 30 jours et peut être révoquée à tout moment. Elle ne contient que des faits vérifiés — jamais de documents ni de chiffres bruts."
                        : 'The certificate expires after 30 days and can be revoked at any time. It contains only verified facts — never raw documents or figures.'}
                </p>
            </div>
        </div>
    );
}
