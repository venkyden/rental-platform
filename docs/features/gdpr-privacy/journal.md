# Journal — GDPR, Privacy & Mentions Légales

## Purpose
GDPR rights (export/erasure), CNIL cookie consent, and the legally-required publisher
identity (Mentions Légales) for a France-operating site.

## Surface
- Backend: `app/routers/gdpr.py` — `GET /gdpr/export` (Art. 20), `DELETE /gdpr/delete` (Art. 17).
- Frontend: `app/legal/{privacy,gdpr,terms,cgv,cookies,mentions-legales}/page.tsx`,
  `components/CookieConsentBanner.tsx`, `sentry.client.config.ts`.

## French-law touchpoints
- GDPR Art. 15/17/20; CNIL cookie consent (reject as easy as accept; no non-essential
  tracking before opt-in); Mentions Légales (LCEN) publisher identity & host.
- **Operator status: SNEE student-entrepreneur (PÉPITE Pays de la Loire / Audencia), no SIRET.**

## Audit findings → fixes
- 🔴 **Export silently returned nothing.** `gdpr.py:51` queried `Property.owner_id`
  (does not exist; model uses `landlord_id`) and imported `app.models.message`
  (file is `messages.py`) with a non-existent `recipient_id`, all swallowed by
  `except Exception: pass`. **Fixed:** correct column/import, per-table logged guards,
  and the export now also includes applications, documents, leases, disputes.
- 🔴 **Mentions Légales fabricated a legal entity** ("Roomivo SAS", "Capital 10 000 €",
  Paris HQ) and named the wrong host (Vercel/Railway). **Fixed:** now states the SNEE
  student-entrepreneur status, no SIRET (project in incubation), and the real host
  (Render / EU Frankfurt). Footer no longer claims "Roomivo SAS".
- 🟠 **CNIL: Sentry Session Replay ran pre-consent.** **Fixed:** replay gated on the
  `analytics` consent written by `CookieConsentBanner`; error reporting (no replay) kept.
- 🟡 Naive `datetime.utcnow()` in the erasure handler → made tz-aware.

## Audit findings → fixes (2026-07-06, domain audit #8)
- 🔴 **Erasure left PII in the DB (Art. 17 defect).** `delete_user_data` cleared
  identity/employment/ownership/deposit-binding JSONB but **omitted `income_data`,
  `guarantor_data`, `insurance_data`, `visale_id`, `garantme_ref`** and never reset
  `income_status`/`guarantor_status`. `guarantor_data` holds **third-party** (the
  guarantor's) name/metadata. EncryptedJSON at rest is not erasure. **Fixed:** all
  cleared + statuses set to "deleted"; regression test captures the erasure UPDATE and
  asserts every PII column is present (`test_gdpr_domain_audit.py`).
- 🟠 **Export incomplete (Art. 15/20).** Omitted the user's income/guarantor
  verification summary and their **visits**. **Fixed:** added `income_status`,
  `guarantor_status`, `guarantor_type`, `visale_id`, `garantme_ref` to the verification
  block + a `visits` collection (booked-as-visitor / hosted-as-landlord).
- ✅ **Refuted (checked, not bugs):** admin purge check (`UserRole` is a `str`-enum, so
  `role != "admin"` works); erasure does NOT abort on storage errors
  (`delete_files_by_prefix` self-catches, `delete_file` returns False).

## Open (judgment calls — owner decision, not unilaterally changed)
- Erasure anonymises the User row but leaves **message content** and **application
  cover letters** (personal data) linked to the now-anonymised user. Retention may be
  defensible (contractual/legal), but "anonymise sender vs scrub content" is a design
  decision worth an explicit call.

## Backlog
- De-duplicate the repeated `legal` blocks in `frontend/lib/i18n.ts` (last-key-wins smell).
- Add the **directeur de la publication** legal name + official contact email to the notice.
- Enforce a data-retention policy in code (CNIL 3-year limit referenced in i18n only).
- Add the **Art. 27 EU representative** line before real EU users scale (buyable as a
  service; no EU entity required). See memory [[roomivo-incorporation-india]].
