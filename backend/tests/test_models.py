import uuid

from sqlmodel import Session

from app.models import Item, User


def test_new_user_and_item_ids_are_uuid7(db: Session) -> None:
    user = User(email="uuid7-check@example.com", hashed_password="x")
    item = Item(title="uuid7-check", owner_id=user.id)
    db.add(user)
    db.add(item)
    db.flush()

    assert uuid.UUID(str(user.id)).version == 7
    assert uuid.UUID(str(item.id)).version == 7
