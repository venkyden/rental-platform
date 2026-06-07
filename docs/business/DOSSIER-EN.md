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

**The wedge:** deposit-theft prevention. Each side vets the other and walks away with a
**watermarked, timestamped, signed evidence document**, usable in a dispute.

**Two distinct revenue models, one verification engine:**
- **A. Roomivo (native)** — our own product, sold to our own users (pay-per-use + Pro subscription).
- **B. Credential Layer (Verification-as-a-Service)** — the same engine exposed via API/badge
  to **third-party platforms and their users** (Leboncoin, Facebook Marketplace, PAP), plus
  GLI insurers and property managers.

**Key figures `[Assumption]`:** French private rental market ≈ 7M households; marginal cost
per verification ≈ €0 (free state services + open-source); target gross margin > 85% on the
Credential Layer.

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
| **Identity fraud** | Borrowed / stolen ID | Both | State identity (France Identité, MoI-signed) → HIGH assurance |
| **Phishing** | Fake "verification" link sent in chat | Both | *Verify-by-ID*: "don't trust the link — type the code on roomivo.app" |

**Why the market won't self-correct:** the classifieds platform can't become the trusted
third party without entering a regulated regime (Loi Hoguet professional card). Existing
tools (DossierFacile on the tenant side, GLI on the landlord side) cover **only one side**
and produce no **portable, two-sided** proof usable outside their silo.

---

## 03 — Why Now

Several unlocks converge in 2025–2026:

- **France Identité** is now a live state service: an MoI-signed *justificatif*, verifiable
  online and naming its recipient. This makes a **HIGH-assurance identity free**, with no
  selfie or liveness.
- **2D-Doc tax notice (DGFiP):** the ECDSA-signed payload is readable and verifiable via the
  state's open-source `betagouv/2ddoc-parser`. HIGH-assurance solvency becomes free.
- **DPE reform (Climat law, since 2025; coefficient recalibration Jan 2026):** energy class
  now gates lettability (class G blocked). Open ADEME data makes property control possible
  at zero cost.
- **DossierFacile** (public service) normalized the idea of a **verified rental dossier** —
  millions of dossiers created `[Assumption — to confirm]`. Behavior has already shifted;
  what's missing is the **portable, two-sided proof**.
- **Rising listing fraud:** media coverage of housing scams creates a demand for trust that
  no one addresses on the open-classifieds side.

**In short:** over the last two years the state has freely opened every cryptographic brick
needed. Roomivo is the first to **assemble them into a portable, two-sided anti-scam proof**.

---

## 04 — Traction & Financial Projections

> **Real status:** pre-seed; the full technical dossier is written; no production code is
> deployed yet (see §17). No revenue. The projections below are an **assumption model**
> meant to show the economic mechanics.

**Core assumptions `[Assumption]`:**
- Marginal cost per verification ≈ **€0** (free state services + self-hosted OSS).
- Average Roomivo price (pay-per-use, mix of identity/dossier/pack) ≈ **€6.90**.
- Average Credential Layer price (API, volume-tiered) ≈ **€1.20** / verification.
- B2B sales cycle (Credential Layer): **6–9 months** per pilot contract.

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
marginal cost per verification is near zero. Every euro of seed funds **R&D and B2B
introductions**, not COGS. Target gross margin > **85%** on the Credential Layer `[Assumption]`.

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

## 08 — Business Model: two distinct revenue models

Golden rule, non-negotiable: **flat / per-verification revenue, never success-based**. Funds
never flow through Roomivo. Insurance is **verified**, never sold (no ORIAS).

### Model A — Roomivo (native / exclusive)
Revenue from **our own users**, on **our** product.
- **Pay-per-use** (consumers): micro-fee per verification + watermarked evidence document.
- **Pro subscription** (recurring landlords, small agencies): monthly plan including a
  volume of verifications + proof-request links.
- Economics: higher ARPU, strong gross margin, but diffuse (B2C) acquisition.

### Model B — Credential Layer (Verification-as-a-Service)
The **same engine**, exposed via **API / badge** to **third-party platforms and their
users**: Leboncoin, Facebook Marketplace, PAP — plus **GLI insurers** and **property
managers**.
- **Usage-based API**, **volume-tiered** pricing (see §15).
- **Integration fee / annual license** depending on the client.
- **Post-incident evidence pack:** the signed audit trail sold to the injured party for
  their legal/insurance claim.
- Economics: **> 85% margin**, concentrated contracts, scale effects. **This is the margin
  engine.**

> Why two **distinct** models, not one: different customers (our users vs. third-party
> platforms), different unit economics (high/diffuse ARPU vs. low-price/volume), and
> different sales cycles (self-service vs. 6–9-month B2B). Presenting them separately
> clarifies the strategy and the valuation.

---

## 09 — R&D Budget

Use of the **€30–50k** seed (`[Assumption]`, base case €40k):

| Item | Amount | Rationale |
|---|---|---|
| **Legal counsel — real-estate law** | €3–5k | Clear the *legal gate* (self-service lease / e-sign positioning vs loi 1971 / Hoguet). **Blocking and cheap.** |
| **GDPR / DPO review** | €2–3k | Confirm lawful basis + non-retention proof (transient processing). |
| **Infrastructure & security** | €2–4k/yr | Hosting, signing infra (Ed25519), security audit. Marginal cost per verif ≈ €0. |
| **R&D Credential core + FR rails** | (founder time) | Credential model, France Identité, 2D-Doc, ADEME property control. |
| **R&D INTL HIGH rail (Phase 2)** | to provision | Passport NFC read (JMRTD / NFCPassportReader); **operational gap: CSCA master list via ICAO PKD**. |
| **Founder seed / stipend** | balance | Enable full-time work through the critical phase. |

**CIR/CII eligibility:** the credential R&D (proof cryptography, state-signature
verification, normalization) may qualify for the French Research / Innovation tax credit
`[Assumption — to validate with an accountant]`.

---

## 10 — Operational Plan — 5 years

**Phase 1 (Y1) — two-sided proof + evidence document.** *(Scope frozen, see §17)*
1. Remove the GLI module (ORIAS/IDD regulatory contradiction) — done before building.
2. **Credential core:** model, Ed25519 signing, issue/verify endpoints, public key,
   watermarked evidence-document export.
3. **FR HIGH identity rail** (France Identité) — serves both tenant *and* landlord.
4. **FR HIGH solvency rail** (2D-Doc tax notice → banded ratio `>=3.0`).
5. **Property control** (ADEME DPE + taxe foncière) — the anti-deposit-theft lever.
6. **Two-sided wiring** + anti-phishing *verify-by-ID* page + institutional endorsement.

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
| **Identity only** | Identity verification (FR HIGH or labeled MEDIUM) + signed attestation | **€2.90** |
| **Verified dossier** | Identity + banded solvency + watermarked evidence document | **€6.90** |
| **Two-sided pack (anti-deposit)** | Both-sided verification + property control + dispute-grade evidence document | **€9.90** |

Marginal cost ≈ €0 → near-full margin. No success fee, ever.

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
- **France Identité** — `idp.france-identite.gouv.fr/valider-attest` (MoI-signed justificatif).
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
    "identity_assurance": "HIGH",
    "identity_source": "france_identite_justificatif",
    "solvency_ratio": ">=3.0",
    "solvency_assurance": "HIGH"
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
| Identity | France Identité (HIGH) → OCR+liveness (MEDIUM) | Passport NFC chip (HIGH) → web MRZ-OCR (MEDIUM) |
| Solvency | 2D-Doc tax notice (HIGH) | Foreign docs (MEDIUM) + FX normalization |
| Property | ADEME DPE + taxe foncière control | same |

**Legal boundaries enforced in code** (never: brokering, mandate, fund handling, success
fee, custom lease drafting, selling insurance, guaranteeing rent, nationality gating, storing
PII without need).

**Anti-phishing model:** one official domain; *verify-by-ID* ("type the code yourself");
published public key; institutional endorsement on the landing/verify pages.
