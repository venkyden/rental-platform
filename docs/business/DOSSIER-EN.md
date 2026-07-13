# Roomivo — Pitch Dossier

> **Document for a jury / incubator** (PÉPITE Pays de la Loire, Audencia, French Tech).
> Founders: **Nallam Venkataramaya** & **C.A. Nishanth** — Student-Entrepreneurs (SNEE).
> Version 1.0 — June 2026.
>
> ⚠️ **Note on the numbers.** Roomivo is pre-seed (no registered company yet, no revenue).
> Every financial and market figure in this dossier is an explicitly labeled working
> assumption `[Assumption]`, with its source or calculation method (§16). They demonstrate
> the economic logic — they do not assert a reality.

---

## Table of Contents

1. Executive Summary
2. The Problem
3. Why Now
4. Traction & Financial Projections
5. Return on Investment (ROI)
6. Market & Key Figures
7. Positioning
8. Business Model — **two distinct revenue models**
9. R&D Budget
10. Operational Plan — 5 years
11. Team & Support Needs
12. Synthesis
13. Pricing — Roomivo Consumer (pay-per-use)
14. Pricing — Roomivo Pro (subscription)
15. Pricing — Credential Layer (Verification-as-a-Service)
16. Sources & References
17. Appendix — Proof of Execution (technical)

---

## 01 — Executive Summary

**Roomivo is the missing trust layer for open rental classifieds.**

On Leboncoin, Facebook Marketplace or PAP, tenants and landlords deal directly, with no
trusted third party. The result: **deposit theft** (a fake landlord collects a deposit
then vanishes), **forged dossiers** (faked tax notices and payslips) and **ghost listings**
all thrive. The platform protects no one — that isn't its job.

Roomivo issues a **signed, short-lived, portable proof** that each party is real and
solvent — **without ever brokering the deal, touching funds, or storing documents**. We
verify, emit a cryptographic attestation, and discard the source. We sell **verified facts**,
never protection.

**The lead motion (B2B): dossier-fraud detection.** The sharpest, most defensible
capability is verifying the **DGFiP cryptographic signature on a tax notice (2D-Doc)** —
a forged *avis d'imposition* is caught because the state's own signature won't validate.
This is what we sell first, to **GLI insurers and property managers**: quantifiable ROI
(lower loss ratio), a budget, and — critically — it verifies a *document signature*, not a
person, so it sidesteps the ANSSI-PVID certification wall that blocks OSS identity
verification. One integration outweighs thousands of consumer micro-fees for a zero-
marketing-budget team.

**The consumer marketplace is the working demo, not the revenue wedge.** Roomivo's own
rental marketplace runs the verification engine end-to-end on real users — it is the live
proof-of-concept shown to insurers ("here is the fraud-check working, plug it into your
underwriting"), and the acquisition/credibility surface. It is deliberately **not** the
primary revenue bet: the two-sided consumer flow needs the landlord — who holds all the
leverage in a tight market — to verify himself, which he won't.

**Two revenue models, one verification engine:**
- **B. Credential Layer (Verification-as-a-Service) — LEAD.** The engine exposed via API/badge
  to **GLI insurers, property managers**, and third-party platforms (Leboncoin, Facebook
  Marketplace, PAP). This is the margin engine and the Phase-1 revenue focus.
- **A. Roomivo (native)** — the marketplace product (pay-per-use + Pro): acquisition, demo,
  and proof of value; a supporting motion, not the wedge.

**Key figures `[Assumption]`:** French private rental market ≈ 7M households; marginal cost
per verification ≈ €0 at scale (free state services + open-source); target gross margin
> 85% on the Credential Layer.

**The ask:** **€30–50k seed + support** (mentorship, a B2B introduction to a pilot GLI
insurer / property manager, hosting, and real-estate-law counsel to clear the lease/e-sign
"legal gate").

---

## 02 — The Problem

Online rental classifieds are a **peer-to-peer market with no trusted third party**. Both
sides face each other with no reliable way to verify one another.

**Taxonomy of scams Roomivo neutralizes:**

| Scam | Mechanic | Victim | Roomivo's answer |
|---|---|---|---|
| **Deposit theft** | Fake landlord (often a ghost listing) collects the deposit, disappears | Tenant | Landlord identity + property control → proof before any payment |
| **Forged tenant dossier** | Faked tax notice / payslips | Landlord | Read the **signed payload** of the 2D-Doc (DGFiP) → tampering with printed text becomes moot |
| **Ghost listing** | Property that doesn't exist / isn't the lister's | Tenant | Taxe foncière check + ADEME DPE → "control, not ownership-attested" (limit disclosed) |
| **Identity fraud** | Borrowed / stolen ID | Both | Phase 1: OCR + liveness → **MEDIUM, labeled as such**; HIGH via FranceConnect (state OIDC) after incorporation — assurance is never inflated |
| **Phishing** | Fake "verification" link sent in chat | Both | *Verify-by-ID*: "don't trust the link — type the code on roomivo.app" |

**Why the market won't self-correct:** the classifieds platform can't become the trusted
third party without entering a regulated regime (Loi Hoguet professional card). Existing
tools (DossierFacile on the tenant side, GLI on the landlord side) cover **only one side**
and produce no **portable, two-sided** proof usable outside their silo.

---

## 03 — Why Now

Several unlocks converge in 2025–2026:

- **State identity rails are opening.** France Identité's MoI-signed *justificatif* exists
  but was assessed and **rejected for v1** (its verification portal is human-facing, not an
  API, and the user friction is prohibitive). The real unlock is **FranceConnect** (state
  OIDC): a free **HIGH-assurance identity**, gated behind incorporation (SIRET + DataPass).
  Phase 1 ships **MEDIUM** (OCR + liveness), labeled as such — never inflated.
- **2D-Doc tax notice (DGFiP):** the ECDSA-signed payload is readable and verifiable via the
  state's open-source `betagouv/2ddoc-parser`. State-signed solvency data becomes free. The
  signature proves the **document**, not the presenter: a name cross-check adds an anti-fraud
  flag, and attribution to the person in front of you is capped by the identity tier
  (MEDIUM until FranceConnect).
- **DPE reform (Climat law, since 2025; coefficient recalibration Jan 2026):** energy class
  now gates lettability (class G blocked). Open ADEME data makes property control possible
  at zero cost.
- **DossierFacile** (public service) normalized the idea of a **verified rental dossier** —
  millions of dossiers created `[Assumption — to confirm]`. Behavior has already shifted;
  what's missing is the **portable, two-sided proof**.
- **Rising listing fraud:** media coverage of housing scams creates a demand for trust that
  no one addresses on the open-classifieds side.
- **A closing window, honestly stated:** eIDAS 2.0 / the EUDI Wallet (2026–27 rollout) will
  eventually let the state itself assemble these bricks into portable attestations. The moat
  is a **2–3-year execution window** — the strongest argument for moving now, not waiting.

**In short:** over the last two years the state has freely opened every cryptographic brick
needed. Roomivo is the first to **assemble them into a portable, two-sided anti-scam proof**.

---

## 04 — Traction & Financial Projections

> **Real status:** pre-seed; the full technical dossier is written and the backend is
> implemented (FastAPI, 300+ automated tests), pre-production (see §17). No public launch,
> no revenue. The projections below are an **assumption model** meant to show the economic
> mechanics.

**Core assumptions `[Assumption]`:**
- Marginal cost per verification ≈ **€0** (free state services + self-hosted OSS).
- Average Roomivo price (pay-per-use, mix of identity/dossier/pack) ≈ **€6.90**.
- Average Credential Layer price (API, volume-tiered) ≈ **€1.20** / verification.
- B2B sales cycle (Credential Layer): **6–9 months** per pilot contract.
- **Incorporation is on the Y1 critical path** `[Assumption — targeted mid-Y1]`: a SIRET
  unlocks contract capacity (no B2B revenue can be signed without it) and the
  DataPass/FranceConnect application (HIGH identity). Until then: MEDIUM-only identity,
  pilots as letters of intent only.

**Base-case projection `[Assumption]` (5 years):**

| Year | Roomivo verifs (native) | Roomivo rev. | Credential Layer clients | API verifs | Credential Layer rev. | **Total rev.** |
|---|---|---|---|---|---|---|
| Y1 | 2,000 | ~€14k | 1 pilot | 5,000 | ~€6k | **~€20k** |
| Y2 | 15,000 | ~€100k | 2–3 | 50,000 | ~€60k | **~€160k** |
| Y3 | 50,000 | ~€340k | 4–5 | 200,000 | ~€240k | **~€580k** |
| Y4 | 120,000 | ~€830k | 6–8 | 450,000 | ~€540k | **~€1.37M** |
| Y5 | 220,000 | ~€1.5M | 10+ | 900,000 | ~€1.1M | **~€2.6M** |

**Reading:** the native **Roomivo** product drives acquisition and proof of value; the
**Credential Layer** drives scale and margin (one insurer/property-manager contract >
thousands of micro-payments). Deliberately conservative for a zero-marketing-budget team —
growth comes from **B2B2C integrations**, not advertising.

---

## 05 — Return on Investment (ROI)

For a jury / incubator, ROI reads on **three levels**:

**1. Capital efficiency.** The tech stack is **100% open-source + free state services**:
marginal cost per verification is near zero **at scale**. The honest COGS of a verification
business at low volume is human review of OCR failures, fraud disputes, and support — the
projections absorb this in Y1–Y2. Every euro of seed funds **R&D and B2B introductions**,
not licenses. Target gross margin > **85%** on the Credential Layer `[Assumption — at scale]`.

**2. Societal ROI.** Each prevented deposit scam saves a victim
**~€700 `[Assumption — one month's average rent]`** and unburdens police/courts. At Y5 scale,
the modeled verification volume represents a meaningful volume of fraud potentially averted.
**A strong argument for public funding** (measurable impact, public-interest alignment).

**3. ROI on the support itself.** With **€30–50k + support**, the leverage is: a single
successful B2B introduction (GLI insurer / property manager) triggers the **Credential
Layer**, whose unit economics (> 85% margin) repay the seed in a handful of contracts. The
money doesn't burn on acquisition — it **clears two gates**: the legal gate (real-estate
counsel) and the commercial gate (first reference customer).

---

## 06 — Market & Key Figures

> All orders of magnitude below are `[Assumption]`, to be confirmed against the sources in §16.

- **Tenants in France:** ~**40%** of households rent (INSEE). Private rental park ≈ **7M
  households** `[Assumption]`.
- **Annual flow:** several million **moves / new leases** per year in the private sector
  `[Assumption]`. Each new lease = an opportunity for two-sided verification.
- **Online listings:** Leboncoin is the #1 peer-to-peer rental channel in France; very high
  listing volume `[Assumption]`.
- **Housing fraud:** thousands of rental-scam victims/year (fake landlords, fake listings),
  average amount lost ≈ one month's rent `[Assumption — sources: Signal Arnaques, DGCCRF,
  cybermalveillance.gouv.fr]`.
- **GLI / unpaid-rent market:** insurers want to **lower their loss ratio** via better
  underwriting data — the natural buyer of the Credential Layer.

**Addressable market (logic):** SAM = verifications tied to new private-sector leases + GLI
underwriting dossiers. The Credential Layer turns a **diffuse B2C TAM** into **concentrated
B2B contracts**.

---

## 07 — Positioning

| Player | Covers | Limit | Roomivo's place |
|---|---|---|---|
| **DossierFacile** (state) | Verified **tenant** dossier | One side only; no portable two-sided proof; no property control | Roomivo verifies **both sides** + produces a **portable signed proof** |
| **GLI insurers** | Unpaid-rent guarantee (landlord side) | Sell protection, not verification; ORIAS/IDD regime | Roomivo **supplies their underwriting data** (≠ selling insurance) |
| **Real-estate agencies** | Full intermediation | Pro card (Loi Hoguet), expensive | Roomivo is a **tool**, not an intermediary — never brokers |
| **Platform "verified" badges** | In-silo signal | Not portable, not cryptographic | Roomivo = proof **portable and verifiable outside the silo** |

**Roomivo's unique slot:** *stateless* (no PII at rest), **portable** (verifiable with no
account, against a public key), **two-sided**, **anti-scam first**, and decidedly
**non-intermediary**. That last point keeps us out of any regulated regime — and it's a
**defensible advantage**, not a constraint.

---

## 08 — Business Model: two revenue models, one lead

Golden rule, non-negotiable: **flat / per-verification revenue, never success-based**. Funds
never flow through Roomivo. Insurance is **verified**, never sold (no ORIAS).

### Model B — Credential Layer (Verification-as-a-Service) — **THE LEAD**
The verification engine exposed via **API / badge** to **GLI insurers** and **property
managers** first, then third-party platforms (Leboncoin, Facebook Marketplace, PAP).
Headlined by **2D-Doc dossier-fraud detection** — verifying the DGFiP signature on a tax
notice, which (a) has quantifiable buyer ROI (lower loss ratio), (b) is sold to a party
with a budget, and (c) verifies a *document signature*, not a person, so it clears the
ANSSI-PVID certification wall that blocks OSS identity verification.
- **Usage-based API**, **volume-tiered** pricing (see §15).
- **Integration fee / annual license** depending on the client.
- **Post-incident evidence pack:** the signed audit trail sold to the injured party for
  their legal/insurance claim.
- Economics: **> 85% margin** at scale, concentrated contracts. **This is the margin engine
  and the Phase-1 revenue focus.**

### Model A — Roomivo (native marketplace) — supporting motion
Revenue from **our own users**, on **our** product — but positioned as acquisition, demo,
and the live proof-of-concept behind the B2B pitch, **not** the primary revenue bet.
- **Pay-per-use** (consumers): micro-fee per verification + watermarked evidence document.
- **Pro subscription** (recurring landlords, small agencies): monthly plan.
- Reality check: the two-sided consumer flow needs the landlord — who holds the leverage in
  a tight market — to verify himself, which he won't. Hence it supports, not leads.

> Why lead B2B: the buyer has budget and quantifiable ROI, the 2D-Doc check is PVID-proof,
> and it depends on **no** unsettled question (identity rail, incorporation geography) — it
> verifies a document, not a person. The marketplace makes the demo credible; the Credential
> Layer makes the money.

---

## 09 — R&D Budget

Use of the **€30–50k** seed (`[Assumption]`, base case €40k):

| Item | Amount | Rationale |
|---|---|---|
| **Legal counsel — real-estate law** | €3–5k | Clear the *legal gate* (self-service lease / e-sign positioning vs loi 1971 / Hoguet). **Blocking and cheap.** |
| **GDPR / DPO review** | €2–3k | Confirm lawful basis + non-retention proof (transient processing); Art. 9 basis + DPIA for the face-match step. |
| **Incorporation** | €1–2k | Company formation → B2B contract capacity. Structure: **Roomivo Technologies Pvt. Ltd. (India)** now; **EU entity added later** (jurisdiction TBD — France's only unique edge here is FranceConnect access, which requires a French SIRET; a non-France EU base reaches HIGH identity via the eIDAS 2.0 / EU wallet instead). **On the Y1 critical path for B2B.** |
| **Infrastructure & security** | €2–4k/yr | Hosting, signing infra (Ed25519), security audit. Marginal cost per verif ≈ €0. |
| **R&D Credential core + FR rails** | (founder time) | Credential model, OCR+liveness (MEDIUM), FranceConnect (post-incorporation), 2D-Doc, ADEME property control. |
| **R&D INTL HIGH rail (Phase 2)** | to provision | Passport NFC read (JMRTD / NFCPassportReader); **operational gap: CSCA master list via ICAO PKD**. |
| **Founder seed / stipend** | balance | Enable full-time work through the critical phase. |

**CIR/CII eligibility:** the credential R&D (proof cryptography, state-signature
verification, normalization) may qualify for the French Research / Innovation tax credit
`[Assumption — to validate with an accountant]`.

---

## 10 — Operational Plan — 5 years

**Phase 1 (Y1) — lead: B2B 2D-Doc dossier-fraud detection; marketplace as demo.** *(see §17)*
1. **2D-Doc solvency / fraud-detection API** (DGFiP-signed tax notice → offline ECDSA verify
   → banded ratio `>=3.0`): the sellable B2B asset, PVID-proof, depends on no identity rail.
   Productize behind the API + land the first insurer / property-manager pilot.
2. **Credential core:** model, Ed25519 signing, issue/verify endpoints, public key,
   watermarked evidence-document export — the engine both motions share.
3. **Marketplace as live demo:** run the engine end-to-end on real users (identity via
   OCR + liveness → **MEDIUM, labeled**; property control via ADEME DPE + taxe foncière) —
   the credibility surface shown to insurers, not the revenue wedge.
4. Anti-phishing *verify-by-ID* page + institutional endorsement.

> Cross-cutting Y1 milestone: **incorporation.** India Pvt Ltd (in progress) gives B2B
> contract capacity now; the **EU entity (added just-in-time before the first live pilot that
> processes EU data)** gates HIGH identity and the EU-user GDPR posture. HIGH identity rail =
> FranceConnect *if* the EU entity is French, else the eIDAS 2.0 / EU wallet — decided with
> the EU-country choice.

**Phase 2+ (Y2–3) — behind the legal gate for lease/e-sign:**
7. DPE depth (class-G block, zone tendue, live reform handling).
8. Uploaded-lease compliance scan (VALIDATED vs ATTACHED). ⚠ gate.
9. **E-signature + evidence pack** (DocuSeal / Documenso **unmodified** — AGPL). ⚠ gate.
10. MRH insurance attestation verification.
11. **INTL rails** (native NFC HIGH; web MRZ-OCR MEDIUM; FX normalization). Blocked on CSCA.

**Y3–5 — Credential Layer scale-up:** ramp platform/insurer contracts; retrofit legacy flows
to stateless verify-and-forget.

---

## 11 — Team & Support Needs

**Founding team (2):**
- **Nallam Venkataramaya** — Co-founder, Student-Entrepreneur (SNEE).
- **C.A. Nishanth** — Co-founder, Student-Entrepreneur (SNEE).

Status: **Student-Entrepreneurs** under **SNEE**, supported by **PÉPITE Pays de la Loire**
(Audencia). *Statuses may be stated; use of the official Ministry / PÉPITE logos requires
prior authorization — to confirm before any display.*

**Support needs (beyond funding):**

| Need | Why | What it unlocks |
|---|---|---|
| **Mentor / real-estate lawyer** | Clear the lease/e-sign legal gate (loi 1971 / Hoguet) | Opens Phase 2 (lease, e-sign) |
| **B2B intro:** a pilot GLI insurer or property manager | First Credential Layer reference customer | Activates the **margin model** |
| **ICAO PKD / CSCA list access** | Passive authentication of passport chips (INTL HIGH) | Unblocks the international rail |
| **Hosting / cloud credits** | Signing and verification infra | Reduces burn |
| **Institutional credibility** | Turn "is this a scam?" into "it's state-backed" | Drives adoption on classifieds |

---

## 12 — Synthesis

Roomivo gives open rental classifieds the **trust layer** they lack: a **signed, portable,
two-sided proof** that neutralizes deposit theft — **with no intermediation, no fund
handling, no document storage**.

Two distinct revenue models on one engine: **Roomivo** (native product, acquisition + proof
of value) and the **Credential Layer** (Verification-as-a-Service for third-party platforms
and insurers — the margin engine). A 100% open-source + state-services stack → near-zero
marginal cost, target gross margin > 85%.

**The ask: €30–50k seed + support** (legal mentorship, first B2B introduction, hosting). The
money clears two gates — legal and commercial — after which unit economics do the rest.

---

## 13 — Pricing: Roomivo Consumer (pay-per-use) — *Model A*

> All prices `[Assumption]`, incl. tax, to validate via market test.

| Offer | Contents | Indicative price |
|---|---|---|
| **Identity only** | Identity verification (MEDIUM today, labeled; HIGH via FranceConnect post-incorporation) + signed attestation | **€2.90** |
| **Verified dossier** | Identity + banded solvency + watermarked evidence document | **€6.90** |
| **Two-sided pack (anti-deposit)** | Both-sided verification + property control + dispute-grade evidence document | **€9.90** |

Marginal cost ≈ €0 at scale (support and manual review dominate at low volume) → high
margin. No success fee, ever.

---

## 14 — Pricing: Roomivo Pro (subscription) — *Model A*

> For recurring landlords and small agencies. Prices `[Assumption]`, excl. tax / month.

| Tier | Included / month | Proof-request links | Price |
|---|---|---|---|
| **Starter** | 10 verifications | unlimited | **€19/month** |
| **Pro** | 40 verifications | unlimited | **€49/month** |
| **Overage** | — | — | **€1.90 / verification** |

Monthly commitment without aggressive auto-renewal. Stays **flat**, never indexed to a
signed lease.

---

## 15 — Pricing: Credential Layer (Verification-as-a-Service) — *Model B*

> For **third-party platforms and their users** (Leboncoin, FB Marketplace, PAP), **GLI
> insurers**, **property managers**. Prices `[Assumption]`, excl. tax.

**Usage-based API — volume-tiered:**

| Monthly volume | Price / verification |
|---|---|
| 0 – 1,000 | **€2.00** |
| 1,000 – 10,000 | **€1.20** |
| 10,000 – 50,000 | **€0.80** |
| 50,000+ | **€0.60** (on quote) |

**Options:**
- **Integration fee** (one-off): **€1,500 – €5,000** depending on complexity.
- **Annual license / "Verified" badge:** on quote (classifieds platform).
- **Post-incident evidence pack:** **€9.90 – €19** per signed audit attestation (injured party).

Target gross margin > **85%**. **The margin engine:** one platform/insurer contract replaces
thousands of B2C micro-payments.

---

## 16 — Sources & References

> Every `[Assumption]`-labeled value above must be confirmed against the following sources
> before any official external use.

**Market & fraud:**
- INSEE — share of renting households, rental-park structure.
- DGCCRF, Signal Arnaques, cybermalveillance.gouv.fr — rental fraud.
- DossierFacile (public service) — verified-dossier volume.

**Technical bricks (free / open-source):**
- **FranceConnect** (state OIDC, via DataPass — post-incorporation): the HIGH identity rail.
  France Identité's `valider-attest` justificatif was assessed and rejected for v1 (human
  verification portal, not an API).
- **betagouv/2ddoc-parser** — read & verify ECDSA of the 2D-Doc tax notice.
- **ADEME** — DPE open-data API (class A–G, no H; coefficient reform Jan 2026).
- **JMRTD** (Android, LGPL) / **AndyQ/NFCPassportReader** (iOS, MIT) — passport chip read.
- **pdf-lib** (MIT) — document generation. **DocuSeal / Documenso** (AGPL — unmodified).

**Legal framework (enforced in the product):**
- Loi Hoguet (brokering, mandate, fund handling); Loi of 31 Dec 1971 (drafting deeds);
  ORIAS + IDD (insurance); Penal Code art. 225-1/2 (non-discrimination); Climat law / DPE;
  loi 89-462 (leases); Décrets 2015-587 and 2015-981.

**Status & endorsement:**
- SNEE (National Student-Entrepreneur Status), PÉPITE Pays de la Loire, Audencia, French
  Ministry of Higher Education and Research.
  ⚠ **Statuses may be stated; official logos require usage authorization.**

---

## 17 — Appendix — Proof of Execution (technical)

> Roomivo is not an idea on a slide: the **full technical dossier** is written
> (`docs/features/trust-layer/DOSSIER.md`), with architecture, an edge-case test matrix, and
> a phasing plan. Extracts:

**The credential (core output) — example:**
```json
{
  "credential_id": "vc_8f3a...",
  "subject_role": "tenant",
  "issued_at": "2026-06-03T10:00:00Z",
  "expires_at": "2026-07-03T10:00:00Z",
  "rail": "FR",
  "claims": {
    "identity_verified": true,
    "identity_assurance": "MEDIUM",
    "identity_source": "ocr_liveness",
    "solvency_ratio": ">=3.0",
    "solvency_assurance": "HIGH",
    "solvency_presenter_binding": "name_crosscheck_flag"
  },
  "disclaimer": "Certifies verification of the stated facts only. Does not warrant future conduct or good faith.",
  "signature": "..."
}
```

**Design principles (non-negotiable):** bands, not raw figures; assurance **labeled, never
inflated** (a MEDIUM is never shown as HIGH); recipient-scoping where the source supports it;
short TTL + revocation; no PII at rest.

**The two rails (selected by documents held, never by nationality):**

| Step | FR rail | INTL rail |
|---|---|---|
| Identity | OCR+liveness (MEDIUM, today) → FranceConnect (HIGH, post-incorporation) | Passport NFC chip (HIGH) → web MRZ-OCR (MEDIUM) |
| Solvency | 2D-Doc tax notice (document authenticity HIGH; presenter via name cross-check) | Foreign docs (MEDIUM) + FX normalization |
| Property | ADEME DPE + taxe foncière control | same |

**Legal boundaries enforced in code** (never: brokering, mandate, fund handling, success
fee, custom lease drafting, selling insurance, guaranteeing rent, nationality gating, storing
PII without need).

**Anti-phishing model:** one official domain; *verify-by-ID* ("type the code yourself");
published public key; institutional endorsement on the landing/verify pages.
