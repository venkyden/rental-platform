# Property Listing Wizard — Feature Dossier

Self-contained reference for the landlord listing-creation flow (`/properties/new`).
Complements `journal.md` (backend compliance) — this dossier is the all-aspects view.

## Rules & Checklist (carry-forward)
Holistic audit per feature: schema · logic · routes · APIs · UI · FR/EN i18n parity ·
a11y · security · bugs · animation (only if needed) · style · perf · glitch-free ·
cross-browser (iOS/Safari/Chrome/Android). Bar: best-in-class, production-ready, simple
yet powerful, no gimmick copy. Test each feature's edge cases before moving on; rate
limiting + input validation considered per feature. New feature = new conversation;
read this dossier first.

Status: 🔴 blocking · 🟠 important · 🟡 polish · ✅ done.
Last updated: 2026-05-31.

## Scope
8-step wizard + success screen in `frontend/app/properties/new/page.tsx` (≈1300 lines,
single file). Backend: `POST /properties` (create draft), `POST /properties/{id}/media-session`
(QR for mobile photo capture), `POST /location/enrich`, `POST /properties/generate-description`
(AI), `POST /properties/{id}/publish`. Model `backend/app/models/property.py`.

Steps: 1 Identity (title + type) · 2 Location (address autocomplete + city/zip) ·
3 Details (bedrooms, surface, DPE A–G) · 4 Layout & capacity (per-room) · 5 Pricing
(rent, charges, deposit, encadrement/loi ELAN, ERP/loi ALUR, CAF) · 6 Amenities ·
7 Description (EN/FR tabs + AI suggest) · 8 Review + legal declaration → submit ·
9 Success (QR code for mobile photo capture, optional publish).

## Done this pass (✅)
- **Killed gimmick copy (EN+FR)** — "Listing Protocol"→"Create a listing", "Next Protocol"→
  "Continue", "Commit to Registry"→"Create listing", "Review Protocol"→"Review & publish",
  "Initializing Asset Registry"→"Let's get started", "Return to Terminal"→"Back to dashboard",
  "Energy Protocol"→"Energy rating (DPE)", "Verify Connectivity & POIs"→"Verify transit &
  nearby places", sidebar "Listing Intelligence/400% engagement protocols"→plain tips,
  "Force Publish"→"Publish now". `properties.new` i18n parity 80/80.
- **e2e repaired** (`frontend/e2e/properties_wizard.spec.ts`): the test was stale vs the
  i18n refactor + missed the legal-declaration checkbox. Fixes: match new copy, correct
  address-autocomplete placeholder ("Start typing an address…"), **mock Photon geocoder +
  click suggestion** (Step 2 validation needs address_line1 which only the autocomplete
  selection sets), DPE button by exact aria-label, mock `/location/enrich`, check the
  `#declaration-checkbox` (sr-only → force) before submit. Green on chromium + webkit.
- **reduced-motion fix (a11y + flake):** the framer step transition wasn't gated by
  `useReducedMotion()`, so Continue was "not stable" mid-animation → flaky clicks. Now
  gated (instant transitions under reduce-motion); spec uses `test.use({ reducedMotion:
  'reduce' })`. Verified with `--repeat-each=2`.

## Findings / TODO
- 🟠 **Single 1300-line component** — `page.tsx` holds all 8 steps inline. Hard to test/
  maintain. Recommend extracting one component per step + a shared wizard shell.
- 🟠 **Client/server compliance duplication** — decency (9m²), deposit cap, DPE-G ban,
  encadrement live in BOTH the wizard (warnings) and `french_compliance.py` (enforced at
  publish). Keep backend authoritative; ensure client only mirrors, never gates legally.
- 🟡 **Micro-typography** — pervasive `text-[9px]/[10px]` uppercase `tracking-[0.4em]`
  (same legibility issue flagged in auth). Review for readability/mobile.
- 🟡 **a11y** — step inputs mostly rely on adjacent `<label>` text, not `htmlFor`/`id`
  association; verify wizard is keyboard + screen-reader navigable across steps.
- 🟡 **reduced-motion** — framer step transitions not gated by `useReducedMotion()`.
- 🟡 **Draft persistence** — long 8-step form has no autosave; a reload loses everything.
- 🟢 Real French-law fields present (DPE, loyer de référence/majoré, complément + justif,
  ERP, CAF) and enforced server-side at publish (see journal.md).

## Verification
Build + `npx playwright test properties_wizard` from `frontend/`. tsc 0 errors.
