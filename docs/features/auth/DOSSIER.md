# Auth — Feature Dossier

Holistic, all-aspects reference for the Authentication feature. Grouped so any
aspect (schema, routes, UI, i18n, a11y, security, perf, cross-browser…) is found
in one place. Frank verdicts: **KEEP / FIX / REPLACE / KILL**.

Status legend: 🔴 blocking · 🟠 important · 🟡 polish · ✅ good.
Last updated: 2026-05-31 (commit d87b6b0). Batch-1 backend security fixes applied & tested.

> **Frontend pass 1 done (login page + shared infra), build+tsc+lint green:**
> - a11y: `role="alert"`/`aria-live` on error banner; `htmlFor`/`id` label association; `aria-invalid` on inputs; `aria-label`/`aria-pressed` on password toggle; `role="status"` on loading fallback.
> - reduced-motion: framer variants now gated via `useReducedMotion()` (factories) + layout blobs use `motion-safe:animate-pulse`.
> - copy: killed "Security Lock"/"Secured Terminal"; hardcoded English Suspense string → translated; uses real i18n keys.
> - security: **single-flight refresh** in `lib/api.ts` (fixes multi-tab logout race); stripped token `console.log`s in api.ts + AuthContext.
> - validation/rate-limit: new `app/lib/utils/validation.ts` (isValidEmail/isStrongPassword/passwordIssues, mirrors backend policy); login does client email/password validation + in-flight submit guard (prevents mashing → server lockout).
> - perf/cross-browser: lighter `blur-3xl` mesh (was `blur-[120px]`); iOS input-zoom fix already existed in globals.css (dossier §4a corrected).
> - i18n: reusable parity checker `frontend/scripts/check-i18n-parity.mjs` → `auth.` scope = 123/123, 0 gaps. (Repo-wide it found 57 NON-auth gaps in property/inbox/dashboard/lease — flag for those dossiers.)
> **Frontend pass 2 DONE (all 7 remaining pages), build+tsc green, backend 37+69 tests pass:**
> - a11y applied to register/reset/forgot-password/forgot-email/verify-email/verify-email-change: `role="alert"`+`aria-live` on every error/status region, `htmlFor` label association, password-toggle `aria-label`+`aria-pressed`, `inputMode="email"`.
> - **verify-email-change + logout were FULLY hardcoded English** → added `auth.verifyEmailChange.*` keys (EN+FR) and reused existing `auth.logout.*`; now bilingual.
> - **forgot-email enumeration oracle FIXED end-to-end:** backend `/auth/forgot-email` now returns an identical generic 200 whether or not an account matches (no 404, no `masked_email`); frontend shows neutral "if an account matches…" message. Covered by 2 new backend tests (`test_forgot_email_no_enumeration_when_missing`, `..._identical_response_when_found`).
> - reset-password client validation now includes the special-char rule (matches backend `ResetPasswordRequest`); added `auth.resetPassword.errors.special` (EN+FR).
> - copy cleanup: gimmick i18n value `strength.strong` "Industrial Grade"/"Qualité Industrielle" → "Very strong"/"Très fort"; gimmick code fallbacks cleaned.
> - auth i18n parity = 133/133 (run `node --experimental-strip-types frontend/scripts/check-i18n-parity.mjs "auth."`).
> **Pass 3 DONE — Playwright e2e + forgot-email copy fix:**
> - New `frontend/e2e/auth_pages.spec.ts`: 9 tests (labelled inputs, password-toggle aria, client email/empty-password validation announced via role=alert, FR/EN i18n parity, forgot-password labelled, forgot-email neutral no-leak message, reset-password no-token path). 18/18 green across chromium + webkit (Safari engine). Installed webkit+firefox browsers locally.
> - Found & fixed a real leak the backend de-enumeration had left in the UI: forgot-email i18n still said "Account Found"/"We found an account" + rendered masked email ("Your email address is"). Rewrote `forgotEmail` copy (EN+FR) to neutral "Check your inbox / if an account matches…"; removed dead `resultLabel`/`errors.notFound` keys. Auth i18n parity now 131/131.
> - e2e gotchas documented: run from `frontend/` (`npx playwright test`) NOT repo root (dual @playwright/test install conflict); scope error-banner selector to exclude Next's `#__next-route-announcer__` (also role=alert); mock API routes by `:8000` origin + POST method so the page navigation isn't hijacked.
>
> **Auth STILL TODO (deferred, documented):**
> - localStorage→in-memory token migration — BLOCKED: LeaseManager `?token=` download URLs + verify-email read token directly, AND the entire existing e2e harness seeds auth via `localStorage.setItem('access_token',…)`. Needs a download-auth redesign + e2e harness change first. High blast radius; do as its own change.
> - REST verb route names (`/auth/switch-role`, `/forgot-password`, …) — intentionally NOT renamed: would break the deployed FE↔BE contract + all tests for cosmetic gain. Deferred to a versioned v2 API.

---

## 1. Scope
Email+password and Google OAuth sign-in, JWT access/refresh, email verification,
password reset, email change, multi-role switching, profile basics, per-account
lockout. Pages under `frontend/app/auth/*`; API in `backend/app/routers/auth.py`.

---

## 2. Schema (`backend/app/models/user.py`)
- ✅ Argon2 password hash; nullable for Google-only accounts.
- ✅ `refresh_token_version` (session-revocation lever; now used by reset/email-change).
- 🔴 **REPLACE — `User` is a god-object (220 graph edges, #1 in repo).** All verification
  state (`identity_verified`, `income_*`, `ownership_*`, `kbis_*`, `carte_g_*`,
  `guarantor_*`) + encrypted PII blobs live on `users`. Should move to a
  `verification_records`/`kyc` table (1-to-many, typed). Tracked for the KYC feature.
- 🟠 **FIX — naive datetimes** on `created_at/updated_at/last_login/marketing_consent_at`
  (no tz). Legal/audit timestamps must be `DateTime(timezone=True)`. (Repo-wide; see DB_AUDIT.)
- 🟠 **FIX — verification statuses are free strings** (`"unverified"`, etc.). Need enum/CHECK.
- 🟡 `onboarding_completed` (bool) duplicates `onboarding_status` (JSON) — one source of truth.
- 🟡 GDPR: consent is one bool + timestamp; CNIL wants consent **version + proof + withdrawal trail**.

## 3. Routes / API (`backend/app/routers/auth.py`, 19 endpoints)
POST `/auth/register` · `/login` · `/refresh` · `/logout` · `/google` · `/forgot-password`
· `/reset-password` · `/request-email-change` · `/confirm-email-change` · `/change-password`
· `/resend-verification` · `/switch-role` · GET `/verify-email` · `/me` · `/me/segment-config`
· PATCH `/me` · `/me/preferences` · POST `/me/avatar` · `/forgot-email`.

- ✅ **FIXED (Batch 1):** token-type clobber in `create_access_token` (was breaking
  reset+verify AND making those links valid Bearer tokens); `get_current_user(+optional)`
  now assert `type=="access"`; reset is single-use (`rtv` bound to version) + revokes
  sessions; email-change revokes sessions; per-account lockout (5/15min→429, Redis, fail-open);
  `full_name` stored raw; `ResetPasswordRequest` complexity validator added.
- 🟠 **FIX — `/forgot-email` is an enumeration + PII oracle.** 404 on no-match vs masked
  email on match lets anyone probe "does X with phone Y have an account". REPLACE with a
  generic always-200 response (and ideally a phone-OTP flow). Also matched on `full_name`
  which used to be HTML-escaped (now fixed) — re-verify lookups work.
- 🟠 **FIX — Google auth leaks internals**: returns `"Database schema mismatch... run alembic"`.
- 🟡 **REST naming**: `/switch-role`, `/forgot-email`, `/forgot-password`, `/resend-verification`
  are verbs (master rule says no verbs). Low priority, but note for a v2 API.
- 🟡 **DRY**: token+cookie+segment-redirect block copy-pasted in login/refresh/google (+switch). Extract one helper.
- 🟡 `/me/avatar` reads whole file into memory, no size cap (unlike income upload's 10 MB cap).

## 4. Frontend pages (`frontend/app/auth/*`)
login(298) · register(508) · forgot-password(153) · reset-password(259) · forgot-email(151)
· verify-email(157) · verify-email-change(111) · logout(104) · layout(76).

### 4a. UI / Style
- ✅ Visually polished, consistent design language (glass-card, rounded-3xl, framer-motion).
- 🟠 **FIX — tone/clarity not best-in-class for a French legal rental platform.** Gimmicky
  copy: password label = "Security Lock", "Handshaking with Google…", suspense =
  "Initializing Secured Terminal…". Reads like a toy, not a trusted tenancy product. Rewrite
  to clear, calm, bilingual copy.
- 🟠 **FIX — micro-typography hurts readability.** Pervasive `text-[9px]/[10px]` uppercase
  `tracking-[0.2em–0.5em]`. Hard to read, especially on mobile; fails WCAG legibility spirit.
- 🟡 Inputs: confirm `font-size ≥ 16px` to avoid **iOS Safari auto-zoom on focus** (a classic glitch).

### 4b. Dual-language (FR/EN) — `lib/i18n.ts` (en + fr trees), `LanguageContext`
- ✅ `t(key, params, fallback)` with both trees; LanguageSwitcher on auth layout.
- 🔴 **FIX — hardcoded English** in login Suspense fallback: `"Initializing Secured Terminal..."`
  ([login/page.tsx:292](../../frontend/app/auth/login/page.tsx#L292)) — not translated.
- 🟠 **VERIFY — every `t()` fallback is English.** Need an automated parity check that the `fr`
  tree has every key the `en` tree has (and vice-versa); silent fallback hides missing FR.

### 4c. Accessibility — ⚠️ weakest area
- 🔴 **FIX — zero `aria-*`/`role` across ALL auth pages** (grep: 0 hits). Error banners are
  visual-only → screen readers never announce login failure. Add `role="alert"`/`aria-live="assertive"`.
- 🔴 **FIX — labels not programmatically associated.** `<label>` lacks `htmlFor` matching input
  `id`; password label text "Security Lock" misdescribes the field to AT.
- 🟠 **FIX — framer-motion ignores `prefers-reduced-motion`.** `globals.css` neutralizes CSS
  animations only; all the JS transform/opacity animations (page, card, shake, stagger) still
  run. Use `useReducedMotion()` to gate variants. Vestibular-accessibility + perceived jank.
- 🟠 **REPLACE — native `prompt()`** for "forget Google email"
  ([login/page.tsx:108](../../frontend/app/auth/login/page.tsx#L108)): unstyled, untranslatable,
  blocked/awkward on iOS & some Android webviews. Replace with a real modal (or remove the feature).
- 🟡 Focus management: no visible focus-ring strategy beyond default; verify keyboard tab order through password toggle.

### 4d. Security (frontend)
- 🟠 **FIX — access token in `localStorage`** ([lib/api.ts](../../frontend/lib/api.ts)): readable by
  any XSS, and CSP still allows `'unsafe-inline'` scripts. With real PII, move to in-memory +
  the existing httpOnly refresh cookie.
- 🟠 **FIX — no single-flight refresh.** Parallel 401s each call `/auth/refresh`; with refresh
  rotation+version-bump, first rotates and the rest get logged out (multi-tab/multi-request bug).
- 🟡 **FIX — strip `console.log` of tokens** (`api.ts`, `AuthContext.tsx`) before prod.
- 🟡 login reads `localStorage` directly for auto-redirect (line 64), duplicating AuthContext logic.

### 4e. Performance / Cross-browser
- 🟠 **FIX — 3 large `blur-[100–120px]` + `animate-pulse` mesh blobs** in auth layout: expensive
  GPU compositing, can jank on Android/older Safari. Reduce blur radius / count, or static SVG.
- 🟡 Verify Google Identity Services button renders under Safari ITP / 3rd-party-cookie blocking;
  COOP is `same-origin-allow-popups` (correct) — smoke-test the popup on iOS Safari.
- 🟡 `framer-motion` adds bundle weight on every auth route; acceptable but measure LCP/INP.

## 5. What to KILL / REPLACE (frank)
- **KILL** the gimmick copy ("Secured Terminal", "Handshaking", "Security Lock") — replace with clear bilingual copy.
- **REPLACE** `prompt()` Google-forget flow with a modal, or drop it.
- **REPLACE** localStorage token storage with in-memory + refresh cookie.
- **REPLACE** `/forgot-email` oracle with generic-200 (ideally phone-OTP).
- **MOVE** verification fields off `User` into a typed table (KYC feature).

## 6. Tests
- ✅ Backend: `tests_integration/test_auth_batch1.py` (6) + `test_auth_batch1_edge.py` (22) — all green.
  Full integration 35 / unit 69 green. Run: `TEST_DATABASE_URL=postgresql+asyncpg://venkat@localhost:5432/roomivo_test ./.venv/bin/python -m pytest tests_integration/`.
- ❌ **MISSING — frontend auth tests.** Playwright e2e exists for landing/search but auth flows
  (login error a11y, reset, i18n parity, reduced-motion) are untested. Add per the per-feature rule.

## 7. Recommended order to finish Auth to "best-in-class"
1. Frontend security: in-memory token + single-flight refresh + strip logs. (pairs with Batch-3)
2. A11y pass: roles/aria-live on errors, label htmlFor, `useReducedMotion()` gating.
3. Copy + typography rewrite (bilingual, legible, trustworthy tone) + i18n parity check + fix hardcoded fallback.
4. `/forgot-email` redesign; Google error message sanitize; DRY token helper.
5. Perf/cross-browser: lighten mesh blobs; iOS input-zoom check; Safari GSI smoke test.
6. Frontend Playwright tests for the above.
