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


@celery_app.task(
    name="app.workers.tasks.purge_legacy_verification_docs_task",
    bind=True,
    max_retries=1,
)
def purge_legacy_verification_docs_task(self) -> dict:
    """
    One-time GDPR cleanup: delete source documents stored in R2 by the legacy
    verification flows (identity, income, guarantor) before the statelessness
    retrofit (Item 12). New flows no longer store source docs.

    Safe to re-run: already-deleted keys are silently skipped by the storage layer.
    """
    import asyncio
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.user import User
    from app.services.storage import storage

    _IDENTITY_KEYS = ("storage_key", "selfie_storage_key", "back_storage_key")
    _INCOME_KEYS = ("storage_key",)
    _GUARANTOR_KEYS = ("storage_key",)

    async def _purge_docs():
        deleted = 0
        errors = 0

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User).where(
                    (User.identity_data.isnot(None))
                    | (User.income_data.isnot(None))
                    | (User.guarantor_data.isnot(None))
                )
            )
            users = result.scalars().all()

            for user in users:
                changed = False

                # Identity
                id_data = user.identity_data or {}
                for key in _IDENTITY_KEYS:
                    r2_key = id_data.get(key)
                    if r2_key:
                        try:
                            await storage.delete_file(r2_key)
                            deleted += 1
                            id_data = {k: v for k, v in id_data.items() if k != key}
                            changed = True
                        except Exception as exc:
                            logger.warning("purge_legacy_docs: identity key=%s err=%s", r2_key, exc)
                            errors += 1
                if changed:
                    user.identity_data = id_data

                # Income
                inc_data = user.income_data or {}
                changed = False
                for key in _INCOME_KEYS:
                    r2_key = inc_data.get(key)
                    if r2_key:
                        try:
                            await storage.delete_file(r2_key)
                            deleted += 1
                            inc_data = {k: v for k, v in inc_data.items() if k != key}
                            changed = True
                        except Exception as exc:
                            logger.warning("purge_legacy_docs: income key=%s err=%s", r2_key, exc)
                            errors += 1
                if changed:
                    user.income_data = inc_data

                # Guarantor: visale/garantme use top-level keys; physical guarantor nests
                # storage_key inside files[*] (upload_guarantor_document schema).
                guar_data = user.guarantor_data or {}
                changed = False
                for key in _GUARANTOR_KEYS:
                    r2_key = guar_data.get(key)
                    if r2_key:
                        try:
                            await storage.delete_file(r2_key)
                            deleted += 1
                            guar_data = {k: v for k, v in guar_data.items() if k != key}
                            changed = True
                        except Exception as exc:
                            logger.warning("purge_legacy_docs: guarantor key=%s err=%s", r2_key, exc)
                            errors += 1
                purged_files = []
                for file_entry in guar_data.get("files", []):
                    r2_key = file_entry.get("storage_key")
                    if r2_key:
                        try:
                            await storage.delete_file(r2_key)
                            deleted += 1
                            file_entry = {k: v for k, v in file_entry.items() if k != "storage_key"}
                            changed = True
                        except Exception as exc:
                            logger.warning("purge_legacy_docs: guarantor file key=%s err=%s", r2_key, exc)
                            errors += 1
                    purged_files.append(file_entry)
                if changed and "files" in guar_data:
                    guar_data = {**guar_data, "files": purged_files}
                if changed:
                    user.guarantor_data = guar_data

            await db.commit()

        logger.info(
            "purge_legacy_verification_docs: deleted=%d errors=%d users_scanned=%d",
            deleted, errors, len(users),
        )
        return {"deleted": deleted, "errors": errors, "users_scanned": len(users)}

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        future = asyncio.run_coroutine_threadsafe(_purge_docs(), loop)
        return future.result()
    else:
        return asyncio.run(_purge_docs())
