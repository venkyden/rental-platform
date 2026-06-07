# FR Identity MEDIUM Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Label every OCR+selfie identity result as MEDIUM (fixing the silent "fully verified" bug), add a state-signed name cross-check from the avis d'imposition 2D-Doc (still MEDIUM), and record FranceConnect as the deferred HIGH path — after upgrading the backend to Python 3.13.

**Architecture:** Four isolated commits. (A) Python 3.13 upgrade + dependency bumps. (B) A single source of truth for identity-assurance labelling, stamped into `identity_data` at every OCR+selfie success and inferred-on-read for legacy users. (C) A bounded `fr_2ddoc` service (decode → parse → ANTS ECDSA verify → declarant names) behind a new authenticated endpoint that corroborates the OCR'd ID name. (D) Documentation reconciliation.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy async, pytest (real-Postgres integration harness), `betagouv/2ddoc-parser` (MIT, offline ANTS ECDSA), `pylibdmtx` (DataMatrix decode), `PyMuPDF` (PDF rasterize).

**Spec:** `docs/superpowers/specs/2026-06-06-fr-identity-medium-rail-design.md`
**Worktree:** `/Users/venkat/rental-platform-fr-identity-medium` on branch `feat/fr-identity-medium-rail`.

**Working directory for all commands:** `backend/` unless stated otherwise.
**Integration tests need Postgres:** `DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test` (the conftest default). Start a local `roomivo_test` DB before running `tests_integration/`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `backend/.python-version` | Pin interpreter to 3.13 | Modify |
| `backend/Dockerfile` | 3.13 base image + `libdmtx` system lib | Modify |
| `backend/requirements.txt` | 3.13-compatible pins + 3 new deps | Modify |
| `backend/app/services/identity_assurance.py` | Single source of truth: MEDIUM label + inference-on-read | Create |
| `backend/app/routers/verification.py` | Stamp label in 3 OCR+selfie branches; surface assurance on status; new avis endpoint | Modify |
| `backend/app/services/fr_2ddoc.py` | Avis 2D-Doc decode/parse/verify + name match | Create |
| `backend/tests_integration/test_identity_assurance.py` | Unit + integration tests for Parts B | Create |
| `backend/tests_integration/test_fr_2ddoc.py` | Unit + integration tests for Part C | Create |
| `docs/features/trust-layer/DOSSIER.md` | Reconcile justificatif-API assumption → FranceConnect deferred | Modify |
| `CLAUDE.md` | Same reconciliation in the condensed context | Modify |

---

## Part A — Python 3.13 upgrade

### Task 1: Upgrade interpreter and dependencies to Python 3.13

**Files:**
- Modify: `backend/.python-version`
- Modify: `backend/Dockerfile`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Confirm Python 3.13 is available locally**

Run: `python3.13 --version`
Expected: `Python 3.13.x`. If missing, install it (`brew install python@3.13`) before continuing.

- [ ] **Step 2: Pin the interpreter**

Replace the entire contents of `backend/.python-version` with:

```
3.13
```

- [ ] **Step 3: Bump the Docker base image (both stages)**

In `backend/Dockerfile`, change both occurrences of the base image:

```dockerfile
FROM python:3.13-slim AS builder
```
```dockerfile
FROM python:3.13-slim AS runner
```

(There are exactly two `python:3.12-slim` lines — builder and runner. Change both.)

- [ ] **Step 4: Bump the dependency pins that lack 3.13 wheels**

In `backend/requirements.txt`, make these three edits:

```
asyncpg>=0.30.0
```
```
psycopg2-binary==2.9.10
```
```
greenlet>=3.1.0
```

(Leave every other line unchanged for now. `passlib==1.7.4` stays — it degrades gracefully on 3.13 because its `crypt` import is wrapped in `try/except ImportError`, and our only scheme is `argon2` via `argon2-cffi`.)

- [ ] **Step 5: Recreate the virtualenv on 3.13 and install**

Run:
```bash
cd backend && python3.13 -m venv .venv313 && . .venv313/bin/activate && pip install -r requirements.txt
```
Expected: a clean install with no "no matching distribution" / wheel-build errors. If `celery==5.3.4` or `pytest==7.4.4` fail to build on 3.13, bump them (`celery>=5.4.0`, `pytest>=8.0.0`) and re-run.

- [ ] **Step 6: Verify the password-hashing path loads (the PEP 594 risk)**

Run:
```bash
cd backend && python -c "from app.core.security import get_password_hash, verify_password; h=get_password_hash('x'); assert verify_password('x', h); print('argon2 OK on', __import__('sys').version.split()[0])"
```
Expected: `argon2 OK on 3.13.x`. If this raises an `ImportError` about `crypt`, replace passlib usage in `app/core/security.py` with `argon2-cffi` directly (`from argon2 import PasswordHasher`) — but only if Step 6 actually fails.

- [ ] **Step 7: Run the full test suite on 3.13**

Run:
```bash
cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test pytest -q
```
Expected: same pass/fail baseline as before the upgrade (all green, or only pre-existing known failures). Fix any 3.13-specific breakage surfaced here.

- [ ] **Step 8: Verify the Docker image builds on 3.13**

Run:
```bash
cd backend && docker build -t roomivo-backend:py313 .
```
Expected: build succeeds through both stages.

- [ ] **Step 9: Commit**

```bash
cd /Users/venkat/rental-platform-fr-identity-medium
git add backend/.python-version backend/Dockerfile backend/requirements.txt backend/app/core/security.py
git commit -m "build: upgrade backend to Python 3.13 (asyncpg/psycopg2 bumps, passlib verified)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Part B — MEDIUM retrofit

### Task 2: Identity-assurance helper (single source of truth)

**Files:**
- Create: `backend/app/services/identity_assurance.py`
- Test: `backend/tests_integration/test_identity_assurance.py`

- [ ] **Step 1: Write the failing unit tests**

Create `backend/tests_integration/test_identity_assurance.py`:

```python
"""
FR identity MEDIUM rail — assurance labelling (DOSSIER §5.2: AS-1, AS-4).
"""
import pytest
from app.services.identity_assurance import (
    OCR_LIVENESS_LABEL,
    derive_identity_assurance,
)


def test_label_is_medium_ocr_liveness():
    assert OCR_LIVENESS_LABEL == {
        "identity_assurance": "MEDIUM",
        "identity_source": "ocr_liveness",
    }


def test_explicit_label_is_returned():
    data = {"identity_assurance": "MEDIUM", "identity_source": "ocr_liveness"}
    assert derive_identity_assurance(True, data) == "MEDIUM"


def test_verified_but_unlabelled_infers_medium():
    # Legacy user verified before labelling existed.
    assert derive_identity_assurance(True, {"verified": True, "status": "verified"}) == "MEDIUM"


def test_unverified_is_unverified():
    assert derive_identity_assurance(False, {"status": "document_uploaded"}) == "UNVERIFIED"
    assert derive_identity_assurance(False, None) == "UNVERIFIED"


def test_unknown_label_falls_back_to_inference():
    # A garbage label is ignored; falls back to verified→MEDIUM.
    assert derive_identity_assurance(True, {"identity_assurance": "SUPER"}) == "MEDIUM"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && pytest tests_integration/test_identity_assurance.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.identity_assurance'`.

- [ ] **Step 3: Write the helper**

Create `backend/app/services/identity_assurance.py`:

```python
"""
Identity assurance labelling for the OCR+selfie (MEDIUM) rail.

Single source of truth for:
- the label stamped onto an OCR+selfie verification, and
- the inference-on-read rule for users verified before labelling existed.

See DOSSIER §5.2 (AS-1 / AS-4) and
docs/superpowers/specs/2026-06-06-fr-identity-medium-rail-design.md.
The OCR+selfie path is MEDIUM by definition (OSS liveness is not forgery-proof)
and is NEVER presented as HIGH. "ocr_liveness" is already a MEDIUM-only source
in app/services/credential.py.
"""

# Stamped into identity_data when an OCR+selfie verification succeeds.
OCR_LIVENESS_LABEL = {
    "identity_assurance": "MEDIUM",
    "identity_source": "ocr_liveness",
}

_VALID_BANDS = ("HIGH", "MEDIUM", "UNVERIFIED")


def derive_identity_assurance(identity_verified: bool, identity_data: dict | None) -> str:
    """
    Report the assurance band for a user's identity.

    - Explicit valid label present in identity_data -> use it.
    - Verified but unlabelled (legacy) -> MEDIUM (every existing verification is OCR+selfie).
    - Otherwise -> UNVERIFIED.
    """
    data = identity_data or {}
    label = data.get("identity_assurance")
    if label in _VALID_BANDS:
        return label
    if identity_verified:
        return "MEDIUM"
    return "UNVERIFIED"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest tests_integration/test_identity_assurance.py -q`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
cd /Users/venkat/rental-platform-fr-identity-medium
git add backend/app/services/identity_assurance.py backend/tests_integration/test_identity_assurance.py
git commit -m "feat(trust-layer): identity-assurance helper (MEDIUM label + inference)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3: Stamp the MEDIUM label in all three OCR+selfie branches

**Files:**
- Modify: `backend/app/routers/verification.py` (selfie_with_id ~L149, mobile selfie_with_id ~L400, mobile selfie ~L470, upload-selfie ~L626)
- Test: `backend/tests_integration/test_identity_assurance.py` (append)

- [ ] **Step 1: Add the import at the top of `verification.py`**

After the existing `from app.utils.watermark import apply_watermark` line (~L27), add:

```python
from app.services.identity_assurance import OCR_LIVENESS_LABEL, derive_identity_assurance
```

- [ ] **Step 2: Stamp the label — authenticated selfie_with_id branch**

In `upload_identity_document`, the `side == "selfie_with_id"` branch sets `current_user.identity_data = {...}` (~L149-159). Add the label spread as the last entries of that dict:

```python
        current_user.identity_data = {
            "verified": True,
            "upload_date": naive_utcnow().isoformat(),
            "filename": file.filename,
            "file_url": storage_result["url"],
            "storage_key": storage_result.get("key"),
            "status": "verified",
            "verification_method": "selfie_with_id",
            "extracted_data": result["data"],
            "checks": result["validation_checks"],
            **OCR_LIVENESS_LABEL,
        }
```

- [ ] **Step 3: Stamp the label — mobile selfie_with_id branch**

In `upload_identity_mobile`, the `side == "selfie_with_id"` branch sets `user.identity_data = {...}` (~L400-410). Add `**OCR_LIVENESS_LABEL,` as the last entry of that dict:

```python
        user.identity_data = {
            "verified": True,
            "upload_date": naive_utcnow().isoformat(),
            "file_url": storage_result["url"],
            "storage_key": storage_result.get("key"),
            "status": "verified",
            "verification_method": "selfie_with_id",
            "extracted_data": doc_result["data"],
            "checks": doc_result["validation_checks"],
            "verified_at": naive_utcnow().isoformat(),
            **OCR_LIVENESS_LABEL,
        }
```

- [ ] **Step 4: Stamp the label — mobile selfie (face-match) branch**

In `upload_identity_mobile`, the `side == "selfie"` branch sets `user.identity_data = {**user.identity_data, ...}` (~L470-477). Add `**OCR_LIVENESS_LABEL,` as the last entry:

```python
        user.identity_data = {
            **user.identity_data,
            "selfie_url": selfie_storage["url"],
            "selfie_storage_key": selfie_storage.get("key"),
            "face_match_confidence": face_result["confidence"],
            "verified_at": naive_utcnow().isoformat(),
            "status": "verified",
            **OCR_LIVENESS_LABEL,
        }
```

- [ ] **Step 5: Stamp the label — authenticated upload-selfie branch**

In `upload_identity_selfie`, the success path sets `current_user.identity_data = {**current_user.identity_data, ...}` (~L626-633). Add `**OCR_LIVENESS_LABEL,` as the last entry:

```python
    current_user.identity_data = {
        **current_user.identity_data,
        "selfie_url": selfie_storage["url"],
        "selfie_storage_key": selfie_storage.get("key"),
        "face_match_confidence": face_result["confidence"],
        "verified_at": naive_utcnow().isoformat(),
        "status": "verified",
        **OCR_LIVENESS_LABEL,
    }
```

- [ ] **Step 6: Write the failing integration test (selfie_with_id end-to-end)**

Append to `backend/tests_integration/test_identity_assurance.py`:

```python
from tests_integration.conftest import make_user, auth


def _stub_identity_and_storage(monkeypatch):
    """Bypass Gemini OCR, R2 storage and watermarking for the upload path."""
    async def fake_selfie_with_id(**kwargs):
        return {
            "verified": True,
            "status": "verified",
            "data": {"full_name": "Tenant User", "document_type": "id_card"},
            "validation_checks": [],
            "rejection_reason": None,
        }

    async def fake_upload_file(**kwargs):
        return {"url": "https://r2.test/doc.jpg", "key": "doc.jpg"}

    import app.services.identity as identity_mod
    import app.routers.verification as verification_mod
    monkeypatch.setattr(identity_mod.identity_service, "verify_selfie_with_id", fake_selfie_with_id)
    monkeypatch.setattr(verification_mod.storage, "upload_file", fake_upload_file)
    monkeypatch.setattr(verification_mod, "apply_watermark", lambda b: b)


@pytest.mark.asyncio
async def test_AS1_selfie_with_id_is_labelled_medium(client, monkeypatch):
    """AS-1: an OCR+selfie verification stores identity_assurance=MEDIUM, source ocr_liveness."""
    _stub_identity_and_storage(monkeypatch)
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")

    r = await client.post(
        "/verification/identity/upload?document_type=id_card",
        headers=auth(tenant),
        data={"side": "selfie_with_id"},
        files={"file": ("id.jpg", b"\xff\xd8\xff fake-jpeg", "image/jpeg")},
    )
    assert r.status_code == 200, r.text

    async with sm() as s:
        from app.models.user import User as U
        refreshed = await s.get(U, tenant.id)
        assert refreshed.identity_verified is True
        assert refreshed.identity_data["identity_assurance"] == "MEDIUM"
        assert refreshed.identity_data["identity_source"] == "ocr_liveness"
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test pytest tests_integration/test_identity_assurance.py::test_AS1_selfie_with_id_is_labelled_medium -q`
Expected: PASS. (If the multipart form field name differs, confirm the endpoint signature: `side` is a `Form` field, `document_type` a query param.)

- [ ] **Step 8: Commit**

```bash
cd /Users/venkat/rental-platform-fr-identity-medium
git add backend/app/routers/verification.py backend/tests_integration/test_identity_assurance.py
git commit -m "fix(trust-layer): label OCR+selfie identity as MEDIUM (AS-1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4: Surface `identity_assurance` on the status endpoint

**Files:**
- Modify: `backend/app/routers/verification.py` (`VerificationStatusResponse` ~L66, `get_verification_status` ~L789)
- Test: `backend/tests_integration/test_identity_assurance.py` (append)

- [ ] **Step 1: Write the failing integration tests (inference-on-read)**

Append to `backend/tests_integration/test_identity_assurance.py`:

```python
@pytest.mark.asyncio
async def test_AS4_status_reports_unverified_when_not_verified(client):
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    r = await client.get("/verification/status", headers=auth(tenant))
    assert r.status_code == 200
    assert r.json()["identity_assurance"] == "UNVERIFIED"


@pytest.mark.asyncio
async def test_status_infers_medium_for_legacy_verified_user(client):
    """Back-compat: a user verified before labelling existed reads as MEDIUM."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        u.identity_verified = True
        u.identity_status = "verified"
        u.identity_data = {"verified": True, "status": "verified"}  # no label
        await s.commit()

    r = await client.get("/verification/status", headers=auth(tenant))
    assert r.status_code == 200
    assert r.json()["identity_assurance"] == "MEDIUM"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test pytest tests_integration/test_identity_assurance.py -k "AS4 or legacy" -q`
Expected: FAIL — response has no `identity_assurance` key (KeyError / assertion).

- [ ] **Step 3: Add the field to the response model**

In `VerificationStatusResponse` (~L66), add after `identity_verified: bool` (L69):

```python
    identity_assurance: str = "UNVERIFIED"
```

- [ ] **Step 4: Populate it in the status endpoint**

In `get_verification_status` (~L796), add to the returned dict, right after the `"identity_verified": current_user.identity_verified,` line:

```python
        "identity_assurance": derive_identity_assurance(
            current_user.identity_verified, current_user.identity_data
        ),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test pytest tests_integration/test_identity_assurance.py -q`
Expected: PASS (all tests in the file).

- [ ] **Step 6: Commit**

```bash
cd /Users/venkat/rental-platform-fr-identity-medium
git add backend/app/routers/verification.py backend/tests_integration/test_identity_assurance.py
git commit -m "feat(trust-layer): surface identity_assurance on /verification/status (AS-4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Part C — Avis 2D-Doc pipeline

### Task 5: Add pipeline dependencies

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/Dockerfile`

- [ ] **Step 1: Add the Python dependencies**

Append to `backend/requirements.txt`:

```
pylibdmtx>=0.1.10
PyMuPDF>=1.24.0
2ddoc-parser @ git+https://github.com/betagouv/2ddoc-parser.git
```

- [ ] **Step 2: Add the libdmtx system library to the Docker runner stage**

In `backend/Dockerfile`, find the runner stage `apt-get install` line (the one installing runtime libs) and add `libdmtx0b`. If there is no such line in the runner stage, add this block before the app is copied:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends libdmtx0b \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 3: Install locally and confirm the parser's import name + API**

Run:
```bash
cd backend && . .venv313/bin/activate && pip install -r requirements.txt
python -c "import pkgutil; print([m.name for m in pkgutil.iter_modules() if '2ddoc' in m.name.lower() or 'ddoc' in m.name.lower()])"
```
Expected: prints the installed top-level module name (e.g. `['two_d_doc']` or similar). **Record the exact import name** — Task 6 Step 3 needs it. Then introspect the parse entry point and the `AvisImposition` (Type 28) fields:
```bash
python -c "import <module>; help(<module>)"
```
Confirm: the function/class that parses a raw 2D-Doc string and verifies the ANTS signature, and the attribute names for the declarant(s) (the spec references `declarant1`, optional `declarant2`) and the document type id (`28`).

- [ ] **Step 4: Smoke-test the heavy imports**

Run:
```bash
cd backend && python -c "import fitz; import pylibdmtx.pylibdmtx as d; print('pymupdf', fitz.__doc__ is not None, 'dmtx ok')"
```
Expected: prints without ImportError. (`fitz` is PyMuPDF's import name.)

- [ ] **Step 5: Commit**

```bash
cd /Users/venkat/rental-platform-fr-identity-medium
git add backend/requirements.txt backend/Dockerfile
git commit -m "build(trust-layer): add avis 2D-Doc deps (2ddoc-parser, pylibdmtx, PyMuPDF, libdmtx)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 6: The `fr_2ddoc` service

**Files:**
- Create: `backend/app/services/fr_2ddoc.py`
- Test: `backend/tests_integration/test_fr_2ddoc.py`

- [ ] **Step 1: Write the failing unit tests for `name_matches_any`**

Create `backend/tests_integration/test_fr_2ddoc.py`:

```python
"""
Avis d'imposition 2D-Doc pipeline — unit + integration (DOSSIER §5.3 SV-1, §5.1 C-1..C-8).
"""
import pytest
from app.services import fr_2ddoc


# ── name matching ───────────────────────────────────────────────────────────

def test_name_match_exact():
    assert fr_2ddoc.name_matches_any("Jean Dupont", ["Jean Dupont"]) is True


def test_name_match_reordered_and_case():
    assert fr_2ddoc.name_matches_any("Jean Dupont", ["DUPONT JEAN"]) is True


def test_name_match_accents_stripped():
    assert fr_2ddoc.name_matches_any("Helene Cesar", ["Hélène César"]) is True


def test_name_match_against_declarant2():
    # ID holder is the spouse (second declarant on a couple's avis).
    assert fr_2ddoc.name_matches_any("Marie Martin", ["Jean Dupont", "Marie Martin"]) is True


def test_name_mismatch():
    assert fr_2ddoc.name_matches_any("Jean Dupont", ["Paul Durand"]) is False


def test_name_match_empty_inputs():
    assert fr_2ddoc.name_matches_any("", ["Jean Dupont"]) is False
    assert fr_2ddoc.name_matches_any("Jean Dupont", []) is False
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && pytest tests_integration/test_fr_2ddoc.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.fr_2ddoc'`.

- [ ] **Step 3: Write the service**

Create `backend/app/services/fr_2ddoc.py`. Replace `REPLACE_WITH_IMPORT_NAME` and the parse call with the exact API confirmed in Task 5 Step 3:

```python
"""
Avis d'imposition 2D-Doc pipeline: decode -> parse -> ANTS ECDSA verify -> names.

Corroborates the OCR'd identity name against the DGFiP-signed payload
(sub-feature #3 — assurance stays MEDIUM; the avis has no presenter binding).
Sub-feature #4 will reuse parse_and_verify_avis() for the banded solvency ratio.

No source document is stored. Verification is fully offline against the ANTS
Trusted Service List bundled in betagouv/2ddoc-parser.
See docs/superpowers/specs/2026-06-06-fr-identity-medium-rail-design.md §5.
"""
import io
import logging
import unicodedata
from dataclasses import dataclass

logger = logging.getLogger(__name__)

AVIS_TYPE_ID = "28"          # 2D-Doc document type for the current avis d'imposition
_MATCH_THRESHOLD = 0.5       # Jaccard over normalized name tokens


# ── errors ──────────────────────────────────────────────────────────────────

class TwoDDocError(Exception):
    """Base error for the avis 2D-Doc pipeline."""


class BarcodeUnreadable(TwoDDocError):
    """No DataMatrix barcode could be decoded from the upload."""


class SignatureInvalid(TwoDDocError):
    """The 2D-Doc ANTS ECDSA signature failed verification (forgery or too-new cert)."""


class WrongDocumentType(TwoDDocError):
    """The 2D-Doc is valid but not an avis d'imposition (type 28)."""


@dataclass
class AvisIdentity:
    declarant_names: list[str]   # declarant1 (+ declarant2 if a couple)


# ── name matching ─────────────────────────────────────────────────────────────

def _normalize(name: str) -> set[str]:
    norm = "".join(
        c for c in unicodedata.normalize("NFD", (name or "").lower())
        if unicodedata.category(c) != "Mn"
    )
    return {t for t in norm.replace("-", " ").split() if t}


def name_matches_any(id_name: str, candidate_names: list[str], threshold: float = _MATCH_THRESHOLD) -> bool:
    """True if id_name token-overlaps any candidate at/above the threshold (accent/order tolerant)."""
    a = _normalize(id_name)
    if not a:
        return False
    for cand in candidate_names:
        b = _normalize(cand)
        if not b:
            continue
        if len(a & b) / len(a | b) >= threshold:
            return True
    return False


# ── decode ────────────────────────────────────────────────────────────────────

def _to_images(file_content: bytes, content_type: str) -> list:
    """Return a list of PIL images for the upload (rasterize PDF pages, else one image)."""
    from PIL import Image
    if content_type == "application/pdf":
        import fitz  # PyMuPDF
        images = []
        with fitz.open(stream=file_content, filetype="pdf") as pdf:
            for page in pdf:
                pix = page.get_pixmap(dpi=300)
                images.append(Image.open(io.BytesIO(pix.tobytes("png"))))
        return images
    return [Image.open(io.BytesIO(file_content))]


def decode_2ddoc(file_content: bytes, content_type: str) -> str:
    """Decode the first DataMatrix 2D-Doc barcode found in the upload to its raw string."""
    from pylibdmtx.pylibdmtx import decode as dmtx_decode
    for img in _to_images(file_content, content_type):
        results = dmtx_decode(img)
        if results:
            return results[0].data.decode("ascii", errors="replace")
    raise BarcodeUnreadable("No 2D-Doc DataMatrix barcode found in the document")


# ── parse + verify ─────────────────────────────────────────────────────────────

def parse_and_verify_avis(raw: str) -> AvisIdentity:
    """
    Parse a raw 2D-Doc string, verify the ANTS signature, require avis (type 28),
    and return the declarant name(s) from the SIGNED payload.

    NOTE: adapt the import + parse call to the exact betagouv/2ddoc-parser API
    confirmed in Task 5 Step 3. The parser verifies the ECDSA signature internally
    and raises on failure; we translate that into SignatureInvalid.
    """
    import REPLACE_WITH_IMPORT_NAME as twoddoc  # noqa: confirmed in Task 5

    try:
        doc = twoddoc.parse(raw)   # verifies signature against bundled ANTS TSL
    except Exception as exc:        # forged sig, unknown/too-new cert, malformed payload
        logger.info("2D-Doc signature/parse rejected: %s", exc)
        raise SignatureInvalid(str(exc)) from exc

    type_id = str(getattr(doc, "type_id", getattr(doc, "document_type_id", "")))
    if type_id != AVIS_TYPE_ID:
        raise WrongDocumentType(f"2D-Doc type {type_id!r} is not an avis d'imposition")

    names = []
    d1 = getattr(doc, "declarant1", None)
    if d1:
        names.append(d1)
    d2 = getattr(doc, "declarant2", None)
    if d2:
        names.append(d2)
    if not names:
        raise WrongDocumentType("avis 2D-Doc contained no declarant name")
    return AvisIdentity(declarant_names=names)
```

- [ ] **Step 4: Run the name-matching tests to verify they pass**

Run: `cd backend && pytest tests_integration/test_fr_2ddoc.py -k name -q`
Expected: PASS (6 passed). The decode/parse functions are import-lazy, so these run without the heavy libs.

- [ ] **Step 5: Write the failing error-mapping unit tests (decode/parse, mocked)**

Append to `backend/tests_integration/test_fr_2ddoc.py`:

```python
# ── decode/parse error mapping (libs mocked) ────────────────────────────────

def test_decode_raises_barcode_unreadable_when_no_barcode(monkeypatch):
    monkeypatch.setattr(fr_2ddoc, "_to_images", lambda c, t: ["img"])
    import pylibdmtx.pylibdmtx as dmtx
    monkeypatch.setattr(dmtx, "decode", lambda img: [])
    with pytest.raises(fr_2ddoc.BarcodeUnreadable):
        fr_2ddoc.decode_2ddoc(b"x", "image/png")
```

(If `import pylibdmtx` is unavailable in the local env at this step, install it via Task 5 Step 4 first.)

- [ ] **Step 6: Run the error-mapping test to verify it passes**

Run: `cd backend && pytest tests_integration/test_fr_2ddoc.py::test_decode_raises_barcode_unreadable_when_no_barcode -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/venkat/rental-platform-fr-identity-medium
git add backend/app/services/fr_2ddoc.py backend/tests_integration/test_fr_2ddoc.py
git commit -m "feat(trust-layer): fr_2ddoc avis pipeline (decode/verify + name match)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 7: The avis cross-check endpoint

**Files:**
- Modify: `backend/app/routers/verification.py` (new endpoint after `upload_identity_selfie`, ~L643)
- Test: `backend/tests_integration/test_fr_2ddoc.py` (append)

- [ ] **Step 1: Write the failing integration tests**

Append to `backend/tests_integration/test_fr_2ddoc.py`:

```python
# ── endpoint integration ────────────────────────────────────────────────────

from tests_integration.conftest import make_user, auth


async def _make_verified_tenant(sm, full_name="Jean Dupont"):
    tenant = await make_user(sm, role="tenant")
    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        u.identity_verified = True
        u.identity_status = "verified"
        u.identity_data = {
            "status": "verified",
            "identity_assurance": "MEDIUM",
            "identity_source": "ocr_liveness",
            "extracted_data": {"full_name": full_name},
        }
        await s.commit()
    return tenant


def _patch_pipeline(monkeypatch, *, names=None, error=None):
    import app.services.fr_2ddoc as svc
    monkeypatch.setattr(svc, "decode_2ddoc", lambda content, ct: "RAW2DDOC")
    if error is not None:
        def _raise(raw):
            raise error
        monkeypatch.setattr(svc, "parse_and_verify_avis", _raise)
    else:
        monkeypatch.setattr(svc, "parse_and_verify_avis",
                            lambda raw: svc.AvisIdentity(declarant_names=names or []))


PDF = ("avis.pdf", b"%PDF-1.4 fake", "application/pdf")


@pytest.mark.asyncio
async def test_avis_requires_verified_identity(client):
    """C-6: avis before identity exists -> 400."""
    sm = client._sessionmaker
    tenant = await make_user(sm, role="tenant")
    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_avis_name_match_sets_flag(client, monkeypatch):
    """SV-1 / C-1: signed declarant name matches ID name -> corroborated + flag stored."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm, full_name="Jean Dupont")
    _patch_pipeline(monkeypatch, names=["DUPONT JEAN"])

    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 200, r.text
    assert r.json()["corroborated"] is True

    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        assert u.identity_data["identity_name_corroborated_by"] == "avis_2ddoc"
        # assurance stays MEDIUM — never upgraded
        assert u.identity_data["identity_assurance"] == "MEDIUM"


@pytest.mark.asyncio
async def test_avis_name_mismatch_no_flag(client, monkeypatch):
    """C-5: declarant name differs -> not corroborated, no flag."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm, full_name="Jean Dupont")
    _patch_pipeline(monkeypatch, names=["Paul Durand"])

    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 200
    assert r.json()["corroborated"] is False
    async with sm() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        assert "identity_name_corroborated_by" not in u.identity_data


@pytest.mark.asyncio
async def test_avis_signature_invalid_returns_not_corroborated(client, monkeypatch):
    """C-3 / C-8: bad ECDSA (forgery or too-new cert) -> 200 not corroborated, no crash."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    _patch_pipeline(monkeypatch, error=fr_2ddoc.SignatureInvalid("bad sig"))

    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 200
    assert r.json()["corroborated"] is False
    assert r.json()["reason"] == "signature_invalid"


@pytest.mark.asyncio
async def test_avis_barcode_unreadable_returns_422(client, monkeypatch):
    """C-2: unreadable barcode -> 422 rescan (never OCR-fallback)."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    import app.services.fr_2ddoc as svc
    def _raise(content, ct):
        raise svc.BarcodeUnreadable("nope")
    monkeypatch.setattr(svc, "decode_2ddoc", _raise)

    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_avis_wrong_type_returns_422(client, monkeypatch):
    """C-4: valid 2D-Doc but not an avis -> 422 reject."""
    sm = client._sessionmaker
    tenant = await _make_verified_tenant(sm)
    _patch_pipeline(monkeypatch, error=fr_2ddoc.WrongDocumentType("type 00"))

    r = await client.post("/verification/identity/avis-cross-check",
                          headers=auth(tenant), files={"file": PDF})
    assert r.status_code == 422
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test pytest tests_integration/test_fr_2ddoc.py -k avis -q`
Expected: FAIL — endpoint returns 404 (route does not exist yet).

- [ ] **Step 3: Implement the endpoint**

In `backend/app/routers/verification.py`, after `upload_identity_selfie` ends (~L643, before the `_check_upload_rate_limit` helper), add:

```python
@router.post("/identity/avis-cross-check")
async def avis_cross_check(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Corroborate the OCR'd identity name against the DGFiP-signed avis d'imposition
    2D-Doc. Assurance stays MEDIUM (the avis has no presenter binding) — a match only
    sets an anti-fraud flag. The avis is processed transiently and never stored.
    """
    if not current_user.identity_verified:
        raise HTTPException(status_code=400, detail="Verify your identity before cross-checking an avis.")
    id_name = (current_user.identity_data or {}).get("extracted_data", {}).get("full_name")
    if not id_name or id_name == "Unknown":
        raise HTTPException(status_code=400, detail="No identity name on file to corroborate.")

    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/heic", "image/heif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}.")

    await _check_upload_rate_limit(str(current_user.id), "avis")
    content = await file.read()  # processed transiently, never stored

    from app.services import fr_2ddoc
    try:
        raw = fr_2ddoc.decode_2ddoc(content, file.content_type)
        avis = fr_2ddoc.parse_and_verify_avis(raw)
    except fr_2ddoc.BarcodeUnreadable:
        raise HTTPException(status_code=422, detail="Could not read the 2D-Doc barcode — please rescan the avis.")
    except fr_2ddoc.WrongDocumentType:
        raise HTTPException(status_code=422, detail="This document is not an avis d'imposition (2D-Doc type 28).")
    except fr_2ddoc.SignatureInvalid:
        return {"corroborated": False, "reason": "signature_invalid"}

    matched = fr_2ddoc.name_matches_any(id_name, avis.declarant_names)
    if matched:
        current_user.identity_data = {
            **(current_user.identity_data or {}),
            "identity_name_corroborated_by": "avis_2ddoc",
        }
        await db.commit()
        await db.refresh(current_user)
    return {"corroborated": matched, "reason": "name_match" if matched else "name_mismatch"}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test pytest tests_integration/test_fr_2ddoc.py -q`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
cd /Users/venkat/rental-platform-fr-identity-medium
git add backend/app/routers/verification.py backend/tests_integration/test_fr_2ddoc.py
git commit -m "feat(trust-layer): avis 2D-Doc name cross-check endpoint (still MEDIUM)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Part D — Documentation reconciliation

### Task 8: Reconcile DOSSIER + CLAUDE.md to the real FR identity posture

**Files:**
- Modify: `docs/features/trust-layer/DOSSIER.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Correct the DOSSIER sub-feature #3 description**

In `docs/features/trust-layer/DOSSIER.md`, replace the §9 item 3 block (the "FR HIGH identity rail … `idp.france-identite.gouv.fr/valider-attest`" paragraph, ~L366-368) with:

```markdown
3. **FR identity — MEDIUM rail now, HIGH deferred** (§5.1, §5.2) — `valider-attest` is a
   human web portal, not an API, and the *justificatif* route (new-CNI + NFC + app) was
   rejected for friction. No zero-OPEX method binds a document to its presenter today, so
   there is no honest FR HIGH identity rail yet. This sub-feature labels OCR+selfie as
   **MEDIUM** (AS-1 fix), adds a **state-signed name cross-check** from the *avis* 2D-Doc
   (still MEDIUM — no presenter binding), and records **FranceConnect** as the deferred
   HIGH path, gated behind incorporation (SIRET + DataPass + 4 governance roles, décret
   du 8 nov. 2018). Serves both tenant and landlord.
```

- [ ] **Step 2: Annotate the §5.1 table rows that assumed the justificatif API**

In `docs/features/trust-layer/DOSSIER.md` §5.1, add a note line directly under the §5.1 table (after ~L227):

```markdown
> **Update 2026-06-06:** ID-1/ID-2/ID-3 assumed a `valider-attest` API that does not exist
> (human portal only). FR HIGH identity is deferred to FranceConnect (post-incorporation).
> The shipped FR rail is MEDIUM (OCR+selfie) + *avis* 2D-Doc name corroboration. See
> `docs/superpowers/specs/2026-06-06-fr-identity-medium-rail-design.md`.
```

- [ ] **Step 3: Correct CLAUDE.md's FR rail + Phase-1 identity claims**

In `CLAUDE.md`, in the "Two rails" section, replace the FR-rail HIGH-identity clause so it no longer asserts a verifiable API at `valider-attest`. Change the FR rail line to:

```markdown
**FR rail:** identity today is OCR+liveness → **MEDIUM** (France Identité *justificatif*
was rejected for friction; `valider-attest` is a portal, not an API). HIGH identity is
deferred to **FranceConnect** (OIDC), gated behind incorporation. Solvency: avis d'imposition
2D-Doc (DGFiP-signed, parse via betagouv/2ddoc-parser) → HIGH, verified offline.
```

And in the "Phase 1 scope" list, change tenant step 1 and landlord step 3 from "France Identité justificatif → verify signature → … (HIGH)" to "identity via OCR+selfie → **MEDIUM**, with avis 2D-Doc name corroboration; HIGH deferred to FranceConnect."

- [ ] **Step 4: Verify no stale "valider-attest API" claims remain**

Run:
```bash
cd /Users/venkat/rental-platform-fr-identity-medium
grep -rn "valider-attest" docs/features/trust-layer/DOSSIER.md CLAUDE.md
```
Expected: every remaining hit is in a context that describes it as a portal / rejected route, not as a callable API.

- [ ] **Step 5: Commit**

```bash
cd /Users/venkat/rental-platform-fr-identity-medium
git add docs/features/trust-layer/DOSSIER.md CLAUDE.md
git commit -m "docs(trust-layer): reconcile FR identity to MEDIUM-now / FranceConnect-deferred

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Run the full suite on Python 3.13**

Run: `cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test pytest -q`
Expected: green (or only pre-existing known failures unrelated to this work).

- [ ] **Confirm the credential layer still rejects inflation**

Run: `cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test pytest tests_integration/test_credential_core.py -q`
Expected: green — `ocr_liveness` → HIGH still raises 422 (AS-3), proving the MEDIUM source can never be presented as HIGH end-to-end.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §3 Python 3.13 upgrade → Task 1 (incl. asyncpg/psycopg2 bumps, passlib/crypt verification, Docker, full-suite gate). ✅
- §4 MEDIUM retrofit (all three OCR+selfie branches + inference-on-read) → Tasks 2-4. ✅
- §5 avis pipeline (decode→parse→ECDSA verify→name match, new endpoint, deps incl. libdmtx) → Tasks 5-7. ✅
- §5.1 edge cases C-1..C-8 → Task 7 tests (C-1/SV-1 match, C-2 422, C-3 not-corroborated, C-4 422, C-5 mismatch, C-6 400, C-7 transient/no-store asserted by never storing content, C-8 same path as C-3). ✅
- §6 FranceConnect deferred + doc reconciliation → Task 8. ✅
- §7 test matrix (AS-1, AS-3, AS-4, ID-4 via inference, SV-1, back-compat) → Tasks 2-4, 7 + final verification. ✅

**Placeholder scan:** one intentional `REPLACE_WITH_IMPORT_NAME` in Task 6 Step 3, gated by Task 5 Step 3 which discovers the exact installed import name — flagged explicitly, not a silent TODO.

**Type consistency:** `OCR_LIVENESS_LABEL`, `derive_identity_assurance(identity_verified, identity_data)`, `fr_2ddoc.decode_2ddoc`, `parse_and_verify_avis`, `name_matches_any`, `AvisIdentity.declarant_names`, and errors `BarcodeUnreadable/SignatureInvalid/WrongDocumentType` are used identically across service, endpoint, and tests.
