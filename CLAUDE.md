# CLAUDE.md — Roomivo Project Context

This file is the persistent memory for this project. Read it before every task.
The full PRD is in `PRD-TrustLayer-v2.md`. This file is the condensed working context.

---

## What this product is (positioning settled 2026-07-04)

**One product, two faces, one verification engine:**

1. **Rental marketplace** — landlords publish, tenants search and apply. Roomivo is a
   **passive publisher** (Leboncoin's legal basis): it never matches, recommends, or
   brokers counterparties. Counterparty matching was removed 2026-07-04 (PR #29);
   `matching_service.py` is DISABLED and no router may import it without a lawyer
   opinion blessing a *support publicitaire* framing.
2. **Trust layer** — a **stateless verification and document layer**, used internally
   (verified profiles/listings on the marketplace) and externally (portable signed
   credentials for users of Leboncoin, Facebook Marketplace, PAP). Verify identity,
   solvency, property → issue a signed, short-lived credential → discard the source.

The trust layer is NOT a separate entity or product — it is Roomivo's core.

We sell **verified facts that enable protection**, not protection itself.
Revenue: flat per-verification or subscription fee. Never success-based.
Status: **incorporating in India** (registration in progress, started 2026-07-05; entity
name not final — do NOT publish it until registration lands);
**EU entity added later, just-in-time before the first live pilot processing EU data**
(country TBD — France's only unique edge is FranceConnect, which needs a French SIRET; a
non-France EU base reaches HIGH identity via eIDAS 2.0 / EU wallet instead). Founders remain
SNEE student-entrepreneurs (PÉPITE Pays de la Loire / Audencia) personally. Free beta until
charging is live. NB: this supersedes the earlier "French SAS" assumption; GDPR needs an EU
Art. 27 representative + India-transfer SCCs. See memory [[roomivo-incorporation-india]].

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

**Anything shareable renders the credential, never the documents behind it** (set
2026-07-20, DOSSIER §0.20). The trust dossier / shared PDF / verify page may show
banded claims, the assurance summary, the "does not prove" disclosure and the
signature — it must never embed, append or re-download an identity document, avis,
payslip, bank statement or guarantor file, even watermarked. A shared artefact is
the least recallable place PII can land. If a rendered artefact is cached at rest,
it inherits the credential's TTL, is revoked with it, and is wired into `gdpr.py`
erasure in the same change.

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

**Status 2026-07-04: Phase 1 shipped** (2026-06-13) plus, since then: statelessness
retrofit (verify-and-forget, Redis 10-min TTL), MRH insurance verification, INTL
MEDIUM rails (identity + funds-coverage solvency — backend only, UI pending),
**e-sign Path B live** (upload + legality screen + in-house Ed25519 signature).
**Path A (Décret 2015-587 generation) is NOT shipped**: PR #23 merged the official
model *assets* + registry and a v0.1 filler (`lease_generation.py`), but that path is
**gated** pending verbatim counsel sign-off and no router calls it. What IS live is the
**legacy free-form generator** (`lease_generator.py`, `POST /leases/generate`), which
uses custom templates and never runs the `lease_rules` legality gate. It now refuses any
type without a verbatim Décret model **wired** in `lease_models/registry.py`
(`supported_types()` is the oracle → vide/meublé/étudiant). **Only `meuble` generates
today.** Why each is refused differs — don't conflate them:
- `vide`/`etudiant`/`colocation` — an official model EXISTS (the annexes are titled
  "CONTRAT TYPE DE LOCATION **OU DE COLOCATION**…", so colocation is covered too) but
  isn't wired to this generator yet → Path A work.
- `mobilite` — no décret contrat-type; art. 25-13 mandatory mentions unimplemented.
- `code_civil` (outside loi 89) / `simple` — no published contrat-type at all.

Open work: wire Path A (verbatim model + counsel-verified transcription). Two known
gaps: (1) `meuble` still renders CUSTOM wording despite its official model existing, and
the PDF stamps "conforme … au décret 2015-587"; (2) the model assets omit the published
preamble (official title, "Champ du contrat type", "Modalités d'application") — found
2026-07-13, so they are NOT yet a complete reproduction; they stay PENDING SIGN-OFF.
Insurance remains verification-only, never sold. Next build order: see the feature
audit program in `docs/superpowers/plans/2026-07-02-stress-test-remediation-master.md`
(INTL solvency UI tab is the chosen next feature).
Full rationale + edge cases: docs/features/trust-layer/DOSSIER.md.

---

## GTM / revenue approach — DG-1 SETTLED (2026-07-05)

**Lead B2B with 2D-Doc dossier-fraud detection.** Pitch and first revenue lead with the
Credential Layer sold to GLI insurers / property managers, headlined by verifying the DGFiP
signature on a tax notice: quantifiable buyer ROI (lower loss ratio), a budget, PVID-proof
(it verifies a document signature, not a person), and dependent on **no** unsettled question
(identity rail, incorporation geography). One integration > thousands of consumer micro-fees.

**The consumer marketplace is the working demo, not the revenue wedge.** It runs the engine
end-to-end on real users — the live proof-of-concept shown to insurers and the acquisition/
credibility surface. Deliberately not the primary revenue bet: the two-sided flow needs the
landlord (all the leverage in a tight market) to verify himself, which he won't (finding F8).
Consumer classified badge (Leboncoin "Vérifié") stays phase 2.

---

## Legal gate — ✅ CLEARED for lease + e-sign (2026-06-24)

The loi 1971 / Hoguet gray zone on self-service lease generation and e-sign was
resolved: written opinion on file (2026-06-20, Mathieu Galand, Avocat au Barreau de
Paris — `docs/legal/2026-06-20-avis-avocat-esign-lease-galand.md`) green-lights both
paths, **subject to**: official model wording only (no custom clauses), mandatory
provisions + annexes enforced (gating for Path A), verified-identity signers,
auditable signing record, GDPR. No success fee; funds never flow.

Still requiring lawyer input before build/enable: counterparty matching re-enable
(support publicitaire framing), EU AI Act classification memo, biometric Art. 9
DPIA (see master plan WS-2).

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

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
