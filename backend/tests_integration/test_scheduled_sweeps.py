"""
The scheduled clean-ups as the embedded Celery worker runs them: in a fresh
process that has not imported the web app, one task call after another, each in
its own event loop. Production logs (2026-10-21) showed every run failing, first
on a model that was never imported, then on connections bound to an earlier loop.
"""

import json
import os
import subprocess
import sys
from datetime import timedelta
from pathlib import Path

import pytest
from sqlalchemy import update

from app.core.timeutils import naive_utcnow
from app.models.application import Application
from tests_integration.conftest import make_application, make_property, make_user

BACKEND = Path(__file__).resolve().parents[1]


def _run_in_worker_process(task_name: str, times: int = 2) -> list[dict]:
    """Call a task `times` times in a new interpreter, as the worker would."""
    code = (
        "import json\n"
        f"from app.workers.tasks import {task_name} as task\n"
        f"for _ in range({times}):\n"
        "    print(json.dumps(task()))\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=BACKEND,
        env={**os.environ},
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr[-3000:]
    return [json.loads(line) for line in result.stdout.strip().splitlines() if line.startswith("{")]


def test_identity_sweep_runs_again_and_again_in_a_fresh_process():
    runs = _run_in_worker_process("purge_stale_identity_docs_task")
    assert len(runs) == 2
    assert all(set(r) == {"objects_deleted", "pointers_cleared"} for r in runs)


@pytest.mark.asyncio
async def test_application_purge_deletes_only_old_rejected_or_withdrawn(sessionmaker_):
    landlord = await make_user(sessionmaker_, role="landlord")
    prop = await make_property(sessionmaker_, landlord, status="active")
    # One application per tenant and listing (uq_application_tenant_property).
    old_rejected, old_withdrawn, recent_rejected, old_pending = [
        await make_application(sessionmaker_, await make_user(sessionmaker_, role="tenant"), prop)
        for _ in range(4)
    ]
    long_ago = naive_utcnow() - timedelta(days=31)
    async with sessionmaker_() as s:
        for app_id, status, when in [
            (old_rejected.id, "rejected", long_ago),
            (old_withdrawn.id, "withdrawn", long_ago),
            (recent_rejected.id, "rejected", naive_utcnow() - timedelta(days=2)),
            (old_pending.id, "pending", long_ago),
        ]:
            await s.execute(update(Application).where(Application.id == app_id).values(status=status, updated_at=when))
        await s.commit()

    runs = _run_in_worker_process("purge_stale_applications_task")

    assert runs[0]["purged_applications_count"] >= 2
    assert runs[1] == {"purged_applications_count": 0}
    async with sessionmaker_() as s:
        assert await s.get(Application, old_rejected.id) is None
        assert await s.get(Application, old_withdrawn.id) is None
        assert await s.get(Application, recent_rejected.id) is not None
        assert await s.get(Application, old_pending.id) is not None


def test_both_clean_ups_are_scheduled():
    from app.workers.celery_app import celery_app

    tasks = {entry["task"] for entry in celery_app.conf.beat_schedule.values()}
    assert tasks == {
        "app.workers.tasks.purge_stale_identity_docs_task",
        "app.workers.tasks.purge_stale_applications_task",
    }
