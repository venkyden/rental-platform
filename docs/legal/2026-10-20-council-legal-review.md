# Council legal review — 2026-10-20

**Not legal advice.** The founders had no budget for a lawyer's sign-off and asked for the
review work to be done by a council of four independent AI research reviewers, each working
from primary sources (Légifrance, EU law, the Défenseur des droits, the Autorité de la
concurrence, CNIL, EDPB). Each claim below was marked by its reviewer as confirmed on the
official text or not; unconfirmed points are flagged. This record is the basis of the decisions
taken the same day by Claude acting as management on the founders' instruction. Revisit it
whenever a lawyer can be consulted.

## 1. Loi Hoguet: listing Q&A and fees

**Q&A on listings — stays outside Hoguet as designed (confidence: medium-high).**
- Loi 70-9 art. 1 covers anyone who "prêtent leur concours, même à titre accessoire" to rentals
  of others' property. Art. 6 I: no fee before the operation is concluded in writing; art. 16 2°:
  2 years and €30,000 for breach. Confirmed (JORFTEXT000000512228).
- Autorité de la concurrence, avis 23-A-07 §§29–32 (confirmed): *entremise* needs a "direct and
  decisive" contribution. CA Dijon 19 Feb 2009 n°08/00592 (ads site, even with a 1% success fee:
  not *entremise*); CA Paris 18 Nov 2022 n°21/03539 (PAP: automatic forwarding of a file is
  "faible valeur ajoutée"; the court noted PAP did not check funds or title). Selection of
  applicants, negotiation, visits and drafting acts *are* *entremise* (§32). Cass. crim. 14 Jan 2009
  n°08-84.590 upheld a conviction where selection of buyers and a success bonus were combined.
- Conditions to stay safe: the landlord's answer published word for word; deterministic matching;
  nothing ranked or recommended between people; free, with no fee tied to it; Roomivo never
  answers for the landlord, negotiates, or vets applicants for him.

**Fees (confidence: medium).** A student fee on acceptance plus a landlord fee on signature, on top
of solvency and identity checks and lease generation, makes requalification as an agent
plausible; the student fee would be collected before the lease (art. 6 I) and outside the capped
tenant fees of loi 89-462 art. 5. **The fallback — a fee for a document (verified file,
certificate, generated lease, e-signature), payable whatever happens next — is materially safer**
(avis 23-A-07 §277: platforms paid before, not on result). Never charge students for access to
listings or contacts (close to art. 1 7°, sale of lists). Keep the lease to the official model.

Open: whether verification + lease generation + any outcome-linked fee adds up to *entremise* for
rentals; no case on point was found. No enforcement against a rental platform was found; past
challenges came from agents' federations (FNAIM, SNPI v PAP).

## 2. Discrimination in published text; gender mix

- Code pénal 225-1 (grounds include origin, sex, nationality via "Nation", language), 225-2 4°
  (making a service conditional on a ground: 3 years, €45,000), 131-38 (company fine ×5),
  121-7 (complicity requires knowledge). Confirmed on the consolidated official text.
- Hosting: DSA art. 6 (no liability without knowledge, if removed promptly), 7 (voluntary
  good-faith checks keep the protection), 8 (no general monitoring duty), 16 (notice and action),
  17 (statement of reasons). Confirmed on the Official Journal text. Recital 22: own checks
  create knowledge — so a flagged text must be **held**, never "flagged and published".
- Défenseur des droits 2017-036 (a flatshare room is a "service"; platform escaped liability by
  prompt removal; recommended a discrimination report reason, keyword filtering, repeat-offender
  suspension, rules listing every ground) and 2022-249 (inaction after reports may itself be
  discrimination by the platform). Confirmed. Guide "Louer sans discriminer" (2025).
- **Gender mix:** a sex condition is presumptively unlawful; the 225-3 4° exception (privacy and
  decency, Directive 2004/113 recital 16) is narrow and not confirmed for flatshares; DdD 2023-211
  rejected "colocation de filles" as a pretext (read via the guide only). Confidence: medium-low.

Safeguards adopted for the Q&A: screen questions and answers before publishing (all 225-1
grounds, French and English); hold any hit for a human; block "who may apply" questions with a
fixed legal notice and do not forward them; a report link with a "Discrimination" reason;
a non-discrimination section in the rules; tell askers the question is published without their
name and must not contain personal details. Gender mix: not shown.

## 3. The furnished label

**Withholding the label based on the owner's own answers does not make Roomivo liable for the
listings that keep it (confidence: medium).** It is good-faith moderation (DSA art. 7, art. 3(t));
keeping "Furnished" while the owner's answers say an item is missing would be the riskier choice.
The real exposure is consumer law: Roomivo's badge and filter are its own commercial practice
(Code de la consommation L121-2, L121-3, L121-4), and a disclaimer only in the terms does not cure
a badge that implies a check (DGCCRF v Abritel, 2021, from a law-firm summary; outcome unknown).

- Décret 2015-981 art. 2, item 5: "Réfrigérateur et congélateur ou, au minimum, un réfrigérateur
  doté d'un compartiment permettant de disposer d'une température inférieure ou égale à -6 °C".
  Confirmed (JORFTEXT000030967884). Loi 89-462 art. 25-4 ("en nombre et en qualité suffisants"
  supports treating a broken item as missing), 25-6, 25-7, 25-8 confirmed. Cass. 3e civ. 16 Mar
  2017 n°16-12.229 confirmed. Requalification falls on the landlord.
- DSA art. 17 applies to restrictions and demotions, including small companies: the owner must be
  told the ground, the facts, that it was automated, and how to contest. Art. 14: the terms must
  describe the rule.

Applied in PR #90: labels match the decree (−6 °C compartment; curtains, blinds or shutters;
plates, glasses and cutlery); badge "Furnished · owner's statement"; filter "Furnished (as stated
by the owner)"; owner notice says the decision is automatic, cites the terms and says how to
contest; students see unanswered required items too; terms section 4 says the label reflects the
owner's answers, not an inspection, that the rule is automatic and can be contested.

## 4. Running from an Indian company

- The service is an "online platform" offering services in the Union (DSA art. 3). With no EU
  establishment it would need a legal representative (DSA art. 13) and a GDPR representative
  (art. 27; the "occasional processing" exemption does not fit identity checks with biometric
  data — EDPB Guidelines 3/2018). **But the founders run the service from France, which very
  likely makes France an establishment (EDPB 3/2018 p. 6; Weltimmo C-230/14), in which case
  neither representative applies; Arcom and the CNIL are competent either way** (confidence:
  medium). Collecting data directly from users is not a "transfer" to India (EDPB 05/2021).
- Gaps found and to fix (free): legal notice per LCEN art. 1-1 (publisher, postal address, phone,
  publication director, host's details; penalty up to €75,000); DSA art. 11–12 contact points;
  art. 16 notice-and-action form; privacy notice covering GDPR art. 13 (controller, legal bases,
  transfers, retention, right to complain to the CNIL).
- Choice for the founders: a French SAS/SASU (about €300 in fees, from non-official sources;
  removes both representative duties; gives the SIRET FranceConnect needs) or the Indian company
  plus one France-based representative (market offers from about $480 a year). First check that
  the founders' residence permits allow them to be company directors (not confirmed).

## Questions still worth a lawyer's time, when one is affordable

1. Whether verification plus lease generation plus any outcome-linked fee is *entremise*.
2. Whether a single-sex flatshare falls within Code pénal 225-3 4°.
3. Whether the founders' work from France is an EU establishment for the GDPR and the DSA.
4. Whether founders on student residence permits may be company directors.
