from datetime import timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlmodel import Session

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.crud import DUMMY_HASH, create_user
from app.models import User, UserCreate
from tests.utils.utils import random_lower_string, random_user_code


def test_get_access_token(client: TestClient) -> None:
    login_data = {
        "username": settings.FIRST_SUPERUSER_CODE,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    assert r.status_code == 200
    assert "access_token" in tokens
    assert tokens["access_token"]


def test_get_access_token_incorrect_password(client: TestClient) -> None:
    login_data = {
        "username": settings.FIRST_SUPERUSER_CODE,
        "password": "incorrect",
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "AUTH_LOGIN_INVALID"


def test_use_access_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=superuser_token_headers,
    )
    result = r.json()
    assert r.status_code == 200
    assert "user_code" in result


def test_login_with_user_code(client: TestClient, db: Session) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    create_user(session=db, user_create=user_in)

    login_data = {"username": user_code, "password": password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_with_unique_full_name(client: TestClient, db: Session) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    full_name = random_lower_string()
    user_in = UserCreate(
        user_code=user_code, full_name=full_name, password=password
    )
    create_user(session=db, user_create=user_in)

    login_data = {"username": full_name, "password": password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_with_ambiguous_full_name(client: TestClient, db: Session) -> None:
    full_name = random_lower_string()
    password = random_lower_string()
    for _ in range(2):
        user_in = UserCreate(
            user_code=random_user_code(), full_name=full_name, password=password
        )
        create_user(session=db, user_create=user_in)

    login_data = {"username": full_name, "password": password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "AUTH_LOGIN_NAME_CONFLICT"
    assert r.json()["detail"]["message"] == (
        "Multiple users share this name, please log in with your user code"
    )


def test_login_incorrect_credentials_unified_message(
    client: TestClient, db: Session
) -> None:
    # Wrong password for an existing user
    login_data = {
        "username": settings.FIRST_SUPERUSER_CODE,
        "password": "incorrect",
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 400
    wrong_password_detail = r.json()["detail"]

    # Unknown identifier yields the same message
    login_data = {"username": random_user_code(), "password": "incorrect"}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == wrong_password_detail["code"]
    assert wrong_password_detail["code"] == "AUTH_LOGIN_INVALID"
    assert wrong_password_detail["message"] == "Incorrect user code/name or password"


def test_login_inactive_user(client: TestClient, db: Session) -> None:
    user_code = random_user_code()
    user_in = UserCreate(
        user_code=user_code, password=random_lower_string(), is_active=False
    )
    create_user(session=db, user_create=user_in)

    login_data = {"username": user_code, "password": user_in.password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)

    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "AUTH_LOGIN_INACTIVE"
    assert r.json()["detail"]["message"] == "Inactive user"


def test_login_unknown_identifier_runs_dummy_hash(
    client: TestClient, db: Session
) -> None:
    """The dummy hash must still be verified for unknown identifiers (timing)."""
    with patch("app.crud.verify_password") as verify_spy:
        login_data = {"username": random_user_code(), "password": "incorrect"}
        r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)

    assert r.status_code == 400
    verify_spy.assert_called_once()
    assert verify_spy.call_args.args[1] == DUMMY_HASH


def test_password_recovery_endpoints_removed(client: TestClient) -> None:
    r = client.post(f"{settings.API_V1_STR}/password-recovery/some-identifier")
    assert r.status_code == 404

    r = client.post(f"{settings.API_V1_STR}/reset-password/", json={})
    assert r.status_code == 404


def test_login_with_bcrypt_password_upgrades_to_argon2(
    client: TestClient, db: Session
) -> None:
    """Test that logging in with a bcrypt password hash upgrades it to argon2."""
    user_code = random_user_code()
    password = random_lower_string()

    # Create a bcrypt hash directly (simulating legacy password)
    bcrypt_hasher = BcryptHasher()
    bcrypt_hash = bcrypt_hasher.hash(password)
    assert bcrypt_hash.startswith("$2")  # bcrypt hashes start with $2

    user = User(user_code=user_code, hashed_password=bcrypt_hash, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    assert user.hashed_password.startswith("$2")

    login_data = {"username": user_code, "password": password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 200
    tokens = r.json()
    assert "access_token" in tokens

    db.refresh(user)

    # Verify the hash was upgraded to argon2
    assert user.hashed_password.startswith("$argon2")

    verified, updated_hash = verify_password(password, user.hashed_password)
    assert verified
    # Should not need another update since it's already argon2
    assert updated_hash is None


def test_login_with_argon2_password_keeps_hash(client: TestClient, db: Session) -> None:
    """Test that logging in with an argon2 password hash does not update it."""
    user_code = random_user_code()
    password = random_lower_string()

    # Create an argon2 hash (current default)
    argon2_hash = get_password_hash(password)
    assert argon2_hash.startswith("$argon2")

    # Create user with argon2 hash
    user = User(user_code=user_code, hashed_password=argon2_hash, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)

    original_hash = user.hashed_password

    login_data = {"username": user_code, "password": password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 200
    tokens = r.json()
    assert "access_token" in tokens

    db.refresh(user)

    assert user.hashed_password == original_hash
    assert user.hashed_password.startswith("$argon2")


def test_token_for_nonexistent_user_returns_403(client: TestClient) -> None:
    """A valid-shaped JWT whose subject references a missing user is an
    authentication failure: it must return 403 (like the invalid-token branch)
    so the SPA's interceptor logs the user out, not 404 which would leave the
    client in a broken half-authenticated state (e.g. after a DB rebuild)."""
    token = create_access_token(
        "00000000-0000-7000-8000-000000000000", timedelta(minutes=30)
    )
    r = client.get(
        f"{settings.API_V1_STR}/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "User not found"
