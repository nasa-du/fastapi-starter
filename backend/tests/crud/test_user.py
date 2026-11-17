import pytest
from fastapi.encoders import jsonable_encoder
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlmodel import Session

from app import crud
from app.core.security import verify_password
from app.models import User, UserCreate, UserUpdate
from tests.utils.utils import random_lower_string, random_user_code


def test_create_user(db: Session) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    assert user.user_code == user_code
    assert hasattr(user, "hashed_password")


def test_authenticate_user(db: Session) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    authenticated_user = crud.authenticate(
        session=db, identifier=user_code, password=password
    )
    assert authenticated_user
    assert user.user_code == authenticated_user.user_code


def test_authenticate_user_by_unique_full_name(db: Session) -> None:
    full_name = random_lower_string()
    password = random_lower_string()
    user_in = UserCreate(
        user_code=random_user_code(), full_name=full_name, password=password
    )
    created_user = crud.create_user(session=db, user_create=user_in)
    authenticated_user = crud.authenticate(
        session=db, identifier=full_name, password=password
    )
    assert authenticated_user
    assert created_user.id == authenticated_user.id


def test_authenticate_user_ambiguous_full_name(db: Session) -> None:
    full_name = random_lower_string()
    password = random_lower_string()
    for _ in range(2):
        user_in = UserCreate(
            user_code=random_user_code(), full_name=full_name, password=password
        )
        crud.create_user(session=db, user_create=user_in)
    with pytest.raises(crud.UserAmbiguousIdentifierError):
        crud.authenticate(session=db, identifier=full_name, password=password)


def test_not_authenticate_user(db: Session) -> None:
    identifier = random_user_code()
    password = random_lower_string()
    user = crud.authenticate(session=db, identifier=identifier, password=password)
    assert user is None


def test_check_if_user_is_active(db: Session) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    assert user.is_active is True


def test_check_if_user_is_active_inactive(db: Session) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password, is_active=False)
    user = crud.create_user(session=db, user_create=user_in)
    assert user.is_active is False


def test_check_if_user_is_superuser(db: Session) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password, is_superuser=True)
    user = crud.create_user(session=db, user_create=user_in)
    assert user.is_superuser is True


def test_check_if_user_is_superuser_normal_user(db: Session) -> None:
    user_code = random_user_code()
    password = random_lower_string()
    user_in = UserCreate(user_code=user_code, password=password)
    user = crud.create_user(session=db, user_create=user_in)
    assert user.is_superuser is False


def test_get_user(db: Session) -> None:
    password = random_lower_string()
    user_code = random_user_code()
    user_in = UserCreate(user_code=user_code, password=password, is_superuser=True)
    user = crud.create_user(session=db, user_create=user_in)
    user_2 = db.get(User, user.id)
    assert user_2
    assert user.user_code == user_2.user_code
    assert jsonable_encoder(user) == jsonable_encoder(user_2)


def test_update_user(db: Session) -> None:
    password = random_lower_string()
    user_code = random_user_code()
    user_in = UserCreate(user_code=user_code, password=password, is_superuser=True)
    user = crud.create_user(session=db, user_create=user_in)
    new_password = random_lower_string()
    user_in_update = UserUpdate(password=new_password, is_superuser=True)
    if user.id is not None:
        crud.update_user(session=db, db_user=user, user_in=user_in_update)
    user_2 = db.get(User, user.id)
    assert user_2
    assert user.user_code == user_2.user_code
    verified, _ = verify_password(new_password, user_2.hashed_password)
    assert verified


def test_authenticate_user_with_bcrypt_upgrades_to_argon2(db: Session) -> None:
    """Test that a user with bcrypt password hash gets upgraded to argon2 on login."""
    user_code = random_user_code()
    password = random_lower_string()

    # Create a bcrypt hash directly (simulating legacy password)
    bcrypt_hasher = BcryptHasher()
    bcrypt_hash = bcrypt_hasher.hash(password)
    assert bcrypt_hash.startswith("$2")  # bcrypt hashes start with $2

    # Create user with bcrypt hash directly in the database
    user = User(user_code=user_code, hashed_password=bcrypt_hash)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Verify the hash is bcrypt before authentication
    assert user.hashed_password.startswith("$2")

    # Authenticate - this should upgrade the hash to argon2
    authenticated_user = crud.authenticate(
        session=db, identifier=user_code, password=password
    )
    assert authenticated_user
    assert authenticated_user.user_code == user_code

    db.refresh(authenticated_user)

    # Verify the hash was upgraded to argon2
    assert authenticated_user.hashed_password.startswith("$argon2")

    verified, updated_hash = verify_password(
        password, authenticated_user.hashed_password
    )
    assert verified
    # Should not need another update since it's already argon2
    assert updated_hash is None
