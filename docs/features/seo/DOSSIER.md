# SEO — Feature Dossier

Self-contained reference for Roomivo's SEO/discoverability. Per the engagement
rules, this covers all relevant aspects and is the handoff for any future SEO work.

## Rules & Checklist (carry-forward)
Holistic per-feature audit — for SEO that means: metadata (title/description/canonical),
Open Graph + Twitter cards, structured data (JSON-LD), sitemap, robots, PWA manifest,
i18n/hreflang, crawlability of private routes, Core Web Vitals/perf, cross-browser.
Bar: best-in-class, bilingual FR/EN, production-ready. Test/verify via `next build`
(watch for metadata warnings) + inspect generated `/sitemap.xml`, `/robots.txt`,
`/opengraph-image`. New feature = new conversation; read this dossier first.

Status legend: 🔴 blocking · 🟠 important · 🟡 polish · ✅ done.
Last updated: 2026-05-31.

## What exists & is good (✅)
- App Router metadata API in use; root `app/layout.tsx` + per-page `app/page.tsx`
  and `app/properties/[id]/page.tsx` (`generateMetadata`).
- `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx` (next/og, bilingual),
  `public/manifest.json`.
- JSON-LD: Organization (home), accommodation (property page).

## Fixed this pass (✅)
- 🔴 **`metadataBase` was unset** → OG/Twitter images resolved to `localhost:3000`
  in prod (3 build warnings). Added `metadataBase: new URL(SITE_URL)` in root layout.
  New `SITE_URL` constant in `lib/constants.ts` (`NEXT_PUBLIC_SITE_URL` override → `https://roomivo.eu`).
- 🔴 **Broken OG image refs** — home metadata pointed at `/og-image.png` (404) which
  OVERRODE the working `app/opengraph-image.tsx` convention. Removed the explicit
  refs so next/og auto-populates OG+Twitter. (Logo JSON-LD `/logo.png` 404 → now `/icons/icon-512.png`.)
- 🔴 **Stale `manifest.json`** — said "Rental Platform"/indigo `#4F46E5`. Now "Roomivo",
  theme `#18181b` (matches app), maskable icon, `lang: fr`.
- 🟠 **Sitemap was static & thin** (5 URLs). Now dynamic (ISR, `revalidate=3600`):
  all public static routes + legal pages + **property detail pages** fetched from the
  API (`/properties?limit=1000`), with a safe empty fallback if the API is down.
- 🟠 **robots.ts** hardened: also disallow `/profile /auth /verify /verify-capture
  /capture /onboarding`; uses `SITE_URL`; added `host`.
- 🟠 Root metadata: title `template` (`%s · Roomivo`), `alternates.languages` FR/EN, both icon sizes.
- 🟡 Home JSON-LD switched from plain `<script>{json}` to `dangerouslySetInnerHTML`
  (reliable SSR render, matches property page).

## Still TODO
- 🟠 **Real hreflang** — `alternates.languages` currently points FR & EN at the same
  `/` because the app is single-URL with a client language toggle. True SEO i18n needs
  either locale-prefixed routes (`/fr`, `/en`) or per-locale URLs. Decide architecture.
- 🟠 **`lang="fr"` is hardcoded** in `<html>` (layout.tsx) while the UI toggles FR/EN
  client-side — screen readers/search get the wrong lang when user picks EN. Tie to language.
- 🟡 Guides (`/guide/[slug]`) are client-only and not in the sitemap or prerendered —
  no slug source found. If guides are SEO targets, make them server-rendered + enumerable.
- 🟡 Property `generateMetadata` falls back to NO image when a listing has no photo;
  consider falling back to the site OG image.
- 🟡 Verify Core Web Vitals (LCP/CLS/INP) on home + search + property (master rule §10).
- 🟡 Add BreadcrumbList JSON-LD on property pages; consider `Place`/`geo` for local SEO.

## Verification
`cd frontend && ./node_modules/.bin/next build` → 0 metadataBase warnings; routes
`/sitemap.xml` (ƒ/ISR), `/robots.txt`, `/opengraph-image` all generate; tsc 0 errors.
