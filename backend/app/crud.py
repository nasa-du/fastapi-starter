from typing import Any

from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.models import User, UserCreate, UserUpdate


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_code(*, session: Session, user_code: str) -> User | None:
    statement = select(User).where(User.user_code == user_code)
    session_user = session.exec(statement).first()
    return session_user


def get_users_by_full_name(*, session: Session, full_name: str) -> list[User]:
    statement = select(User).where(User.full_name == full_name)
    return list(session.exec(statement).all())


class UserAmbiguousIdentifierError(Exception):
    """Raised when a login identifier matches multiple users by full_name."""


# Dummy hash to use for timing attack prevention when user is not found
# This is an Argon2 hash of a random password, used to ensure constant-time comparison
DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def authenticate(*, session: Session, identifier: str, password: str) -> User | None:
    """Authenticate by user_code first, then by (unique) full_name.

    Raises UserAmbiguousIdentifierError when the identifier matches several
    users by full_name; the caller must ask for the user code instead.
    """
    db_user = get_user_by_code(session=session, user_code=identifier)
    if not db_user:
        matches = get_users_by_full_name(session=session, full_name=identifier)
        if len(matches) > 1:
            raise UserAmbiguousIdentifierError
        db_user = matches[0] if matches else None
    if not db_user:
        # Prevent timing attacks by running password verification even when
        # the identifier matches no user
        verify_password(password, DUMMY_HASH)
        return None
    verified, updated_password_hash = verify_password(password, db_user.hashed_password)
    if not verified:
        return None
    if updated_password_hash:
        db_user.hashed_password = updated_password_hash
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
    return db_user
