# Admin Panel: Stranded-Upload Monitor — Design Spec

**Date:** 2026-06-16
**Status:** Approved
**Scope:** `backend/app/routers/admin.py` only — no new files, no DB migrations

---

## Context

The statelessness retrofit (PR #4 / Item 12) removed `file_url`, `storage_key`, and
`extracted_data` from `identity_data`. Source documents are now stored in Redis with a
10-minute TTL and discarded after claim extraction. This broke the admin panel in two ways:

1. `GET /admin/verifications/pending` queries `identity_status == "pending_review"`, which
   is **never set** in the post-retrofit verification flows. The queue is permanently empty
   for new users.

2. `VerificationReview` exposes `file_url` and `extracted_data` — both are always blank
   post-retrofit. The model no longer reflects reality.

The manual document-review workflow is also no longer possible: documents are gone within
10 minutes, so an admin cannot meaningfully review them.

### What IS a real operational problem

Users who upload an identity document but never complete the selfie step end up with:
- `identity_status = "document_uploaded"` (stuck)
- Redis key TTL'd (doc gone after 10 min)
- `identity_verified = False`
- No user-facing error explaining they need to restart

These users need a support action (reset + notify). This is the queue the admin panel
should surface.

---

## Goal

Replace the dead `pending_review` queue with a **stranded-upload monitor**: surfaces users
whose identity upload stalled > 15 minutes ago, so an operator can reset them and they can
restart the flow.

---

## Changes to `backend/app/routers/admin.py`

### 1. `VerificationReview` model

Remove `file_url` and `extracted_data`. Add `minutes_stalled` and `checks`.

```python
class VerificationReview(BaseModel):
    id: str
    user_name: str
    type: str            # "identity_stalled" | "property"
    status: str          # "stalled_upload" | "pending_review" (property)
    upload_date: str     # ISO UTC string from identity_data["upload_date"]
    minutes_stalled: int # computed: floor((now_utc - upload_date) / 60)
    checks: dict | None  # identity_data.get("checks") — partial OCR results if any
```

`checks` is included because it tells the operator what succeeded before the user dropped
off (e.g. `document_detected: true, face_detected: false`), which is useful context for a
support outreach.

### 2. `GET /admin/verifications/pending` — query change

**DB query (users):**
```python
user_query = (
    select(User)
    .where(
        User.identity_status == "document_uploaded",
        User.identity_verified == False,
    )
    .offset(skip)
    .limit(limit)
)
```

**Python-side age filter** (15-minute threshold — Redis TTL is 10 min; at 15 min the doc
is definitively gone and the user cannot complete the flow without re-uploading):

```python
STALL_THRESHOLD_MINUTES = 15

now_utc = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC to match stored dates

for user in users:
    if not user.identity_data:
        continue
    upload_date_str = user.identity_data.get("upload_date", "")
    if not upload_date_str:
        continue
    try:
        upload_dt = datetime.fromisoformat(upload_date_str)
    except ValueError:
        continue
    stalled_for = now_utc - upload_dt
    if stalled_for < timedelta(minutes=STALL_THRESHOLD_MINUTES):
        continue  # user may still complete on their own
    pending.append(VerificationReview(
        id=str(user.id),
        user_name=user.full_name or user.email,
        type="identity_stalled",
        status="stalled_upload",
        upload_date=upload_date_str,
        minutes_stalled=int(stalled_for.total_seconds() / 60),
        checks=user.identity_data.get("checks"),
    ))
```

**Drop the `employment_status == "pending_review"` branch** — it is dead code. The only
`employment_status` assignment in verification.py is `res.get("status", "unverified")`,
which never yields `"pending_review"` from the FR 2D-Doc income service.

**Keep the property query unchanged** — out of scope for this change. However, the property
`VerificationReview` builder (lines 219-230) currently passes `file_url=` and
`extracted_data=` to the model constructor. Those kwargs must be removed when the model
drops those fields; the property entry is constructed without them:

```python
pending.append(VerificationReview(
    id=str(prop.id),
    user_name=f"Property: {prop.title}",
    type="property",
    status="pending_review",
    upload_date=prop.verification_data.get("upload_date", ""),
    minutes_stalled=0,   # properties don't have a stall concept; 0 is sentinel
    checks=prop.verification_data.get("checks"),
))
```

**Pagination note:** `skip`/`limit` is applied at the DB level; the Python-side age filter
may reduce the result count below `limit`. This is acceptable at MVP scale (stalled users
are rare). Document this in the endpoint docstring.

### 3. New endpoint — `POST /admin/verifications/{id}/reset`

Resets a stalled user so they can restart the identity flow from scratch.

```python
@router.post("/verifications/{id}/reset")
async def reset_verification(
    id: str,
    type: str,  # currently only "identity" supported
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Reset a stalled verification. Clears identity_data and sets status back to
    "unverified" so the user can restart the upload flow.

    Guards:
    - 404 if user not found
    - 409 if identity_verified is True (completed between queue load and reset click)
    - 400 for unsupported type values
    """
    from uuid import UUID
    uid = UUID(id)

    if type == "identity":
        user = await db.get(User, uid)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.identity_verified:
            raise HTTPException(
                status_code=409,
                detail="User has already completed identity verification — cannot reset."
            )
        user.identity_status = "unverified"
        user.identity_data = None  # type: ignore
        await db.commit()
        return {"status": "reset", "user_id": id}

    raise HTTPException(status_code=400, detail=f"Reset not supported for type: {type}")
```

**Trust score is not modified** — no trust was awarded (the flow never completed), so
there is nothing to deduct.

### 4. Guard `POST /admin/verifications/{id}/approve` for `type == "identity"`

Post-retrofit there is no document to review, so manual identity approval is
evidence-free. Add a guard at the top of the `type == "identity"` branch:

```python
if type == "identity":
    raise HTTPException(
        status_code=400,
        detail=(
            "Identity verifications cannot be manually approved — "
            "no document is retained post-retrofit. Use /reset to unblock stalled users."
        ),
    )
```

Property approval (`type == "property"`) is kept as-is.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| User stalled < 15 min | Filtered out — may still self-complete |
| User completes verification after admin loads queue | Reset endpoint returns 409 |
| User uploaded twice (second upload after prior stall) | `upload_date` reflects latest upload; age check is always current |
| `identity_data` is None or `upload_date` missing | Skip silently — defensive against legacy rows |
| R2 fallback path users (have `file_url` in identity_data) | Treated identically — operator action is reset, not document review |
| `employment_status == "pending_review"` branch | Removed — dead code, no emit path in current verification flows |
| Admin calls approve with `type == "identity"` | 400 with descriptive message pointing to /reset |

---

## What This Does NOT Change

- Property queue logic — out of scope
- `POST /admin/verifications/{id}/approve` for `type == "property"` — kept as-is
- Frontend / any API consumer — response shape changes (`file_url`/`extracted_data` gone,
  `minutes_stalled`/`checks` added); consumers must be updated separately if they exist
- No DB schema changes — `identity_status`, `identity_data`, `identity_verified` columns
  already exist and are already the correct types

---

## Files Changed

| File | Change |
|---|---|
| `backend/app/routers/admin.py` | All changes above |
| `backend/tests/test_admin.py` (or `tests_integration/`) | New tests for reset endpoint, stall filter, approve guard |
