# E-sign Path B — landlord-uploaded lease → e-sign → tamper-evident proof

Date: 2026-06-24. Status: design (build pass, branch `feat/esign-path-b`).
Source of truth: `docs/features/trust-layer/DOSSIER.md` §0.16, §5.6, §5.7, §6, §12.1.

## Decision (recorded from this session)
- **Engine: in-house Ed25519**, not DocuSeal/Documenso. Founder constraint: **0 opex/capex**
  — no second service to host/operate, no AGPL surface to manage. We reuse the credential
  signing key (`CredentialService`), the watermark util, and the evidence-PDF pattern that
  already ship. DocuSeal/Documenso stay the **deferred SG-5 "max robustness / QTSP" v2**
  upgrade (DOSSIER §5.7 SG-5), not Phase 1.
- **Path B before Path A** (DOSSIER §0.16): landlord uploads *their own* lease. Roomivo
  never drafts wording → stays clear of loi 1971. Legal basis: French residential lease is
  an *acte sous seing privé* → **no qualified signature required**; eIDAS simple/advanced is
  valid for a bail (DOSSIER §5.7).

## Scope (v1)
Upload → both **verified** parties sign → emit a tamper-evident **signature evidence pack**.
The uploaded lease is screened by the **§5.6 legality red-line** (`lease_legality.py`,
deterministic): LU-1 (no text layer), LU-2 (art. 4 prohibited-clause patterns, partial),
LU-4 (DPE/ERP/notice referenced), LU-5 (FR-law / foreign governing law) → **VALIDATED** or
**ATTACHED / NOT LEGALITY-VERIFIED**. It never gates signing (LU-6): flags are shown in the UI
and recorded in the signed manifest. LU-3 (deposit/rent over cap) is deferred to AI extraction.

Out of v1: Path A template generation; DocuSeal/QTSP; LU-3 + AI clause extraction; frontend
wizard (a thin status/sign UI follows; the cryptographic rail is the load-bearing core).

## Boundaries held (DOSSIER §1)
- No success fee — flat per-verification only. No funds touched: deposit/rent flow
  tenant→landlord off-platform; we record agreed terms + signatures only.
- Roomivo authors **no** lease wording in Path B (landlord's own document).
- No PII source documents at rest. The signed lease **is** the mutual instrument both
  parties retain (a contract, not an identity/financial source doc) — storing it + its hash
  is in-scope and distinct from the statelessness rule, which targets ID/income docs.

## Edge cases (DOSSIER §5.7) → enforcement
| ID | Rule | Where |
|----|------|-------|
| SG-1 | Signer must be a **verified** party (`identity_verified`) **and** the lease's landlord/tenant — else **block** | `esign.can_sign` (pure) + router 403 |
| SG-2 | One party abandons → **no manifest emitted**, lease stays `awaiting_signatures`; nothing finalised | manifest built only when both present |
| SG-3 | Document altered after signing → hash mismatch → signing/verify fails, surfaced | `document_hash` re-checked at every sign + in `verify_manifest` |
| SG-4 | Dispute → produce **evidence pack** (label AES, not QTSP) | `export_signature_evidence_pdf` |
| SG-5 | Max robustness → QTSP upgrade | **deferred (v2)** |

## Data model — extend `Lease` (`visits_and_leases.py`)
- `document_hash: str|None` — SHA-256 hex of the exact signed PDF bytes (SG-3 anchor).
- `document_source: str` — `"uploaded"` (Path B) | `"generated"` (Path A, future).
- `esign_manifest: JSONB|None` — the Ed25519-signed manifest, emitted only when both sign.
- Reuse existing `signature_data` (JSONB) for the in-progress **audit trail** (per-signer:
  party, user_id, credential ref, identity_assurance, signed_at, ip, user_agent, consent),
  existing `landlord_signature`/`tenant_signature` (drawn PNG / typed marker), `pdf_path`,
  and `status` (`awaiting_signatures` → `signed`).

## Service — `app/services/esign.py` (pure, unit-tested)
- `compute_document_hash(pdf_bytes) -> str` (SHA-256 hex).
- `can_sign(user, lease) -> (bool, reason)` — SG-1.
- `build_audit_entry(party, user, ip, user_agent, consent) -> dict`.
- `build_manifest(lease, audit_entries, document_hash) -> dict` — canonical, party assurance tiers.
- `sign_manifest` / `verify_manifest` — via `CredentialService.sign_payload`/`verify_payload`
  (one signing key, same canonical-JSON discipline as credentials).
- `export_signature_evidence_pdf(...) -> bytes` — watermarked, lists both signers + assurance
  + doc hash + timestamps + IP + consent + Ed25519 sig + verify-by-ID instruction (§12.1).

## Endpoints — `app/routers/esign.py`
- `POST /esign/leases/{id}/document` (landlord, identity-verified) — multipart PDF; hash + store.
- `POST /esign/leases/{id}/sign` (party) — `{signature_image?|typed_name?, consent}`; SG-1, SG-3, consent.
- `GET  /esign/leases/{id}/status` — signing state for the UI.
- `GET  /esign/leases/{id}/evidence.pdf` (party) — only when `signed`.
