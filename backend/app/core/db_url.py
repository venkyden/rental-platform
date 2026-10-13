"""Database URL helpers for the synchronous (non-asyncio) code paths.

The app itself talks to Postgres through asyncpg (see app.core.database).
Two things still need a *sync* driver: Alembic migrations and the
pre-flight connectivity check in check_db_conn.py.

They used to strip the URL down to a bare ``postgresql://`` and let
SQLAlchemy pick the default driver. SQLAlchemy 2.1 changed that default
from psycopg2 to psycopg (v3), which we do not install — so on any fresh
install that resolved to 2.1, migrations died with
``ModuleNotFoundError: No module named 'psycopg'``. Naming the driver
explicitly makes the result independent of the SQLAlchemy version.

Kept free of app imports so check_db_conn.py can use it before settings
or the async engine are loaded.
"""

SYNC_DRIVER_PREFIX = "postgresql+psycopg2://"

_PREFIXES = (
    "postgresql+asyncpg://",
    "postgresql+psycopg2://",
    "postgresql+psycopg://",
    "postgresql://",
    "postgres://",
)


def to_sync_url(url: str) -> str:
    """Return ``url`` rewritten to use the psycopg2 driver.

    Accepts the forms we see in the wild: Render's ``postgres://``, a bare
    ``postgresql://``, and the app's own ``postgresql+asyncpg://``. Any other
    scheme (e.g. sqlite) is returned unchanged.
    """
    for prefix in _PREFIXES:
        if url.startswith(prefix):
            return SYNC_DRIVER_PREFIX + url[len(prefix):]
    return url
