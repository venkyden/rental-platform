# DPIA — Selfie ↔ ID Biometric Face-Match (DRAFT for counsel review)

> Status: **DRAFT** written by the engineering side 2026-07-04 (master plan WS-2).
> To be reviewed/completed by counsel on the same engagement as the e-sign opinion
> (Galand, `2026-06-20-avis-avocat-esign-lease-galand.md`). Controller designation
> is tied to the incorporation timeline (currently: unincorporated SNEE founders —
> see CLAUDE.md "no SIRET" note).

## 1. Processing description

To reach MEDIUM identity assurance, the user photographs their ID document and a
selfie (single `selfie_with_id` image, or a two-step document + selfie flow). A
face-match compares the selfie against the ID portrait (1:1 biometric
**verification**, never 1:many identification). Rails: FR (`/verification/identity/*`)
and INTL (`/verification/intl/identity/selfie`).

- **Data:** ID document image, selfie image, derived boolean match result.
- **Storage:** none at rest. In-flight document images live in Redis with a 10-minute
  TTL (R2 fallback purged on completion); images are deleted immediately after the
  check **including on failure/rejection** (statelessness retrofit, 2026-06-15).
  What persists: booleans/labels only (`identity_verified`, assurance tier) and the
  banded credential. No embeddings, templates, or images are retained.
- **Processors:** OCR/extraction currently via Google Gemini API (US subprocessor —
  disclosed in the privacy policy; Vertex-AI-EU migration on the roadmap). Face
  match runs in our backend (DeepFace, open source).

## 2. Lawful basis

Art. 9(2)(a) — **explicit consent**, implemented 2026-07-04:

- Consent screen shown before any capture UI (web + mobile QR flow), FR/EN,
  stating purpose, transience, non-retention, and the right to refuse.
- Recorded server-side (`biometric_consents`: user id, wording version, timestamp,
  user agent — **no biometric data**). Wording changes bump
  `BIOMETRIC_CONSENT_VERSION` and force re-consent.
- Enforced at the API: every selfie endpoint returns 403
  `BIOMETRIC_CONSENT_REQUIRED` without a recorded consent at the current version.
- **Refusal alternative:** document-only verification; identity stays UNVERIFIED /
  lower assurance with no loss of account access — consent is not a condition of
  service (Art. 7(4) freely-given test).
- Consent records are retained after account anonymisation as evidence of lawful
  processing (Art. 17(3)(b)) and included in the Art. 15 export.

## 3. Necessity & proportionality

Purpose: anti-scam identity assurance for rental transactions (deposit-theft
prevention). The face-match is the minimum binding between the presented document
and the presenter; alternatives (video call review, in-person) are
disproportionate for a free consumer service. Data minimisation: 1:1 match,
transient processing, boolean output, banded credential.

## 4. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Biometric data breach at rest | **No biometric data at rest** (core architectural mitigation) |
| Interception in flight | TLS everywhere; Redis TTL 10 min; per-upload session tokens |
| False accept (OSS liveness weakness) | Result capped at MEDIUM, never presented as HIGH; relying-party copy states the limit |
| Function creep (1:many, scoring) | Bright lines in CLAUDE.md / DOSSIER §0.19: 1:1 only, no ML scoring, no auto-gating |
| Consent invalidity (bundled/forced) | Dedicated screen, unticked checkbox, refusal path with functional alternative |
| US subprocessor transfer (Gemini) | Disclosed; EU-residency migration planned before B2B scale |

## 5. Open items for counsel

1. Confirm Art. 9(2)(a) analysis and the freely-given test given the assurance-tier
   consequence of refusal.
2. Controller designation pre-incorporation (SNEE founders) and DPO need.
3. Whether a CNIL prior consultation (Art. 36) is triggered — our view: no, residual
   risk is low given non-retention, but confirm.
4. Retention period for consent records (proposal: life of account + 5 years).
5. EU AI Act classification memo (DOSSIER §0.19) — same engagement.
