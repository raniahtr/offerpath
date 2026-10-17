"""Alembic runtime config: how migrations connect to the database.

The URL comes from DATABASE_URL (via app settings), never from alembic.ini, so no credentials
are committed. Tests can instead pass an open connection in `config.attributes["connection"]`.
"""

from logging.config import fileConfig

from sqlalchemy import create_engine
from sqlalchemy.engine import Connection

import app.models  # noqa: F401  # registers all models on Base.metadata
from alembic import context
from app.config import get_settings
from app.db import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The schema as defined by the SQLAlchemy models; used by `alembic revision --autogenerate`
# and `alembic check` to compare models against the database.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """`alembic upgrade head --sql`: print the SQL instead of running it."""
    context.configure(
        url=get_settings().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    engine = create_engine(get_settings().database_url)
    with engine.connect() as connection:
        _run(connection)
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
