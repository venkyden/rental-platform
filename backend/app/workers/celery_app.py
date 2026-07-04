from celery import Celery
from app.core.config import settings

redis_url = settings.REDIS_URL or "redis://redis:6379/0"
# For TLS Redis (rediss://, e.g. Upstash) verify the server certificate by
# default. Operators can override per-environment by setting ssl_cert_reqs in
# REDIS_URL explicitly (e.g. ssl_cert_reqs=none for a trusted/internal endpoint).
if redis_url.startswith("rediss://") and "ssl_cert_reqs=" not in redis_url:
    sep = "&" if "?" in redis_url else "?"
    redis_url += f"{sep}ssl_cert_reqs=required"

# Initialize Celery app
celery_app = Celery(
    "rental_platform_worker",
    broker=redis_url,
    backend=redis_url,
)

# Optional configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Survive brief Upstash blips. Exit non-zero on sustained broker outage.
    # Crashed worker flips Render state, fires notifyOnFail. ~3 min vs ~50.
    broker_connection_retry_on_startup=True,
    broker_connection_max_retries=10,
)

# Discover tasks automatically (you can add tasks later)
celery_app.autodiscover_tasks(["app.workers"])
