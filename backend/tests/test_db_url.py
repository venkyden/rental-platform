"""to_sync_url must always name the psycopg2 driver.

Regression: SQLAlchemy 2.1 made psycopg (v3) the default driver for a bare
``postgresql://`` URL. We only install psycopg2, so Alembic and the
check_db_conn.py pre-flight crashed with ModuleNotFoundError on any fresh
install that resolved to 2.1 (CI first, Render's next build after).
"""

import pytest
from sqlalchemy import create_engine

from app.core.db_url import to_sync_url

HOST = "user:pw@db.example:5432/roomivo"


@pytest.mark.parametrize(
    "url",
    [
        f"postgres://{HOST}",
        f"postgresql://{HOST}",
        f"postgresql+asyncpg://{HOST}",
        f"postgresql+psycopg://{HOST}",
        f"postgresql+psycopg2://{HOST}",
    ],
)
def test_every_postgres_form_becomes_psycopg2(url):
    assert to_sync_url(url) == f"postgresql+psycopg2://{HOST}"


def test_query_string_is_preserved():
    url = f"postgres://{HOST}?sslmode=require"
    assert to_sync_url(url) == f"postgresql+psycopg2://{HOST}?sslmode=require"


def test_non_postgres_url_is_untouched():
    assert to_sync_url("sqlite:///./test.db") == "sqlite:///./test.db"


def test_resolved_engine_uses_psycopg2_whatever_sqlalchemy_version():
    # create_engine imports the DBAPI without connecting, which is exactly
    # where the 2.1 default blew up. This holds on 2.0 and 2.1 alike.
    engine = create_engine(to_sync_url(f"postgresql+asyncpg://{HOST}"))
    try:
        assert engine.dialect.driver == "psycopg2"
    finally:
        engine.dispose()
