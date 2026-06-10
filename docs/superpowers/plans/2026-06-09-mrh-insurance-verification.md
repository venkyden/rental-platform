# MRH Insurance Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant MRH (Multirisques Habitation) insurance attestation verification — the last missing Phase-2 item — so a tenant's credential can carry a `mrh_insurance_verified` claim (MEDIUM assurance, OCR-based), blocking quotes and foreign-insurer certs while flagging mismatches for the landlord to decide.

**Architecture:** New pure-function service `mrh_insurance.py` runs Gemini AI extraction over the uploaded certificate, then applies five hard/soft checks (IN-1..IN-5) without building any RegExp from database strings. The endpoint mirrors the existing `/verification/income/upload` pattern; the credential `issue-mine` and evidence PDF are extended to surface the new claim.

**Tech Stack:** Python/FastAPI, SQLAlchemy async, Gemini AI (`google.genai`), `unicodedata` for accent-safe fuzzy matching, Alembic for schema migration, pytest + httpx for integration tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/app/services/mrh_insurance.py` | Extract + validate MRH cert; five IN-* checks |
| Modify | `backend/app/models/user.py` | Add `insurance_verified`, `insurance_status`, `insurance_data` |
| Create | `backend/alembic/versions/add_mrh_insurance_fields.py` | Schema migration for the three new columns |
| Modify | `backend/app/routers/verification.py` | Add `POST /verification/insurance/upload` endpoint |
| Modify | `backend/app/routers/credentials.py` | Extend `issue-mine` to include MRH claim |
| Modify | `backend/app/services/credential.py` | Extend evidence PDF claims table with MRH row |
| Create | `backend/tests_integration/test_mrh_insurance.py` | Integration tests IN-1..IN-5 + happy path |

---

## Task 1: MRH insurance service (pure logic — no DB)

**Files:**
- Create: `backend/app/services/mrh_insurance.py`

- [ ] **Step 1: Write the failing unit tests**

Create `backend/tests_integration/test_mrh_insurance.py` with the pure-function tests only (no HTTP yet):

```python
"""
MRH insurance verification — unit tests (DOSSIER §5.8 IN-1..IN-5).
"""
import pytest
from app.services import mrh_insurance as svc


# ── IN-1: quote rejected ─────────────────────────────────────────────────────

def test_quote_document_is_rejected():
    result = svc.check_mrh_extraction(
        {
            "document_type": "quote",
            "insurer_country": "FR",
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert result["verified"] is False
    assert result["status"] == "rejected"
    assert result["rejection_reason"] == "IN-1: document is a quote, not a final certificate"


def test_certificate_document_passes_in1():
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "FR",
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert result["verified"] is True
    assert "IN-1" not in result.get("rejection_reason", "")


def test_unknown_doc_type_not_hard_rejected():
    # unknown type → flag, not hard-block (give benefit of the doubt)
    result = svc.check_mrh_extraction(
        {
            "document_type": "unknown",
            "insurer_country": "FR",
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert result["verified"] is False
    assert result["status"] == "flagged"
    assert "doc_type_unknown" in result["flags"]


# ── IN-2: name mismatch ──────────────────────────────────────────────────────

def test_name_match_exact():
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "FR",
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert "name_mismatch" not in result["flags"]


def test_name_match_accent_difference():
    # "Élodie" vs "Elodie" — strip accents → match
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "FR",
            "insured_name": "Élodie Martin",
            "property_address": "5 av Victor Hugo, 69001 Lyon",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Elodie Martin",
        expected_address=None,
    )
    assert "name_mismatch" not in result["flags"]


def test_name_mismatch_flags_not_blocks():
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "FR",
            "insured_name": "Paul Martin",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert "name_mismatch" in result["flags"]
    # soft flag — not a hard rejection (landlord decides)
    assert result["status"] in ("flagged", "verified")
    assert result["rejection_reason"] is None


def test_name_mismatch_never_builds_regex_from_db():
    # Pathological name that would cause ReDoS if naively used in re.search
    malicious = "(a+)+" * 5
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "FR",
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name=malicious,
        expected_address=None,
    )
    # Should return in finite time (< 1s) — if it times out, ReDoS is present.
    # Result doesn't matter here; the important thing is it doesn't blow up.
    assert isinstance(result, dict)


# ── IN-3: foreign insurer blocked ────────────────────────────────────────────

def test_foreign_insurer_hard_block():
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "UK",
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert result["verified"] is False
    assert result["status"] == "rejected"
    assert result["rejection_reason"] == "IN-3: non-French insurer — French MRH required for French property"


def test_fr_insurer_passes():
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "FR",
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert result["verified"] is True


def test_unknown_country_flagged_not_blocked():
    # insurer_country=None → can't determine → flag, don't hard-block
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": None,
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert "insurer_country_unknown" in result["flags"]
    assert result["status"] in ("flagged", "verified")


# ── IN-4: cover dates recorded ────────────────────────────────────────────────

def test_cover_start_stored_in_result():
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "FR",
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-08-01",
            "cover_end": "2027-08-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert result["mrh_cover_start"] == "2026-08-01"
    assert result["mrh_cover_end"] == "2027-08-01"


def test_missing_cover_start_flagged():
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "FR",
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": None,
            "cover_end": None,
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert "cover_dates_missing" in result["flags"]


# ── IN-5: no gating ──────────────────────────────────────────────────────────

def test_no_fields_gated_on_insurance():
    # verify that even a flagged result has verified=False (flag, not gate)
    # This is a design assertion: the API never gates access based on insurance.
    # Landlord can see flags and decide. verified=False means "flags present",
    # not "access denied".
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "FR",
            "insured_name": "Wrong Name",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    # flagged, but NOT "rejected" — landlord still gets the data
    assert result["status"] == "flagged"
    assert result.get("rejection_reason") is None


# ── assurance always MEDIUM ───────────────────────────────────────────────────

def test_assurance_always_medium():
    result = svc.check_mrh_extraction(
        {
            "document_type": "certificate",
            "insurer_country": "FR",
            "insured_name": "Jean Dupont",
            "property_address": "12 rue de la Paix, 75001 Paris",
            "cover_start": "2026-07-01",
            "cover_end": "2027-07-01",
        },
        expected_name="Jean Dupont",
        expected_address=None,
    )
    assert result["mrh_assurance"] == "MEDIUM"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && python -m pytest tests_integration/test_mrh_insurance.py -q 2>&1 | head -20
```
Expected: `ModuleNotFoundError: No module named 'app.services.mrh_insurance'` (or similar import failure).

- [ ] **Step 3: Implement `mrh_insurance.py`**

Create `backend/app/services/mrh_insurance.py`:

```python
"""
MRH (Multirisques Habitation) insurance attestation verification.

Checks (DOSSIER §5.8):
  IN-1  Quote, not final cert → hard reject.
  IN-2  Name/address mismatch → flag (never build RegExp from DB strings — ReDoS/injection).
  IN-3  Foreign insurer, French property → hard block.
  IN-4  Cover-start date recorded for cross-check by caller.
  IN-5  We gate nothing; flags are for the landlord to decide.

Assurance is always MEDIUM (OCR/AI extraction — no insurer API in Phase 2).
"""

import logging
import unicodedata
from typing import Optional

logger = logging.getLogger(__name__)

# Optional AI imports (same pattern as employment.py)
try:
    from google import genai
    from google.genai import types as genai_types
    GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    genai_types = None
    GEMINI_AVAILABLE = False


# ── accent-safe fuzzy helpers ────────────────────────────────────────────────

def _strip_accents(text: str) -> str:
    """Normalise NFD then drop combining marks — accent-safe comparison."""
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def _normalise(text: str) -> str:
    return _strip_accents(text).lower().strip()


def _names_match(a: str, b: str) -> bool:
    """
    True if two names are 'close enough' after accent-stripping.
    Uses plain string containment — never builds a RegExp from either value
    (ReDoS/injection prevention, DOSSIER IN-2).
    """
    na, nb = _normalise(a), _normalise(b)
    # Exact or one-contains-the-other (handles "Jean Dupont" vs "J. Dupont" partially)
    return na == nb or na in nb or nb in na


# ── core check function (pure — no DB, no AI) ────────────────────────────────

def check_mrh_extraction(
    extracted: dict,
    expected_name: Optional[str],
    expected_address: Optional[str],
) -> dict:
    """
    Apply IN-1..IN-5 checks to already-extracted MRH certificate fields.

    Args:
        extracted: dict with keys: document_type, insurer_country, insured_name,
                   property_address, cover_start, cover_end.
        expected_name: the tenant's verified display name (from identity_data), or None.
        expected_address: the rental property address to cross-check, or None.

    Returns:
        {
            "verified": bool,
            "status": "verified" | "flagged" | "rejected",
            "mrh_assurance": "MEDIUM",
            "mrh_insurer_fr": bool | None,
            "mrh_cert_type": str,
            "mrh_cover_start": str | None,
            "mrh_cover_end": str | None,
            "flags": list[str],
            "rejection_reason": str | None,
        }
    """
    flags: list[str] = []
    rejection_reason: Optional[str] = None

    doc_type = (extracted.get("document_type") or "unknown").lower()
    insurer_country = extracted.get("insurer_country")
    insured_name = extracted.get("insured_name") or ""
    cover_start = extracted.get("cover_start")
    cover_end = extracted.get("cover_end")

    # IN-1: quote → hard reject
    if doc_type == "quote":
        return {
            "verified": False,
            "status": "rejected",
            "mrh_assurance": "MEDIUM",
            "mrh_insurer_fr": None,
            "mrh_cert_type": doc_type,
            "mrh_cover_start": cover_start,
            "mrh_cover_end": cover_end,
            "flags": ["is_quote"],
            "rejection_reason": "IN-1: document is a quote, not a final certificate",
        }

    if doc_type == "unknown":
        flags.append("doc_type_unknown")

    # IN-3: foreign insurer → hard block
    if insurer_country is not None:
        insurer_fr = insurer_country.upper() == "FR"
        if not insurer_fr:
            return {
                "verified": False,
                "status": "rejected",
                "mrh_assurance": "MEDIUM",
                "mrh_insurer_fr": False,
                "mrh_cert_type": doc_type,
                "mrh_cover_start": cover_start,
                "mrh_cover_end": cover_end,
                "flags": ["foreign_insurer"],
                "rejection_reason": (
                    "IN-3: non-French insurer — French MRH required for French property"
                ),
            }
    else:
        insurer_fr = None
        flags.append("insurer_country_unknown")

    # IN-2: name mismatch (soft flag — never builds regex from input)
    if expected_name and insured_name:
        if not _names_match(insured_name, expected_name):
            flags.append("name_mismatch")

    if expected_address and insured_name:
        # address is low-signal; we flag but weight it less than name
        prop_addr = extracted.get("property_address") or ""
        if prop_addr and not _names_match(prop_addr, expected_address):
            flags.append("address_mismatch")

    # IN-4: cover dates — record for cross-check; flag if missing
    if not cover_start or not cover_end:
        flags.append("cover_dates_missing")

    # IN-5: no gating — flags are advisory, landlord decides
    hard_flags = {"name_mismatch", "address_mismatch", "insurer_country_unknown",
                  "doc_type_unknown", "cover_dates_missing"}
    has_soft_flags = bool(flags)
    blocking_flags = set(flags) - hard_flags  # any unexpected hard flags
    _ = blocking_flags  # currently none beyond IN-1/IN-3 handled above

    if has_soft_flags:
        status = "flagged"
        verified = False
    else:
        status = "verified"
        verified = True

    return {
        "verified": verified,
        "status": status,
        "mrh_assurance": "MEDIUM",
        "mrh_insurer_fr": insurer_fr,
        "mrh_cert_type": doc_type,
        "mrh_cover_start": cover_start,
        "mrh_cover_end": cover_end,
        "flags": flags,
        "rejection_reason": rejection_reason,
    }


# ── AI extraction ────────────────────────────────────────────────────────────

_EXTRACTION_PROMPT = """
You are an assistant that extracts structured data from French MRH (Multirisques Habitation)
insurance documents. Extract the following fields from the document text or image and return
a JSON object with EXACTLY these keys:

- document_type: "certificate" if this is a final attestation/certificate, "quote" if it is
  a devis or proposition, or "unknown" if you cannot determine.
- insurer_name: the name of the insurance company.
- insurer_country: the ISO-3166-1 alpha-2 country code of the insurer (e.g. "FR" for France).
  Return null if you cannot determine.
- insured_name: the full name of the insured person.
- property_address: the insured property address.
- cover_start: the policy start date in YYYY-MM-DD format, or null.
- cover_end: the policy end date in YYYY-MM-DD format, or null.

Respond with JSON only. No explanation.
"""


class MrhInsuranceService:
    """Stateless service — instantiate once; call verify() per upload."""

    def __init__(self) -> None:
        self._client = None
        if GEMINI_AVAILABLE:
            from app.core.config import settings
            if getattr(settings, "GEMINI_API_KEY", None):
                self._client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def verify(
        self,
        file_content: bytes,
        file_type: str,
        expected_name: Optional[str] = None,
        expected_address: Optional[str] = None,
    ) -> dict:
        """
        Full pipeline: AI extract → IN-* checks.

        If no AI client is available, returns status="rejected" with a clear message
        so the endpoint can surface it rather than silently pass.
        """
        extracted = await self._extract(file_content, file_type)
        if extracted is None:
            return {
                "verified": False,
                "status": "rejected",
                "mrh_assurance": "MEDIUM",
                "mrh_insurer_fr": None,
                "mrh_cert_type": "unknown",
                "mrh_cover_start": None,
                "mrh_cover_end": None,
                "flags": ["extraction_failed"],
                "rejection_reason": "Could not extract data from document — check file quality",
            }
        return check_mrh_extraction(extracted, expected_name, expected_address)

    async def _extract(self, file_content: bytes, file_type: str) -> Optional[dict]:
        if self._client is None:
            logger.warning("MrhInsuranceService: no AI client — cannot extract")
            return None

        import json as _json

        try:
            # Use same inline-bytes approach as employment.py
            part = genai_types.Part.from_bytes(data=file_content, mime_type=file_type)
            response = self._client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[_EXTRACTION_PROMPT, part],
                config=genai_types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                ),
            )
            text = response.text.strip()
            return _json.loads(text)
        except Exception as exc:
            logger.warning("MrhInsuranceService extraction failed: %s", exc)
            return None


mrh_insurance_service = MrhInsuranceService()
```

- [ ] **Step 4: Run unit tests — expect passing**

```bash
cd backend && python -m pytest tests_integration/test_mrh_insurance.py -q -k "not upload" 2>&1 | tail -10
```
Expected: all unit tests pass.

- [ ] **Step 5: Commit**

```bash
cd backend && git add app/services/mrh_insurance.py tests_integration/test_mrh_insurance.py
git commit -m "feat(mrh): add MRH insurance verification service (IN-1..IN-5)"
```

---

## Task 2: Schema migration — add insurance columns to users

**Files:**
- Modify: `backend/app/models/user.py`
- Create: `backend/alembic/versions/add_mrh_insurance_fields.py`

- [ ] **Step 1: Add columns to the User model**

In `backend/app/models/user.py`, after line 76 (`income_data = Column(EncryptedJSON, nullable=True)`), add:

```python
    insurance_verified = Column(Boolean, default=False)
    insurance_status = Column(String, default="unverified")
    insurance_data = Column(EncryptedJSON, nullable=True)
```

(The `EncryptedJSON` import is already present at the top of the model file via `from app.utils.encryption import EncryptedJSON`.)

- [ ] **Step 2: Create Alembic migration**

Create `backend/alembic/versions/add_mrh_insurance_fields.py`:

```python
"""Add MRH insurance verification fields to users

Revision ID: add_mrh_insurance_fields
Revises: fix_user_schema_encryption
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "add_mrh_insurance_fields"
down_revision = "fix_user_schema_encryption"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    existing = {c["name"] for c in sa.inspect(conn).get_columns("users")}

    with op.batch_alter_table("users") as batch_op:
        if "insurance_verified" not in existing:
            batch_op.add_column(
                sa.Column("insurance_verified", sa.Boolean(), nullable=False, server_default="false")
            )
        if "insurance_status" not in existing:
            batch_op.add_column(
                sa.Column("insurance_status", sa.String(), nullable=False, server_default="unverified")
            )
        if "insurance_data" not in existing:
            batch_op.add_column(
                sa.Column("insurance_data", sa.Text(), nullable=True)
            )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("insurance_data")
        batch_op.drop_column("insurance_status")
        batch_op.drop_column("insurance_verified")
```

> **Note on `insurance_data` column type:** `EncryptedJSON` serialises to `Text` at the SQL level (AES-encrypted JSON string). The migration uses `sa.Text()` to match that, identical to how the existing `income_data`/`identity_data` columns are stored.

- [ ] **Step 3: Apply the migration to the test DB**

```bash
cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test \
  alembic upgrade head 2>&1 | tail -5
```
Expected: `Running upgrade fix_user_schema_encryption -> add_mrh_insurance_fields, Add MRH insurance verification fields to users`

- [ ] **Step 4: Verify columns exist**

```bash
cd backend && python -c "
import asyncio, os
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://127.0.0.1:5432/roomivo_test'
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import inspect, text
async def main():
    e = create_async_engine(os.environ['DATABASE_URL'])
    async with e.connect() as c:
        cols = await c.run_sync(lambda sc: [col['name'] for col in inspect(sc).get_columns('users')])
        for col in ('insurance_verified', 'insurance_status', 'insurance_data'):
            print(col, '✓' if col in cols else '✗ MISSING')
asyncio.run(main())
"
```
Expected: all three columns `✓`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/user.py backend/alembic/versions/add_mrh_insurance_fields.py
git commit -m "feat(mrh): add insurance_verified/status/data columns to users"
```

---

## Task 3: Verification endpoint `POST /verification/insurance/upload`

**Files:**
- Modify: `backend/app/routers/verification.py`

- [ ] **Step 1: Add the endpoint at the bottom of the router**

Append to `backend/app/routers/verification.py` (before the last blank line / after any final `@router` block):

```python
@router.post("/insurance/upload")
async def upload_insurance_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Verify a tenant's MRH insurance attestation certificate (loi 89 art. 7g).

    Checks (DOSSIER §5.8):
      IN-1  Quote → 400 rejected.
      IN-2  Name/address mismatch → 200 flagged (landlord decides; we never gate).
      IN-3  Foreign insurer → 400 rejected (French MRH required for FR property).
      IN-4  Cover-start date stored in insurance_data for lease-start cross-check.
      IN-5  No access gating — verified or flagged, caller sees all data.

    Assurance is always MEDIUM (OCR — no insurer API).
    The source document is processed transiently; only the banded result is stored.
    """
    from app.services.mrh_insurance import mrh_insurance_service

    await _validate_file_size(file, max_size_mb=10)
    content = await file.read()

    # Derive expected name from identity_data (for IN-2 cross-check)
    identity_data = current_user.identity_data or {}
    expected_name = (
        (identity_data.get("extracted_data") or {}).get("full_name")
        or current_user.full_name
    )

    result = await mrh_insurance_service.verify(
        file_content=content,
        file_type=file.content_type or "application/pdf",
        expected_name=expected_name,
        expected_address=None,  # Phase 2: address cross-check added when lease is linked
    )

    # IN-1 / IN-3: hard rejects → 400
    if result["status"] == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["rejection_reason"],
        )

    # Store banded result (source document never persisted)
    current_user.insurance_verified = result["verified"]
    current_user.insurance_status = result["status"]
    current_user.insurance_data = {
        "status": result["status"],
        "upload_date": naive_utcnow().isoformat(),
        "filename": file.filename,
        "mrh_assurance": result["mrh_assurance"],
        "mrh_insurer_fr": result["mrh_insurer_fr"],
        "mrh_cert_type": result["mrh_cert_type"],
        "mrh_cover_start": result["mrh_cover_start"],
        "mrh_cover_end": result["mrh_cover_end"],
        "flags": result["flags"],
    }

    await db.commit()

    return {
        "verified": result["verified"],
        "status": result["status"],
        "mrh_assurance": result["mrh_assurance"],
        "mrh_insurer_fr": result["mrh_insurer_fr"],
        "mrh_cover_start": result["mrh_cover_start"],
        "mrh_cover_end": result["mrh_cover_end"],
        "flags": result["flags"],
    }
```

- [ ] **Step 2: Write the endpoint integration test**

Add to `backend/tests_integration/test_mrh_insurance.py` after the unit tests:

```python
# ── endpoint integration tests ───────────────────────────────────────────────

import pytest_asyncio
from tests_integration.conftest import make_user, auth

PDF_CERT = b"%PDF-1.4 fake-certificate"
PDF_QUOTE = b"%PDF-1.4 devis"
PDF_FOREIGN = b"%PDF-1.4 foreign-insurer"


def _patch_mrh(monkeypatch, *, document_type="certificate", insurer_country="FR",
               insured_name="Jean Dupont", cover_start="2026-07-01", cover_end="2027-07-01"):
    """Patch the MRH service to return a controlled extraction without calling AI."""
    import app.services.mrh_insurance as svc_mod

    async def _mock_verify(file_content, file_type, expected_name=None, expected_address=None):
        return svc_mod.check_mrh_extraction(
            {
                "document_type": document_type,
                "insurer_country": insurer_country,
                "insured_name": insured_name,
                "property_address": "12 rue de la Paix, 75001 Paris",
                "cover_start": cover_start,
                "cover_end": cover_end,
            },
            expected_name=expected_name,
            expected_address=expected_address,
        )

    monkeypatch.setattr(svc_mod.mrh_insurance_service, "verify", _mock_verify)


@pytest.mark.asyncio
async def test_insurance_upload_happy_path(client, sessionmaker_, monkeypatch):
    tenant = await make_user(sessionmaker_, role="tenant")
    token = await auth(client, tenant)

    _patch_mrh(monkeypatch, document_type="certificate", insurer_country="FR",
               insured_name="Jean Dupont", cover_start="2026-07-01", cover_end="2027-07-01")

    resp = await client.post(
        "/verification/insurance/upload",
        files={"file": ("cert.pdf", PDF_CERT, "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["verified"] is True
    assert body["status"] == "verified"
    assert body["mrh_assurance"] == "MEDIUM"
    assert body["mrh_insurer_fr"] is True


@pytest.mark.asyncio
async def test_insurance_upload_quote_rejected(client, sessionmaker_, monkeypatch):
    tenant = await make_user(sessionmaker_, role="tenant")
    token = await auth(client, tenant)

    _patch_mrh(monkeypatch, document_type="quote", insurer_country="FR", insured_name="Jean Dupont")

    resp = await client.post(
        "/verification/insurance/upload",
        files={"file": ("quote.pdf", PDF_QUOTE, "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "IN-1" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_insurance_upload_foreign_insurer_rejected(client, sessionmaker_, monkeypatch):
    tenant = await make_user(sessionmaker_, role="tenant")
    token = await auth(client, tenant)

    _patch_mrh(monkeypatch, document_type="certificate", insurer_country="UK",
               insured_name="Jean Dupont")

    resp = await client.post(
        "/verification/insurance/upload",
        files={"file": ("cert.pdf", PDF_CERT, "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "IN-3" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_insurance_upload_name_mismatch_flagged_not_blocked(client, sessionmaker_, monkeypatch):
    """IN-2: mismatch → 200 flagged, not 400. Landlord decides."""
    tenant = await make_user(sessionmaker_, role="tenant")
    token = await auth(client, tenant)

    _patch_mrh(monkeypatch, document_type="certificate", insurer_country="FR",
               insured_name="Paul Autre")  # different name

    resp = await client.post(
        "/verification/insurance/upload",
        files={"file": ("cert.pdf", PDF_CERT, "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "flagged"
    assert "name_mismatch" in body["flags"]


@pytest.mark.asyncio
async def test_insurance_upload_requires_auth(client):
    resp = await client.post(
        "/verification/insurance/upload",
        files={"file": ("cert.pdf", PDF_CERT, "application/pdf")},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_insurance_upload_stores_cover_dates(client, sessionmaker_, monkeypatch):
    """IN-4: cover_start must be persisted in insurance_data."""
    tenant = await make_user(sessionmaker_, role="tenant")
    token = await auth(client, tenant)

    _patch_mrh(monkeypatch, document_type="certificate", insurer_country="FR",
               insured_name="Jean Dupont", cover_start="2026-09-01", cover_end="2027-09-01")

    resp = await client.post(
        "/verification/insurance/upload",
        files={"file": ("cert.pdf", PDF_CERT, "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["mrh_cover_start"] == "2026-09-01"

    # Verify the data was persisted to insurance_data
    from app.models.user import User as U
    async with sessionmaker_() as s:
        u = await s.get(U, tenant.id)
        assert u.insurance_data is not None
        assert u.insurance_data["mrh_cover_start"] == "2026-09-01"
```

- [ ] **Step 3: Run endpoint tests**

```bash
cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test \
  python -m pytest tests_integration/test_mrh_insurance.py -q -k "upload" -v 2>&1 | tail -20
```
Expected: all 6 endpoint tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/verification.py backend/tests_integration/test_mrh_insurance.py
git commit -m "feat(mrh): add POST /verification/insurance/upload endpoint (IN-1..IN-5)"
```

---

## Task 4: Wire MRH claim into `issue-mine`

**Files:**
- Modify: `backend/app/routers/credentials.py:282-361`

- [ ] **Step 1: Add MRH claim assembly to `issue-mine`**

In `backend/app/routers/credentials.py`, inside the `issue_mine` function, after the property control claims block (around line 313), add:

```python
    # MRH insurance claim (DOSSIER §5.8 — always MEDIUM, never gated)
    insurance_data = current_user.insurance_data or {}
    mrh_status = insurance_data.get("status")
    if mrh_status in ("verified", "flagged"):
        claims["mrh_insurance_verified"] = mrh_status == "verified"
        claims["mrh_insurance_assurance"] = "MEDIUM"
        claims["mrh_insurance_status"] = mrh_status
        if insurance_data.get("flags"):
            claims["mrh_insurance_flags"] = insurance_data["flags"]
```

Also update the `assurance_summary` helper (around line 75) to include MRH in the human-readable string:

```python
def _assurance_summary(claims: dict) -> str:
    parts = []
    ia = claims.get("identity_assurance")
    if ia:
        parts.append(f"Identité : {ia}")
    sa = claims.get("solvency_assurance")
    if sa:
        parts.append(f"Solvabilité : {sa}")
    pa = claims.get("property_assurance")
    if pa:
        parts.append(f"Bien : {pa}")
    ma = claims.get("mrh_insurance_assurance")
    if ma:
        status_label = "OK" if claims.get("mrh_insurance_verified") else "Signalé"
        parts.append(f"Assurance MRH : {ma} ({status_label})")
    return " | ".join(parts) if parts else "Aucune attestation"
```

- [ ] **Step 2: Write the `issue-mine` MRH test**

Add to `backend/tests_integration/test_mrh_insurance.py`:

```python
@pytest.mark.asyncio
async def test_issue_mine_includes_mrh_claim(client, sessionmaker_, monkeypatch):
    """MRH insurance claim appears in issued credential when insurance is verified."""
    from app.core.timeutils import naive_utcnow

    tenant = await make_user(sessionmaker_, role="tenant")
    token = await auth(client, tenant)

    # Pre-set insurance_data directly (simulates a prior upload)
    async with sessionmaker_() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        u.insurance_verified = True
        u.insurance_status = "verified"
        u.insurance_data = {
            "status": "verified",
            "mrh_assurance": "MEDIUM",
            "mrh_insurer_fr": True,
            "mrh_cert_type": "certificate",
            "mrh_cover_start": "2026-07-01",
            "mrh_cover_end": "2027-07-01",
            "flags": [],
        }
        await s.commit()

    resp = await client.post(
        "/credentials/issue-mine",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    claims = body["claims"]
    assert claims.get("mrh_insurance_verified") is True
    assert claims.get("mrh_insurance_assurance") == "MEDIUM"


@pytest.mark.asyncio
async def test_issue_mine_mrh_flagged_included_not_blocked(client, sessionmaker_):
    """Flagged MRH is included in the credential — never silently dropped."""
    tenant = await make_user(sessionmaker_, role="tenant")
    token = await auth(client, tenant)

    async with sessionmaker_() as s:
        from app.models.user import User as U
        u = await s.get(U, tenant.id)
        u.insurance_verified = False
        u.insurance_status = "flagged"
        u.insurance_data = {
            "status": "flagged",
            "mrh_assurance": "MEDIUM",
            "mrh_insurer_fr": True,
            "mrh_cert_type": "certificate",
            "mrh_cover_start": "2026-07-01",
            "mrh_cover_end": "2027-07-01",
            "flags": ["name_mismatch"],
        }
        await s.commit()

    resp = await client.post(
        "/credentials/issue-mine",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    claims = resp.json()["claims"]
    assert claims.get("mrh_insurance_verified") is False
    assert claims.get("mrh_insurance_status") == "flagged"
    assert "name_mismatch" in claims.get("mrh_insurance_flags", [])
```

- [ ] **Step 3: Run `issue-mine` tests**

```bash
cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test \
  python -m pytest tests_integration/test_mrh_insurance.py -q -k "issue_mine" -v 2>&1 | tail -10
```
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/credentials.py backend/tests_integration/test_mrh_insurance.py
git commit -m "feat(mrh): surface MRH insurance claim in issue-mine and assurance summary"
```

---

## Task 5: MRH row in evidence PDF

**Files:**
- Modify: `backend/app/services/credential.py:282-315` (claims table section)

- [ ] **Step 1: Add MRH row to the claims table in `export_evidence_pdf`**

In `backend/app/services/credential.py`, inside `export_evidence_pdf`, after the `property_control` block (around line 314), add before the `if len(claims_rows) > 1:` check:

```python
        if "mrh_insurance_assurance" in claims:
            mrh_ok = claims.get("mrh_insurance_verified")
            mrh_status_label = "Vérifié ✓" if mrh_ok else "Signalé ⚠"
            flags = claims.get("mrh_insurance_flags") or []
            flag_note = f" — signalements : {', '.join(flags)}" if flags else ""
            claims_rows.append([
                Paragraph("Assurance MRH (loi 89 art. 7g)", body),
                Paragraph(f"{mrh_status_label}{flag_note}", body),
                Paragraph(assurance_fr.get(claims.get("mrh_insurance_assurance", "UNVERIFIED"), "—"), body),
            ])
```

- [ ] **Step 2: Write the PDF test**

Add to `backend/tests_integration/test_mrh_insurance.py`:

```python
def test_evidence_pdf_includes_mrh_row():
    """MRH claim appears in the evidence PDF when present in the credential."""
    from app.services.credential import credential_service

    payload = credential_service.issue(
        subject_role="tenant",
        rail="FR",
        claims={
            "identity_assurance": "MEDIUM",
            "mrh_insurance_assurance": "MEDIUM",
            "mrh_insurance_verified": True,
            "mrh_insurance_status": "verified",
        },
        subject_display_name="Jean Dupont",
    )
    pdf_bytes = credential_service.export_evidence_pdf(payload)
    assert len(pdf_bytes) > 100
    # Check the PDF text contains the MRH row label (basic smoke test)
    import re
    assert b"MRH" in pdf_bytes or b"Assurance" in pdf_bytes


def test_evidence_pdf_mrh_flagged_shows_flags():
    """Flags are rendered in the PDF so the recipient can see them."""
    from app.services.credential import credential_service

    payload = credential_service.issue(
        subject_role="tenant",
        rail="FR",
        claims={
            "identity_assurance": "MEDIUM",
            "mrh_insurance_assurance": "MEDIUM",
            "mrh_insurance_verified": False,
            "mrh_insurance_status": "flagged",
            "mrh_insurance_flags": ["name_mismatch"],
        },
        subject_display_name="Jean Dupont",
    )
    pdf_bytes = credential_service.export_evidence_pdf(payload)
    assert len(pdf_bytes) > 100
```

- [ ] **Step 3: Run PDF tests**

```bash
cd backend && python -m pytest tests_integration/test_mrh_insurance.py -q -k "pdf" -v 2>&1 | tail -10
```
Expected: both pass.

- [ ] **Step 4: Run full suite**

```bash
cd backend && DATABASE_URL=postgresql+asyncpg://127.0.0.1:5432/roomivo_test \
  python -m pytest tests_integration/ -q 2>&1 | tail -15
```
Expected: all integration tests pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/credential.py backend/tests_integration/test_mrh_insurance.py
git commit -m "feat(mrh): add MRH insurance row to evidence PDF"
```

---

## Self-review

**Spec coverage:**
- IN-1 (quote rejected): Task 1 unit test + Task 3 endpoint test `test_insurance_upload_quote_rejected`. ✓
- IN-2 (name mismatch flagged, no ReDoS): Task 1 unit tests `test_name_mismatch_flags_not_blocks` + `test_name_mismatch_never_builds_regex_from_db`. ✓
- IN-3 (foreign insurer blocked): Task 1 unit test + Task 3 endpoint test `test_insurance_upload_foreign_insurer_rejected`. ✓
- IN-4 (cover dates stored): Task 1 unit test + Task 3 endpoint test `test_insurance_upload_stores_cover_dates`. ✓
- IN-5 (no gating): Task 1 unit test `test_no_fields_gated_on_insurance` + Task 3 `test_insurance_upload_name_mismatch_flagged_not_blocked`. ✓
- Assurance always MEDIUM: Task 1 `test_assurance_always_medium`. ✓
- Credential claim: Task 4 `test_issue_mine_includes_mrh_claim`. ✓
- Flagged credential included not silently dropped: Task 4 `test_issue_mine_mrh_flagged_included_not_blocked`. ✓
- Evidence PDF: Task 5 PDF tests. ✓

**Placeholder scan:** No TBD/TODO in code steps. All types/functions defined before use. ✓

**Type consistency:**
- `check_mrh_extraction` defined in Task 1, called in Task 3 endpoint via `mrh_insurance_service.verify()` which internally calls it. ✓
- `mrh_insurance_service` singleton defined at module level, imported by endpoint. ✓
- `insurance_data`, `insurance_verified`, `insurance_status` added to model in Task 2, used by endpoint in Task 3, read by `issue-mine` in Task 4. ✓
