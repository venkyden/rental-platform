"""
Celery tasks (durable background queue).

These run in the Celery worker process (see docker-compose `worker` service)
using the Redis broker configured in ``celery_app``. They are the durable
path for slow/blocking work; request handlers that cannot reach a broker fall
back to FastAPI ``BackgroundTasks`` instead.
"""

import logging
import os
import uuid as _uuid
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
    name="app.workers.tasks.retry_pending_dpe_task",
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # 5 min between retries
    acks_late=True,
)
def retry_pending_dpe_task(self, property_id: str, dpe_number: str) -> dict:
    """
    Retry ADEME DPE lookup for a property whose last attempt returned PENDING (PR-6).

    On success: updates ownership_data to HIGH and sets dpe_rating.
    On DPENotFound: updates to UNVERIFIED.
    On ADEMEUnavailable: retries up to max_retries times (5 min apart).
    """
    import asyncio
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.property import Property
    from app.services.ademe_dpe import (
        lookup_dpe,
        ADEMEUnavailable,
        DPENotFound,
        InvalidDPENumber,
    )

    async def _retry():
        try:
            dpe = await lookup_dpe(dpe_number)
        except InvalidDPENumber:
            logger.warning("retry_pending_dpe: invalid DPE number %r — skipping", dpe_number)
            return {"status": "invalid_dpe_number"}
        except DPENotFound:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(Property).where(Property.id == _uuid.UUID(property_id))
                )
                prop = result.scalar_one_or_none()
                if prop is None:
                    logger.warning(
                        "retry_pending_dpe: property %s no longer exists — dropping task",
                        property_id,
                    )
                    return {"status": "not_found"}
                prop.ownership_data = {
                    **(prop.ownership_data or {}),
                    "dpe_assurance": "UNVERIFIED",
                    "dpe_number": dpe_number.strip(),
                }
                await db.commit()
            logger.info("retry_pending_dpe: DPE %r not found → UNVERIFIED (property %s)", dpe_number, property_id)
            return {"status": "unverified"}
        except ADEMEUnavailable as exc:
            logger.warning("retry_pending_dpe: ADEME still unavailable for %s — scheduling retry", property_id)
            raise self.retry(exc=exc)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Property).where(Property.id == _uuid.UUID(property_id))
            )
            prop = result.scalar_one_or_none()
            if prop is None:
                logger.warning(
                    "retry_pending_dpe: property %s no longer exists — dropping task",
                    property_id,
                )
                return {"status": "not_found"}
            prop.dpe_rating = dpe.energy_class
            prop.ownership_data = {
                **(prop.ownership_data or {}),
                "dpe_assurance": "HIGH",
                "dpe_number": dpe.dpe_number,
                "dpe_class": dpe.energy_class,
                "dpe_valid_until": dpe.valid_until.isoformat() if dpe.valid_until else None,
                "dpe_established": dpe.established_date.isoformat() if dpe.established_date else None,
                "dpe_expired": dpe.expired,
                "dpe_ademe_address": dpe.address_line,
            }
            await db.commit()
        logger.info(
            "retry_pending_dpe: resolved property %s → class %s",
            property_id,
            dpe.energy_class,
        )
        return {"status": "resolved", "dpe_class": dpe.energy_class}

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        future = asyncio.run_coroutine_threadsafe(_retry(), loop)
        return future.result()
    else:
        return asyncio.run(_retry())
