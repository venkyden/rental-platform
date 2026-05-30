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

## Backlog
- De-duplicate the repeated `legal` blocks in `frontend/lib/i18n.ts` (last-key-wins smell).
- Add the **directeur de la publication** legal name + official contact email to the notice.
- Enforce a data-retention policy in code (CNIL 3-year limit referenced in i18n only).
