"""Round-trip tests for the drop-item migration against an isolated database.

Isolation contract (tasks/plan.md, Architecture Decisions 3 and 4):

- ``ITEM_REMOVAL_TEST_DATABASE_URL`` must point at the admin database of a
  dedicated, disposable PostgreSQL instance. A randomly named database is
  created on it and destroyed after each test.
- The Alembic URL is injected through the custom ``item_removal_database_url``
  option; ``app/alembic/env.py`` uses it only when present and keeps the global
  ``Settings`` behaviour otherwise.
- Before connecting, the target (host, port, database) is asserted to differ
  from the current ``DATABASE_URL`` so the development database can never be
  mistaken for the isolation target.
- Every test pins the isolated database's ``alembic_version`` immediately after
  each migration command that is a no-op on an already-migrated database and
  BEFORE any destructive ``downgrade``. If Alembic were ever misrouted away
  from the isolated database (e.g. if env.py stopped honouring the override),
  the pin assertion fails loudly while the development database has only seen
  no-op upgrades - never a downgrade.
- Without ``ITEM_REMOVAL_TEST_DATABASE_URL`` the whole module is skipped, so a
  plain ``uv run pytest`` can never reach an isolation instance by accident.
"""

import os
import secrets
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine, make_url

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[2]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"

ADMIN_URL = os.getenv("ITEM_REMOVAL_TEST_DATABASE_URL", "")
OLD_HEAD = "7125f2112706"  # last revision where the item table still exists

pytestmark = pytest.mark.skipif(
    ADMIN_URL == "",
    reason=(
        "ITEM_REMOVAL_TEST_DATABASE_URL is not configured; migration round-trip "
        "tests are skipped instead of guessing an isolation target"
    ),
)


def _normalized_target(url: make_url) -> tuple[str, int | None, str]:
    host = (url.host or "").lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        host = "localhost"
    return host, url.port, url.database or ""


def _assert_not_development_database() -> None:
    target = make_url(ADMIN_URL)
    current = make_url(str(settings.DATABASE_URL))
    if _normalized_target(target) == _normalized_target(current):
        pytest.fail(
            "ITEM_REMOVAL_TEST_DATABASE_URL points at the current DATABASE_URL "
            f"({current.host}:{current.port}/{current.database}); refusing to run "
            "destructive migration tests against it"
        )


@pytest.fixture()
def isolated_config() -> Generator[tuple[Config, str]]:
    _assert_not_development_database()

    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(BACKEND_DIR / "app" / "alembic"))

    # The backend ships psycopg 3, so both engines must use the psycopg driver
    # explicitly (a bare postgresql:// URL would resolve to psycopg2, which is
    # not installed). URL.__str__ masks the password, so the connection string
    # handed to Alembic must come from render_as_string(hide_password=False).
    admin_url = make_url(ADMIN_URL).set(drivername="postgresql+psycopg")
    db_name = f"item_removal_test_{secrets.token_hex(6)}"
    admin_engine = create_engine(admin_url)
    with admin_engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        conn.execute(text(f'CREATE DATABASE "{db_name}"'))

    target_url = admin_url.set(database=db_name).render_as_string(hide_password=False)
    config.set_main_option("item_removal_database_url", target_url)
    print(f"[item-removal] isolation target: {admin_url.host}:{admin_url.port}/{db_name}")

    try:
        yield config, target_url
    finally:
        with admin_engine.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)'))
        admin_engine.dispose()


@contextmanager
def _engine(url: str) -> Generator[Engine]:
    engine = create_engine(url)
    try:
        yield engine
    finally:
        engine.dispose()


def _single_head(config: Config) -> str:
    heads = ScriptDirectory.from_config(config).get_heads()
    assert len(heads) == 1, f"expected exactly one Alembic head, got {heads}"
    return heads[0]


def _applied_revision(engine: Engine) -> str:
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
    assert len(rows) == 1, f"expected a single alembic_version row, got {len(rows)}"
    return str(rows[0][0])


def _assert_isolation_pinned(url: str, expected_revision: str) -> None:
    """Pin Alembic routing to the isolated database before destructive steps."""
    with _engine(url) as engine:
        if "alembic_version" not in _table_names(engine):
            pytest.fail(
                "the isolated database has no alembic_version table; Alembic is "
                "not routing to it - aborting before any destructive step"
            )
        applied = _applied_revision(engine)
    assert applied == expected_revision, (
        f"isolated database is at revision {applied!r}, expected {expected_revision!r}"
    )


def _table_names(engine: Engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def _user_column_snapshot(engine: Engine) -> list[dict[str, object]]:
    return [
        {"name": column["name"], "type": str(column["type"]), "nullable": column["nullable"]}
        for column in inspect(engine).get_columns("user")
    ]


def _user_rows(engine: Engine) -> list[dict[str, object]]:
    with engine.connect() as conn:
        result = conn.execute(text('SELECT * FROM "user" ORDER BY id'))
        return [dict(row._mapping) for row in result]


def _pg_column(engine: Engine, table: str, column: str) -> tuple[str, int | None, str]:
    """Return (data_type, character_maximum_length, is_nullable) from the catalog."""
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT data_type, character_maximum_length, is_nullable "
                "FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = :table "
                "AND column_name = :column"
            ),
            {"table": table, "column": column},
        ).one()
    return str(row[0]), row[1], str(row[2])


def _seed_user_and_item_data(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                'INSERT INTO "user" (id, hashed_password, is_active, is_superuser, '
                "full_name, user_code, created_at) VALUES "
                "(gen_random_uuid(), 'seed-hash-u1', true, false, 'Seed User One', "
                "'seed_user_1', '2026-01-01T00:00:00Z'::timestamptz), "
                "(gen_random_uuid(), 'seed-hash-u2', false, false, NULL, "
                "'seed_user_2', NULL)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO item (id, title, description, owner_id, created_at) VALUES "
                "(gen_random_uuid(), 'Seed item 1', 'desc-1', "
                "(SELECT id FROM \"user\" WHERE user_code = 'seed_user_1'), "
                "'2026-01-02T00:00:00Z'::timestamptz), "
                "(gen_random_uuid(), 'Seed item 2', NULL, "
                "(SELECT id FROM \"user\" WHERE user_code = 'seed_user_1'), NULL), "
                "(gen_random_uuid(), 'Seed item 3', 'desc-3', "
                "(SELECT id FROM \"user\" WHERE user_code = 'seed_user_2'), "
                "'2026-02-03T04:05:06Z'::timestamptz)"
            )
        )


def test_upgrade_head_on_empty_database_drops_item(isolated_config: tuple[Config, str]) -> None:
    config, url = isolated_config
    head = _single_head(config)

    command.upgrade(config, "head")
    _assert_isolation_pinned(url, head)

    with _engine(url) as engine:
        assert "item" not in _table_names(engine)
        assert "user" in _table_names(engine)


def test_upgrade_from_old_head_with_data_drops_item_and_keeps_users(
    isolated_config: tuple[Config, str],
) -> None:
    config, url = isolated_config
    command.upgrade(config, OLD_HEAD)
    _assert_isolation_pinned(url, OLD_HEAD)

    with _engine(url) as engine:
        assert {"user", "item"} <= _table_names(engine)
        _seed_user_and_item_data(engine)
        with engine.connect() as conn:
            item_rows = conn.execute(text("SELECT COUNT(*) FROM item")).scalar_one()
            user_rows = conn.execute(text('SELECT COUNT(*) FROM "user"')).scalar_one()
        assert item_rows == 3
        assert user_rows == 2
        columns_before = _user_column_snapshot(engine)
        primary_key_before = inspect(engine).get_pk_constraint("user")["constrained_columns"]
        rows_before = _user_rows(engine)

    command.upgrade(config, "head")

    with _engine(url) as engine:
        assert "item" not in _table_names(engine)
        assert _user_column_snapshot(engine) == columns_before
        assert (
            inspect(engine).get_pk_constraint("user")["constrained_columns"]
            == primary_key_before
        )
        assert _user_rows(engine) == rows_before


def test_downgrade_recreates_empty_item_table_with_previous_structure(
    isolated_config: tuple[Config, str],
) -> None:
    config, url = isolated_config
    command.upgrade(config, "head")
    _assert_isolation_pinned(url, _single_head(config))

    command.downgrade(config, "-1")

    with _engine(url) as engine:
        assert _applied_revision(engine) == OLD_HEAD
        inspector = inspect(engine)
        assert "item" in _table_names(engine)
        with engine.connect() as conn:
            item_rows = conn.execute(text("SELECT COUNT(*) FROM item")).scalar_one()
        assert item_rows == 0  # downgrade restores structure only, never data

        columns = {column["name"] for column in inspector.get_columns("item")}
        assert columns == {"id", "title", "description", "owner_id", "created_at"}
        assert _pg_column(engine, "item", "id") == ("uuid", None, "NO")
        assert _pg_column(engine, "item", "title") == ("character varying", 255, "NO")
        assert _pg_column(engine, "item", "description") == ("character varying", 255, "YES")
        assert _pg_column(engine, "item", "owner_id") == ("uuid", None, "NO")
        assert _pg_column(engine, "item", "created_at") == (
            "timestamp with time zone",
            None,
            "YES",
        )

        primary_key = inspector.get_pk_constraint("item")
        assert primary_key["constrained_columns"] == ["id"]
        foreign_keys = inspector.get_foreign_keys("item")
        assert len(foreign_keys) == 1
        foreign_key = foreign_keys[0]
        assert foreign_key["referred_table"] == "user"
        assert foreign_key["constrained_columns"] == ["owner_id"]
        assert foreign_key["referred_columns"] == ["id"]
        assert foreign_key.get("options", {}).get("ondelete") == "CASCADE"


def test_downgrade_then_reupgrade_drops_item_again_and_preserves_users(
    isolated_config: tuple[Config, str],
) -> None:
    config, url = isolated_config
    command.upgrade(config, "head")
    _assert_isolation_pinned(url, _single_head(config))

    with _engine(url) as engine:
        _seed_user_and_item_data(engine)
        rows_before = _user_rows(engine)
        assert len(rows_before) == 2

    command.downgrade(config, "-1")

    with _engine(url) as engine:
        # Users survive the downgrade; the item table comes back empty.
        assert _user_rows(engine) == rows_before
        with engine.connect() as conn:
            item_rows = conn.execute(text("SELECT COUNT(*) FROM item")).scalar_one()
        assert item_rows == 0

    command.upgrade(config, "head")

    with _engine(url) as engine:
        assert "item" not in _table_names(engine)
        assert _user_rows(engine) == rows_before
