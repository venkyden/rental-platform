# Walk-through answers — Feature Dossier

Self-contained reference for the tap lists a landlord answers about a home and the
"Good to know" panel on the listing page. Read this before changing either. New feature =
new conversation.

Last updated: 2026-10-13. Design: `docs/superpowers/specs/2026-10-06-walkthrough-answers-and-room-qa-design.md`.

## Why it exists

Students abroad ask the same basic questions about every listing (is there internet, does
the oven work, who lives there) and landlords take days to answer. The landlord answers once,
space by space, and the listing shows it. It is also the first step toward a listing that
builds itself from the walk-through (roadmap WS-4).

## Rules and checklist (carry-forward)

- **The answers are the landlord's own statements.** Roomivo never writes, infers or checks
  one. The panel says "Answered by the owner on {date}" and never "verified".
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
  `backend/tests/test_walkthrough_catalogue.py` fails if the three disagree.
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
  `{flatmates}`. Saving a space replaces that space; an unchanged answer keeps its date.
  Rate limited.
- `GET /properties/media-sessions/{code}` also returns `walkthrough`: bedroom count,
  whether the home is shared, current answers and household card.
- `PUT /properties/{id}` accepts `walkthrough_answers` as `{space: {item: state}}` and
  `flatmates`, with the same checks. Stored dates are set by the server, never taken from
  the request.
- The public listing response carries both fields.
- A studio with no room list still has one bedroom. Bedroom indexes beyond the room list
  are refused. The household card is kept only for a shared home.

Frontend (paths relative to `frontend/`):

- `lib/walkthrough.ts` — the item list, space keys and labels, and tolerant readers for
  stored answers.
- `components/walkthrough/TapList.tsx` — one row per item, two or three large buttons;
  tapping the chosen answer again clears it.
- `components/walkthrough/FlatmatesFields.tsx` — the household card.
- `app/capture/[code]/page.tsx` — a "Quick answers" card on the first screen and after an
  upload, a list of spaces with progress, and one screen per space. With no network the
  answers are kept on the phone (`localStorage`) and sent on the next load or when the
  network returns.
- `components/walkthrough/GoodToKnowPanel.tsx` on `app/properties/[id]/PropertyDetailClient.tsx`
  — answers grouped by space, the source line, and the household card. Renders nothing for
  a listing without answers.
- `components/walkthrough/WalkthroughAnswersEditor.tsx` on step 6 of
  `app/properties/[id]/edit/page.tsx` — the same lists on a computer. Sent with the listing
  only when changed.

## Differences from the design

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
  the scarce side; it needs the founder's yes (open point 1). The eleven items are still
  checked when a lease is generated.
- **The measures** in the design (share of listings with complete answers, and so on).

## Tests

- `backend/tests/test_walkthrough_catalogue.py` (72) — catalogue integrity against the
  decree list, the frontend copy and the labels; answer and household validation with
  hostile values; merging and dates.
- `backend/tests_integration/test_walkthrough_answers.py` (24) — real rows: saving and
  reading back, a code cannot write to another listing, unusable codes write nothing,
  answers outside the catalogue are refused, bedrooms follow the room list, the household
  card and its refusals, the edit path and its permissions.
- `frontend/e2e/walkthrough.spec.ts` (18) — the helpers; the capture flow including clearing
  an answer, Back without saving, the household card, an out-of-range count, no network
  then back online, a refused save, an older session, French, a 320px phone and the
  keyboard; the edit page sending answers only when changed.
- 2026-10-13, on the development machine: 18 Playwright tests on Chromium, WebKit and mobile
  Chrome = 54 passes; the whole backend unit suite (689 passed, 2 skipped) and the whole
  integration suite (227 passed); `next build` and `tsc` clean.
- Also run by hand against a live backend and database, in Chromium and WebKit: answers
  saved on the phone page appeared on the public listing page in English and French, and a
  listing without answers showed no panel. This run is not automated: the listing page
  fetches on the server, so the browser tests cannot mock it.

## Known limits

- The panel has no automated browser test of its own (see above); its logic is covered
  through `lib/walkthrough.ts`.
- Answers kept on the phone while offline live in that browser only. Clearing site data, or
  a private window, loses them.
- An answer for a bedroom removed from the room list stays stored and is no longer shown.
- French copy was written without a native review.
