import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.security import verify_password
from app.models import User, UserCreate
from tests.utils.user import create_random_user
from tests.utils.utils import NORMAL_USER_CODE, random_lower_string, random_user_code


def test_get_users_superuser_me(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(f"{settings.API_V1_STR}/users/me", headers=superuser_token_headers)
    current_user = r.json()
    assert current_user
    assert current_user["is_active"] is True
    assert current_user["is_superuser"]
    assert current_user["user_code"] == settings.FIRST_SUPERUSER_CODE


def test_get_users_normal_user_me(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(f"{settings.API_V1_STR}/users/me", headers=normal_user_token_headers)
    current_user = r.json()
    assert current_user
    assert current_user["is_active"] is True
    assert current_user["is_superuser"] is False
    assert current_user["user_code"] == NORMAL_USER_CODE


def test_create_user_new_user_code(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    data = {"user_code": user_code, "password": password}
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=superuser_token_headers,
        json=data,
    )
    assert 200 <= r.status_code < 300
    created_user = r.json()
    user = crud.get_user_by_code(session=db, user_code=user_code)
    assert user
    assert user.user_code == created_user["user_code"]


def test_get_existing_user_as_superuser(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    user_id = user.id
    r = client.get(
        f"{settings.API_V1_STR}/users/{user_id}",
        headers=superuser_token_headers,
    )
    assert 200 <= r.status_code < 300
    api_user = r.json()
    existing_user = crud.get_user_by_code(session=db, user_code=user_code)
    assert existing_user
    assert existing_user.user_code == api_user["user_code"]


def test_get_non_existing_user_as_superuser(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/users/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
    assert r.json() == {"detail": "User not found"}


def test_get_existing_user_current_user(client: TestClient, db: Session) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    user_id = user.id

    login_data = {
        "username": user_code,
        "password": password,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    a_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {a_token}"}

    r = client.get(
        f"{settings.API_V1_STR}/users/{user_id}",
        headers=headers,
    )
    assert 200 <= r.status_code < 300
    api_user = r.json()
    existing_user = crud.get_user_by_code(session=db, user_code=user_code)
    assert existing_user
    assert existing_user.user_code == api_user["user_code"]


def test_get_existing_user_permissions_error(
    db: Session,
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    user = create_random_user(db)

    r = client.get(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert r.json() == {"detail": "The user doesn't have enough privileges"}


def test_get_non_existing_user_permissions_error(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
) -> None:
    user_id = uuid.uuid4()

    r = client.get(
        f"{settings.API_V1_STR}/users/{user_id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert r.json() == {"detail": "The user doesn't have enough privileges"}


def test_create_user_existing_user_code(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    crud.create_user(session=db, user_create=user_in)
    data = {"user_code": user_code, "password": password}
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=superuser_token_headers,
        json=data,
    )
    created_user = r.json()
    assert r.status_code == 400
    assert "_id" not in created_user


def test_create_user_by_normal_user(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    data = {"user_code": user_code, "password": password}
    r = client.post(
        f"{settings.API_V1_STR}/users/",
        headers=normal_user_token_headers,
        json=data,
    )
    assert r.status_code == 403


def test_retrieve_users(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    crud.create_user(session=db, user_create=user_in)

    user_code2 = random_user_code()
    password2 = random_lower_string()
    user_in2 = UserCreate(user_code=user_code2, password=password2)
    crud.create_user(session=db, user_create=user_in2)

    r = client.get(f"{settings.API_V1_STR}/users/", headers=superuser_token_headers)
    all_users = r.json()

    assert len(all_users["data"]) > 1
    assert "count" in all_users
    for item in all_users["data"]:
        assert "user_code" in item


def test_update_user_me(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    full_name = "Updated Name"
    data = {"full_name": full_name}
    r = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=normal_user_token_headers,
        json=data,
    )
    assert r.status_code == 200
    updated_user = r.json()
    assert updated_user["full_name"] == full_name

    user_query = select(User).where(User.user_code == NORMAL_USER_CODE)
    user_db = db.exec(user_query).first()
    assert user_db
    assert user_db.full_name == full_name


def test_update_user_me_cannot_change_user_code(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    data = {"user_code": random_user_code()}
    r = client.patch(
        f"{settings.API_V1_STR}/users/me",
        headers=normal_user_token_headers,
        json=data,
    )
    assert r.status_code == 200
    current_user = r.json()
    assert current_user["user_code"] == NORMAL_USER_CODE

    user_db = db.exec(
        select(User).where(User.user_code == NORMAL_USER_CODE)
    ).first()
    assert user_db


def test_update_password_me(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    new_password = random_lower_string()
    data = {
        "current_password": settings.FIRST_SUPERUSER_PASSWORD,
        "new_password": new_password,
    }
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 200
    updated_user = r.json()
    assert updated_user["message"] == "Password updated successfully"

    user_query = select(User).where(User.user_code == settings.FIRST_SUPERUSER_CODE)
    user_db = db.exec(user_query).first()
    assert user_db
    assert user_db.user_code == settings.FIRST_SUPERUSER_CODE
    verified, _ = verify_password(new_password, user_db.hashed_password)
    assert verified

    # Revert to the old password to keep consistency in test
    old_data = {
        "current_password": new_password,
        "new_password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=superuser_token_headers,
        json=old_data,
    )
    db.refresh(user_db)

    assert r.status_code == 200
    verified, _ = verify_password(
        settings.FIRST_SUPERUSER_PASSWORD, user_db.hashed_password
    )
    assert verified


def test_update_password_me_incorrect_password(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    new_password = random_lower_string()
    data = {"current_password": new_password, "new_password": new_password}
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 400
    updated_user = r.json()
    assert updated_user["detail"] == "Incorrect password"


def test_update_password_me_same_password_error(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "current_password": settings.FIRST_SUPERUSER_PASSWORD,
        "new_password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.patch(
        f"{settings.API_V1_STR}/users/me/password",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 400
    updated_user = r.json()
    assert (
        updated_user["detail"] == "New password cannot be the same as the current one"
    )


def test_signup_endpoint_removed(client: TestClient) -> None:
    data = {"user_code": random_user_code(), "password": random_lower_string()}
    r = client.post(
        f"{settings.API_V1_STR}/users/signup",
        json=data,
    )
    # The route is gone; the remaining /users/{user_id} pattern makes Starlette
    # answer 405 (method not allowed) instead of a plain 404.
    assert r.status_code in (404, 405)
    # The signup route must not be registered anywhere in the OpenAPI schema
    openapi_paths = client.get(f"{settings.API_V1_STR}/openapi.json").json()["paths"]
    assert not any("signup" in path for path in openapi_paths)


def test_update_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)

    data = {"full_name": "Updated_full_name"}
    r = client.patch(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 200
    updated_user = r.json()

    assert updated_user["full_name"] == "Updated_full_name"

    user_query = select(User).where(User.user_code == user_code)
    user_db = db.exec(user_query).first()
    db.refresh(user_db)
    assert user_db
    assert user_db.full_name == "Updated_full_name"


def test_update_user_not_exists(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"full_name": "Updated_full_name"}
    r = client.patch(
        f"{settings.API_V1_STR}/users/{uuid.uuid4()}",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "The user with this id does not exist in the system"


def test_update_user_user_code_exists(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)

    user_code2 = random_user_code()
    password2 = random_lower_string()
    user_in2 = UserCreate(user_code=user_code2, password=password2)
    user2 = crud.create_user(session=db, user_create=user_in2)

    data = {"user_code": user2.user_code}
    r = client.patch(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "User with this user_code already exists"


def test_delete_user_me(client: TestClient, db: Session) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    user_id = user.id

    login_data = {
        "username": user_code,
        "password": password,
    }
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    tokens = r.json()
    a_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {a_token}"}

    r = client.delete(
        f"{settings.API_V1_STR}/users/me",
        headers=headers,
    )
    assert r.status_code == 200
    deleted_user = r.json()
    assert deleted_user["message"] == "User deleted successfully"
    result = db.exec(select(User).where(User.id == user_id)).first()
    assert result is None

    user_query = select(User).where(User.id == user_id)
    user_db = db.execute(user_query).first()
    assert user_db is None


def test_delete_user_me_as_superuser(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.delete(
        f"{settings.API_V1_STR}/users/me",
        headers=superuser_token_headers,
    )
    assert r.status_code == 403
    response = r.json()
    assert response["detail"] == "Super users are not allowed to delete themselves"


def test_delete_user_super_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    user_id = user.id
    r = client.delete(
        f"{settings.API_V1_STR}/users/{user_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    deleted_user = r.json()
    assert deleted_user["message"] == "User deleted successfully"
    result = db.exec(select(User).where(User.id == user_id)).first()
    assert result is None


def test_delete_user_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.delete(
        f"{settings.API_V1_STR}/users/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "User not found"


def test_delete_user_current_super_user_error(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    super_user = crud.get_user_by_code(
        session=db, user_code=settings.FIRST_SUPERUSER_CODE
    )
    assert super_user
    user_id = super_user.id

    r = client.delete(
        f"{settings.API_V1_STR}/users/{user_id}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "Super users are not allowed to delete themselves"


def test_delete_user_without_privileges(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)

    r = client.delete(
        f"{settings.API_V1_STR}/users/{user.id}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "The user doesn't have enough privileges"


def test_reset_user_password(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user = create_random_user(db)

    r = client.post(
        f"{settings.API_V1_STR}/users/{user.id}/reset-password",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    new_password = r.json()["new_password"]
    assert len(new_password) >= 16

    # The temporary password can be used to log in
    login_data = {"username": user.user_code, "password": new_password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    assert r.status_code == 200
    assert "access_token" in r.json()

    # Only the hash is persisted, the plaintext never is
    db.refresh(user)
    assert user.hashed_password != new_password
    verified, _ = verify_password(new_password, user.hashed_password)
    assert verified


def test_reset_user_password_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/users/{uuid.uuid4()}/reset-password",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404
    assert r.json() == {"detail": "User not found"}


def test_reset_user_password_without_privileges(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    user = create_random_user(db)

    r = client.post(
        f"{settings.API_V1_STR}/users/{user.id}/reset-password",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 403
    assert r.json() == {"detail": "The user doesn't have enough privileges"}


def test_reset_user_password_for_deactivated_user(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    user = create_random_user(db)
    user.is_active = False
    db.add(user)
    db.commit()

    r = client.post(
        f"{settings.API_V1_STR}/users/{user.id}/reset-password",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    new_password = r.json()["new_password"]
    assert len(new_password) >= 16

    db.refresh(user)
    verified, _ = verify_password(new_password, user.hashed_password)
    assert verified
