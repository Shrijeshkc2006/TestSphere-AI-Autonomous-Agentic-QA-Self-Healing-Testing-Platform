"""Celery application factory."""
from celery import Celery
from app.config import settings

celery_app = Celery(
    "testsphere",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,  # one task per worker — prevents resource exhaustion
    task_soft_time_limit=settings.TEST_TIMEOUT_SECONDS + 30,
    task_time_limit=settings.TEST_TIMEOUT_SECONDS + 60,
    result_expires=3600,
)
