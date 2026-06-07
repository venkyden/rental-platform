# CLAUDE.md — Trust Layer Project Context

This file is the persistent memory for this project. Read it before every task.
The full PRD is in `PRD-TrustLayer-v2.md`. This file is the condensed working context.

---

## What this product is

A **stateless verification and document layer** for open rental classifieds (Leboncoin,
Facebook Marketplace, PAP). Users verify identity, solvency, and property, generate or
validate a lease, and e-sign — all without the platform ever brokering the deal.

We sell **verified facts that enable protection**, not protection itself.
Revenue: flat per-verification or subscription fee. Never success-based.

---

## What it is NOT — non-negotiable regulatory boundaries

Crossing any of these lines triggers a licensing regime and destroys the model.

| Never… | Because… |
|---|---|
| Search, match, or recommend counterparties | Loi Hoguet (entremise → carte pro) |
| Hold a mandate or act on a party's behalf | Loi Hoguet |
| Touch, hold, or gate funds | Hoguet maniement de fonds + payment services |
| Take a success fee on a signed lease | Hoguet intermediation criterion |
| Draft custom lease wording for parties | Loi 1971 (rédaction d'actes) |
| Sell / propose / earn commission on insurance | ORIAS + IDD |
| Guarantee rent payment | Unlicensed insurer/guarantor |
| Route or gate by nationality / immigration status | Code pénal 225-1/225-2 (discrimination) |
| Store identity/financial source documents at rest | GDPR liability surface |

---

## Architecture — verify → issue signed credential → forget

For every check: verify client-side or against a state service → emit a signed,
short-lived JSON credential → discard the source document. No PII at rest.

The credential states banded claims ("solvency ≥ 3.0", "identity: HIGH"), never raw data.
Assurance levels: HIGH (state-cryptographic) / MEDIUM (OCR+liveness) / UNVERIFIED.
**Never inflate a MEDIUM to HIGH.**

---

## Two rails — selected by documents held, not nationality

**FR rail:** identity today is OCR+liveness → **MEDIUM** (France Identité *justificatif*
was rejected for friction; `valider-attest` is a human portal, not an API). HIGH identity
is deferred to **FranceConnect** (OIDC), gated behind incorporation (SIRET + DataPass + 4
governance roles, décret du 8 nov. 2018). Solvency: avis d'imposition 2D-Doc (DGFiP-signed,
parse via betagouv/2ddoc-parser, `fr_2ddoc_parser` package) → offline ECDSA verify, banded
claim. The *avis* 2D-Doc name cross-check adds an anti-fraud flag but does NOT upgrade
identity to HIGH (no presenter binding).

**INTL rail:** Native-app passport NFC chip read (JMRTD / AndyQ NFCPassportReader,
BAC/PACE/Passive Auth) → HIGH. Web MRZ-OCR + liveness → MEDIUM. OSS liveness has
high false-accept rate — keep MEDIUM labelled MEDIUM, never upgrade it silently.

The FR/INTL split is self-selected by which documents the user holds. Same tiers for everyone.

---

## OSS stack per component

| Component | Tool | Notes |
|---|---|---|
| FR identity | France Identité state service (consumed, not built) | Free |
| FR solvency | **betagouv/2ddoc-parser** (Python) | Govt OSS; verifies ANTS ECDSA sig |
| Datamatrix decode | ZXing + pscott/poc-d-doc (browser) | Permissive |
| INTL identity HIGH | **JMRTD** (Android) + **AndyQ/NFCPassportReader** (iOS) | LGPL / MIT; needs CSCA master list |
| INTL identity MEDIUM | Tesseract (MRZ OCR) + DeepFace (face match) | See liveness caveat above |
| Property | ADEME DPE open-data API | Free; class A–G only (no H) |
| Lease generation | **pdf-lib** | MIT |
| Uploaded lease parse | Tesseract + rule-set | Apache |
| E-signature | **DocuSeal** or **Documenso** — unmodified, behind API | **AGPL** — do NOT fork; run unmodified or copyleft triggers |
| Insurance verify | Insurer API preferred; Tesseract fallback | |

### Key caveats
- **AGPL:** DocuSeal and Documenso are AGPL. Use them unmodified behind their embed/API.
  Do not fork. If you need to modify, pick a permissively-licensed alternative.
- **CSCA master list:** Passive Auth on passport chips requires issuing-country root certs.
  Assembling a complete, current list (via ICAO PKD) is the operational gap for INTL HIGH.
- **Liveness:** OSS anti-spoofing has a materially higher false-accept rate than commercial 3D.
  This is exactly why MEDIUM stays MEDIUM. Do not present OSS liveness as fraud-proof.

---

## Phase 1 scope — both sides verified (updated 2026-06-05)

**Each side vets the other and leaves with a watermarked evidence document.**
Directly targets the deposit-theft scam (fake landlord takes deposit, disappears).

Tenant side:
1. Identity via OCR+selfie → **MEDIUM** assurance; avis d'imposition 2D-Doc name cross-check adds anti-fraud flag. HIGH deferred to FranceConnect (post-incorporation).
2. Avis d'imposition 2D-Doc → betagouv/2ddoc-parser → verify ECDSA → banded solvency.

Landlord + property side:
3. Identity via OCR+selfie → **MEDIUM** (same rail as tenant). HIGH deferred to FranceConnect.
4. ADEME DPE class lookup + taxe foncière document check → "control, not
   ownership-attested" (no free ownership oracle at €0; disclose the limit).

Common:
5. Sign + emit a combined credential JSON with TTL, per side.
6. Watermarked, signed, timestamped, hash-anchored **evidence document** the user
   downloads (usable as proof in a deposit-theft dispute).
7. Anti-phishing trust layer: one canonical domain, verify-by-ID ("type the code on
   the site, don't trust the link"), published public key, and institutional
   endorsement (PÉPITE Pays de la Loire / SNEE / Ministère de l'Enseignement
   supérieur et de la Recherche) — logos subject to usage authorization.
8. Shareable link/QR per side.

Do NOT build lease, e-sign, or insurance yet (lease + e-sign also behind the legal gate).
Note: broader than the original cheapest-slice plan — accepted trade to deliver the
deposit-theft use case. Full rationale + edge cases: docs/features/trust-layer/DOSSIER.md.

---

## GTM / revenue approach

Lead B2B2C: pitch the verified-dossier API to a GLI insurer or property manager first.
They have quantifiable ROI (lower loss ratio) and a budget. One integration > thousands of
consumer micro-fees for a solo, zero-marketing-budget founder.
Consumer classified badge (Leboncoin "Vérifié") is phase 2.

---

## Legal gate — do NOT build past this

The lease-generation and e-sign modules have a genuine legal gray zone (loi 1971 / Hoguet
boundary on self-service contract generation). Get a French *droit immobilier* lawyer to
bless the framing before building or launching those modules. This is cheap and gating.
Reference: PRD §7.6.

---

## French law specifics (enforce these in code)

- Deposit: vide ≤ 1 month hors charges; meublé/étudiant ≤ 2 months; bail mobilité = 0.
- Furnished: all 11 items of Décret n°2015-981 required.
- DPE: class G blocked for new leases (loi Climat, since Jan 2025). Scale is A–G, no H.
- Always use live ADEME data — the Jan 2026 DPE coefficient reform reclassified ~850k units.
- Bail mobilité: no deposit, 1–10 months, specific eligible tenant categories.
- Lease model: Décret n°2015-587 only, no custom wording.
- Mandatory annexes: DPE, notice d'information, ERP (état des risques), diagnostics.
- Insurance: tenant MRH (risques locatifs) mandatory under loi 89 art. 7g.
- Solvency signal: present RFR as "fiscal capacity" not monthly income. Prefer payslips.

---

## Reference

Full PRD, user journeys, and per-process edge-case matrices: `PRD-TrustLayer-v2.md`
