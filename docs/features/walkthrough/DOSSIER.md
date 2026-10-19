# Walk-through answers — Feature Dossier

Self-contained reference for the tap lists a landlord answers about a home and the
"Good to know" panel on the listing page. Read this before changing either. New feature =
new conversation.

Last updated: 2026-10-19 (fixes from the review of PR #89). Design: `docs/superpowers/specs/2026-10-06-walkthrough-answers-and-room-qa-design.md`.

## Why it exists

Students abroad ask the same basic questions about every listing (is there internet, does
the oven work, who lives there) and landlords take days to answer. The landlord answers once,
space by space, and the listing shows it. It is also the first step toward a listing that
builds itself from the walk-through (roadmap WS-4).

## Rules and checklist (carry-forward)

- **The answers are the landlord's own statements.** Roomivo never writes, infers or checks
  one. The panel says "Last updated by the owner on {date}" and never "verified" (a test
  checks the word appears in neither language).
- **No "what we couldn't check" wording**, and no claim about the home's quality. A "not
  working" or "not here" answer is shown as plainly as a good one.
- **The household card describes a household, never a person.** It accepts a count, students
  / working / both, smoking and pets, and nothing else. No name, age, gender or nationality:
  the server refuses any other field (Code pénal 225-1 and 225-2; GDPR). The gender mix of a
  flatshare is deliberately left out until counsel has been asked (roadmap L-1).
- **Unanswered is not "no".** An item with no answer is not shown at all.
- Every string is in both dictionaries of `frontend/lib/i18n.ts` under `walkthrough.*`.
- Adding or removing an item: change `CATALOGUE` in
  `backend/app/services/walkthrough_catalogue.py`, `WALKTHROUGH_ITEMS` in
  `frontend/lib/walkthrough.ts` and the labels in both languages.
  `backend/tests/test_walkthrough_catalogue.py` fails if the item lists or the
  `walkthrough.items` labels disagree, and `frontend/e2e/walkthrough.spec.ts` checks every
  item and answer has a label in both languages.
- A new endpoint must be added to `backend/tests/route_manifest.json` in the same change.

## What exists

Backend:

- `backend/app/services/walkthrough_catalogue.py` — twenty items in five spaces (kitchen,
  bedroom, living area, bathroom, whole home). An appliance is `working`, `not_working` or
  `absent`; a thing is `present` or `absent`. Items that correspond to the eleven categories
  of Décret n°2015-981 carry the matching key from `lease_rules.FURNISHED_REQUIRED_ITEMS`;
  all eleven are covered.
- `properties.walkthrough_answers` (JSONB): `{space_key: {item_key: {state, answered_at}}}`,
  with `space_key` one of `kitchen`, `bathroom`, `living`, `home`, `bedroom:<index>`.
  `properties.flatmates` (JSONB): `{count, occupation, smoking, pets, answered_at}`.
  Migration `c7e1a9d4b2f6`.
- `PUT /properties/media-sessions/{code}/answers` — no sign-in; the capture code is the
  key and can only write to its own listing. Body: `{space, answers: {item: state}}` and/or
  `{flatmates}`; a request with neither, or a space without its answers, is refused.
  Saving a space replaces that space; an unchanged answer keeps its date (the household
  card is dated again on every save). Rate limited (60 a minute). A refused value is never
  repeated back in the error message.
- Both write paths lock the listing row while they merge, so two spaces saved at the same
  moment (from the phone and the edit page, say) are both kept.
- `GET /properties/media-sessions/{code}` also returns `walkthrough`: bedroom count,
  whether the home is shared, current answers and household card.
- `PUT /properties/{id}` accepts `walkthrough_answers` as `{space: {item: state}}` and
  `flatmates`, with the same checks. Stored dates are set by the server, never taken from
  the request.
- The public listing response carries both fields.
- A studio with no room list still has one bedroom. Bedroom indexes beyond the room list
  are refused, and there is one spelling per bedroom (`bedroom:1`, never `bedroom:01`).
- The household card is accepted only for a shared home (otherwise 422), cleared when a
  home stops being shared, and never served in a listing response for a home that is not
  shared.

Frontend (paths relative to `frontend/`):

- `lib/walkthrough.ts` — the item list, space keys and labels, and tolerant readers for
  stored answers.
- `lib/walkthroughQueue.ts` — the rules for answers waiting on the phone.
- `components/walkthrough/TapList.tsx` — one row per item, two or three large toggle
  buttons (`aria-pressed`, in a labelled group); pressing the chosen answer again clears it.
- `components/walkthrough/FlatmatesFields.tsx` — the household card.
- `app/capture/[code]/page.tsx` — a "Quick answers" card on the first screen, an "Answer
  the questions" button after an upload, a list of spaces with progress, and one screen per
  space. Every save is first kept on the phone (`localStorage`, one entry per space, the
  newest replacing the older), then sent; it leaves the phone once the server has it.
  - A lost connection, a timeout (15 s), the rate limit or a server error keeps it waiting.
    The list shows "Answers waiting to be sent" with a "Send now" button, and sending is
    tried again when the connection returns, when the page is shown again and on the next
    load.
  - An answer the server refuses is dropped, and the landlord is told which space to answer
    again.
  - If the link has expired, the page says how many answers were not sent.
  - Only one sending run at a time, and a new save waits for it, so an older answer never
    reaches the server after a newer one.
- `components/walkthrough/GoodToKnowPanel.tsx` on `app/properties/[id]/PropertyDetailClient.tsx`
  — answers grouped by space, the source line, and the household card. Renders nothing for
  a listing without answers.
- `components/walkthrough/WalkthroughAnswersEditor.tsx` on step 6 of
  `app/properties/[id]/edit/page.tsx` — the same lists on a computer. Sent with the listing
  once a list has been touched, and only for the spaces the listing has now; the household
  card only if the home was shared when the page loaded.

## Differences from the design

- **The edit path is `PUT /properties/{id}`**, not a separate
  `PUT /properties/{id}/walkthrough-answers`.
- **A space the listing does not have is refused (422)**, not ignored.
- **The answers have their own screens**, reached from a card and after an upload, rather
  than following each space's photos; there is no one-tap "no such space" and no "whole
  home" prompt at the end.
- **The phone keeps unsent answers in its own queue**, not in the existing media offline
  queue.
- **The household card carries a date** (`answered_at`), used in the panel's source line.

- **The amenities block stays.** The design replaced it with the panel; it lists things the
  tap lists do not cover (parking, lift, balcony), so both are shown.
- **The item list lives in the frontend as well** instead of being sent with the capture
  session, so the listing page can lay answers out without a second request. A test keeps
  the two copies equal.
- **Media is still tagged by bedroom or common area.** Tagging photos by kitchen, bathroom
  and living area (open point 3) is not done.

## Not built yet, and why

- **The question box** (a student asks, the landlord answers once, the answer stays on the
  page). It relays between the two sides, which roadmap L-1 puts to counsel first.
- **The furnished publish rule** (refuse to publish a furnished listing unless the eleven
  items are marked present). It would add a way for publishing to fail while listings are
  the scarce side; it needs the founder's yes (open point 1).
- **Nothing live checks the eleven items today.** The check exists
  (`lease_rules.validate_furnished_inventory`), but only `lease_generation.generate` runs it,
  and no route calls that. The lease route in use (`routers/leases.py` with
  `lease_generator`) only prints whether the home is furnished. Found in the review of
  2026-10-19.
- **The measures** in the design (share of listings with complete answers, and so on).

## Tests

Counted as collected by pytest (parametrised cases count separately) and as `test(` calls.

- `backend/tests/test_walkthrough_catalogue.py` (77) — catalogue integrity against the
  decree list, the frontend copy and the labels; answer and household validation with
  hostile values; refused values not echoed; merging and dates.
- `backend/tests_integration/test_walkthrough_answers.py` (33) — real rows: saving and
  reading back, a code cannot write to another listing, unusable codes write nothing,
  malformed and incomplete requests are refused, bedrooms follow the room list (also when
  sent with a new room list), two spaces saved at the same moment are both kept, the
  household card and its refusals, a home that stops being shared, the edit path and its
  permissions.
- `frontend/e2e/walkthrough.spec.ts` (29) — the helpers and the queue rules; the capture flow
  including clearing an answer, Back without saving, the household card, an out-of-range
  count, no network then back, a server error or rate limit, a refused waiting answer, a
  newer save replacing a waiting one, a reload mid-save, an expired link, the server's
  answer winning over the draft, a refused save, an older session, French, a 320px phone
  and the keyboard; the edit page sending answers only when changed.
- 2026-10-19, on the development machine: 29 Playwright tests on Chromium, WebKit and mobile
  Chrome = 87 passes, three runs in a row with no retries; the whole backend unit suite
  (694 passed, 2 skipped) and the whole integration suite (236 passed); `next build` and
  `tsc` clean.
- Also run by hand against a live backend and database, in Chromium and WebKit: answers
  saved on the phone page appeared on the public listing page in English and French, and a
  listing without answers showed no panel. This run is not automated: the listing page
  fetches on the server, so the browser tests cannot mock it.

## Known limits

- In two of about 260 test runs under parallel load, a first click on "Answer the questions"
  did not change the screen. It was not reproduced in 110 isolated attempts, including with
  the CPU slowed eightfold; the tests retry that one click. Watch for it in real use.

- The panel has no rendering test: the test runner rewrites JSX, so the component cannot be
  rendered there without adding a test framework. Its logic (what is shown, the date, the
  household lines) lives in `lib/walkthrough.ts` and is tested there.
- The panel's date is the UTC day of the last answer, so an answer given just after
  midnight in France shows the previous day.
- Answers kept on the phone while offline live in that browser only. Clearing site data, or
  a private window, loses them.
- An answer for a bedroom removed from the room list stays stored and is no longer shown.
- French copy was written without a native review.
