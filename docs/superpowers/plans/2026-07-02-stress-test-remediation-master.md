# Stress-Test Remediation — Master Division Plan

> **For agentic workers:** This is a MASTER plan dividing 13 stress-test findings into
> independent workstreams. Per project workflow rules, **each workstream = its own
> conversation + its own git worktree + its own detailed implementation plan** (written
> at execution time with superpowers:writing-plans, executed with
> superpowers:subagent-driven-development or executing-plans). This document is the
> self-contained handoff: a workstream conversation needs ONLY this file + the linked
> code references. Do not implement multiple workstreams in one branch.

**Goal:** Close the critical legal, fraud, and engineering gaps identified in the
2026-07-02 stress test before any production launch or investor circulation of the
pitch dossier.

**Architecture:** Three parallel tracks — Track 1 (pure engineering/docs, no decisions
needed, start immediately), Track 2 (gated on product-owner decisions DG-0..DG-2),
Track 3 (gated on external legal input). Highest-urgency item is WS-1 (real PII at
rest today).

**Tech stack:** FastAPI backend (`backend/app/`), Ed25519 credentials
(`services/credential.py`), CloudStorageService (`services/storage.py`), docs in
`docs/business/` and `docs/features/`.

---

## Findings index (from 2026-07-02 stress test)

| # | Finding | Severity | Workstream |
|---|---|---|---|
| F1 | Brokering routers (applications, messages, visits, dispute, esign, leases, inventory, matching_service…) contradict the "never broker" Hoguet doctrine the pitch depends on | CRITICAL | DG-0 → WS-7 |
| F2 | DeepFace selfie/ID face-match = GDPR Art. 9 biometric data; no explicit-consent flow, no DPIA, no legal entity as controller | CRITICAL | WS-2 |
| F3 | PII at rest: guarantor PDFs persist in `uploads/verification/guarantor/`; payslips persisted via `documents.py`; `delete_document` deletes DB row but orphans the stored file | HIGH | WS-1 |
| F4 | Tier system (HIGH reachable only via FranceConnect/passport-NFC) becomes a de-facto nationality filter if relying parties demand HIGH | MEDIUM | DG-2 → WS-5 |
| F5 | MEDIUM tier + official-looking evidence doc can AMPLIFY scams (stolen ID + OSS-liveness false-accept + forged taxe foncière + public DPE = "verified" fake landlord) | CRITICAL | WS-5 |
| F6 | Pitch dossier overclaims HIGH identity/solvency (France Identité listed as current answer though rejected; 2D-Doc has no presenter binding) vs Phase-1 MEDIUM reality | HIGH | WS-4 |
| F7 | Roomivo brand becomes a phishing template (roomiv0.app); verify-by-ID only protects users who already know the canonical domain | MEDIUM | WS-6 |
| F8 | Consumer wedge requires cooperation from the party (landlord) with all the leverage and no incentive | CRITICAL | DG-1 → WS-9 |
| F9 | DossierFacile (free, state, API) + eIDAS 2.0 EUDI Wallet squeeze the moat window to ~2–3 years | HIGH | WS-4 / WS-9 |
| F10 | B2B insurers ask for ANSSI PVID for identity verification; OCR+DeepFace can never pass. Sellable asset is 2D-Doc dossier-fraud detection, not identity | HIGH | WS-9 |
| F11 | Y1 plan hides incorporation (SIRET → contract capacity → DataPass → FranceConnect) as uncosted critical path; €0-marginal-cost claim ignores manual-review/support COGS | MEDIUM | WS-4 |
| F12 | `CREDENTIAL_SIGNING_KEY` = single Ed25519 env var, no `kid`, no rotation, no revocation story; leaked key silently forges every credential ever | HIGH | WS-3 |
| F13 | Doctrine enforced only where audits looked (GLI killed, but F1/F3 drift); no CI-level guard | MEDIUM | WS-8 |

---

## Decision gates (product owner — decide before the gated workstreams start)

### DG-0 — Legacy brokering surface (gates WS-7, WS-8) — ✅ RESOLVED 2026-07-04

> **Owner decision (2026-07-04):** none of A/B/C as written. Roomivo is **one product**:
> a rental **marketplace + the trust layer**, internal + external — the trust layer is
> not a separate entity. The marketplace stays a **passive publisher**: counterparty
> matching/recommendations removed (PR #29, `fix/hoguet-matching-removal`), funds-handling
> marketing claim removed in the same PR. WS-7 is therefore **replaced** by the
> per-feature audit program in §"Feature audit program (2026-07-04)" at the end of this
> file: audit/fix/keep each module instead of killing the platform. WS-8 (CI doctrine
> guard) survives, adapted to the unified surface.
The stateless-trust-layer positioning is contradicted by mounted routers
([main.py:258-317](../../../backend/app/main.py#L258-L317)): `property_manager`,
`visits`, `messages`, `team`, `bulk`, `documents`, `applications`, `leases`, `esign`,
`inventory`, `dispute`, plus `services/matching_service.py`.
Options:
- **A. Kill (recommended)** — archive branch + delete, following the executed GLI
  precedent ("delete, don't flag-off", trust-layer DOSSIER §8). Aligns repo with
  doctrine before any lawyer/insurer/jury sees it.
- **B. Firewall** — split repo/deployment into "Roomivo platform" (accepts Hoguet
  analysis needed) and "Credential Layer" (stateless). Preserves Model-A optionality;
  doubles the legal surface and the maintenance load for a 2-person team.
- **C. Abandon stateless positioning** — rewrite the pitch instead of the code.
  Rejected by every prior decision on record; listed for completeness.

Per-router decision needed; note CLAUDE.md already marks lease + e-sign as behind the
legal gate ("do NOT build yet") — they are built and mounted.

### DG-1 — Wedge repositioning (gates WS-9)
Demote the two-sided consumer wedge to demo status; lead B2B with 2D-Doc
dossier-fraud detection (the check that survives PVID objections)? Affects pitch
dossier structure, pricing pages §13–15, and Phase-1 build order.

### DG-2 — Anti-filtering stance (gates the F4 slice of WS-5)
What friction does the product add against relying parties demanding HIGH?
(e.g., verification responses never expose tier as a filterable field to bulk/API
consumers; consumer-facing copy states MEDIUM is the standard tier.) Decide the
stance; WS-5 implements it.

---

## Track 1 — start immediately (no decisions, no blockers)

### WS-1 `fix/gdpr-purge-parity` — F3 — ✅ MERGED as PR #27 (2026-07-02) + local sweep 2026-07-03
**Type:** engineering. **Worktree:** `../rental-platform-gdpr-purge-parity`
**Scope:**
- Guarantor uploads ([verification.py:1207](../../../backend/app/routers/verification.py#L1207)
  and `/guarantor/physical/submit`): apply the same purge-after-processing pattern used
  for identity docs (13 `purge_identity_doc` call sites in the same file are the model;
  storage deletion via `CloudStorageService.delete_file`,
  [storage.py:292](../../../backend/app/services/storage.py#L292)).
- Income/employment uploads ([verification.py:883](../../../backend/app/routers/verification.py#L883),
  `:962`) and [documents.py:109](../../../backend/app/routers/documents.py#L109)
  `submit_income_proof`: decide retention vs purge per document type; anything retained
  needs an explicit TTL + documented lawful basis; default is purge.
- Fix `delete_document` ([documents.py:123](../../../backend/app/routers/documents.py#L123)):
  delete the stored file (`file_url`/storage key) before deleting the DB row; test that
  erasure removes both.
- ~~Sweep existing artifacts in `uploads/verification/`~~ ✅ done 2026-07-03 (owner
  authorized; local files deleted, `delete_files_by_prefix` parity R2/local confirmed).
  Remaining WS-1 scope (guarantor/income purge-in-code, `delete_document` orphan) still open.
**Verify:** upload → verify → assert file absent from storage AND redis; DELETE
document → assert 404 on file fetch; repo-wide test suite green.
**Note:** PII-touching branch → second audit before merge (standing rule).

### WS-3 `feat/credential-key-lifecycle` — F12 (must land before first relied-upon credential)
**Type:** engineering. **Worktree:** `../rental-platform-credential-key-lifecycle`
**Scope:**
- Add `kid` (key id, e.g. first 8 bytes of pubkey SHA-256) to the signed payload in
  [credential.py](../../../backend/app/services/credential.py#L174) and to
  verification responses.
- Verification accepts a set of active+retired public keys (`CREDENTIAL_VERIFY_KEYS`),
  signing uses the newest; rotation = add new key, keep old for verify until max
  credential TTL elapses.
- Extend the public-key endpoint ([credentials.py:98](../../../backend/app/routers/credentials.py#L98))
  to return key history (kid, pubkey, valid-from, retired-at).
- Write the revocation + key-compromise runbook in
  `docs/features/trust-layer/` (what happens to issued evidence documents if the key
  leaks; who rotates; how verifiers learn).
**Verify:** credential signed under key-1 still verifies after rotation to key-2; a
credential signed with an unknown kid fails closed; production boot still refuses to
start without a signing key ([config.py:90](../../../backend/app/core/config.py#L90)).

### WS-4 `docs/pitch-truth-pass` — F6, F11, F9-slice
**Type:** docs only. **Worktree:** `../rental-platform-pitch-truth-pass`
**Scope (both `docs/business/DOSSIER-EN.md` and `DOSSIER-FR.md`, kept in sync):**
- §02 scam table + §03 "Why Now": France Identité is NOT a current capability
  (rejected — human portal); Phase 1 identity = MEDIUM, HIGH deferred to
  FranceConnect post-incorporation. Remove/asterisk every "HIGH ... free" claim.
- §02/§03 solvency: 2D-Doc proves document authenticity, not presenter identity —
  state the no-presenter-binding limit and the name-cross-check mitigation honestly.
- §04/§10: add incorporation (SIRET → DataPass → FranceConnect, 4 governance roles)
  as a costed, scheduled critical-path item; revise Y1 gating on it.
- §05: replace "marginal cost ≈ €0" with an honest COGS note (manual review of OCR
  failures, fraud disputes, support).
- §03 or new §: name the eIDAS 2.0 / EUDI Wallet horizon and the 2–3-year window —
  reframed as "urgency to integrate now", which is the honest version of Why Now.
**Verify:** grep both dossiers for "HIGH" — every remaining instance is either the
INTL passport-NFC rail or explicitly future/FranceConnect-gated; FR/EN sections
mirror each other.

### WS-6 `feat/anti-phishing-ops` — F7
**Type:** engineering + ops (small). **Worktree:** `../rental-platform-anti-phishing-ops`
**Scope:**
- Verify-by-ID endpoint ([credentials.py:176](../../../backend/app/routers/credentials.py#L176)
  area): confirm code entropy ≥ 64 bits and add per-IP rate limiting on the public
  verify path (enumeration oracle).
- Register the obvious typo-domains (roomiv0/room1vo/roomivo-verify, .app/.fr/.com)
  or document the watch-and-takedown plan if budget says no.
- Publish the canonical-domain + published-public-key statement on the site and in
  the evidence document footer.
**Verify:** brute-force test against verify endpoint gets 429; evidence PDF footer
carries canonical-domain wording.

---

## Track 2 — gated on decisions

### WS-7 `chore/legacy-surface-removal` — F1 (after DG-0)
**Type:** engineering (large). **Worktree:** `../rental-platform-legacy-surface-removal`
**Scope (if DG-0 = Kill):** per-router kill-list in the GLI style (trust-layer DOSSIER
§8 is the template): unmount from `main.py`, delete router + services
(`matching_service.py`, `esign.py` service, lease generation chain if gated),
frontend routes, feature flags, seeds; keep `verification`, `credentials`,
`documents`(reduced), `gdpr`, `auth`, `admin`, `media`, `notifications`, `feedback`,
`stats`, `webhooks` as the credential-layer surface (exact keep-list is DG-0 output).
Archive branch `archive/full-platform-2026-07` first.
**Verify:** repo-wide grep for each killed module returns only journal/docs mentions;
OpenAPI schema diff shows only the keep-list; full suite green; frontend builds.

### WS-8 `test/doctrine-ci-guard` — F13 (after WS-7 defines the surface)
**Type:** engineering (small). **Worktree:** `../rental-platform-doctrine-ci-guard`
**Scope:**
- CI test asserting the mounted route set == checked-in allowlist manifest
  (`docs/features/trust-layer/route-manifest.json`); any new router fails CI until
  the manifest (and thus a human) approves it.
- CI test asserting the only storage-write call sites are on an allowlist (guards
  the WS-1 invariant against regression).
**Verify:** adding a dummy router/storage write makes CI fail; removing it passes.

### WS-9 `docs/b2b-repositioning` — F8, F10, F9-slice (after DG-1)
**Type:** business docs. **Worktree:** `../rental-platform-b2b-repositioning`
**Scope:** restructure pitch + Credential Layer pages (§08, §15) to lead with 2D-Doc
dossier-fraud detection for GLI insurers / property managers (no PVID barrier, crypto
actually closes the loop, relying party pays); demote the two-sided consumer flow to
"demonstrator"; add a PVID objection-handling paragraph (what we sell is document
authenticity verification, not certified remote identity proofing).
**Verify:** a cold read of §01 answers "what do you sell to whom" with the fraud-
detection API, not the consumer wedge.

### WS-5 `feat/relying-party-ux` — F5 + F4 (after DG-2; sequenced after WS-4 wording)
**Type:** product + frontend + backend. **Worktree:** `../rental-platform-relying-party-ux`
**Scope:**
- Evidence document + verify-by-ID result page redesign: assurance tier and the
  "control, not ownership-attested" limit rendered as first-class visual elements
  (banner-level, not fine print); explicit "what this does NOT prove" block listing
  the F5 attack surface in user language ("a MEDIUM check can be passed with a
  stolen ID — never pay a deposit on MEDIUM alone").
- Property claim wording: taxe foncière check labelled as document-based,
  non-cryptographic.
- DG-2 output implemented (tier not exposed as filterable field; anti-"HIGH required"
  copy).
**Verify:** screenshot review of evidence PDF + verify page against a checklist of
required disclosures; PII-sanitization check on the verify response
(`identity_data.checks` must stay boolean-only — standing rule).

---

## Track 3 — gated on external legal input (start intake now)

### WS-2 `feat/biometric-art9-compliance` — F2
**Type:** legal + engineering. **Worktree:** `../rental-platform-biometric-consent`
**Scope:**
- Engineering (can start now): explicit-consent screen before any selfie capture
  (purpose, Art. 9 basis = explicit consent, retention = transient, right to refuse
  with alternative rail); consent record (who/when/version) stored WITHOUT the
  biometric itself; block the flow when consent absent.
- Legal (external): DPIA draft in `docs/legal/DPIA-biometric-face-match.md`
  (processing description, necessity, risks, mitigations — the purge architecture is
  the core mitigation); controller designation question tied to incorporation
  timeline; add both to the existing counsel questions list (trust-layer DOSSIER §7).
- **Interim risk decision for the owner:** whether the selfie/face-match flow stays
  enabled in production before counsel signs off, or is feature-flagged off (identity
  becomes UNVERIFIED/document-only in the interim).
**Verify:** selfie endpoints 403 without a recorded consent; DPIA doc exists and is
referenced from the counsel checklist; consent record contains no image data.

---

## Launch order

| Order | Workstream | Why |
|---|---|---|
| 1 (now) | WS-1 | Real PII at rest today; second-audit rule applies |
| 1 (now, parallel) | WS-4 | Pitch dossier is being circulated for the €30–50k ask |
| 1 (now, parallel) | WS-3 | Cheap now, breaking-change later; blocks first real credential |
| 2 | WS-6, WS-2(eng half) | Small; WS-2 legal intake starts in parallel |
| 3 (after DG-0) | WS-7 → WS-8 | Largest diff; do after the urgent PII/docs items land |
| 3 (after DG-1/DG-2) | WS-9, WS-5 | Depend on repositioning decisions + WS-4 wording |

Do not start WS-7 and WS-1 in overlapping worktrees touching `verification.py` /
`documents.py` at the same time — land WS-1 first.

---

## Feature audit program (2026-07-04) — replaces WS-7

> Positioning (owner, 2026-07-04): **one product** — rental marketplace + trust layer,
> internal + external. No SIRET yet (SNEE, PÉPITE Pays de la Loire + Audencia support) →
> free beta until SAS incorporation. Constraints: OSS/free state APIs, low OPEX/CAPEX,
> minimal third-party dependence, zero licensed-activity surface (no entremise, no
> mandate, no funds, no custom lease wording, no insurance sale).

**Per-domain method (each = own conversation + own worktree, per workflow rules):**
1. **Scan** — routers/services/models + frontend routes/components + tests + journal.
2. **Legal screen** — check every endpoint/copy against the DOSSIER §1 red-line table.
3. **Fix** — bugs, silent failures, PII leaks, dead code my changes orphan.
4. **Alter** — align with unified positioning (trust badges, verify-by-ID hooks).
5. **UI/UX pass** — copy honesty (no overclaims), FR/EN parity, mobile, empty states.
6. **Test** — unit + integration per feature edge-case matrix; update domain journal.

### Verdicts (owner-reviewed 2026-07-04)

| Domain | Verdict | Notes |
|---|---|---|
| auth | KEEP+AUDIT (#1) | passwordless magic-link lane for external credential users (DOSSIER §0.7) still unbuilt |
| verification/KYC + credentials | KEEP+AUDIT (#2) | crown jewel; INTL solvency UI tab (item 14) ships here; WS-2 consent screen; WS-3 key lifecycle |
| properties/search/onboarding | KEEP+AUDIT (#3) | passive publisher; preferences → default search filters + objective per-criterion badges (no pairing scores); verified-listing badge tier |
| applications + visits | KEEP+AUDIT (#4) | user-initiated = defensible; check no verification auto-gating |
| messages | KEEP+AUDIT (#5) | needed for marketplace; DSA/moderation minimum + scam-pattern warnings |
| leases + esign | KEEP+AUDIT (#6) | Path B live; Path A branch verdict vs Galand gating conditions |
| inventory (état des lieux) | KEEP+AUDIT (#6) | document tool, aligned |
| disputes | KEEP+AUDIT (#7) | must be evidence tooling only — Roomivo never mediates/decides |
| gdpr | KEEP+AUDIT (#8) | WS-1 remainder (guarantor/income purge-in-code, delete_document orphan) |
| admin/stats/notifications/media/feedback | KEEP+AUDIT (#9) | light pass |
| property_manager / team / bulk | FREEZE | agency tooling; unmount + hide nav behind flags; revisit at B2B demand |
| erp_webhooks | FREEZE (verify first) | audit what it serves before unmounting |
| relocation ("Roomivo Black", "dedicated rental agent") | KILL | Hoguet mandate claim for a nonexistent service |
| "Premium Mobility / zero-deposit / Get Certified" copy | KILL/REWORD | implies guarantee product (unlicensed insurance line) |
| matching_service | DISABLED ✅ | PR #29; re-enable only behind lawyer opinion (support publicitaire framing) |

### Order
Wave 0 (parallel, small): WS-3 key lifecycle · WS-4 pitch truth pass (merged with doc
reconciliation: README, CLAUDE.md, DOSSIER-EN/FR, unified positioning) · WS-2 consent
screen (eng half) · KILL items (relocation + mobility copy).
Wave 1: domain audits #1→#9 above, one conversation each.
Wave 2: WS-8 CI doctrine guard (route-manifest allowlist) · WS-5 relying-party UX ·
WS-6 anti-phishing ops · FREEZE items.
