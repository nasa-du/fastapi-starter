from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app.core.db import engine, init_db
from app.main import app
from app.models import User
from tests.utils.user import authentication_token_from_user_code
from tests.utils.utils import NORMAL_USER_CODE, get_superuser_token_headers


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session]:
    with Session(engine) as session:
        init_db(session)
        # Open Question 2 boundary (see tasks/todo.md, Task 1 record): only
        # users created by this test session may be cleaned up afterwards.
        # Snapshot every user_code present before the run (first superuser,
        # the controlled `test-user`, any pre-existing dev-database rows) and
        # at teardown delete only rows outside that snapshot. Pre-existing
        # users are never modified or removed here.
        pre_existing_codes: set[str] = set(session.exec(select(User.user_code)).all())
        yield session
        session_users = session.exec(
            select(User).where(col(User.user_code).not_in(pre_existing_codes))
        ).all()
        for user in session_users:
            session.delete(user)
        session.commit()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="module")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_user_code(
        client=client, user_code=NORMAL_USER_CODE, db=db
    )
