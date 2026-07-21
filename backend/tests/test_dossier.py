"""
Universal Trust Dossier — endpoint, ownership, sharing and doctrine tests.

Two things this suite exists to protect:

1. **Async correctness.** `get_db` yields an AsyncSession. The first
   implementation called `db.scalar(...)` / `db.commit()` without `await`,
   which returns a *coroutine* — and a coroutine is truthy, so guards like
   `if not dossier: raise 404` silently never fired and every request 500'd.
   The fake session here is `async def` throughout, so a forgotten `await`
   fails these tests instead of reaching production.

2. **The banded-claims doctrine (DOSSIER §0.20).** A dossier renders the
   signed credential only. It must never embed, append or re-download a
   source document (ID, avis, payslip, bank statement, guarantor file).
"""

import os
import sys
from datetime import timedelta
from itertools import count
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.sql.elements import BinaryExpression, BooleanClauseList

from app.main import app
from app.core.database import get_db
from app.core.timeutils import naive_utcnow
from app.routers.auth import get_current_user, get_current_user_optional
from app.models.credential import Credential
from app.models.dossier import TrustDossier, DossierShareLink

from tests.conftest import make_mock_user


# ── Fake AsyncSession ────────────────────────────────────────────────────
# Deliberately async: un-awaited production calls blow up here.

class FakeAsyncSession:
    def __init__(self):
        self.rows: dict[type, list] = {}
        self.queried_entities: list[type] = []
        self.commits = 0

    # -- helpers used by tests --
    def seed(self, obj):
        self.rows.setdefault(type(obj), []).append(obj)
        return obj

    # -- session API --
    @staticmethod
    def _apply_column_defaults(obj):
        """SQLAlchemy applies Python-side column defaults (e.g.
        `created_at = Column(..., default=naive_utcnow)`) at flush time.
        Emulate that so rows look like they would after a real INSERT."""
        table = getattr(type(obj), "__table__", None)
        if table is None:
            return
        for column in table.columns:
            if getattr(obj, column.key, None) is not None:
                continue
            default = column.default
            if default is None or not getattr(default, "is_scalar", False) and not callable(getattr(default, "arg", None)):
                if default is not None and getattr(default, "is_scalar", False):
                    setattr(obj, column.key, default.arg)
                continue
            arg = default.arg
            setattr(obj, column.key, arg(None) if callable(arg) else arg)

    def add(self, obj):
        self._apply_column_defaults(obj)
        self.rows.setdefault(type(obj), []).append(obj)

    async def flush(self):
        pass

    async def commit(self):
        self.commits += 1

    async def refresh(self, _obj=None):
        pass

    async def close(self):
        pass

    def _entity(self, stmt):
        return stmt.column_descriptions[0]["entity"]

    def _matches(self, row, clause) -> bool:
        if clause is None:
            return True
        if isinstance(clause, BooleanClauseList):
            return all(self._matches(row, c) for c in clause.clauses)
        if isinstance(clause, BinaryExpression):
            column = getattr(clause.left, "key", None)
            expected = getattr(clause.right, "value", None)
            if column is None:
                return True
            return str(getattr(row, column, None)) == str(expected)
        return True

    def _select(self, stmt):
        entity = self._entity(stmt)
        self.queried_entities.append(entity)
        return [r for r in self.rows.get(entity, []) if self._matches(r, stmt.whereclause)]

    async def scalar(self, stmt):
        found = self._select(stmt)
        return found[0] if found else None

    async def scalars(self, stmt):
        found = self._select(stmt)

        class _Result:
            def all(self_inner):
                return found

        return _Result()


_client_ips = count(1)


def make_client(session, user=None, optional_user=None):
    target_app = app.app if hasattr(app, "app") else app

    def fake_get_db():
        yield session

    target_app.dependency_overrides[get_db] = fake_get_db
    if user is not None:
        target_app.dependency_overrides[get_current_user] = lambda: user
    target_app.dependency_overrides[get_current_user_optional] = lambda: optional_user
    # Public share endpoint is rate limited per IP on a shared scope; give each
    # client its own bucket so tests stay order-independent.
    return TestClient(app, client=(f"10.1.0.{next(_client_ips)}", 50000))


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    target_app = app.app if hasattr(app, "app") else app
    target_app.dependency_overrides.clear()


# ── Builders ─────────────────────────────────────────────────────────────

def make_credential(user_id, role="tenant"):
    now = naive_utcnow()
    return Credential(
        id="cred-abc-123",
        subject_role=role,
        rail="FR",
        subject_user_id=user_id,
        subject_display_name="Test Tenant",
        issued_at=now,
        expires_at=now + timedelta(days=30),
        claims={"identity_assurance": "MEDIUM"},
        disclaimer="informative",
        signature="sig",
        kid="k1",
        revoked=False,
    )


def make_dossier(user_id, status="ready", pdf_key="dossiers/u/d.pdf", expires_in_days=30):
    now = naive_utcnow()
    d = TrustDossier(
        id="dossier-1",
        user_id=str(user_id),
        role="tenant",
        status=status,
        credential_id="cred-abc-123",
        pdf_s3_key=pdf_key,
        expires_at=now + timedelta(days=expires_in_days),
    )
    d.created_at = now
    return d


def make_link(dossier, token="tok-123", expires_in_days=7, target_user_id=None):
    link = DossierShareLink(
        id="link-1",
        dossier_id=dossier.id,
        target_user_id=target_user_id,
        token=token,
        expires_at=naive_utcnow() + timedelta(days=expires_in_days),
    )
    link.view_count = 0
    link.dossier = dossier  # eager-loaded by selectinload in production
    return link


# ── Ownership: the guard that was silently dead ──────────────────────────

def test_sharing_someone_elses_dossier_is_rejected():
    """The original code's `if not dossier or ...` never fired because the
    un-awaited coroutine was truthy. This is the regression guard."""
    owner = make_mock_user(role="tenant")
    attacker = make_mock_user(role="tenant")
    attacker.id = "11111111-1111-1111-1111-111111111111"

    session = FakeAsyncSession()
    session.seed(make_dossier(owner.id))

    client = make_client(session, user=attacker)
    res = client.post("/api/v1/dossiers/share", json={"dossier_id": "dossier-1"})
    assert res.status_code == 404, res.text


def test_sharing_unknown_dossier_is_404():
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    client = make_client(session, user=user)
    res = client.post("/api/v1/dossiers/share", json={"dossier_id": "nope"})
    assert res.status_code == 404


def test_owner_can_create_share_link():
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    session.seed(make_dossier(user.id))

    client = make_client(session, user=user)
    res = client.post("/api/v1/dossiers/share", json={"dossier_id": "dossier-1", "expires_in_days": 7})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["token"]
    assert len(body["token"]) >= 32  # secrets.token_urlsafe(32)
    assert body["url"].endswith(f"/d/share/{body['token']}")


def test_share_link_expiry_is_clamped_to_dossier_expiry():
    """A link must never outlive the credential-backed dossier it points at."""
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    session.seed(make_dossier(user.id, expires_in_days=2))

    client = make_client(session, user=user)
    res = client.post("/api/v1/dossiers/share", json={"dossier_id": "dossier-1", "expires_in_days": 365})
    assert res.status_code == 200, res.text
    granted = res.json()["expires_at"]
    # 365-day request must be clamped down to the dossier's 2-day horizon
    assert granted < (naive_utcnow() + timedelta(days=3)).isoformat()


# ── Public share endpoint ────────────────────────────────────────────────

def test_shared_unknown_token_is_404():
    session = FakeAsyncSession()
    client = make_client(session, user=make_mock_user())
    assert client.get("/api/v1/dossiers/shared/does-not-exist").status_code == 404


def test_shared_expired_link_is_403():
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    dossier = session.seed(make_dossier(user.id))
    link = make_link(dossier)
    link.expires_at = naive_utcnow() - timedelta(minutes=1)
    session.seed(link)

    client = make_client(session, user=user)
    res = client.get("/api/v1/dossiers/shared/tok-123")
    assert res.status_code == 403
    assert "expired" in res.json()["detail"].lower()


def test_shared_targeted_link_rejects_anonymous_viewer():
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    dossier = session.seed(make_dossier(user.id))
    session.seed(make_link(dossier, target_user_id="22222222-2222-2222-2222-222222222222"))

    client = make_client(session, user=user, optional_user=None)
    res = client.get("/api/v1/dossiers/shared/tok-123")
    assert res.status_code == 403


def test_shared_targeted_link_rejects_wrong_user():
    user = make_mock_user(role="tenant")
    wrong = make_mock_user(role="tenant")
    wrong.id = "33333333-3333-3333-3333-333333333333"

    session = FakeAsyncSession()
    dossier = session.seed(make_dossier(user.id))
    session.seed(make_link(dossier, target_user_id="22222222-2222-2222-2222-222222222222"))

    client = make_client(session, user=user, optional_user=wrong)
    res = client.get("/api/v1/dossiers/shared/tok-123")
    assert res.status_code == 403


def test_shared_dossier_not_ready_is_404():
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    dossier = session.seed(make_dossier(user.id, status="compiling", pdf_key=None))
    session.seed(make_link(dossier))

    client = make_client(session, user=user)
    assert client.get("/api/v1/dossiers/shared/tok-123").status_code == 404


def test_shared_valid_link_returns_pdf_and_counts_the_view():
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    dossier = session.seed(make_dossier(user.id))
    link = session.seed(make_link(dossier))

    client = make_client(session, user=user)
    with patch("app.services.storage.storage.download_file", new=AsyncMock(return_value=b"%PDF-1.4 fake")):
        res = client.get("/api/v1/dossiers/shared/tok-123")

    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")
    assert link.view_count == 1
    assert session.commits >= 1, "view count increment must be committed"


def test_missing_pdf_object_reports_404_not_500():
    """The generic `except Exception` used to swallow this 404 into a 500."""
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    dossier = session.seed(make_dossier(user.id))
    session.seed(make_link(dossier))

    client = make_client(session, user=user)
    with patch("app.services.storage.storage.download_file", new=AsyncMock(return_value=None)):
        res = client.get("/api/v1/dossiers/shared/tok-123")
    assert res.status_code == 404


# ── Listing ──────────────────────────────────────────────────────────────

def test_my_dossiers_lists_only_own():
    user = make_mock_user(role="tenant")
    other = "44444444-4444-4444-4444-444444444444"
    session = FakeAsyncSession()
    session.seed(make_dossier(user.id))
    foreign = make_dossier(other)
    foreign.id = "dossier-2"
    session.seed(foreign)

    client = make_client(session, user=user)
    res = client.get("/api/v1/dossiers/me")
    assert res.status_code == 200, res.text
    ids = [d["id"] for d in res.json()]
    assert ids == ["dossier-1"]


# ── Compilation ──────────────────────────────────────────────────────────

def test_compile_without_a_credential_is_400():
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()  # no Credential seeded
    client = make_client(session, user=user)
    res = client.post("/api/v1/dossiers/compile", json={"role": "tenant"})
    assert res.status_code == 400


def test_compile_builds_dossier_from_the_credential():
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    session.seed(make_credential(user.id))

    client = make_client(session, user=user)
    with patch("app.services.dossier_service.generate_trust_dossier_pdf", new=AsyncMock(return_value=b"%PDF-1.4")), \
         patch("app.services.storage.storage.upload_file", new=AsyncMock(return_value={"key": "dossiers/u/d.pdf"})):
        res = client.post("/api/v1/dossiers/compile", json={"role": "tenant"})

    assert res.status_code == 200, res.text
    assert res.json()["status"] == "ready"


# ── Doctrine: banded claims only (DOSSIER §0.20) ─────────────────────────

def test_generator_never_reads_source_documents():
    """If this test is deleted or made to pass by weakening it, the
    verify-and-forget doctrine is being violated. See DOSSIER §0.20."""
    import app.services.dossier_generator as gen
    import inspect

    source = inspect.getsource(gen)
    for forbidden in ("Document", "identity_data", "income_data", "guarantor"):
        assert forbidden not in source, (
            f"dossier generator references {forbidden!r} — the dossier must render "
            "the signed credential only, never source documents (DOSSIER §0.20)"
        )


@pytest.mark.asyncio
async def test_generator_queries_only_the_credential():
    """Runtime counterpart to the static check above."""
    from app.services.dossier_generator import generate_trust_dossier_pdf

    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    session.seed(make_credential(user.id))

    with patch("app.services.credential.credential_service.export_evidence_pdf", return_value=b"%PDF-1.4"):
        pdf = await generate_trust_dossier_pdf(session, str(user.id), "cred-abc-123")

    assert pdf.startswith(b"%PDF")
    assert session.queried_entities == [Credential], (
        f"generator touched {session.queried_entities} — expected Credential only"
    )


# ── Public metadata endpoint (viewer shows validity before download) ─────

def test_shared_meta_returns_non_sensitive_descriptor_only():
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    dossier = session.seed(make_dossier(user.id))
    session.seed(make_link(dossier))

    client = make_client(session, user=user)
    res = client.get("/api/v1/dossiers/shared/tok-123/meta")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["role"] == "tenant"
    assert body["status"] == "ready"
    assert set(body) == {"role", "status", "expires_at"}, (
        "metadata must not widen beyond role/status/expiry — no claims, no PII"
    )


def test_shared_meta_enforces_the_same_guards_as_the_pdf_route():
    """meta and PDF share one guard helper; this proves they cannot drift."""
    user = make_mock_user(role="tenant")

    # expired
    session = FakeAsyncSession()
    dossier = session.seed(make_dossier(user.id))
    link = make_link(dossier)
    link.expires_at = naive_utcnow() - timedelta(minutes=1)
    session.seed(link)
    client = make_client(session, user=user)
    assert client.get("/api/v1/dossiers/shared/tok-123/meta").status_code == 403

    # unknown token
    session2 = FakeAsyncSession()
    client2 = make_client(session2, user=user)
    assert client2.get("/api/v1/dossiers/shared/nope/meta").status_code == 404

    # targeted at someone else
    session3 = FakeAsyncSession()
    d3 = session3.seed(make_dossier(user.id))
    session3.seed(make_link(d3, target_user_id="22222222-2222-2222-2222-222222222222"))
    client3 = make_client(session3, user=user, optional_user=None)
    assert client3.get("/api/v1/dossiers/shared/tok-123/meta").status_code == 403


def test_shared_meta_does_not_count_as_a_view():
    """Only fetching the PDF is a view; polling metadata must not inflate it."""
    user = make_mock_user(role="tenant")
    session = FakeAsyncSession()
    dossier = session.seed(make_dossier(user.id))
    link = session.seed(make_link(dossier))

    client = make_client(session, user=user)
    client.get("/api/v1/dossiers/shared/tok-123/meta")
    assert link.view_count == 0
