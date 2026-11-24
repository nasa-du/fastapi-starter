import uuid

from sqlmodel import Session

from app.models import User, UserCreate, UserUpdate


def test_new_user_ids_are_uuid7(db: Session) -> None:
    user = User(user_code="uuid7-check", hashed_password="x")
    db.add(user)
    db.flush()

    assert uuid.UUID(str(user.id)).version == 7


def test_user_code_strips_surrounding_whitespace() -> None:
    user_in = UserCreate(user_code="  padded-code  ", password="password123")
    assert user_in.user_code == "padded-code"
    update_in = UserUpdate(user_code="  padded-code  ")
    assert update_in.user_code == "padded-code"
