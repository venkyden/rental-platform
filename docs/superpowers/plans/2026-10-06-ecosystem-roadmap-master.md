# Roomivo Ecosystem — Master Roadmap

> **For agentic workers:** This is a MASTER plan. Per the project workflow, **each
> workstream = its own conversation + its own git worktree + its own detailed
> implementation plan** written at execution time. This file is the self-contained
> handoff: read it, the linked spec or code, and `CLAUDE.md`. Do not implement several
> workstreams in one branch.

Date: 2026-10-06, revised 2026-10-07 after the review of PR #86. Owner decisions recorded
here were made by the founder in the 2026-09-22 → 2026-10-06 landing-page conversation.

**Goal:** one product that takes an international student and a private landlord from
first look to the last rent receipt, with as few steps as possible on both sides.

**Build rule:** anything regulated or generic comes from a provider; everything else is
native. Each provider sits behind a thin connector so it can be swapped.

**Architecture:** three tracks. Track 1 needs no new provider and can start now, except
the parts listed in L-1, which wait for that opinion (each is marked "Gate" below).
Track 2 waits for the European company and a new legal opinion. Track 3 waits for payment
and insurance partners, and for L-1 and L-2.

---

## Decisions on record

| Topic | Decision |
|---|---|
| Identity | A technology company, not an estate agency. Licences and regulated partners are acceptable when needed. |
| Student fee | One flat fee "X" (amount not set), charged once when a landlord accepts the student. If a visa is needed, the accommodation certificate is issued at that moment. Full refund if the visa is refused or the landlord withdraws. |
| Landlord fee | Listing is free. One small flat fee when the lease is signed. |
| Fee wording on the landing page | Structure only: "One small fee. Pay for nothing more." Since 2026-10-07 the page no longer says when either fee is charged (open decision 4). |
| Not offered | Monthly membership, guaranteed-rent provider, move-in services (internet, electricity, moving), proof-of-funds provider. |
| Rent guarantee | None offered. Roomivo checks the tenant's Visale certificate (the existing document check, medium assurance; `guarantor_compliance.py`). |
| Providers | Stripe (one-off fees, subscriptions, later rent), Appenin (home insurance), Meta WhatsApp Cloud API (landlord messages). Fallback for payments: Mangopay. |
| Public copy | See the copy rules in `CLAUDE.md`, "Direction update — 2026-10-06". They are kept there only. |

**Conflict to resolve before any fee goes live:** both fees are tied to acceptance or
signature. `CLAUDE.md` still says "never success-based", its boundaries table has the row
"Take a success fee on a signed lease", and the 2026-06-20 legal opinion was given on that
condition. The certificate and the refund also depend on whether a visa is needed, which
touches the nationality and immigration-status row. See L-1.

---

## Done

**WS-0 — Landing page and smart search. Merged in PR #86 (2026-10-06).**

- `frontend/components/landing/home/` — `HomeExperience.tsx` (audience switch, hero,
  gold thread, final call) and `screens.tsx` (phone wireframes).
- `frontend/lib/smartSearch.ts` — sentence search: place, home type, bedrooms,
  bathrooms, budget, furnished, flatshare, amenities, move-in month, length of stay, in
  English and French, with no network call.
- `frontend/app/search/page.tsx` — reads the URL filters and shows them as removable
  chips. `backend/app/routers/properties.py` — filters `bathrooms_min`,
  `min_duration_months`, `available_by`.
- `frontend/app/trust/page.tsx` — the credential-layer explainer and verify-by-code box.
- Removed: the five replaced landing sections and the stock apartment images.
- Evidence at merge (2026-10-06): 39 Playwright tests (landing 24, parser 12, translation
  parity 3), each run on Chromium, WebKit and mobile Chrome = 117 passes; 80 backend tests
  in four files (`test_typology_filters.py`, `test_properties.py`,
  `test_property_edge_cases_stress.py`, `test_colocation.py`), not the whole suite;
  `next build` clean.

**Review after merge.** PR #86 was merged before its review. A four-reviewer pass ran on
2026-10-06/07; its findings are fixed on branch `fix/landing-council-findings`: the sentence
parser was rewritten (negations, ranges and lower bounds, districts and postcodes, end
months, "sept mois", hyphenated and accented places), the search page reports a failed
load instead of "no results", Reset clears every filter, colour contrast and screen-reader
behaviour were corrected, the backend filters were hardened, and the fee timing and the
word "safe" were taken off the page. Evidence and what was not verified are in
`docs/features/landing/DOSSIER.md`.

---

## Track 1 — build now

### WS-1 — Walk-through answers and room page questions
- **Why:** students ask the same basic questions and landlords take 2–3 days to answer.
- **Spec:** `docs/superpowers/specs/2026-10-06-walkthrough-answers-and-room-qa-design.md`
  on branch `feat/walkthrough-listing` (commit `8991c31`, local only: push the branch
  before removing its worktree). Four open points for the founder at its end.
- **Gate:** the question-and-answer relay between student and landlord is in L-1.
- **Done when:** a landlord can answer a tap list per space during capture, the room page
  shows a "Good to know" panel, and a question asked once stays answered on the page.

### WS-2 — Lease model, October 2026 version
- **Why:** reported, not yet read on Légifrance: décret n° 2026-596 changed the official
  model for leases signed or renewed from 1 October 2026 (resolutory clause mandatory with
  six weeks, main-residence clause, optional phone field). No source is recorded in the
  repository; the first step of this workstream is to read the text. Verified:
  `backend/app/services/lease_models/` only has `2025-01-01/`.
- **Done when:** a new dated model directory exists, read from Légifrance (not from
  summaries), the generator selects it by signing date, and lease-rule tests cover both
  versions.

### WS-3 — One-tap application and reusable student file
- **Why:** today a student registers, answers a questionnaire and writes a bio before
  applying (`applications.py` rejects without a bio).
- **Done when:** browsing needs no account, sign-in is one step, the file is built once
  (passport and selfie, one proof of funds or a Visale certificate) and every later
  application is one tap.
- **Gate:** accepting bank statements as proof of funds is in L-1.

### WS-4 — Listing from the walk-through
- **Why:** landlords face eight wizard screens before filming.
- **Done when:** a landlord starts from one link, confirms the address the phone found,
  films, states the rent, and the energy rating, deposit limit and room list are filled
  in for confirmation. The wizard remains for desktop editing.

### WS-5 — Rent tracking and receipts
- **Why:** gives landlords a monthly reason to stay and students proof of address.
- **Done when:** the landlord marks rent received, a receipt is generated for the tenant,
  and a reminder goes out when rent is late. Roomivo does not move money in this piece.

### WS-6 — Search follow-ups
- **Any phrasing, any language:** interpret the sentence with the AI model already in the
  stack, behind a connector, rate-limited, with `smartSearch.ts` as the instant fallback.
- **Visible controls** on the search page for bedrooms, bathrooms, move-in month and
  length of stay (today they arrive only from the landing page).
- **No results:** offer to be told when a room appears for that search.
- **Gate:** interpretation by an AI model waits for the AI Act classification memo that
  `CLAUDE.md` lists as pending; the "tell me when a room appears" alert must be checked
  against the "search, match, or recommend" row (L-1) before it is built.

### WS-7 — Object recognition during the walk-through
- **Depends on:** WS-1.
- **Done when:** a prototype on real phones shows whether on-device recognition is fast
  enough; if so it pre-ticks the landlord's list for confirmation. Published answers
  remain the landlord's own statements.

### WS-8 — Legifrance watchlist
- **Why:** nothing in the project watches for changes such as the reported October 2026
  lease model (see WS-2). A design spec exists on branch `feat/legifrance-decret-watchlist`.

---

## Track 2 — needs the European company and legal sign-off

### WS-9 — "Accepted, pending visa" and the accommodation certificate
- Landlord accepts with a hold deadline; a certificate is issued naming the identified
  landlord, the address, the dates and the student, checkable by code on the site.
- One live certificate per student; it expires on the deadline and can be withdrawn; the
  code shows its current status.
- Test with one or two consulates before promising it.

### WS-10 — Fees and the pricing page
- Stripe one-off payments for the student fee X and the landlord fee; refund flow.
- A pricing page that states the amounts, reachable without changing the footer design
  unless the founder asks; amounts shown again before payment.
- **Gate:** L-1.

### WS-11 — Subscriptions for landlords with several homes (Stripe Billing).
### WS-12 — Verification sold to insurers and agencies (the credential layer as an API).
### WS-13 — WhatsApp messages to landlords (Meta Cloud API), for one-tap answers.

---

## Track 3 — needs partners, L-1 and L-2

Both workstreams cross rows of the boundaries table in `CLAUDE.md` (funds; insurance), so
a partner agreement alone does not unblock them.

### WS-14 — Rent through the platform
Stripe Connect with bank debit for monthly rent and bank transfer for students paying
from abroad. Roomivo never holds the money; the payment institution does.

### WS-15 — Home insurance at move-in
Appenin partner API; requires registration as an insurance intermediary.

---

## Legal and company track

| ID | Item |
|---|---|
| L-1 | New opinion on the model: fees at acceptance and at signing; a certificate and a refund that depend on whether a visa is needed (nationality and immigration-status row); relaying between the two sides; the pending-visa certificate's wording and whether it binds the landlord; accepting bank statements when landlords may not demand them; showing a flatshare's gender mix; saved-search alerts. The opinion should also name which registrations the model needs ("the licensed set-up"). |
| L-2 | Rewrite the boundaries table in `CLAUDE.md` once L-1 and the licensed set-up are in place. Until then it governs what ships. |
| L-3 | Confirm every Visale figure against visale.fr before publishing any. |
| L-4 | European entity: assumed prerequisite for Stripe and for the insurance registration (to confirm with each). FranceConnect needs a French SIRET specifically; see `CLAUDE.md`. |

---

## Law watch (verify on official sources before relying on these)

- Rent-control trial ends 23 November 2026; a bill to make it permanent was before the
  Senate in October 2026. `zone_tendue.py` checks may need to change either way.
- Student visa: minimum resources €877.50 a month since 1 August 2026 (47% of the gross
  minimum wage). No source is recorded in the repository: confirm before use. Compute
  from the minimum wage; never hard-code.
- Housing benefit ended on 1 July 2026 for non-EU students without a scholarship.
- Visale cover is limited to the first three years of a lease since January 2026.
- A government bill (April 2026) would let class F and G homes stay on the market under a
  works contract; not adopted when this was written.

---

## Order

1. WS-0 is merged (PR #86). Merge the review fixes on `fix/landing-council-findings`.
2. WS-2 (confirm the décret on Légifrance first) and WS-1, in parallel worktrees.
3. WS-3, then WS-4.
4. WS-5 and WS-6.
5. Track 2 as soon as L-1 and L-4 allow; Track 3 after L-1, L-2 and the partner agreements.

## Open decisions for the founder

1. The amount X and the landlord's fee amount.
2. The four open points in the WS-1 spec.
3. Whether the pricing page may be linked from the landing footer.
4. Fee timing on the landing page. The founder's wording was "a small fee will be charged
   when the lease is signed". The review flagged that sentence as advertising a fee tied to
   a signed lease before L-1, so it was taken off the page on 2026-10-07; the page now says
   "one small fee, once". Confirm, or put the timing back.
5. The word "safe" was removed from the student headline in the same pass ("Land your real
   home. In a few clicks."), as a brand-level promise. Confirm, or put it back.
6. Whether DG-1 in `CLAUDE.md` (lead with verification sold to insurers) and the
   2026-07-02 build order still stand next to this roadmap, which places that work at WS-12.
7. The site-wide page transition (`frontend/app/template.tsx`) renders every page at zero
   opacity until scripts run. It predates this work and was left alone; removing the fade
   would make every page readable sooner and without scripts.
