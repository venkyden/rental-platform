from celery import Celery
from app.core.config import settings

# Initialize Celery app
celery_app = Celery(
    "rental_platform_worker",
    broker=settings.REDIS_URL or "redis://redis:6379/0",
    backend=settings.REDIS_URL or "redis://redis:6379/0",
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
