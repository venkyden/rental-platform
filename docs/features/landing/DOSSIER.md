# Landing page and smart search — Feature Dossier

Self-contained reference for the home page (`/`), the trust page (`/trust`) and the
sentence search. Read this before changing any of them. New feature = new conversation.

Last updated: 2026-10-07 (review fixes after PR #86).

## Rules and checklist (carry-forward)

Copy, set by the founder (see also `CLAUDE.md`, "Direction update — 2026-10-06"):

- No claims about the market or competitors, and no brand-level promises.
- No "what we couldn't check" wording in marketing copy. The credential and verify pages
  keep their own disclosures.
- Never name the state tenant-file service. Visale may be mentioned as free guidance.
- No price figure. Structure only: "One small fee. Pay for nothing more." Since
  2026-10-07 the page does not say when the fee is charged (roadmap open decision 4).
- The page describes only what the product does today, with one founder-approved
  exception: the fee structure is shown although nothing is charged yet. Add a stop to the
  thread when a feature ships, not before.
- The tagline is the existing `landing.footer.slogan` ("Where your heart wants to live").
- Do not change `Navbar.tsx` or `LandingFooter.tsx` unless asked.
- No stock photos of homes. Stock photos of students are acceptable.

Engineering:

- Every string goes through `t()` with keys in both dictionaries of `lib/i18n.ts`;
  `e2e/i18n_parity.spec.ts` must pass.
- The page must render with no backend: listings appear only at three or more real ones.
- Check both audiences, both languages, 320px to 1920px, reduced motion and keyboard use.
- `e2e/landing.spec.ts` checks the copy rules against every `landing.home` string in both
  dictionaries. Extend that test when a rule is added.
- Gold on the cream background: `--gold` fails contrast for text. Use `#b07c12` for the
  large italic headline, `#946608` for buttons and pills, `#8a5e07` for small text.

## What exists

Paths are relative to `frontend/` unless they start with `backend/`.

- `app/page.tsx` — Navbar, `HomeExperience`, `FeaturedListings`, `EndorsementStrip`, footer.
- `components/landing/home/HomeExperience.tsx` — audience switch ("Moving to France" /
  "Letting a place"), hero with the tagline and the logo opened into four spokes, the
  smart search, the scroll-drawn gold thread with four stops, the final call.
- `components/landing/home/screens.tsx` — phone wireframes for each stop, per audience.
  Each is one labelled image for screen readers.
- `components/landing/FeaturedListings.tsx` — up to six of the twelve newest active
  listings; renders nothing below three, while loading, or when the API fails.
- `lib/smartSearch.ts` — `parseSearch`, `toSearchUrl`, `suggestCities`, `formatMonth`.
  Deterministic, local, English and French. Understands place (known city, district of
  Paris, Lyon or Marseille, typed postcode, or free text), home type, bedrooms, bathrooms,
  budget, furnished, flatshare, amenities, move-in month and length of stay. A filter the
  visitor rules out ("without parking") is not applied.
- `app/search/page.tsx` — reads `q`, `typology`, `furnished`, `colocation`, `max_rent`,
  `bedrooms`, `bathrooms`, `amenities`, `from`, `months`; shows the last five as removable
  chips; Reset clears them; a failed load shows an error with a retry.
- URL to API (`GET /properties`): `q` to `city` (substring of city, postcode or address, 3+
  characters; a district is sent as its postcode), `bedrooms` to `bedrooms` (minimum),
  `bathrooms` to `bathrooms_min`, `months` to `min_duration_months`, `from` (YYYY-MM) to
  `available_by` (last day of that month), `amenities` repeated.
- `backend/app/routers/properties.py` — filters `bathrooms_min` (a listing with no count
  is treated as one bathroom), `min_duration_months` (flexible listings kept),
  `available_by` (undated listings kept). Malformed or oversized values are ignored.
- `app/trust/page.tsx` — `CredentialLayerSection` with the verify-by-code box.
- `lib/i18n.ts` — key groups `landing.home.*` and `search.smart.*`, in both dictionaries.
- `app/sitemap.ts` lists `/search` and `/trust`. `app/globals.css` has the `font-display`
  and `paper-grain` utilities. `app/icon.svg` is the gold mark. Self-hosted Playfair
  Display in `public/fonts/` (OFL).
- Deleted in PR #86: `SearchHero`, `ValuePropSection`, `HowItWorks`,
  `FrenchComplianceSection`, `DualCTA` and the three stock apartment images.
  `CredentialLayerSection` was kept and is now used by `/trust` only.

## Tests

- `e2e/landing.spec.ts` (34) — content for both audiences, copy rules over both
  dictionaries, phone drawings as labelled images, smart search behaviour and
  announcements, hostile input, malformed URL parameters, the parameters sent to the
  listings API, chip removal, Reset, the error state, listings block at 2, 3 and API
  failure, French completeness, language switch, overflow and clipped text at seven
  widths, rapid switching, reduced motion, keyboard, broken images, rendering without
  JavaScript.
- `e2e/smart_search.spec.ts` (18) — the parser: negations, ranges and lower bounds,
  districts and postcodes, end months, ambiguous words, hostile input, and the landing
  page's own examples in both languages. No browser.
- `e2e/i18n_parity.spec.ts` (3) — every key exists in both dictionaries. No browser.
- `backend/tests/test_typology_filters.py` (26) — the list filters, with the generated SQL
  checked, and hostile values.
- `backend/tests_integration/test_listing_filters.py` (5) — the same filters against real
  rows in Postgres.
- 2026-10-07, on the development machine: 55 Playwright tests, each run on Chromium,
  WebKit and mobile Chrome = 165 passes; 82 backend unit tests in four files
  (`test_typology_filters`, `test_properties`, `test_property_edge_cases_stress`,
  `test_colocation`), not the whole suite; 5 integration tests; `next build` and `tsc`
  clean.
- Not confirmed on the development machine: `interaction_smoothness.spec.ts` ("no unhandled
  console errors during landing page interaction"), `qa_navigation_smoothness_regression.spec.ts`
  ("Standard page navigation produces no unhandled runtime console errors") and
  `qa_interactive_surfaces.spec.ts` ("Zero console error logs during standard page
  navigation"). They fail there because the local backend refuses the test port's origin
  (CORS); the console output shows no other error. CI runs them against its own backend.

## Known limits and open items

- The search understands English and French only. Any-language interpretation is WS-6 in
  the roadmap.
- The city list in `smartSearch.ts` is a fixed set of student cities. Any other place is
  taken from what is left of the sentence once filters and filler words are removed, so an
  unrecognised phrase can end up as the place. The result is cut to 60 characters.
- Only the first bare number is considered as a budget. A lower bound ("at least 500") is
  ignored, because the search has no minimum-rent control from the sentence.
- A negated filter is dropped, not inverted: "without parking" does not exclude listings
  with parking.
- "Nice" and "Tours" are read as cities only after a preposition or at the end of the
  sentence.
- French copy was written without a native review.
- The phone wireframes are illustrations. The example applicant and listing are invented,
  and the fee phone shows a fee that is not charged yet.
- Without JavaScript the page is in the markup but stays invisible: the site-wide page
  transition in `app/template.tsx` starts every route at zero opacity. Inside the landing
  component the headline and stops no longer depend on an animation. Roadmap open
  decision 7.
- The decorative hero nodes and the phone drawings still fade in on scroll and are
  invisible until scripts run.
- The existing navbar's wordmark and "Get started" button touch at 390px. Not changed, by
  instruction.
- Roadmap: `docs/superpowers/plans/2026-10-06-ecosystem-roadmap-master.md`.
