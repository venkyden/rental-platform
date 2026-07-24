"""
Age-sweep for raw identity documents left by the storage fallback path.

The Redis path expires on its own (600s TTL); the R2/disk fallback has no expiry
of any kind, so an abandoned or crashed verification leaves a raw ID image behind
forever. purge_stale_objects reclaims those by object age — the only mechanism
that can reach an orphan no database row references.
"""

import os
import time

import pytest

from app.services.storage import CloudStorageService


RETENTION = 3600


def _write(root: str, relpath: str, age_seconds: int) -> str:
    """Create a file under root and backdate its mtime by age_seconds."""
    full = os.path.join(root, relpath)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as fh:
        fh.write(b"fake-identity-image")
    past = time.time() - age_seconds
    os.utime(full, (past, past))
    return full


@pytest.fixture
def local_storage(tmp_path):
    """A CloudStorageService pinned to local mode, rooted at a temp dir."""
    s = CloudStorageService()
    s.client = None
    s.is_local = True
    s.local_path = str(tmp_path)
    return s


@pytest.mark.asyncio
async def test_deletes_objects_older_than_retention(local_storage, tmp_path):
    stale = _write(str(tmp_path), "verification/identity/u1/2026/07/23/old.jpg", RETENTION + 600)

    deleted = await local_storage.purge_stale_objects("verification/identity/", RETENTION)

    assert deleted == 1
    assert not os.path.exists(stale)


@pytest.mark.asyncio
async def test_keeps_objects_inside_retention(local_storage, tmp_path):
    """A verification still inside its face-match window must survive."""
    fresh = _write(str(tmp_path), "verification/identity/u1/2026/07/24/new.jpg", 60)

    deleted = await local_storage.purge_stale_objects("verification/identity/", RETENTION)

    assert deleted == 0
    assert os.path.exists(fresh)


@pytest.mark.asyncio
async def test_never_touches_durable_prefixes(local_storage, tmp_path):
    """
    The sweep is indiscriminate within its prefix, so scoping is the only thing
    protecting listing photos, leases, uploaded documents and guarantor files —
    all of which are old by design. Regression guard for that scoping.
    """
    survivors = [
        _write(str(tmp_path), "properties/p1/2020/01/01/photo.jpg", RETENTION * 100),
        _write(str(tmp_path), "leases/l1/2020/01/01/lease.pdf", RETENTION * 100),
        _write(str(tmp_path), "documents/u1/2020/01/01/payslip.pdf", RETENTION * 100),
        _write(str(tmp_path), "dossiers/u1/2020/01/01/dossier.pdf", RETENTION * 100),
        _write(str(tmp_path), "avatars/2020/01/01/face.jpg", RETENTION * 100),
        # guarantor keys are referenced by guarantor_data["files"] — must persist
        _write(str(tmp_path), "verification/guarantor/u1/2020/01/01/id.jpg", RETENTION * 100),
    ]

    deleted = await local_storage.purge_stale_objects("verification/identity/", RETENTION)

    assert deleted == 0
    for path in survivors:
        assert os.path.exists(path), f"sweep destroyed durable object: {path}"


@pytest.mark.asyncio
async def test_sweeps_intl_identity_prefix(local_storage, tmp_path):
    """intl lives outside verification/identity/, so it needs its own sweep."""
    stale = _write(
        str(tmp_path), "verification/intl/identity/u1/2026/07/23/old.jpg", RETENTION + 600
    )

    assert await local_storage.purge_stale_objects("verification/identity/", RETENTION) == 0
    assert os.path.exists(stale)

    assert await local_storage.purge_stale_objects("verification/intl/identity/", RETENTION) == 1
    assert not os.path.exists(stale)


@pytest.mark.asyncio
@pytest.mark.parametrize("prefix", ["", "/", ".", "   "])
async def test_refuses_unsafe_prefix(local_storage, tmp_path, prefix):
    """An empty/root prefix would sweep the whole bucket."""
    keep = _write(str(tmp_path), "properties/p1/2020/01/01/photo.jpg", RETENTION * 100)

    assert await local_storage.purge_stale_objects(prefix, RETENTION) == 0
    assert os.path.exists(keep)


@pytest.mark.asyncio
async def test_prunes_emptied_directories(local_storage, tmp_path):
    _write(str(tmp_path), "verification/identity/u1/2026/07/23/old.jpg", RETENTION + 600)

    await local_storage.purge_stale_objects("verification/identity/", RETENTION)

    # the per-user date tree should not linger as empty scaffolding
    assert not os.path.exists(os.path.join(tmp_path, "verification/identity/u1/2026/07/23"))


@pytest.mark.asyncio
async def test_missing_prefix_is_a_noop(local_storage):
    assert await local_storage.purge_stale_objects("verification/identity/", RETENTION) == 0
