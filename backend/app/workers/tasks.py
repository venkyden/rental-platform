"""
Celery tasks (durable background queue).

These run in the Celery worker process (see docker-compose `worker` service)
using the Redis broker configured in ``celery_app``. They are the durable
path for slow/blocking work; request handlers that cannot reach a broker fall
back to FastAPI ``BackgroundTasks`` instead.
"""

import logging
import os
from typing import Optional

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.workers.tasks.send_email_task",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def send_email_task(
    self,
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> bool:
    """Dispatch a transactional email via Resend with retry/backoff."""
    from app.services.email import _send_via_resend

    from_email = os.getenv("FROM_EMAIL", "onboarding@resend.dev")
    if not os.getenv("RESEND_API_KEY"):
        logger.info("📧 [worker console email] TO=%s SUBJECT=%s", to_email, subject)
        return True

    ok = _send_via_resend(from_email, to_email, subject, html_content, text_content)
    if not ok:
        raise self.retry(exc=RuntimeError(f"email dispatch failed for {to_email}"))
    return True


@celery_app.task(
    name="app.workers.tasks.purge_stale_applications_task",
    bind=True,
    max_retries=1,
)
def purge_stale_applications_task(self) -> dict:
    """
    Finds and deletes REJECTED or WITHDRAWN applications older than 30 days.
    Purges associated snapshot documents from cloud storage (GDPR compliance).
    """
    import asyncio
    from datetime import timedelta
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.core.timeutils import naive_utcnow
    from app.models.application import Application, ApplicationStatus
    from app.services.storage import storage

    async def _purge():
        purged_count = 0
        cutoff_date = naive_utcnow() - timedelta(days=30)

        async with AsyncSessionLocal() as db:
            # Find stale applications
            stmt = select(Application).where(
                Application.status.in_([ApplicationStatus.REJECTED.value, ApplicationStatus.WITHDRAWN.value]),
                Application.updated_at < cutoff_date
            )
            result = await db.execute(stmt)
            stale_apps = result.scalars().all()

            for app in stale_apps:
                if app.snapshot_data and isinstance(app.snapshot_data, dict):
                    # Attempt to delete stored documents associated with this application snapshot
                    docs = app.snapshot_data.get("documents", [])
                    for doc in docs:
                        if "storage_key" in doc:
                            try:
                                await storage.delete_file(doc["storage_key"])
                            except Exception as e:
                                logger.error(f"Failed to delete document {doc['storage_key']}: {e}")

                await db.delete(app)
                purged_count += 1

            if purged_count > 0:
                await db.commit()
                logger.info(f"Purged {purged_count} stale applications for GDPR compliance.")

        return {"purged_applications_count": purged_count}

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        future = asyncio.run_coroutine_threadsafe(_purge(), loop)
        return future.result()
    else:
        return asyncio.run(_purge())
