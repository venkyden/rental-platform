# Admin Stranded-Upload Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead `pending_review` admin queue with a stranded-upload monitor that surfaces users stuck mid-verification so operators can reset them.

**Architecture:** All changes are contained in `backend/app/routers/admin.py`. The `VerificationReview` Pydantic model is updated to drop stale fields and add operational ones. The pending queue query is changed from `identity_status == "pending_review"` (never set post-retrofit) to `identity_status == "document_uploaded"` with a 15-minute age filter applied in Python. A new `/reset` endpoint replaces the blind identity approve action; the approve endpoint is guarded to block `type == "identity"` with a descriptive error.

**Tech Stack:** FastAPI, SQLAlchemy async, Pydantic v2, pytest + `unittest.mock` (same pattern as `tests/test_intl_identity.py`).

---

## File Map

| File | Action | What changes |
|---|---|---|
| `backend/app/routers/admin.py` | Modify | 4 targeted changes (model, query, new endpoint, approve guard) |
| `backend/tests/test_admin.py` | Create | All tests for the 4 changes |

---

## Task 1: Update `VerificationReview` model

**Files:**
- Modify: `backend/app/routers/admin.py:22-29`
- Test: `backend/tests/test_admin.py` (create)

### Background

`VerificationReview` currently has `file_url: str` and `extracted_data: dict | None` — both always blank post-retrofit. They are replaced by `minutes_stalled: int` and `checks: dict | None`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_admin.py` with this content:

```python
"""
Tests for admin router — stranded-upload monitor (Item 12 downstream fix).
Pattern: mock DB + mock auth, same as test_intl_identity.py.
"""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.routers.auth import get_current_user
from tests.conftest import make_mock_user, mock_get_db


def make_admin_client():
    admin = make_mock_user("admin", "admin@test.com")
    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides[get_current_user] = lambda: admin
    target_app.dependency_overrides[get_db] = mock_get_db
    return TestClient(app)


class TestVerificationReviewModel:
    def test_model_has_minutes_stalled_and_checks(self):
        from app.routers.admin import VerificationReview
        r = VerificationReview(
            id="abc",
            user_name="Jean Dupont",
            type="identity_stalled",
            status="stalled_upload",
            upload_date="2026-06-16T09:00:00",
            minutes_stalled=45,
            checks={"document_detected": True},
        )
        assert r.minutes_stalled == 45
        assert r.checks == {"document_detected": True}

    def test_model_has_no_file_url_field(self):
        from app.routers.admin import VerificationReview
        import pydantic
        fields = VerificationReview.model_fields
        assert "file_url" not in fields
        assert "extracted_data" not in fields

    def test_model_checks_nullable(self):
        from app.routers.admin import VerificationReview
        r = VerificationReview(
            id="abc",
            user_name="Jean Dupont",
            type="identity_stalled",
            status="stalled_upload",
            upload_date="2026-06-16T09:00:00",
            minutes_stalled=20,
            checks=None,
        )
        assert r.checks is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/venkat/rental-platform/backend
python -m pytest tests/test_admin.py::TestVerificationReviewModel -v 2>&1 | tail -20
```

Expected: FAIL — `VerificationReview` still has `file_url` and lacks `minutes_stalled`.

- [ ] **Step 3: Update the `VerificationReview` model in `admin.py`**

Replace lines 22–29 in `backend/app/routers/admin.py`:

```python
class VerificationReview(BaseModel):
    id: str
    user_name: str
    type: str            # "identity_stalled" | "property"
    status: str          # "stalled_upload" | "pending_review" (property)
    upload_date: str     # ISO UTC from identity_data["upload_date"]
    minutes_stalled: int # floor((now_utc - upload_date).total_seconds() / 60)
    checks: dict | None  # identity_data.get("checks") — partial OCR results if any
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/venkat/rental-platform/backend
python -m pytest tests/test_admin.py::TestVerificationReviewModel -v 2>&1 | tail -10
```

Expected: 3 PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/admin.py backend/tests/test_admin.py
git commit -m "feat(admin): update VerificationReview model for post-retrofit shape"
```

---

## Task 2: Update `GET /admin/verifications/pending`

**Files:**
- Modify: `backend/app/routers/admin.py:154-232`
- Test: `backend/tests/test_admin.py`

### Background

The endpoint currently queries `identity_status == "pending_review"` (never set post-retrofit) and `employment_status == "pending_review"` (also dead). These are replaced by a query for `identity_status == "document_uploaded" AND identity_verified == False`, then filtered in Python to only include entries older than 15 minutes (Redis TTL is 10 min — at 15 min the user is definitively stuck).

The property branch in the same endpoint also passes `file_url=` and `extracted_data=` to the now-updated `VerificationReview` constructor — those kwargs must be removed.

- [ ] **Step 1: Add tests for the new query behaviour**

Append to `backend/tests/test_admin.py`:

```python
class TestPendingVerificationsQueue:
    def _make_stalled_user(self, minutes_ago: int):
        """Create a mock user stuck at document_uploaded N minutes ago."""
        from datetime import datetime, timedelta, timezone
        user = make_mock_user("tenant")
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        upload_dt = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=minutes_ago)
        user.identity_data = {
            "status": "document_uploaded",
            "upload_date": upload_dt.isoformat(),
            "checks": {"document_detected": True},
        }
        return user

    def test_stalled_user_over_threshold_appears_in_queue(self):
        stalled = self._make_stalled_user(minutes_ago=30)
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [stalled]

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app) as client:
            response = client.get("/admin/verifications/pending")

        target_app.dependency_overrides.clear()
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        item = next(x for x in data if x["type"] == "identity_stalled")
        assert item["status"] == "stalled_upload"
        assert item["minutes_stalled"] >= 28
        assert "file_url" not in item
        assert "extracted_data" not in item

    def test_recent_upload_under_threshold_excluded(self):
        """User uploaded 5 min ago — may still self-complete. Not shown."""
        recent = self._make_stalled_user(minutes_ago=5)
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [recent]

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app) as client:
            response = client.get("/admin/verifications/pending")

        target_app.dependency_overrides.clear()
        assert response.status_code == 200
        identity_items = [x for x in response.json() if x["type"] == "identity_stalled"]
        assert identity_items == []

    def test_missing_identity_data_skipped_silently(self):
        """Users with identity_status=document_uploaded but no identity_data don't crash."""
        user = make_mock_user("tenant")
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        user.identity_data = None

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [user]

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app) as client:
            response = client.get("/admin/verifications/pending")

        target_app.dependency_overrides.clear()
        assert response.status_code == 200
        assert response.json() == []

    def test_non_admin_gets_403(self):
        target_app = app.app if hasattr(app, "app") else app
        tenant = make_mock_user("tenant")
        target_app.dependency_overrides[get_current_user] = lambda: tenant
        target_app.dependency_overrides[get_db] = mock_get_db
        with TestClient(app) as client:
            response = client.get("/admin/verifications/pending")
        target_app.dependency_overrides.clear()
        assert response.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/venkat/rental-platform/backend
python -m pytest tests/test_admin.py::TestPendingVerificationsQueue -v 2>&1 | tail -20
```

Expected: FAIL — the endpoint still queries `pending_review` and uses the old model shape.

- [ ] **Step 3: Rewrite the user query section of `GET /admin/verifications/pending`**

In `backend/app/routers/admin.py`, the full updated endpoint (replace lines 154–232):

```python
@router.get("/verifications/pending", response_model=List[VerificationReview])
async def get_pending_verifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    List verifications that require operator attention.

    Identity: users whose upload stalled > 15 minutes ago (Redis TTL is 10 min —
    at 15 min the user cannot complete the flow without re-uploading). The
    skip/limit is applied at the DB level; the Python-side age filter may reduce
    the result count below `limit` — acceptable at MVP scale.

    Property: unverified properties with verification_data present.
    """
    from datetime import datetime, timedelta, timezone

    STALL_THRESHOLD_MINUTES = 15

    pending = []

    # ── 1. Stalled identity uploads ───────────────────────────────────────────
    user_query = (
        select(User)
        .where(
            User.identity_status == "document_uploaded",
            User.identity_verified == False,
        )
        .offset(skip)
        .limit(limit)
    )
    user_result = await db.execute(user_query)
    users = user_result.scalars().all()

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC matches stored dates
    stall_threshold = timedelta(minutes=STALL_THRESHOLD_MINUTES)

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
        if stalled_for < stall_threshold:
            continue
        pending.append(VerificationReview(
            id=str(user.id),
            user_name=user.full_name or user.email,
            type="identity_stalled",
            status="stalled_upload",
            upload_date=upload_date_str,
            minutes_stalled=int(stalled_for.total_seconds() / 60),
            checks=user.identity_data.get("checks"),
        ))

    # ── 2. Unverified properties ──────────────────────────────────────────────
    prop_query = (
        select(Property)
        .where(Property.ownership_verified == False)
        .offset(skip)
        .limit(limit)
    )
    prop_result = await db.execute(prop_query)
    properties = prop_result.scalars().all()

    for prop in properties:
        if hasattr(prop, 'verification_data') and prop.verification_data:
            pending.append(VerificationReview(
                id=str(prop.id),
                user_name=f"Property: {prop.title}",
                type="property",
                status="pending_review",
                upload_date=prop.verification_data.get("upload_date", ""),
                minutes_stalled=0,
                checks=prop.verification_data.get("checks"),
            ))

    return pending
```

Note: also add `from datetime import datetime, timedelta, timezone` at the top of `admin.py` if it isn't already imported (check line 1–15 first).

- [ ] **Step 4: Add datetime import to `admin.py`**

The existing `admin.py` imports do not include `datetime`. Add it after the `from sqlalchemy import select, or_` line (currently line 12):

```python
from datetime import datetime, timedelta, timezone
```

The full import block at the top of the file should then look like:

```python
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.services.feature_flag_service import feature_flag_service
from app.models.user import User, UserRole
from app.models.property import Property
from app.routers.auth import get_current_user
from sqlalchemy import select, or_
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/venkat/rental-platform/backend
python -m pytest tests/test_admin.py::TestPendingVerificationsQueue -v 2>&1 | tail -15
```

Expected: 4 PASSED.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/admin.py backend/tests/test_admin.py
git commit -m "feat(admin): replace pending_review queue with stranded-upload monitor"
```

---

## Task 3: Add `POST /admin/verifications/{id}/reset`

**Files:**
- Modify: `backend/app/routers/admin.py` (append after line 232)
- Test: `backend/tests/test_admin.py`

### Background

The new `/reset` endpoint clears `identity_data` and sets `identity_status = "unverified"` so the user can restart the upload flow. Trust score is NOT touched (no trust was awarded — the flow never completed). Three guards: 404 (user not found), 409 (already verified — race condition protection), 400 (unsupported type).

- [ ] **Step 1: Add tests for the reset endpoint**

Append to `backend/tests/test_admin.py`:

```python
class TestResetVerification:
    def _make_db_with_user(self, user):
        mock_db = MagicMock()
        mock_db.get = AsyncMock(return_value=user)
        mock_db.commit = AsyncMock()
        return mock_db

    def _admin_client_with_db(self, mock_db):
        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db
        return target_app

    def test_reset_stalled_user_returns_200(self):
        user = make_mock_user("tenant")
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        user.identity_data = {"status": "document_uploaded", "upload_date": "2026-06-16T09:00:00"}
        mock_db = self._make_db_with_user(user)
        target_app = self._admin_client_with_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{user.id}/reset?type=identity")

        target_app.dependency_overrides.clear()
        assert response.status_code == 200
        assert response.json()["status"] == "reset"
        assert user.identity_status == "unverified"
        assert user.identity_data is None

    def test_reset_already_verified_returns_409(self):
        user = make_mock_user("tenant")
        user.identity_verified = True
        user.identity_status = "verified"
        mock_db = self._make_db_with_user(user)
        target_app = self._admin_client_with_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{user.id}/reset?type=identity")

        target_app.dependency_overrides.clear()
        assert response.status_code == 409
        assert "already completed" in response.json()["detail"]

    def test_reset_user_not_found_returns_404(self):
        mock_db = MagicMock()
        mock_db.get = AsyncMock(return_value=None)
        target_app = self._admin_client_with_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{uuid.uuid4()}/reset?type=identity")

        target_app.dependency_overrides.clear()
        assert response.status_code == 404

    def test_reset_unsupported_type_returns_400(self):
        user = make_mock_user("tenant")
        mock_db = self._make_db_with_user(user)
        target_app = self._admin_client_with_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{user.id}/reset?type=property")

        target_app.dependency_overrides.clear()
        assert response.status_code == 400

    def test_reset_does_not_touch_trust_score(self):
        user = make_mock_user("tenant")
        user.trust_score = 50
        user.identity_verified = False
        user.identity_status = "document_uploaded"
        user.identity_data = {"status": "document_uploaded", "upload_date": "2026-06-16T09:00:00"}
        mock_db = self._make_db_with_user(user)
        target_app = self._admin_client_with_db(mock_db)

        with TestClient(app) as client:
            client.post(f"/admin/verifications/{user.id}/reset?type=identity")

        target_app.dependency_overrides.clear()
        assert user.trust_score == 50
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/venkat/rental-platform/backend
python -m pytest tests/test_admin.py::TestResetVerification -v 2>&1 | tail -15
```

Expected: FAIL — endpoint does not exist yet.

- [ ] **Step 3: Add the reset endpoint to `admin.py`**

Insert after the closing brace of `get_pending_verifications` (after the `return pending` line, before `@router.post("/verifications/{id}/approve")`):

```python
@router.post("/verifications/{id}/reset")
async def reset_verification(
    id: str,
    type: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Reset a stalled identity verification so the user can restart the upload flow.
    Clears identity_data and sets identity_status back to "unverified".
    Trust score is unchanged — no trust was awarded for an incomplete flow.

    Returns 409 if the user completed verification between queue load and this call.
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
                detail="User has already completed identity verification — cannot reset.",
            )
        user.identity_status = "unverified"
        user.identity_data = None  # type: ignore
        await db.commit()
        return {"status": "reset", "user_id": id}

    raise HTTPException(status_code=400, detail=f"Reset not supported for type: {type}")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/venkat/rental-platform/backend
python -m pytest tests/test_admin.py::TestResetVerification -v 2>&1 | tail -15
```

Expected: 5 PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/admin.py backend/tests/test_admin.py
git commit -m "feat(admin): add reset endpoint for stalled identity verifications"
```

---

## Task 4: Guard `approve` against `type == "identity"`

**Files:**
- Modify: `backend/app/routers/admin.py:234-275` (the approve endpoint)
- Test: `backend/tests/test_admin.py`

### Background

`POST /admin/verifications/{id}/approve` with `type=identity` blindly sets `identity_verified = True` and grants +30 trust with no document in evidence. Post-retrofit there is no document to review. A guard is added to return 400 for `type == "identity"` with a message pointing operators to `/reset` instead. Property approval is unchanged.

- [ ] **Step 1: Add the test**

Append to `backend/tests/test_admin.py`:

```python
class TestApproveGuard:
    def test_approve_identity_returns_400(self):
        user = make_mock_user("tenant")
        user.identity_data = {"status": "document_uploaded"}
        mock_db = MagicMock()
        mock_db.get = AsyncMock(return_value=user)

        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{user.id}/approve?type=identity")

        target_app.dependency_overrides.clear()
        assert response.status_code == 400
        assert "/reset" in response.json()["detail"]

    def test_approve_property_still_works(self):
        prop = MagicMock()
        prop.id = uuid.uuid4()
        mock_db = MagicMock()
        mock_db.get = AsyncMock(return_value=prop)
        mock_db.commit = AsyncMock()

        target_app = app.app if hasattr(app, "app") else app
        admin = make_mock_user("admin", "admin@test.com")
        target_app.dependency_overrides[get_current_user] = lambda: admin
        target_app.dependency_overrides[get_db] = lambda: mock_db

        with TestClient(app) as client:
            response = client.post(f"/admin/verifications/{prop.id}/approve?type=property")

        target_app.dependency_overrides.clear()
        assert response.status_code == 200
        assert prop.ownership_verified is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/venkat/rental-platform/backend
python -m pytest tests/test_admin.py::TestApproveGuard -v 2>&1 | tail -10
```

Expected: `test_approve_identity_returns_400` FAIL (currently returns 200), `test_approve_property_still_works` may PASS or FAIL depending on mock shape.

- [ ] **Step 3: Add the guard to the approve endpoint**

In `backend/app/routers/admin.py`, locate `POST /admin/verifications/{id}/approve` (around line 234). At the very start of the function body, before the `if type == "identity":` block, add:

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

The existing `elif type == "employment":` and `elif type == "property":` blocks remain untouched below this guard.

- [ ] **Step 4: Run all admin tests**

```bash
cd /Users/venkat/rental-platform/backend
python -m pytest tests/test_admin.py -v 2>&1 | tail -25
```

Expected: all tests PASS.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
cd /Users/venkat/rental-platform/backend
python -m pytest tests/ -v --tb=short 2>&1 | tail -30
```

Expected: all existing tests pass, new admin tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/admin.py backend/tests/test_admin.py
git commit -m "feat(admin): guard approve endpoint against evidence-free identity approval"
```

---

## Task 5: Update DOSSIER

**Files:**
- Modify: `docs/features/trust-layer/DOSSIER.md`

- [ ] **Step 1: Mark Item 12 downstream admin gap as resolved**

Find the Item 12 entry in `docs/features/trust-layer/DOSSIER.md`. Add a note that the admin panel downstream gap has been addressed:

```
Item 12 (Statelessness Retrofit): ✅ Done (2026-06-15). Admin panel downstream gap (dead
pending_review queue, stale VerificationReview fields) resolved 2026-06-16 — replaced with
stranded-upload monitor (identity_stalled queue + /reset endpoint).
```

- [ ] **Step 2: Commit**

```bash
git add docs/features/trust-layer/DOSSIER.md
git commit -m "docs(dossier): mark Item 12 admin downstream gap as resolved"
```
