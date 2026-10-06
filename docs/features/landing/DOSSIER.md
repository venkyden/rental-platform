# Landing page and smart search — Feature Dossier

Self-contained reference for the home page (`/`), the trust page (`/trust`) and the
sentence search. Read this before changing any of them. New feature = new conversation.

Last updated: 2026-10-06.

## Rules and checklist (carry-forward)

Copy, set by the founder (see also `CLAUDE.md`, "Direction update — 2026-10-06"):

- No claims about the market or competitors, and no brand-level promises.
- No "what we couldn't check" wording.
- Never name the state tenant-file service. Visale may be mentioned as free guidance.
- No price figure. Structure only: "One small fee. Pay for nothing more."
- The page describes only what the product does today. Add a stop to the thread when a
  feature ships, not before.
- The tagline is the existing `landing.footer.slogan` ("Where your heart wants to live").
- Do not change `Navbar.tsx` or `LandingFooter.tsx` unless asked.
- No stock photos of homes. Stock photos of students are acceptable.

Engineering:

- Every string goes through `t()` with keys in both dictionaries of `lib/i18n.ts`;
  `e2e/i18n_parity.spec.ts` must pass.
- The page must render with no backend: listings appear only at three or more real ones.
- Check both audiences, both languages, 320px to 1920px, reduced motion and keyboard use.

## What exists

- `app/page.tsx` — Navbar, `HomeExperience`, `FeaturedListings`, `EndorsementStrip`, footer.
- `components/landing/home/HomeExperience.tsx` — audience switch ("Moving to France" /
  "Letting a place"), hero with the tagline and the logo opened into four spokes, the
  smart search, the scroll-drawn gold thread with four stops, the final call.
- `components/landing/home/screens.tsx` — phone wireframes for each stop, per audience.
- `lib/smartSearch.ts` — `parseSearch`, `toSearchUrl`, `suggestCities`, `formatMonth`.
  Deterministic, local, English and French. Understands place, home type, bedrooms,
  bathrooms, budget, furnished, flatshare, amenities, move-in month and length of stay.
- `app/search/page.tsx` — reads `max_rent`, `bedrooms`, `bathrooms`, `amenities`, `from`,
  `months`; shows the last five as removable chips.
- `backend/app/routers/properties.py` — filters `bathrooms_min`, `min_duration_months`
  (flexible listings kept), `available_by` (undated listings kept). Malformed values are
  ignored.
- `app/trust/page.tsx` — `CredentialLayerSection` with the verify-by-code box.
- `app/icon.svg` — the gold mark. Self-hosted Playfair Display in `public/fonts/` (OFL).

## Tests

- `e2e/landing.spec.ts` — content for both audiences, smart search behaviour, hostile
  input, malformed URL parameters, listings block at 2, 3 and API failure, French
  completeness, language switch, overflow at seven widths, rapid switching, reduced
  motion, keyboard, broken images, server-rendered markup.
- `e2e/smart_search.spec.ts` — the parser, including ambiguous words and hostile input.
- `backend/tests/test_typology_filters.py` — the three new filters and hostile values.
- 2026-10-06: 117 frontend tests passed on Chromium, WebKit and mobile Chrome; 80 backend
  tests passed.

## Known limits and open items

- The search understands English and French only. Any-language interpretation is WS-6 in
  the roadmap.
- The city list in `smartSearch.ts` is a fixed set of student cities; other places are
  kept as typed.
- French copy was written without a native review.
- The phone wireframes are illustrations. The example applicant and listing are invented.
- The existing navbar's wordmark and "Get started" button touch at 390px. Not changed, by
  instruction.
- Three existing console-cleanliness tests could not be confirmed on the development
  machine because its local backend rejected the test origin.
- Roadmap: `docs/superpowers/plans/2026-10-06-ecosystem-roadmap-master.md`.
