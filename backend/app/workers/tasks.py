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
                    user.identity_data = id_data  # type: ignore

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
                    user.income_data = inc_data  # type: ignore

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
                    user.guarantor_data = guar_data  # type: ignore

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
                prop.ownership_data = {  # type: ignore
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
            prop.dpe_rating = dpe.energy_class  # type: ignore
            prop.ownership_data = {  # type: ignore
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


# Raw identity documents are only useful for the ~10 minute face-match window
# (Redis TTL is 600s). One hour is a generous safety margin for a slow user on
# the storage fallback path, after which any surviving object is garbage.
IDENTITY_DOC_RETENTION_SECONDS = 3600

# Transient-only prefixes. verification/guarantor/ is deliberately excluded: its
# keys are referenced by guarantor_data["files"] and are meant to persist.
_TRANSIENT_IDENTITY_PREFIXES = (
    "verification/identity/",
    "verification/intl/identity/",
)


@celery_app.task(
    name="app.workers.tasks.purge_stale_identity_docs_task",
    bind=True,
    max_retries=1,
)
def purge_stale_identity_docs_task(self) -> dict:
    """
    Age-sweep raw identity documents left behind by the storage fallback path.

    The Redis path expires on its own (600s TTL), but when Redis is unavailable
    the document goes to R2/disk instead — where nothing expires it. Two ways it
    then survives forever:

      1. the user abandons the flow before the selfie, so identity_data still
         points at a raw ID image nobody will ever consume;
      2. the process dies between upload and commit, or the delete is swallowed
         as a warning, leaving an object no row references at all.

    Case 2 is invisible to any database-driven purge, which is why this sweeps
    storage by object age. Dangling identity_data pointers are cleared in the
    same pass so the record stops claiming to hold a document.
    """
    import asyncio
    from datetime import datetime, timedelta
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.core.timeutils import naive_utcnow
    from app.models.user import User
    from app.services.storage import storage

    async def _purge():
        deleted = 0
        for prefix in _TRANSIENT_IDENTITY_PREFIXES:
            try:
                deleted += await storage.purge_stale_objects(
                    prefix, IDENTITY_DOC_RETENTION_SECONDS
                )
            except Exception as exc:
                logger.warning("purge_stale_identity_docs: sweep %s failed: %s", prefix, exc)

        # Drop pointers whose object this sweep has just aged out.
        cutoff = naive_utcnow() - timedelta(seconds=IDENTITY_DOC_RETENTION_SECONDS)
        cleared = 0
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.identity_data.isnot(None)))
            for user in result.scalars().all():
                data = user.identity_data or {}
                if not (data.get("storage_key") or data.get("file_url")):
                    continue
                raw_date = data.get("upload_date")
                if not raw_date:
                    continue
                try:
                    uploaded = datetime.fromisoformat(str(raw_date))
                except ValueError:
                    continue
                if uploaded >= cutoff:
                    continue
                user.identity_data = {
                    k: v for k, v in data.items() if k not in ("storage_key", "file_url")
                }
                cleared += 1
            if cleared:
                await db.commit()

        logger.info(
            "purge_stale_identity_docs: objects_deleted=%d pointers_cleared=%d", deleted, cleared
        )
        return {"objects_deleted": deleted, "pointers_cleared": cleared}

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        future = asyncio.run_coroutine_threadsafe(_purge(), loop)
        return future.result()
    else:
        return asyncio.run(_purge())
