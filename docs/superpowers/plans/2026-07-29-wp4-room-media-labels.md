# WP4 — Room Media Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task.

**Goal:** Room chips show size, capture-page room labels are actually localized (currently hardcoded English server strings), the detail-page gallery gets room-grouped thumbnail navigation, and GPS-verified photos are badged.

**Re-evaluation note (2026-07-29):** Checked current state before planning — most of the original WP4 spec is **already built**:
- Publish already **hard-blocks** (400, not the spec's "soft warn") unless every `room_details` index has ≥1 photo/video — stricter than originally planned; keep it, don't water down.
- Capture page (`app/capture/[code]/page.tsx`) already has a room-selector chip UI wired to `room_index`/`room_label` on upload.
- Detail page already shows a room-label badge over the active hero photo.

**Real gaps found:**
1. Both media-session endpoints (`create_media_session`, `get_media_session`) build `rooms_list` with a **hardcoded English label** `f"Bedroom {i+1}"` sent to a capture page whose own UI already toggles FR/EN — the room chip text never localizes. Duplicated verbatim in two places.
2. Room chips carry no size (`room_details[i].surface`), even though it's already captured by the wizard.
3. `get_property`'s photo-sync dict has no GPS-verification signal — no way to badge a photo as GPS-verified on the detail page despite `PropertyMedia.verification_status`/`captured_latitude` already existing.
4. Gallery is a single hero image + prev/next arrows — no thumbnail strip, so "grouped by room" only shows one room label at a time with no visual overview.

**Architecture:** Backend: extract the duplicated `rooms_list` builder into one helper returning `{index, surface}` (no label — text is now purely client-rendered/localized); add `gps_verified: bool` to the photo-sync dict. Frontend: capture page renders localized "Chambre {n}" / "Room {n}" + surface suffix; detail page adds a thumbnail strip and a GPS badge on verified photos.

---

## Setup

- [ ] `git worktree add ../rental-platform-room-media -b feat/room-media-labels && cd ../rental-platform-room-media`
- [ ] `cp ../rental-platform/backend/.env backend/.env`

### Task 1: Backend — shared room-list helper with surface, no hardcoded label

**Files:** `backend/app/routers/properties.py`, `backend/tests/test_room_media.py` (create)

- Add a module-level helper near `_landlord_trust_fields`:
```python
def _rooms_for_capture(room_details: Optional[list]) -> Optional[list]:
    """Room list for the capture-page selector: index + surface only — no
    hardcoded label text, so the capture page can localize it (FR/EN)."""
    if not room_details:
        return None
    rooms = []
    for i, room in enumerate(room_details):
        surface = None
        if isinstance(room, dict):
            surface = room.get("surface") or room.get("surface_sqm") or room.get("size_sqm")
        rooms.append({"index": i, "surface": surface})
    return rooms
```
- Replace both inline `rooms_list = [...]` blocks (in `create_media_session` and `get_media_session`) with `rooms_list = _rooms_for_capture(cast(Optional[list], property_obj.room_details))`.
- Tests: empty/None room_details → None; rooms with surface → correct list; rooms missing surface → `surface: None`, index still present.

### Task 2: Backend — `gps_verified` on synced photos

**Files:** `backend/app/routers/properties.py` (photo-sync block in `get_property`), `backend/tests/test_room_media.py`

- In the `new_photos.append({...})` dict (the `all_media` sync loop), add:
```python
"gps_verified": m.verification_status == "verified" and m.captured_latitude is not None,
```
- Test: a `PropertyMedia`-shaped mock with `verification_status="verified"` + `captured_latitude` set → `gps_verified=True`; `verification_status="pending_review"` → `False`; verified but no GPS coords (manual upload fallback path) → `False`.

### Task 3: Frontend — capture page localized, sized room chips

**Files:** `frontend/app/capture/[code]/page.tsx`

- `Room` type: add `surface?: number | null` (replace/extend wherever `label` was typed — the API no longer sends `label`).
- Chip render: replace `{room.label}` with `{fr ? 'Chambre' : 'Room'} {room.index + 1}{room.surface ? ` — ${room.surface}m²` : ''}`.
- The upload payload's `room_label` (sent to `/media`) should be built client-side the same way, e.g. `` `${fr ? 'Chambre' : 'Room'} ${selectedRoom.index + 1}` `` — keeps `PropertyMedia.room_label` populated (used by the publish-gate's `room.get("label", ...)` fallback text and the detail-page room badge) without depending on a server-sent label string.

### Task 4: Frontend — thumbnail strip + GPS badge on detail page

**Files:** `frontend/app/properties/[id]/PropertyDetailClient.tsx`

- `PropertyPhoto` interface: add `gps_verified?: boolean`.
- Add a `getGpsVerified(p)` helper mirroring the existing `getRoomLabel`/`getMediaType` pattern.
- Below the hero image block (after the closing `</motion.div>` of the hero, before "Walkthrough Video Download Section"), add a horizontal-scroll thumbnail strip when `galleryPhotos.length > 1`: each thumbnail is a small `<button>` with a cropped `<Image>`, room-label caption underneath, active-state ring border, `onClick={() => setActivePhotoIdx(i)}`.
- On the hero image, add a small GPS badge (reuse the `ShieldCheck` icon already imported) next to the existing room-label badge when `getGpsVerified(activePhoto)` is true — same visual language as the landlord-card verified badge.

### Task 5: i18n

**Files:** `frontend/lib/i18n.ts`

- `property.media.gpsVerified` ("GPS-verified" / "Vérifié GPS") — only new key needed; room chip text is now inline-conditional (matches the capture page's existing `fr ? ... : ...` convention, not the `t()` dictionary).

### Task 6: Verification

- Backend: `python -m pytest tests/ -q`.
- Frontend: `npx tsc --noEmit`, `npm run lint`, `npx next build`.
- e2e regression: landing/search/wizard specs (chromium), stop the docker frontend container first.
- Finish per finishing-a-development-branch: merge to master, push, remove worktree.

## Out of scope (deferred to WP5)

- New Playwright coverage for the capture page / thumbnail strip specifically — folds into WP5's broader both-sides stress-test pass.
