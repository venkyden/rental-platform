# Rental Trust Layer — Feature Dossier

Self-contained handoff for re-posturing Roomivo's verification stack into a
**signed, expiring, portable proof** layer whose single job is to **stop people
acting in bad faith and scamming each other** on open classifieds (Leboncoin,
Facebook Marketplace/Groups, PAP).

Source spec: `PRD-TrustLayer-v2.md` (supersedes PROJECT-TRUST-0-OPEX v1).
Condensed working context: `CLAUDE.md — Trust Layer Project Context` (read before
every task; it sets Phase-1 scope, the OSS stack, and the legal gate).
Per [[roomivo-new-convo-per-feature]] this DOSSIER is the handoff: rules +
edge-case checklist live inside it. Each sub-feature below = its own conversation,
its own worktree ([[feedback_git_worktree]]), tested edge-case-by-edge-case before
moving on ([[roomivo-test-per-feature]]).

Status legend: 🔴 blocking · 🟠 important · 🟡 polish · ✅ done.
Verdicts: **KEEP / FIX / REPLACE / KILL / BUILD**.
Last updated: 2026-06-10. Status: **in progress** — Phase 2 items shipping incrementally; DPE reclassification enforcement (§5.4 PR-1/3/4/5) landed 2026-06-10 (see "Done this pass" in §5.4).

---

## 0. Decisions on record (set by product owner, 2026-06-05)

1. **North star = anti-scam, not statelessness.** Statelessness/GDPR/OPEX are
   benefits, not the goal. When they conflict with catching scammers, the
   anti-scam outcome wins. → We adopt a **hybrid architecture** (§3), not a
   big-bang stateless rewrite.
2. **GLI: remove completely.** All quote/apply code is deleted, not flagged-off.
   The PRD's insurance posture is *verification-only* and GLI distribution needs
   ORIAS + IDD (§7.3, §9). See §8 for the removal plan.
3. **Start with the dossier only.** This document. No implementation in this pass.
4. **Phase 1 = BOTH sides verified** (product-owner override of CLAUDE.md's
   tenant-only slice, 2026-06-05). Each side vets the other and leaves with a
   watermarked evidence document (§12.1):
   - **Tenant:** FR identity (France Identité *justificatif* → verify sig) + solvency
     (*avis* 2D-Doc → betagouv/2ddoc-parser → verify ECDSA → banded ratio).
   - **Landlord + property:** FR identity (same rail) + **property ownership/control**
     (ADEME DPE class lookup + *taxe foncière* document check → "control, not
     ownership-attested"). This is what directly attacks **deposit theft** (tenant
     confirms a real landlord/property before paying).
   - Combine + sign + TTL; shareable, verifiable credential per side.
   **Still excluded from Phase 1:** lease generation, e-sign, insurance (lease/e-sign
   also behind the §7.1 legal gate). ⚠ Bigger/slower than CLAUDE.md's cheapest-slice
   plan — accepted trade for delivering the deposit-theft use case. **`CLAUDE.md`
   Phase-1 section now disagrees with this and should be reconciled (see note below).**
   This **overrides the §9 ordering** for what ships first.
5. **Legal gate (hard):** do NOT build lease-generation or e-sign past a French
   *droit immobilier* lawyer blessing the self-service framing (loi 1971 / Hoguet
   gray zone). Cheap and gating. See §7.1.
6. **GTM is B2B2C-first** — pitch the verified-dossier API to a GLI insurer /
   property manager (quantifiable ROI, has budget) before the consumer badge.
   Note: selling verified facts **to** a GLI insurer ≠ Roomivo selling insurance —
   consistent with the GLI-distribution removal in §8.
7. **Access model (see §12):** access is tiered by *action*, not by who the user is.
   **Verifying** a credential is always public/accountless. **Generating** one uses
   a **passwordless email/phone magic-link** "verification identity" (not a full
   Roomivo signup) — Roomivo users get it inline; classified users get the
   passwordless lane (= the acquisition funnel).
8. **Credential resolution (see §12):** **thin server store** — persist only the
   **banded** credential record (no source docs) keyed by `credential_id`. Enables
   per-verification metering, B2B2C billing, revocation, and the evidence pack;
   signature stays independently verifiable against the public key. GDPR-light.
9. **Deliverable = watermarked, evidence-grade document** (see §12.1). External
   users visit, get their job done, and leave with a **watermarked, signed,
   timestamped, hash-anchored** document admissible as evidence — the target
   scenario is **deposit theft** (landlord collects deposit, disappears). Build
   "leave no room for scam." The evidence pack is Phase-1-central, not a later add-on.
10. **Anti-phishing trust model is a feature, not polish** (see §12.2). A link/QR in
    a Leboncoin chat looks like phishing → adoption dies unless we defeat that fear.
    Counter with: one canonical official domain, **verify-by-ID** ("don't trust the
    link — type the code on roomivo.app yourself"), published public key, and
    landing-page institutional endorsement: **PÉPITE Pays de la Loire / SNEE /
    Ministère de l'Enseignement supérieur et de la Recherche** with logos.
    ✅ **Logo rights secured (2026-06-07):** statuses ("Lauréat PÉPITE",
    "Étudiant-Entrepreneur / SNEE") **and** the ministry/PÉPITE logos are **authorized
    for display**. See [[roomivo-legal-status-snee]].
11. **Scoping (assumption — confirm):** Phase 1 / Direction A = **(a) Roomivo-scoped
    broadcastable** credential. Direction B (Phase 2) = **(b) recipient-scoped**.

---

## 1. What this product IS / IS NOT (load-bearing legal boundaries)

A self-service **verification + document utility** used *alongside* a listing the
parties already found elsewhere. It does four jobs: verify identity, verify
solvency/property, handle the lease (generate from official model OR legality-check
an uploaded one), and e-sign + emit a proof.

**The boundaries below are not style — each is the edge of a regulated activity.
Crossing one pulls Roomivo into a licensing regime.** Every feature must be checked
against this table before merge:

| Roomivo must NEVER… | …because it triggers |
|---|---|
| Search / match / recommend counterparties | Loi Hoguet (*entremise* — carte pro) |
| Hold a mandate / act on a party's behalf | Loi Hoguet (mandat) |
| Touch / hold / initiate / gate funds | Loi Hoguet *maniement de fonds* + payment-services |
| Take a success/commission fee on a signed lease | Loi Hoguet intermediation criterion |
| Draft custom lease wording *for* the parties | Loi du 31 déc. 1971 (rédaction d'actes) |
| Sell / propose / earn commission on insurance | ORIAS + IDD ← **this is why GLI is removed** |
| Guarantee rent / make a party whole | Unlicensed insurance/guarantor |
| Route / price / gate by nationality or immigration status | Code pénal 225-1/225-2 (discrimination) |
| Store identity/financial docs at rest **without need** | Avoidable GDPR liability |

**Legal thesis:** parties met on the classified → no *entremise* → this is a
verification SaaS + signed-PDF tool. Revenue is **flat / per-verification, never
success-based**. Funds never flow. Insurance is verification-only (no ORIAS).

---

## 2. The credential (the new core output)

A short-lived, **signed** JSON attestation. Roomivo holds the signing key; any
counterparty verifies the signature against the public key. This is the portable
anti-scam artifact: a wary landlord/tenant on Leboncoin can check it without an
account.

```json
{
  "credential_id": "vc_8f3a...",
  "subject_role": "tenant",              // tenant | landlord | property
  "issued_at": "2026-06-03T10:00:00Z",
  "expires_at": "2026-07-03T10:00:00Z",  // short TTL by design
  "rail": "FR",                          // FR | INTL — by DOCUMENTS held, not nationality
  "claims": {
    "identity_verified": true,
    "identity_assurance": "HIGH",        // HIGH | MEDIUM — never silently upgraded
    "identity_source": "france_identite_justificatif",
    "solvency_ratio": ">=3.0",           // BANDED, never raw figures
    "solvency_assurance": "HIGH"
  },
  "disclaimer": "Certifies verification of the stated facts only. Does not warrant future conduct or good faith.",
  "signature": "..."
}
```

Design rules (non-negotiable):
- **Bands, not raw numbers** (`ratio >= 3.0`, never the RFR). Data minimisation.
- **Assurance labelled, never inflated.** A MEDIUM check is never shown as HIGH.
- **Recipient-scoping** where the source supports it (France Identité *justificatif*
  names the recipient).

### Trust tiers
- **HIGH** — state cryptographic signature or passport chip (France Identité MoI
  sig; DGFiP-signed 2D-Doc; ICAO chip via BAC/PACE). Forgery-resistant.
- **MEDIUM** — OCR + liveness, or unsigned foreign docs. Catches casual fraud /
  typos; **does not defeat a competent forgery.** Always shown as MEDIUM.
- **UNVERIFIED** — document attached but not validated.

---

## 3. Architecture decision — hybrid, anti-scam-first

> The most powerful anti-scam levers, in order: (1) **HIGH-assurance identity**
> (state-verified, defeats forgery), (2) **property/listing verification** (kills
> ghost-listing & deposit-theft scams — the #1 Leboncoin fraud), (3) **portable
> signed proof** the wary side can actually check. Statelessness is a distant 4th.
> So we build 1–3 first; we adopt statelessness *where it removes liability without
> weakening anti-scam* (notably: keep an **evidence pack** for disputes, §6, which
> a purely stateless design would throw away).

Chosen shape:
- **BUILD** a `Credential` as a new first-class output beside existing flows.
- **New rails are stateless from day one** (France Identité, 2D-Doc, INTL, DPE):
  verify → emit credential → discard source. No new at-rest PII.
- **Legacy OCR flows keep storing** for now (they already do, to R2) — they become
  the **MEDIUM** tier and are migrated to verify-and-forget per-domain, last.
- **Assurance labelling is retrofitted first** (§5.2) — cheapest, highest integrity
  gain: today the OCR+selfie path is silently treated as fully verified, which by
  the PRD's own definition is MEDIUM. Stop the silent MEDIUM→HIGH inflation.

### Current vs target (the gap)
| Dimension | Target (PRD) | Roomivo today |
|---|---|---|
| Output | Signed, expiring, portable credential | Mutable `User.identity_data` JSON + `trust_score` int |
| Identity HIGH | France Identité / NFC chip | AI OCR + selfie face-match = **MEDIUM** |
| Solvency HIGH | DGFiP 2D-Doc signed payload / SVAIR | AI OCR of payslips = **MEDIUM** |
| Assurance | Explicit per-claim band | Booleans + one opaque `trust_score` |
| Property | ADEME DPE + "control, not ownership" | Claims `ownership_verified=True` (overclaim) |
| Insurance | Verify-only, no ORIAS | **GLI quote+apply present → REMOVE (§8)** |
| Docs | Discard new rails; migrate legacy | All kept on R2 |

Affected surface:
`backend/app/routers/{verification,leases}.py`,
`backend/app/services/{identity,identity_service,employment,lease_generator,lease_templates,cross_verification,french_government_api,gli,storage}.py`,
`frontend/app/verify/*`, `/verification`, `/verify-capture/[code]`,
`components/{VerificationUpload,VerificationGate}.tsx`.

---

## 4. The two rails (split by DOCUMENTS held, never by nationality)

This split is what keeps us clear of discrimination law (art. 225-1/2). The *same
tiers are offered to everyone*; the user self-selects on documents available.
Immigration status is **never** a gate.

| Step | FR rail | INTL rail |
|---|---|---|
| Identity | OCR+liveness (**MEDIUM**); *avis* 2D-Doc name corroboration (flag only, stays MEDIUM); HIGH deferred to FranceConnect | NFC passport chip / BAC-PACE (HIGH) → web MRZ-OCR+liveness (MEDIUM) |
| Solvency | *Avis* 2D-Doc + optional SVAIR (HIGH) | Foreign tax/payslips (MEDIUM) + currency normalisation |
| Property | ADEME DPE + document-verified control | same |
| Lease | Generated (Décret 2015-587) or uploaded-and-checked | same; foreign-law uploads "not legality-verified" |
| Insurance | French MRH attestation verify (required) | French MRH still required for FR property |
| Signature | Simple/AES + audit trail | same |

---

## 5. Edge-case & test matrix (the QA harness)

Status = coverage in Roomivo **today**. ✅ covered · 🟡 partial · ❌ missing.
"Block" = stop with a labelled error. "Flag" = proceed at lower assurance.
Tests follow the existing convention in `backend/tests_integration/` (real DB,
`make_user`/`auth` helpers, mocked AI/storage). Each row = at least one test.

### 5.1 Identity (PRD §6.1) — service: `identity.py`, `identity_service.py`

> **Update 2026-06-06:** ID-1/ID-2/ID-3 assumed a `valider-attest` API that does not exist
> (human portal only). FR HIGH identity is deferred to FranceConnect (post-incorporation).
> The shipped FR rail is MEDIUM (OCR+selfie) + *avis* 2D-Doc name corroboration. See
> `docs/superpowers/specs/2026-06-06-fr-identity-medium-rail-design.md`.

| # | Edge case | Expected | Now |
|---|---|---|---|
| ID-1 | Altered/screenshotted *justificatif* | endpoint/sig fails → **block**, regenerate | ❌ deferred (FranceConnect path) |
| ID-2 | *Justificatif* for a different recipient | recipient mismatch → **block** | ❌ deferred |
| ID-3 | Expired single-use *justificatif* (TTL) | **block**, regenerate | ❌ deferred |
| ID-4 | No new-CNI / no NFC phone | **fallback → MEDIUM**, labelled | ✅ labelled (AS-1 fix) |
| ID-5 | Web NFC cannot read passport (impossible) | auto web-MEDIUM, never claim HIGH | ❌ |
| ID-6 | MRZ checksum (mod-10) fails | transcription error → **re-scan** | ❌ |
| ID-7 | Passport without chip (older book) | MEDIUM only, labelled | ❌ |
| ID-8 | Liveness spoof (photo-of-photo / replay) | liveness **reject**; residual noted in MEDIUM | 🟡 face-match yes; true replay detection? |
| ID-9 | Non-Latin / transliterated names | MRZ transliteration tolerance, surface both forms | 🟡 fuzzy match, not MRZ-aware |
| ID-10 | Signer ≠ verified credential subject | **block** at e-sign | ❌ |

### 5.2 Assurance labelling (PRD §2.2/§4) — retrofit, do FIRST
| # | Edge case | Expected | Now |
|---|---|---|---|
| AS-1 | OCR+selfie identity result | labelled **MEDIUM**, never `HIGH` | 🔴 silently treated as fully verified |
| AS-2 | OCR payslip/avis solvency | labelled **MEDIUM** | 🔴 same |
| AS-3 | Credential never upgrades band silently | assertion test: HIGH only from HIGH source | ❌ |
| AS-4 | UNVERIFIED surfaced (not hidden as "pending forever") | explicit label | 🟡 |

### 5.3 Solvency (PRD §6.2) — service: `employment.py`, `french_government_api.py`
| # | Edge case | Expected | Now |
|---|---|---|---|
| SV-1 | *Avis* printed text edited, 2D-Doc intact | read **signed payload** → tampering moot | ❌ OCRs printed text (defeated by this) |
| SV-2 | Authentic but superseded *avis* | **SVAIR** recency check, else flag "recency unconfirmed" | 🟡 `verify_tax_notice` exists, no SVAIR |
| SV-3 | Dependant on parent's *avis* (rattaché) | guarantor path (parent verifies own facts) | 🟡 guarantor flows exist |
| SV-4 | No *avis* (student/first job/new arrival) | payslips/guarantor/Visale | 🟡 |
| SV-5 | INTL foreign doc unverifiable | **MEDIUM** + currency normalisation | ❌ no FX normalisation |
| SV-6 | FX volatility over lease term | flat labelled margin (+5%, as margin not σ) | ❌ |
| SV-7 | Income just under threshold after margin | surface band honestly, **don't silently pass** | 🟡 `trust_score` opaque |
| SV-8 | RFR mislabelled as monthly net income | present as **fiscal capacity**, not RFR/12 | ❌ audit all copy |

### 5.4 Property (PRD §6.3) — NEW module + `verification.py` property upload
| # | Edge case | Expected | Now |
|---|---|---|---|
| PR-1 | DPE class **G** | **warn + require acknowledgment** at publish, *not* hard-block (décence bites at lease formation, not advertising); keep class display mandatory (L126-33) | ✅ publish gate warns+ack, audit trail in `ownership_data` (2026-06-10) |
| PR-2 | Reference to class "H" | reject — scale is **A–G only** | ✅ rejected in `ademe_dpe` |
| PR-3 | 1 Jan 2026 DPE reform reclassification | read **live** ADEME, never hard-code class | ✅ authoritative ADEME (HIGH) class overrides self-typed at publish |
| PR-4 | DPE ID not found / invalid | `energy: UNVERIFIED`, **don't hard-block** | ✅ self-declared allowed (flagged), publish not hard-blocked |
| PR-5 | Expired DPE (>10yr / pre-Jul-2021) | require current | ✅ expired → warn + require acknowledgment at publish |
| PR-6 | ADEME 5xx / timeout | **non-blocking** "pending", background retry | ❌ |
| PR-7 | Zone tendue (encadrement loyers) | advisory flag vs loyer de référence majoré | ❌ |
| PR-8 | Lister ≠ owner (ghost listing) | *taxe foncière* check, label **"control, not ownership-attested"** | 🔴 currently claims `ownership_verified=True` (overclaim) |

**Done this pass — DPE reclassification enforcement (Phase 2 item 9, 2026-06-10)** —
spec `docs/superpowers/specs/2026-06-10-dpe-reclassification-enforcement-design.md`,
plan `docs/superpowers/plans/2026-06-10-dpe-reclassification-enforcement.md`.
- New pure service `app/services/dpe_compliance.py` (`assess_dpe`): date-aware décence
  calendar (G now / F 2028 / E 2034), authoritative-class resolution (ADEME HIGH > self-typed),
  bilingual warnings. 10 unit tests.
- Publish gate (`properties.py`) rewritten: missing class → 400 (**L126-33**, the ad must
  state a class); class G / expired → **409 unless `acknowledge_dpe_warning`** (warn+ack, not
  block); authoritative ADEME class overwrites self-typed `dpe_rating` for accuracy; ack audit
  trail (`dpe_decence_acknowledged_at`/`_class`) in `ownership_data`.
- Frontend: creation wizard + edit page warn (amber notice) instead of disabling publish;
  required acknowledgment checkbox; ack UI driven by the backend **409 `warnings[]`** so
  ADEME-override / expired cases are actionable (no dead-end); legally-correct copy
  (loi Climat: class-G ban since **Jan 2025**, corrected from "2023"); FR/EN i18n parity.
- **Legal grounding:** décence énergétique bites at lease formation (ANIL), not advertising,
  so the platform warns rather than blocks; L126-33 makes the class *display* mandatory and
  requires it be accurate (hence ADEME-class-wins). Sources in the spec.
- 31 backend tests pass; frontend tsc clean.
- Out of scope / follow-up: no ADEME DPE-number capture in the wizard (kept opt-in); no
  scheduled live re-verification of existing listings.

### 5.5 Lease — generated (PRD §6.4) — `lease_generator.py`, `lease_templates.py`
| # | Edge case | Expected | Now |
|---|---|---|---|
| LG-1 | Deposit over cap for type | **block** w/ specific legal cap | 🟡 caps in `LEASE_CONFIGS`, enforce-at-finalise? |
| LG-2 | Bail mobilité with non-zero deposit | force **0** | 🟡 config=0, needs test |
| LG-3 | Furnished: Décret 2015-981 **11-item** list incomplete | **block** until all 11 confirmed | ❌ |
| LG-4 | Missing mandatory annex (DPE/ERP/diagnostics/notice) | **block** finalisation; auto-stitch notice | ❌ |
| LG-5 | Zone tendue / complément de loyer | carry advisory flag into lease | ❌ |
| LG-6 | Only Décret 2015-587 model wording (no custom) | enforce — avoids loi 1971 | 🟡 verify no free-text clause path |

### 5.6 Lease — uploaded & legality-checked (PRD §6.5) — **all NEW**
Two acceptance tiers: **VALIDATED** (passed red-line) vs **ATTACHED / NOT
LEGALITY-VERIFIED** (override or unanalysable). The credential records which.
| # | Edge case | Expected | Now |
|---|---|---|---|
| LU-1 | Scanned PDF, no text layer | OCR; low confidence → **ATTACHED** + notice | ❌ |
| LU-2 | Clause *réputée non écrite* (loi 89-462 art. 4) | **flag** + one-click swap to template; keep → ATTACHED | ❌ |
| LU-3 | Deposit/rent over cap | flag + override → ATTACHED | ❌ |
| LU-4 | Missing mandatory annex | flag + offer to attach | ❌ |
| LU-5 | Foreign-law lease | **never VALIDATED** → ATTACHED | ❌ |
| LU-6 | Landlord insists on non-compliant lease | allowed; **record flags-shown-and-overridden** (liability) | ❌ |

### 5.7 E-signature (PRD §6.6) — `leases.py`, lease signature columns
French residential lease = *acte sous seing privé* → **no qualified sig required.**
Self-hosted audit trail (doc hash, timestamp, signer's credential ref, IP, consent).
| # | Edge case | Expected | Now |
|---|---|---|---|
| SG-1 | Signer ≠ verified party | **block** (matches ID-10) | ❌ |
| SG-2 | One party abandons | session expires, **no lease**, nothing stored | 🟡 stateful sig columns exist |
| SG-3 | Document altered after signing | hash mismatch → sig invalid, surfaced | 🟡 confirm hash chain |
| SG-4 | Repudiation / dispute | produce **evidence pack** (§6), label AES vs QTSP | ❌ |
| SG-5 | Party wants max robustness | offer **QTSP** upgrade (paid, v2) | ❌ |

### 5.8 Insurance — verification only (PRD §6.7) — **post GLI removal**
| # | Edge case | Expected | Now |
|---|---|---|---|
| IN-1 | Quote submitted (not final certificate) | **reject** — must be final cert | ❌ |
| IN-2 | Address/name/date mismatch | normalise (strip accents, fuzzy) + **flag**; **never build RegExp from raw DB strings** (ReDoS/injection) | ❌ |
| IN-3 | Foreign insurance, French property | **block** — French MRH required | ❌ |
| IN-4 | Cover starts after lease start | **flag** gap; landlord decides | ❌ |
| IN-5 | Cancel-after-keys | dissolves (we gate nothing); offer paid annual re-verify | ❌ |

---

## 6. Monetization (sell verified facts, never protection)
Flat / per-verification, **never** success-based.
- Per-verification micro-fee (tenant-side ID/listing check — the anti-scam wedge).
- Landlord verification / subscription (their downside ≈ 10× tenant's → pricing power).
- Risk-tiered: HIGH/chip priced above MEDIUM.
- **B2B2C API** (margin engine): GLI insurers (our solvency credential = their
  underwriting dossier), agences, and the classifieds (paid "Vérifié" badge).
- **Evidence pack** (post-incident): sell the signed audit trail to the injured
  party for their legal/insurance claim. ← reason we keep an audit trail despite
  the otherwise-stateless posture.

---

## 7. Residual legal risks — NOT engineering-closable (PRD §7.6)
Must clear French counsel **before launch**:
1. **Lease-generation + e-sign framing** vs loi 1971 / Hoguet — the one real gray
   zone. Get a *droit immobilier* lawyer to bless the self-service positioning.
2. **Transient GDPR processing** — confirm lawful basis + non-retention proof with
   DPO/counsel even though there's no store.
3. **Reliance / product liability** — selling verification invites reliance.
   Mitigate via assurance-tier labelling + ToS limiting warranty to *the
   verification act only* ("we certify facts, not good faith"). Never promise an
   outcome.
4. **Ownership fraud** — cannot be fully closed at ~€0 OPEX. Disclosed + labelled.
5. **MEDIUM international tier** — not forgery-proof; never relabelled HIGH.

---

## 8. GLI removal plan (decision: remove completely)
GLI distribution needs ORIAS + IDD; it contradicts the PRD's v1 verification-only
insurance posture. **Delete, don't flag-off.**
- 🔴 **KILL** endpoints `POST /verification/gli/quote` and `/gli/apply`
  ([verification.py:1223-1326](../../../backend/app/routers/verification.py#L1223)).
- 🔴 **KILL** `backend/app/services/gli.py` (`gli_service`, `TenantProfile`, `GLIQuoteRequest`).
- 🟠 Remove the `gli_quote` feature flag + any seed/admin references.
- 🟠 Frontend: remove `/gli` page/route and any GLI CTA in dashboards/lease flow.
- 🟠 Docs: update `docs/features/README.md` row "Guarantor / GLI / Visale" → drop GLI;
  keep Visale/Garantme (those are guarantor *verification*, not insurance sale).
- ✅ Verify: grep `gli`/`GLI` repo-wide returns only historical journal mentions;
  full test suite green after removal.
- ⚠️ Keep distinct: **MRH attestation verification** (§5.8) and **Visale/Garantme
  guarantor verification** are verification, allowed, and stay.

---

## 9. Sub-features & phasing (each = own convo + worktree + dossier section)

> **Phase 1 = both sides verified** (§0.4): tenant *and* landlord/property, each
> leaving with a watermarked evidence document. Items 1–6 below. Everything from
> item 7 is **Phase 2+**; lease/e-sign are additionally blocked by the §7.1 legal
> gate. Property is **in Phase 1** (deposit-theft prevention), reversing the earlier
> CLAUDE.md tenant-only ordering.

**Phase 1 — both-sided verified credential + evidence document**
1. **GLI removal** (§8) — clears the legal contradiction before building. Small,
   self-contained, no new deps.
2. **Credential core** (§2) — `Credential` model + `app/services/credential.py`
   (Ed25519 sign), `app/routers/credentials.py` (`POST /issue`, `GET /verify`),
   public-key endpoint, watermarked evidence-document export (§12.1), Alembic
   migration. Thin banded store (§0.8); no source docs at rest.
3. **FR identity — MEDIUM rail now, HIGH deferred** (§5.1, §5.2) — `valider-attest` is a
   human web portal, not an API, and the *justificatif* route (new-CNI + NFC + app) was
   rejected for friction. No zero-OPEX method binds a document to its presenter today, so
   there is no honest FR HIGH identity rail yet. This sub-feature labels OCR+selfie as
   **MEDIUM** (AS-1 fix), adds a **state-signed name cross-check** from the *avis* 2D-Doc
   (still MEDIUM — no presenter binding), and records **FranceConnect** as the deferred
   HIGH path, gated behind incorporation (SIRET + DataPass + 4 governance roles, décret
   du 8 nov. 2018). Serves both tenant and landlord.
4. **FR HIGH solvency rail** (§5.3, tenant) — *avis* 2D-Doc via
   **betagouv/2ddoc-parser**, verify ANTS ECDSA, read income from the **signed
   payload**, emit banded ratio (`>=3.0`) + optional SVAIR recency.
5. **Property ownership/control** (§5.4, landlord) — ADEME DPE class lookup +
   *taxe foncière* document check → "control, not ownership-attested." This is the
   deposit-theft lever (tenant confirms real landlord/property before paying).
6. **Both-sided wiring** — verify-by-ID + anti-phishing trust page (§12.2),
   institutional endorsement, public verify page showing subject name+photo, the
   shareable link per side.

**Phase 2+ (defer; lease/e-sign behind §7.1 legal gate)**
7. **DPE lettability depth** (§5.4) — class-G block, zone-tendue advisory, live-reform
   handling (beyond the Phase-1 class lookup).
8. **Uploaded-lease red-line scan** (§5.6) — VALIDATED vs ATTACHED tiers. ⚠ gate.
9. **E-sign + evidence pack upgrade** (§5.7, §6) — DocuSeal/Documenso **unmodified**
   (AGPL, §11). ⚠ gate.
10. **Insurance MRH verification** (§5.8).
11. **INTL rails** (§4) — NFC native app (JMRTD/NFCPassportReader) for HIGH; web
    MRZ-OCR MEDIUM; FX normalisation. Blocked on CSCA master-list (§11).
12. **Statelessness retrofit** — flip legacy store-to-R2 flows to verify-and-forget,
    per-domain (touches GDPR posture + evidence model — most invasive).

## 11. OSS stack & caveats (from `CLAUDE.md`)
| Component | Tool | License / note |
|---|---|---|
| FR identity | France Identité state service (consumed, not built) | Free |
| FR solvency | **betagouv/2ddoc-parser** (Python) | Govt OSS; verifies ANTS ECDSA sig |
| Datamatrix decode | ZXing + pscott/poc-d-doc (browser) | Permissive |
| INTL identity HIGH | **JMRTD** (Android) + **AndyQ/NFCPassportReader** (iOS) | LGPL / MIT; needs CSCA list |
| INTL identity MEDIUM | Tesseract (MRZ OCR) + DeepFace (face match) | liveness caveat ↓ |
| Property | ADEME DPE open-data API | Free; A–G only (no H) |
| Lease generation | **pdf-lib** | MIT |
| Uploaded-lease parse | Tesseract + rule-set | Apache |
| E-signature | **DocuSeal** / **Documenso** | **AGPL — run unmodified behind API; do NOT fork** |
| Insurance verify | Insurer API preferred; Tesseract fallback | — |

Hard caveats:
- **AGPL:** DocuSeal/Documenso are AGPL — embed/API unmodified, never fork. Need to
  modify? pick a permissive alternative.
- **CSCA master list:** Passive Auth on passport chips needs issuing-country root
  certs (via ICAO PKD). Assembling a complete/current list is the INTL-HIGH
  operational gap.
- **Liveness:** OSS anti-spoofing has materially higher false-accept than commercial
  3D — exactly why MEDIUM stays MEDIUM. Never present OSS liveness as fraud-proof.

---

## 10. Consolidated QA harness (PRD §10 summary)
| Process | Must pass | Dissolved by design |
|---|---|---|
| FR identity | altered/expired/wrong-recipient → block; no-CNI → MEDIUM | — |
| INTL identity | chip→HIGH, web→MEDIUM, checksum typo→rescan; spoof→liveness reject | "WebNFC reads passport" (impossible) |
| FR solvency | text-tampered avis moot (signed payload); superseded→SVAIR; dependant→guarantor | — |
| INTL solvency | foreign→MEDIUM; FX margin labelled; under-threshold honest | σ pseudo-statistics |
| Property | G→block; no H; live ADEME; API down→non-blocking; zone tendue→advisory | rigid hard-coded class |
| Lease (generated) | deposit caps, mobilité=0, 11 furniture items, mandatory annexes | — |
| Lease (uploaded) | illegal clause→flag+override→ATTACHED; no text→OCR→tier | — |
| Signature | signer≠verified→block; abandon→nothing stored; tamper→hash fail | "cancel-after-keys" loophole |
| Insurance | quote-not-cert / address / name / date via API not raw regex | regex-injection from DB strings |

## 12. Access & flow model (Roomivo users + classified users)

Tier access by **action**, not by who the person is. Three personas:

| Persona | Action | Account? |
|---|---|---|
| **Subject** (Roomivo or classified user) | gets verified → credential issued about them | **passwordless** magic-link anchor |
| **Verifier** (landlord/tenant on Leboncoin/FB/PAP) | *reads* a credential sent to them | **never** — public, no install |
| **Requester** (Roomivo user vetting someone) | asks a counterparty to prove themselves | already a Roomivo user |

**Rule 0:** verifying a credential MUST never require an account or app install. A
signup wall here kills the anti-scam value. Verifier opens link → banded claims +
assurance tier + validity date + "signature valid ✓" against the published public
key.

### Direction A — subject proves themselves outward (tenant wedge)
1. Tenant verifies (FR identity + solvency) → signed credential.
2. Gets shareable link / QR (`roomivo.app/c/<credential_id>`).
3. Pastes it into the Leboncoin/FB message.
4. Landlord (no account) opens the public verify page. Done.

### Direction B — Roomivo user pulls a proof inward (landlord wedge)
1. Roomivo landlord generates a **verification-request link**.
2. Sends it to the classified applicant.
3. Applicant (no account) opens it → guided verification; the France Identité
   *justificatif* is generated **naming that landlord as recipient** → replay-proof,
   scoped 1:1.
4. Landlord receives the resulting credential.

**Precedent in code:** the accountless lane already exists — the
[verify-capture/[code]](../../../frontend/app/verify-capture/[code]/page.tsx)
session + the **tokenless**
[`/identity/upload-mobile`](../../../backend/app/routers/verification.py#L331)
endpoint (session-code, no auth header). The Trust Layer generalises this into a
public credential rail.

### Decisions (recorded §0.7–0.8)
- **Generation = passwordless magic-link** verification identity (not full signup).
  Roomivo users inline; classified users via the passwordless lane = funnel.
- **Verification = always public/accountless.**
- **Resolution = thin server store** of the banded record (no source docs) +
  independently checkable signature.

### Recipient-scoping — SETTLED (direction-dependent)
- **Phase 1 / Direction A** (tenant broadcasts, recipient unknown) = **(a)
  Roomivo-scoped**: *justificatif* names "Roomivo"; any verifier trusts it via the
  signature; broadcastable. Anti-impersonation: subject **name + photo thumbnail**
  shown on the verify page (verifier matches it to the person they're chatting with),
  short TTL, revocable (thin store).
- **Direction B** (landlord requests, recipient known, Phase 2) = **(b)
  recipient-scoped**: *justificatif* names the landlord → replay-proof, 1:1.

## 12.1 Evidentiary deliverable (the watermarked evidence document)
Target scenario: **deposit-theft** — a (often ghost) landlord collects a deposit
then disappears; the victim needs court/police/insurer-grade proof. So the artifact
handed to the user is not just a screen badge — it is a **downloadable, watermarked,
signed document** containing:
- subject identity (name + photo thumbnail) and the banded claims verified;
- **assurance tier** per claim (HIGH/MEDIUM) — honestly labelled;
- **issued/expiry timestamps**, `credential_id`, and a **content hash**;
- the **cryptographic signature** + a pointer to the public key / verify-by-ID page;
- recipient (Direction B) or "Roomivo-scoped" (Direction A);
- the §2 disclaimer ("certifies facts, not good faith").

Reuse the existing [`apply_watermark`](../../../backend/app/utils/watermark.py)
util. The thin store (decision §0.8) retains the **banded record** so the user — or
a victim — can re-fetch / regenerate the evidence document until expiry, and so an
**evidence pack** (§6) can be produced post-incident. No source documents at rest.
"Leave no room for scam": short TTL, revocation, tamper-evident hash, no raw figures,
no silent tier inflation.

## 12.2 Anti-phishing & trust model (adoption-critical)
A link/QR pasted into a classified's chat is indistinguishable from phishing to a
wary user — defeating that fear is a Phase-1 requirement, not polish.
- **One canonical official domain.** Never URL shorteners or lookalike domains
  (they scream phishing). Human-readable verify URLs only.
- **Verify-by-ID pattern:** "Don't trust the link — go to roomivo.app and enter this
  code." The credential ID is checkable on the known-safe site, so a victim never has
  to trust an inbound link. Strongest anti-phishing UX.
- **Published public key** so technical / B2B verifiers check the signature themselves.
- **Institutional endorsement on the landing + verify pages:** supported by **PÉPITE
  Pays de la Loire**, under **SNEE** (Statut National Étudiant-Entrepreneur), **French
  Ministère de l'Enseignement supérieur et de la Recherche** — with logos, to convert
  "is this a scam?" into "this is state-backed." Consistent with
  [[roomivo-legal-status-snee]] and the existing Mentions Légales.
  - ✅ **Logo rights:** affiliation *statuses* **and** the official logos (ministry /
    PÉPITE) are **authorized for display** (confirmed by founder 2026-06-07). Display them
    on the landing + verify pages to maximise the "state-backed" trust signal.
- A short **"How to know this link is real"** explainer page reinforcing the above.

---
*§7 items must clear legal review before launch — they are not engineering-closable.*
