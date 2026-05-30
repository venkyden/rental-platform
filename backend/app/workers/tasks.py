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
