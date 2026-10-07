# Walk-through Answers + Room Page Q&A — Design

Date: 2026-10-06. Status: draft for founder review. Not implemented.

## Problem

Students abroad ask the same basic questions about every listing: is there internet, are
there pans and plates, do the oven and microwave work, is there a dishwasher, who are the
flatmates. Landlords take two to three days to answer (founder's observation from the
manually handled rentals). The delay costs more time than any form in the product.

Today the listing wizard collects a flat `amenities` list (Step 6) and the listing page
(`PropertyDetailClient.tsx`) prints it. Nothing records whether an item is present **and
working**, nothing is collected room by room, there is no flatmate information, and a
question can only be asked through private messages, so every student asks again.

**Goal:** a student can decide on a room without messaging anyone. Measured by questions
asked per published listing (target: falling toward zero) and median time to a landlord's
answer when a question is asked.

This is piece 1 of the product direction recorded on 2026-10-06 (one ecosystem; regulated
or generic capabilities come from providers, everything else is native). **This piece is
fully native and uses no external provider.**

---

## Scope

In scope:

1. A short tap list per space, answered by the landlord during the phone walk-through
   (`/capture/[code]`) and editable later from the listing edit page.
2. A "Good to know" panel on the listing page showing those answers.
3. A flatmates card for shared homes.
4. A public question box on the listing page: known answers are surfaced as the student
   types; a new question goes to the landlord once and the answer stays on the page.
5. A publish rule: a listing advertised as furnished must have the eleven legally required
   items marked present.

Out of scope (later pieces): object recognition from video, voice input, WhatsApp
delivery, AI-written answers, one-tap application, the pending-visa stage, rent tracking,
payments, and the landing page.

---

## Rules this design must respect

- **Copy rules (founder, Sept–Oct 2026):** no bold claims; the page states where an answer
  came from ("Answered by the owner on 12 Sept") and never says "verified" for a landlord's
  statement. No "we couldn't check" wording.
- **Roomivo does not speak for a party.** Answers are the landlord's own statements.
  Roomivo never writes or infers an answer in this piece.
- **Décret n°2015-981:** a furnished home must contain eleven categories of equipment.
  The keys already exist as `FURNISHED_REQUIRED_ITEMS` in `backend/app/services/lease_rules.py`
  and are reused here so the walk-through answers feed the lease check (LG-3) directly.
- **Code pénal 225-1/225-2 and GDPR:** the flatmates card carries no name, nationality,
  age or gender. It describes the household, not individuals.
- **Anti-scam advisories:** landlord free-text answers pass through the existing
  deterministic scan in `backend/app/services/message_safety.py`.
- **EN/FR parity:** every new string is added to both dictionaries in
  `frontend/lib/i18n.ts`; `frontend/e2e/i18n_parity.spec.ts` must stay green.

---

## Design

### 1. The item catalogue

A fixed, versioned catalogue in code (`backend/app/services/walkthrough_catalogue.py`),
mirrored to the frontend through the capture-session response so there is one source.

Each item has: `key`, `space` (`kitchen`, `bathroom`, `living`, `bedroom`, `home`),
`kind` (`appliance` or `thing`), and an optional `legal_key` pointing at
`FURNISHED_REQUIRED_ITEMS`.

| Space | Items (legal items marked L) |
|---|---|
| Kitchen | hob (L), oven, microwave (oven or microwave satisfies L), fridge with freezer (L), plates and glasses (L), pans and utensils (L), dishwasher |
| Bedroom (each) | bed with bedding (L), curtains or shutters (L), desk, wardrobe |
| Living area | table and chairs (L), sofa, TV |
| Bathroom | shower or bath, washing machine |
| Whole home | internet, lights in every room (L), storage shelves (L), cleaning equipment (L) |

Answer states:

- `appliance` items: `working`, `not_working`, `absent`.
- `thing` items: `present`, `absent`.

Unanswered items are simply not shown on the listing page.

### 2. The walk-through tap list (landlord)

In `/capture/[code]`, after the landlord picks a space and adds photos or video for it, a
tap list for that space is shown: one item per row, two or three large buttons. Finishing
the list returns to the space picker, where the space is marked done. The "whole home"
list is offered once at the end.

Spaces offered: each bedroom from `room_details` (as today) plus kitchen, bathroom, living
area and whole home. Spaces the home does not have can be skipped with one tap ("no
separate living area").

The same lists are editable on the listing edit page for landlords working on a computer.

The existing offline queue on the capture page also queues answer submissions.

### 3. Flatmates card (shared homes only)

Shown in the walk-through and on the listing only when `is_colocation` is true. Fields,
all optional: number of flatmates, students / working / both, smoking in the home (yes or
no), pets in the home (yes or no). Entered by the landlord.

### 4. "Good to know" panel (listing page)

A new `GoodToKnowPanel` component in `PropertyDetailClient.tsx`, placed directly under the
media, replacing the current "Amenities & Features" block when walk-through answers exist
(the old block remains as fallback for listings without answers).

- Items grouped by space, each with its state. `not_working` and `absent` are shown
  plainly, not hidden.
- One source line for the panel: "Answered by the owner on {date}".
- The flatmates card sits in the same panel.

### 5. Question box (listing page)

- Reading questions and answers needs no account. Asking requires sign-in so the student
  can be notified.
- As the student types, a deterministic keyword match against the catalogue (labels and a
  synonym list per item, EN and FR) surfaces the existing answer: "Dishwasher: not here.
  Answered by the owner on 12 Sept." No AI in this piece.
- If nothing matches and the student submits, the question is stored and the landlord is
  notified through the existing notification and email path with a link to answer:
  yes / no / a short text (280 characters).
- The answer is published on the listing for everyone, without the asker's name. Later
  students see it and the keyword match includes it.
- One reminder is sent to the landlord after 24 hours without an answer.
- Each question and answer has a "report" link routed to the existing admin queue.

### 6. Publish rule

In `publish_property` (`backend/app/routers/properties.py`), when `furnished` is true:
every catalogue item with a `legal_key` must be `working` or `present` (oven **or**
microwave satisfies `four_ou_micro_ondes`). Otherwise publishing is refused with the list
of missing items and the option to publish as unfurnished. Unfurnished listings have no
answer requirement.

---

## Data

- `properties.walkthrough_answers` (JSONB, nullable):
  `{ "<space_key>": { "<item_key>": { "state": "...", "answered_at": "..." } } }`, where
  `space_key` is `kitchen`, `bathroom`, `living`, `home`, or `bedroom:<index>`.
- `properties.flatmates` (JSONB, nullable): `{ "count", "occupation", "smoking", "pets" }`.
- New table `listing_questions`: `id`, `property_id`, `asker_id`, `question`,
  `answer_kind` (`yes` / `no` / `text`), `answer_text`, `asked_at`, `answered_at`,
  `reminded_at`, `status` (`open` / `answered` / `removed`).
- One migration adds the two columns and the table.
- `gdpr.py` erasure: deleting a user removes `asker_id` from their questions (the public
  question text stays, unattributed) and removes questions on their own listings.

## API

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /properties/media-sessions/{code}` (existing) | session code | Also returns the catalogue and current answers |
| `PUT /properties/media-sessions/{code}/answers` | session code | Save answers for one space |
| `PUT /properties/{id}/walkthrough-answers` | landlord | Edit answers and flatmates from the listing edit page |
| Public property response (existing) | none | Adds `walkthrough_answers`, `flatmates` |
| `GET /properties/{id}/questions` | none | Answered questions |
| `POST /properties/{id}/questions` | signed in | Ask a question (rate limited per user and listing) |
| `POST /questions/{id}/answer` | landlord of the listing | Answer yes / no / text |

Server validation rejects unknown item keys and states, and ignores answers for spaces the
listing does not have.

## Testing

- Unit: catalogue integrity (every `legal_key` exists in `FURNISHED_REQUIRED_ITEMS`; all
  eleven are covered), state validation, the furnished publish rule including the oven or
  microwave case, keyword matching in EN and FR.
- API: session-code answers cannot write to another listing; only the listing's landlord
  can answer a question; unanswered and removed questions are not public; rate limit.
- Erasure: the GDPR test suite covers `listing_questions`.
- Frontend: the i18n parity test; a Playwright flow for tap list → panel → question →
  answer → published.

## Measures

Recorded in the existing stats: share of published listings with complete answers,
questions per published listing per week, median time to answer, and the most frequent
unmatched question words (the input for adding items to the catalogue).

---

## Open points for the founder

1. **Furnished publish rule.** Today the eleven items are checked only when a lease is
   generated. This design also checks them at publication. Confirm that is wanted.
2. **Flatmates.** Students also ask about the gender mix of a flatshare. It is left out
   here pending legal advice; say if you want it raised with the lawyer.
3. **Kitchen and bathroom as spaces.** Capture media is currently tagged by bedroom or
   "common area". Tagging media by kitchen, bathroom and living area is a small extension
   of `room_label`; the exact change is settled in the implementation plan.
4. **Item list.** The catalogue above is a first proposal from your account of what
   students ask. Add or remove items before build.
