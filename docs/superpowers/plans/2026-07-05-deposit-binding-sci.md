# Deposit-binding + Entity/SCI Landlord Verification — Implementation Plan

> Items **15 + 16** from the trust-layer DOSSIER §9 ("the deposit-safety story").
> Feature branch: `feat/deposit-binding-sci`. Worktree:
> `../rental-platform-deposit-binding-sci`. One PR, two sequenced parts (15 then 16).
> Read `docs/features/trust-layer/DOSSIER.md` §9 (items 15/16) + §0.15/§0.17 first.

## The wedge, in one line

Today's credential proves **verification status**. This feature makes it prove a
**specific deposit transaction** — binding *verified tenant ↔ verified landlord ↔
property ↔ deposit amount ↔ payee IBAN + name-match ↔ date* into the signed evidence
document, so a deposit-theft victim has a tamper-evident artifact naming exactly who
they were told to pay. Roomivo **never** touches the money (§0.15).

**Who issues vs. consumes:** the **landlord** (verified) creates the binding; the
**tenant** (the potential victim) consumes it via the existing shareable
`/c/<credential_id>` link the landlord sends — no account needed (Rule 0, §12). The
anti-scam mechanism: a fake landlord *cannot* produce a name-MATCH binding (their payout
IBAN's holder name won't match their verified identity → MISMATCH → amber warning).
`tenant_credential_id` cross-links the two sides. **The exact deposit figure is carried
verbatim, not banded** — it is an agreed contractual term (the point of the artifact),
not solvency PII; banding applies to solvency signals only.

## Owner decisions (2026-07-05)

- **VoP mechanism = Roomivo-side name↔IBAN consistency check.** VoP is a *bank-side*
  service (EU Instant Payments Reg., payer's bank at transfer time) — Roomivo cannot
  call it for free and calling it edges toward the funds flow. Instead: landlord
  declares payee IBAN + account-holder name; Roomivo mod-97-validates the IBAN and
  checks the declared holder name against the **already-verified** landlord (item 15)
  or **verified SCI** (item 16). We record `payee_name_match: MATCH/MISMATCH` and
  **disclose the limit**: we did not confirm the IBAN truly belongs to that account at
  the bank. No self-attest field this pass (spoofable, tenant-at-pay-time dependent).
- **Scope = one worktree, 15 then 16 sequenced.** Item 16 is the landlord-type branch
  that fixes item 15's name-match break when the lessor is an SCI (account + lease in
  the entity name, not the gérant's).

## Legal red-line screen (DOSSIER §1) — pre-checked

| Red line | This feature | Verdict |
|---|---|---|
| Touch/hold/gate/route funds | Records agreed terms + payee identity only; money flows tenant→landlord off-platform | ✅ clear |
| Success fee on a lease | Flat/free verification; binding is evidence, not intermediation | ✅ clear |
| Entremise / matching | Parties already chose each other; we verify, not match | ✅ clear |
| Store identity/financial source docs at rest | **IBAN is landlord PII → emit-and-forget**: store only masked IBAN + name-match boolean + consent record; never the raw IBAN or the declared name | ⚠️ enforce in code |
| Guarantee rent / act as escrow | Binding explicitly disclaims: "Roomivo is not in the money flow; this proves who you were told to pay, not that money moved" (§0.17) | ✅ clear, disclose |

## Existing scaffolding this builds on (reuse, don't reinvent)

- [french_government_api.py](../../../backend/app/services/french_government_api.py) —
  `verify_siret()` already hits the free `recherche-entreprises.api.gouv.fr` public API
  (no token). Backbone for item 16. ⚠️ **Today it only reads `nom_complet`/`siege`; the
  `dirigeants` array item 16's gérant→SCI chain needs has never been touched in this
  codebase — B0 verifies that field exists on the live API before Part B relies on it,
  with INPI/RNE as the documented fallback.**
- [fr_2ddoc.py:78](../../../backend/app/services/fr_2ddoc.py#L78) `name_matches_any` +
  `_normalize` — accent/order-tolerant Jaccard ≥0.5 name match. **Reuse for the payee
  name-match** (binary MATCH/MISMATCH), same as insurance IN-2 / property
  `owner_name_match`. No new normalizer.
- [french_compliance.py:103](../../../backend/app/services/french_compliance.py#L103)
  deposit-cap check (Loi 1989 Art. 22, 1×/2×) — but it is **property-object-based and
  does NOT cover bail mobilité = 0 or student**. Item 15 needs a lease-type-aware
  wrapper that adds `mobilite → 0`.
- [user.py:66-67](../../../backend/app/models/user.py#L66) — `kbis_verified` /
  `carte_g_verified` booleans already present (entity / manager-mandataire).
- [credentials.py:332](../../../backend/app/routers/credentials.py#L332)
  `_build_claims_for_user` — banded-claims assembler; add a `deposit_binding` block.
- [credential.py:365](../../../backend/app/services/credential.py#L365)
  `export_evidence_pdf` — add a deposit-binding + payee row.
- [verification.py:1635](../../../backend/app/routers/verification.py#L1635)
  `upload_property_document` (property/control) — the endpoint pattern to mirror.

---

## Part 0 — Schema (do first; both parts depend on it)

### 0a. New column — `deposit_binding_data` (EncryptedJSON) on `User`
**Why a new column, not `ownership_data`:** the property/control endpoint at
[verification.py:1740](../../../backend/app/routers/verification.py#L1740) does
`current_user.ownership_data = {…}` — a **wholesale reassignment, not a merge**. Nesting
the binding under `ownership_data` means a landlord who runs property/control *after*
binding silently wipes it. A dedicated column matches the codebase's per-domain pattern
(6 existing `*_data` EncryptedJSON columns) and avoids the clobber. Item 16's
`landlord_entity` record lives in the same column (one new column, two nested keys).
- Model: add `deposit_binding_data = Column(EncryptedJSON, nullable=True)` beside
  `insurance_data` in [user.py](../../../backend/app/models/user.py#L83).

### 0b. Alembic migration
- New revision under `backend/alembic/versions` (`op.add_column`/`op.drop_column`;
  nullable → no backfill). Confirm `alembic heads` = 1 after.

### 0c. GDPR wiring (both currently MISSING — verified)
- **Erasure** ([gdpr.py:280](../../../backend/app/routers/gdpr.py#L280)): add
  `deposit_binding_data=None` to the `update(User).values(...)` block — a new column is
  not erased automatically. (Do **not** fix the pre-existing gap that
  `income_data`/`insurance_data`/`guarantor_data` are already omitted from erasure —
  separate branch, out of scope.)
- **Export** ([gdpr.py:162](../../../backend/app/routers/gdpr.py#L162)): the Art. 20
  payload emits only verification *booleans* today, no `*_data` column. Add a
  `deposit_binding` block to `user.verification` carrying the **masked** binding, so
  export/erasure are symmetric for the data this feature introduces.

---

## Part A — Item 15: Deposit-binding evidence layer

### A1. IBAN utility — `backend/app/services/iban.py` (new)
- `validate_iban(iban) -> {valid, country, masked}`: strip spaces/upper; ISO-13616
  length-by-country + **mod-97 == 1** checksum. Mask to `FR76 **** **** **** ***X`.
- **Name-match: reuse** `fr_2ddoc.name_matches_any(declared_holder, [verified_name])`
  → binary MATCH/MISMATCH. No new normalizer.
- Pure functions, **no storage** — caller keeps only masked IBAN + verdict.

### A2. Deposit-cap wrapper — `backend/app/services/deposit_cap.py` (new, small)
- `check_deposit_cap(lease_type, deposit, monthly_rent_hc) -> error|None`: vide ≤1×,
  meublé/étudiant ≤2×, **bail mobilité = 0** (reject non-zero). Delegate the 1×/2× math
  to the existing `french_compliance` logic where practical; the new part is the
  lease-type dispatch + mobilité=0 the existing validator lacks. Over-cap → 422 with
  the legal reason.

### A3. Endpoint — `POST /verification/deposit/bind` (verification.py)
Mirror `upload_property_document`. Auth = verified landlord (identity MEDIUM+;
`ownership_verified` for the bound property). Body: `property_id, lease_type,
monthly_rent_hors_charges, deposit_amount, payee_iban, payee_holder_name,
tenant_credential_id (optional), consent: true`.
Flow:
1. Require `consent` (IBAN is landlord PII) → else 403.
2. `validate_iban` → 422 if invalid checksum.
3. `check_deposit_cap` → 422 if over cap / non-zero for mobilité.
4. Name-match target = verified landlord name (profile `full_name`; identity_data raw
   name is purged — profile fallback is the accepted statelessness pattern, insurance
   IN-2). For SCI (Part B) the target becomes the SCI denomination.
5. Persist to `user.deposit_binding_data["binding"]` (new column, Part 0a): **only**
   `{deposit_amount, lease_type, payee_iban_masked, payee_name_match, iban_country,
   bank_ownership_confirmed: false, tenant_credential_id, consent_at, bound_at}`.
   **Never** the raw IBAN or raw declared name.
6. Return the binding summary.

### A4. Claims + evidence
- `_build_claims_for_user`: add a `deposit_binding` block when present. Never inflate;
  MISMATCH stays MISMATCH.
- `export_evidence_pdf`: add "Dépôt de garantie — engagement de paiement" section:
  amount, lease type, masked payee IBAN, name-match verdict in plain language, and the
  **disclosed limit** ("Roomivo n'est pas dans le flux financier ; ceci prouve à qui
  vous deviez payer, pas que les fonds ont circulé").
- Verify page `/c/[id]`: same, plain-language (no tier badges, §0.13). MISMATCH → amber
  warning ("le titulaire du compte ne correspond pas au bailleur vérifié — n'envoyez
  rien").

### A5. GDPR parity
- Erasure + export wiring for the new column is done in **Part 0c** (both were verified
  missing — a new column is not covered automatically). Masked IBAN is pseudonymized but
  landlord-linked → must be in both.
- Consent = `consent_at` timestamp only; no separate PII.

---

## Part B — Item 16: Entity / SCI landlord verification

### B0. Verify the API contract FIRST (gates the rest of Part B)
- Fetch a live SCI (known SIREN) from `recherche-entreprises.api.gouv.fr` and confirm
  the director field shape (`dirigeants[]` with names) + legal form
  (`nature_juridique`/`complements`). Capture the response as a test fixture. **If
  `dirigeants` is absent/unreliable, switch B1/B2 to the INPI/RNE gérant lookup** (the
  documented fallback). Do not build B2's chain until this is confirmed.

### B1. Extend `french_government_api.py`
- `verify_entity(siren) -> {valid, denomination, is_active, legal_form, dirigeants[],
  location}` via the existing `recherche-entreprises` call (or INPI/RNE per B0); surface
  `dirigeants` + `nature_juridique` (SCI = société civile forms). SIREN = 9 digits,
  distinct from the 14-digit SIRET already handled. Free, no token.

### B2. Landlord-type branch — `POST /verification/landlord-entity/verify`
Body: `landlord_type: individual|sci|manager, siren?, property_id`.
- `individual` → existing path (name-match vs personal identity).
- `sci` → `verify_entity(siren)`; assert the **verified gérant** (this user's verified
  name) appears in `dirigeants` (reuse `name_matches_any`) → chain: verified gérant →
  dirigeant of SCI → SCI `denomination`. Set `kbis_verified = True`. Deposit name-match
  target becomes the **SCI denomination**.
- `manager` (Hoguet carte G) → set `carte_g_verified` scaffolding only; **build no
  mandate/brokering flow** (entremise red line) — verify-only, flag for later.
- Store `user.deposit_binding_data["landlord_entity"] = {type, siren, denomination,
  gerant_match, verified_at}` (same new column as Part 0a) — only public denomination +
  match booleans at rest.

### B3. Wire into deposit-binding
- A3 step 4 becomes type-aware: `sci` → payee holder vs SCI denomination; `individual`
  → vs personal name. Evidence states which entity matched ("compte au nom de la SCI
  vérifiée X").

### B4. Claims + evidence
- Add `landlord_type` + `entity_verified` (denomination, gérant chain yes/no).
- Evidence PDF + verify page: "Bailleur : SCI [denomination] — gérant vérifié ✓".

---

## Edge-case test matrix (per feature — DOSSIER test-per-feature rule)

**Part 0 (schema/GDPR)**
- Migration up/down clean; `alembic heads` = 1.
- Erasure nulls `deposit_binding_data` (assert None after DELETE /gdpr/delete).
- Export includes the masked binding block; masked IBAN only, never raw.

**Item 15**
- Invalid IBAN checksum → 422; valid FR/DE/ES pass; lowercase/spaced normalized.
- Deposit over cap (vide 1.5×) → 422; meublé 2× ok; **mobilité non-zero → 422**.
- Name MATCH vs MISMATCH each render; MISMATCH → amber, never blocks issuance (evidence).
- No consent → 403; raw IBAN + raw declared name **absent** from DB after bind (assert
  `deposit_binding_data`); `bank_ownership_confirmed: false` in every binding.

**Item 16**
- B0 contract check recorded (fixture captured from the live API).
- SCI SIREN with gérant in `dirigeants` → chain MATCH, `kbis_verified=True`.
- Gérant NOT in dirigeants → chain MISMATCH, no kbis flag, binding flags broken link.
- Inactive/dissolved entity → flagged, not verified.
- SIRET(14) vs SIREN(9) handling; API down → non-blocking UNVERIFIED (mirror DPE).
- `manager` sets carte_g scaffolding but exposes **no** mandate/brokering surface.

## Verify (definition of done)
- `pytest` green incl. new matrices; repo suite green; `alembic upgrade head` clean.
- Bind → issue-mine → evidence PDF shows deposit + masked payee + name-match + limit;
  `/c/[id]` renders plain-language, MISMATCH = amber; tenant reads it accountless.
- DB assertion: no raw IBAN / raw declared holder name at rest anywhere.
- GDPR export + erasure both cover `deposit_binding_data` (symmetric).
- FR/EN parity; mobile + empty states.
- **Second audit before merge** (standing rule — PII/identity-touching branch).
- Update DOSSIER §9 items 15/16 → ✅, journal the pass.

## Out of scope (simplicity)
- Tenant self-attested bank-VoP result field (owner deferred).
- Manager/mandataire mandate flow (Hoguet red line — verify-only scaffolding).
- Payment initiation / bank-side IBAN ownership proof (impossible at €0; disclosed).
- Fixing the pre-existing `income_data`/`insurance_data`/`guarantor_data` erasure gap
  (flagged in Part 0c, separate branch).
- INPI/RNE is **not** out of scope — it is the B0 fallback if the free API lacks
  `dirigeants`.

## Build order
0. Part 0 — column + migration + GDPR erase/export wiring. Lands first; both parts import it.
1. Part A (item 15) — IBAN util, cap wrapper, endpoint, claims/PDF/verify-page.
2. B0 API-contract check → Part B (item 16).
3. Second audit → PR.
