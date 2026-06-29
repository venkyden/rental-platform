from celery import Celery
from app.core.config import settings

redis_url = settings.REDIS_URL or "redis://redis:6379/0"
if redis_url.startswith("rediss://") and "ssl_cert_reqs=" not in redis_url:
    sep = "&" if "?" in redis_url else "?"
    redis_url += f"{sep}ssl_cert_reqs=CERT_NONE"

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
)

# Discover tasks automatically (you can add tasks later)
celery_app.autodiscover_tasks(["app.workers"])
