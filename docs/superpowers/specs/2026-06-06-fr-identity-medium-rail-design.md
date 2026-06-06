# FR identity — honest MEDIUM rail now, HIGH deferred

**Sub-feature #3** of the Trust Layer (DOSSIER §9, item 3).
Date: 2026-06-06. Status: design approved, pending spec review.
Worktree per [[feedback_git_worktree]]; tested edge-case-by-edge-case per
[[roomivo-test-per-feature]].

---

## 1. Problem & corrected premise

The DOSSIER (§5.1, §9.3) and `CLAUDE.md` assume FR HIGH identity comes from the
France Identité *justificatif* validated at an API. Two corrections are now load-bearing:

- `idp.france-identite.gouv.fr/valider-attest` is a **human web portal, not a
  programmatic API**, and the justificatif route requires new-CNI (2021+) + NFC phone
  + France Identité app activation — rejected as excessive friction by the product owner.
- The only zero-OPEX, no-habilitation method available today — parsing the avis
  d'imposition 2D-Doc — gives state-cryptographic *document authenticity* but **cannot
  bind a document to the person presenting it** (no photo, no possession proof). Identity
  assurance = document authenticity × binding-to-presenter. Without binding, an avis name
  is **not HIGH identity**.

Conclusion: no honest FR HIGH identity rail is achievable today at zero OPEX without
hardware/habilitation friction. This sub-feature therefore:

1. Fixes the 🔴 **AS-1** bug — OCR+selfie identity is silently treated as fully verified;
   it must be labelled **MEDIUM**.
2. Adds a state-signed **name cross-check** from the avis 2D-Doc to corroborate the OCR'd
   ID name (anti-fraud strengthening; assurance stays MEDIUM — no presenter binding).
3. Records **FranceConnect** as the real deferred HIGH path (gated behind incorporation),
   and reconciles the docs that assumed the justificatif API.

**Non-negotiable (CLAUDE.md / DOSSIER §2):** never inflate MEDIUM to HIGH; never store
identity/financial source documents at rest; banded claims only; never gate by nationality.

## 2. Scope

In scope:
- **A. Python 3.13 upgrade** — prerequisite for `betagouv/2ddoc-parser` (requires 3.13+).
- **B. MEDIUM retrofit** — label every OCR+selfie identity result MEDIUM at the User level.
- **C. Avis 2D-Doc pipeline** — decode → parse → ECDSA verify → `declarant1` → name match.
- **D. FranceConnect-deferred documentation** + DOSSIER/CLAUDE.md reconciliation (no code).

Explicitly out of scope (surgical / YAGNI):
- The `+30 trust_score` value is **not** rebalanced — the assurance label is what makes it
  honest; trust-score redesign is a separate task.
- The Stripe `identity_service.py` path is **not** touched (product owner excluded it;
  removal was not requested).
- The INTL rail, solvency banding (#4 reuses the pipeline for RFR), property (#5), wiring (#6).
- No new `VALID_IDENTITY_SOURCES` entry for FranceConnect until it can actually be issued.

## 3. Part A — Python 3.13 upgrade

`betagouv/2ddoc-parser` (MIT, actively maintained, v1.0.5 / Mar 2026) requires **Python
3.13+**; the backend runs 3.12 (`.python-version` = 3.12.2, `Dockerfile` = `python:3.12-slim`).

Changes:
- `.python-version` → `3.13`.
- `Dockerfile` builder and runner stages → `python:3.13-slim`.
- CI matrix (if any) → 3.13.
- Dependency bumps required for 3.13 wheels:
  - `asyncpg==0.29.0` → `>=0.30.0` (0.30 added 3.13 support; 0.29 has no 3.13 wheels).
  - `psycopg2-binary==2.9.9` → `2.9.10` (3.13 wheels).
  - Re-resolve `celery==5.3.4`, `pytest==7.4.4`, `pytest-asyncio==0.23.5` if they block.
- **Highest-risk item:** `passlib==1.7.4`. Python 3.13 **removed the stdlib `crypt`
  module** (PEP 594). passlib imports `crypt` lazily. Mitigation: confirm the argon2 /
  bcrypt backends actually used still load on 3.13; pin/patch or migrate the hashing call
  site if the import path errors. Must be verified, not assumed.

**Success gate:** `pytest` full suite green on 3.13 locally **and** `docker build` succeeds
on `python:3.13-slim`. This is the **first, isolated commit** so any regression is bisectable.

## 4. Part B — MEDIUM retrofit

Today the OCR+selfie success branches set `identity_verified=True`,
`identity_status="verified"`, `+30 trust_score`, with **no assurance label**:
- `backend/app/routers/verification.py` selfie-with-id branch (~L147–159)
- mobile path (~L398–419)
- selfie-completion path (~L624–640)

Change (surgical): in each branch that marks OCR+selfie verified, add to `identity_data`:
```python
"identity_assurance": "MEDIUM",
"identity_source": "ocr_liveness",   # already a registered MEDIUM-only source
```
Surface `identity_assurance` on `VerificationStatusResponse` and the status endpoint.

**Inference-on-read** (back-compat, no migration): when reading a user's identity state —
- `identity_verified=True` but no `identity_assurance` in `identity_data` → report `MEDIUM`
  (every existing verification is OCR+selfie);
- not verified / `document_uploaded` / front-only → report `UNVERIFIED`.

`ocr_liveness` → MEDIUM is already enforced at credential issuance
(`credential.py` `_validate_claims`, MEDIUM_ONLY_SOURCES). This retrofit makes the
User-level record agree, so a credential issued later (in #6) carries the honest source.

## 5. Part C — Avis 2D-Doc pipeline

New service `backend/app/services/fr_2ddoc.py` — a well-bounded unit, reused by #4 for RFR.

Flow:
```
avis file (PDF or image)
  → if PDF: rasterize page (PyMuPDF)
  → DataMatrix decode (pylibdmtx → libdmtx system lib)
  → 2ddoc-parser, Type 28 (AvisImposition)
  → ANTS ECDSA verify (bundled TSL, offline; P-256/384/521)
  → declarant1 (+ declarant2 if a couple)
```
The decoded, signature-verified name is compared to the OCR'd ID name via the existing
`_fuzzy_name_match` in `identity.py`. **Outcome is a flag, not a tier change** — assurance
stays MEDIUM. On match, `identity_data` gains `"identity_name_corroborated_by": "avis_2ddoc"`.

New endpoint: `POST /verification/identity/avis-cross-check` (authenticated), accepting the
avis upload; returns `{corroborated: bool, reason: str}`. Requires an existing MEDIUM identity.

New dependencies:
- `betagouv/2ddoc-parser` — installed via git ref (not on PyPI), MIT.
- `pylibdmtx` (LGPL) + `libdmtx` system lib added to the Dockerfile.
- `PyMuPDF` (AGPL — used unmodified as a library, acceptable). Alternative `pdf2image`
  + poppler if AGPL-as-dependency is undesirable; decide at implementation.

### 5.1 Edge cases (each ≥ one test)
| # | Case | Expected |
|---|---|---|
| C-1 (SV-1) | Avis printed text edited, barcode intact | Read **signed payload** → printed-text tampering moot. Core win. |
| C-2 | Barcode unreadable / cropped / low-res | **Block**, "rescan". Never OCR-fallback the avis (would void the signature guarantee). |
| C-3 | ECDSA verify fails (forged / unknown cert) | **Block** corroboration; identity stays plain MEDIUM, no flag. |
| C-4 | Wrong 2D-Doc type (e.g. justificatif de domicile) | Reject; only Type 28 accepted. |
| C-5 | Name mismatch (declarant1) | Check declarant2 too (ID holder may be the spouse); tolerate accents + NOM/Prénom order. No flag if still mismatched. |
| C-6 | Avis uploaded before identity exists | **400** "verify identity first." |
| C-7 | GDPR | Avis processed transiently; discard source; store only the boolean flag (never RFR here — that's #4). |
| C-8 | TSL freshness | A new ANTS signing cert issued after the bundled TSL fails verify. Documented limitation + TSL-refresh note; treat as C-3 (no corroboration, no crash). |

## 6. Part D — FranceConnect deferred + doc reconciliation

No code. Reconcile docs to reality:
- DOSSIER §5.1 / §9.3 and `CLAUDE.md` currently name the justificatif `valider-attest`
  *API* as the HIGH path → correct to: **FR HIGH identity = FranceConnect (OIDC),
  gated behind incorporation** (SIRET + DataPass + 4 governance roles — Data Controller,
  DPO, Technical Manager, ISSM — per décret du 8 nov. 2018). Record the justificatif route
  as rejected-for-friction.
- No new `VALID_IDENTITY_SOURCES` entry until FranceConnect can actually be issued.

## 7. Test matrix (DOSSIER rows closed)

`tests_integration/`, real DB, `make_user`/`auth` helpers, mocked decode/parse/AI.

| DOSSIER row | Test |
|---|---|
| AS-1 | OCR+selfie verified → `identity_data.identity_assurance == "MEDIUM"`, source `ocr_liveness`, across all three upload branches. |
| AS-3 | Already green in `test_credential_core.py` (HIGH only from HIGH source). |
| AS-4 | Front-only / `document_uploaded` → status reports `UNVERIFIED`. |
| ID-4 | No-CNI / no-NFC user → MEDIUM, labelled (never silently HIGH). |
| back-compat | Pre-existing verified user without label → status infers `MEDIUM`. |
| C-1…C-8 | Pipeline edges from §5.1. |

## 8. Sequencing (commits)

1. Python 3.13 upgrade + dep bumps; full suite + Docker green. *(isolated, bisectable)*
2. MEDIUM retrofit (Part B) + tests.
3. Avis 2D-Doc pipeline (Part C) + tests.
4. Doc reconciliation (Part D).

## 9. Success criteria

- Full test suite green on Python 3.13; Docker image builds on `python:3.13-slim`.
- Every OCR+selfie identity result carries `identity_assurance: MEDIUM` / source
  `ocr_liveness`; no path can present it as HIGH.
- Avis cross-check corroborates the ID name from the **signed payload** only; failure modes
  block cleanly without crashing or downgrading to OCR-of-avis.
- No source documents at rest; no raw figures stored.
- DOSSIER + CLAUDE.md no longer reference a non-existent justificatif API; FranceConnect
  recorded as the gated HIGH path.
