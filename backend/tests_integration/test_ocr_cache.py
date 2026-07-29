"""
Persistent OCR cache (DocumentExtraction) — real-DB integration tests.

Replaces tests/test_ocr_cache.py, which was a manual script rather than a
test: no assertions, print()+early-return instead of failures, an
`if __name__ == "__main__"` block, and it called the *real* Gemini extraction
against the *real* database. It could only ever fail by raising, it made
network calls, and under pytest-asyncio's event-loop scoping it leaked into
unrelated tests (it broke 10 cases in test_intl_rails.py).

Here the AI extraction is mocked, so these assert the cache contract itself:
a miss extracts once and persists, a hit serves from the database without
touching the extractor again.
"""

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal, engine as app_engine
from app.models.document import DocumentExtraction
from app.models.user import User  # noqa: F401 — needed to resolve relationships
from app.services.employment import EmploymentData, employment_service


def _payslip_data(**overrides) -> EmploymentData:
    base = dict(
        employer_name="ACME SARL",
        employee_name="Test User",
        gross_salary=Decimal("3000.00"),
        net_salary=Decimal("2400.00"),
        pay_period="2026-06",
        employment_type="CDI",
        siret=None,  # keep the external SIRET registry out of these tests
        job_title="Engineer",
        confidence_score=0.99,
    )
    base.update(overrides)
    return EmploymentData(**base)


@pytest_asyncio.fixture(autouse=True)
async def _dispose_app_engine():
    """
    employment_service talks to the DB through the app's global
    AsyncSessionLocal, whose engine uses a QueuePool — unlike the conftest
    engine, which is NullPool precisely so it survives per-test event loops.
    Pooled asyncpg connections stay bound to the loop that opened them, so
    without disposing here the next test inherits a connection whose loop is
    closed ("RuntimeError: Event loop is closed").
    """
    yield
    await app_engine.dispose()


@pytest_asyncio.fixture
async def unique_content():
    """Fresh bytes per test so each run starts as a cache miss, cleaned after."""
    content = f"payslip-{uuid.uuid4()}".encode()
    yield content
    file_hash = employment_service._get_file_hash(content)
    async with AsyncSessionLocal() as session:
        await session.execute(
            delete(DocumentExtraction).where(DocumentExtraction.file_hash == file_hash)
        )
        await session.commit()


async def _fetch_cached(content: bytes):
    file_hash = employment_service._get_file_hash(content)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(DocumentExtraction).where(DocumentExtraction.file_hash == file_hash)
        )
        return result.scalar_one_or_none()


@pytest.mark.asyncio
async def test_cache_miss_extracts_once_and_persists(unique_content):
    extractor = AsyncMock(return_value=_payslip_data())

    with patch.object(employment_service, "_extract_document_data", extractor):
        await employment_service.verify_payslip(
            file_content=unique_content, file_type="text/plain", expected_name="Test User"
        )

    assert extractor.await_count == 1, "cache miss must run extraction exactly once"

    record = await _fetch_cached(unique_content)
    assert record is not None, "extraction result must be persisted for reuse"
    assert record.extraction_data["employer_name"] == "ACME SARL"
    assert record.extraction_data["net_salary"] == 2400.0


@pytest.mark.asyncio
async def test_cache_hit_does_not_reinvoke_extractor(unique_content):
    first = AsyncMock(return_value=_payslip_data())
    with patch.object(employment_service, "_extract_document_data", first):
        result1 = await employment_service.verify_payslip(
            file_content=unique_content, file_type="text/plain", expected_name="Test User"
        )
    assert first.await_count == 1

    # Same bytes -> same hash -> must be served from the DB, not re-extracted.
    second = AsyncMock(return_value=_payslip_data(employer_name="SHOULD-NOT-BE-USED"))
    with patch.object(employment_service, "_extract_document_data", second):
        result2 = await employment_service.verify_payslip(
            file_content=unique_content, file_type="text/plain", expected_name="Test User"
        )

    assert second.await_count == 0, "cache hit must not call the extractor"
    assert result2["status"] == result1["status"]
    # Served from the persisted row, not from `second`'s sentinel value.
    assert result2["data"]["employer"] == "ACME SARL"
    assert result2["data"]["net_salary"] == result1["data"]["net_salary"]


@pytest.mark.asyncio
async def test_distinct_content_is_a_separate_cache_entry(unique_content):
    other = f"payslip-{uuid.uuid4()}".encode()
    extractor = AsyncMock(return_value=_payslip_data())
    try:
        with patch.object(employment_service, "_extract_document_data", extractor):
            await employment_service.verify_payslip(
                file_content=unique_content, file_type="text/plain", expected_name="Test User"
            )
            await employment_service.verify_payslip(
                file_content=other, file_type="text/plain", expected_name="Test User"
            )

        assert extractor.await_count == 2, "different bytes must not share a cache entry"
        assert await _fetch_cached(other) is not None
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                delete(DocumentExtraction).where(
                    DocumentExtraction.file_hash == employment_service._get_file_hash(other)
                )
            )
            await session.commit()


@pytest.mark.asyncio
async def test_null_employment_type_does_not_crash_validation(unique_content):
    """
    Regression: the AI can emit an explicit JSON null for employment_type.
    dict.get(key, default) passes that through as None rather than using the
    default, so _validate_employment_data used to raise AttributeError on
    .upper() and 500 the whole upload.
    """
    extractor = AsyncMock(return_value=_payslip_data(employment_type=None))

    with patch.object(employment_service, "_extract_document_data", extractor):
        result = await employment_service.verify_payslip(
            file_content=unique_content, file_type="text/plain", expected_name="Test User"
        )

    assert result["status"] in {"verified", "pending_review", "rejected"}
    stable = next(c for c in result["validation_checks"] if c["name"] == "stable_employment")
    assert stable["passed"] is False
