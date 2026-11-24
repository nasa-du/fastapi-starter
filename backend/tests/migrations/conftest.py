"""Keep migration round-trip tests fully isolated from the development database.

The session-scoped autouse ``db`` fixture in ``tests/conftest.py`` connects to
the development database (and wipes the user table on teardown). Migration
tests drive their own disposable database, so the fixture is shadowed here with
a no-op to guarantee the development database is never touched by this package.
"""

from collections.abc import Generator

import pytest


@pytest.fixture(scope="session")
def db() -> Generator[None]:
    yield
