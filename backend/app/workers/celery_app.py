from celery import Celery
from celery.schedules import crontab
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
    backend=None, # Disable result backend to save Redis requests
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
    
    # Upstash/Serverless Redis Optimization: Reduce chatter and limits
    worker_send_task_events=False,
    task_send_sent_event=False,
    worker_prefetch_multiplier=1,
    worker_enable_remote_control=False,
    broker_pool_limit=1,
    broker_transport_options={
        "visibility_timeout": 3600,
        "max_connections": 5,
        "socket_timeout": 5,
    },
)

# Discover tasks automatically (you can add tasks later)
celery_app.autodiscover_tasks(["app.workers"])

# Periodic work. Dispatched by the dedicated roomivo-beat service (render.yaml);
# without a beat process running somewhere these tasks exist but nothing ever
# invokes them. Beat must stay at exactly one instance — a second would
# double-fire every entry below.
#
# Raw identity documents on the storage fallback path have no TTL of their own,
# so this sweep is the only thing that reclaims them. Every 15 minutes against a
# 1 hour retention bounds a stray ID image's life to ~1h15m.
celery_app.conf.beat_schedule = {
    "purge-stale-identity-docs": {
        "task": "app.workers.tasks.purge_stale_identity_docs_task",
        "schedule": crontab(minute="*/15"),
    },
}
