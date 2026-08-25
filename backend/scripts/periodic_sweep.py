"""
Periodic background sweep — entrypoint for the roomivo-periodic-sweep Render
Cron Job (render.yaml), replacing the old always-on roomivo-worker +
roomivo-beat Celery services. Runs the same low-frequency maintenance work
in-process and exits, rather than paying for two 24/7 instances (plus
continuous Upstash broker polling) to do a few seconds of work every 15 min.

Usage: python scripts/periodic_sweep.py
"""
import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger("periodic_sweep")


async def main() -> None:
    # SQLAlchemy configures every mapper it knows about on first query, not
    # just the ones the query touches — a relationship() elsewhere that
    # string-references a model class this process never imported (e.g.
    # TrustDossier -> "Credential") blows up at query time, not import time.
    # app/models/__init__.py doesn't cover every model (the full app avoids
    # this because its routers happen to import the rest); import everything
    # explicitly here rather than depend on that.
    import app.models  # noqa: F401
    import app.models.credential  # noqa: F401
    import app.models.feature_flag  # noqa: F401
    import app.models.feedback  # noqa: F401
    import app.models.webhook_subscriptions  # noqa: F401

    from app.workers.tasks import purge_stale_identity_docs, sweep_pending_dpe_properties

    # Both awaited on this single event loop, not two separate asyncio.run()
    # calls — the DB session factory's connection pool holds asyncpg
    # connections that are bound to whichever loop created them, so reusing
    # it across a second, later-created loop raises "attached to a different
    # loop" / "Event loop is closed".
    identity_result = await purge_stale_identity_docs()
    logger.info("purge_stale_identity_docs: %s", identity_result)

    dpe_result = await sweep_pending_dpe_properties()
    logger.info("sweep_pending_dpe_properties: %s", dpe_result)


if __name__ == "__main__":
    asyncio.run(main())
