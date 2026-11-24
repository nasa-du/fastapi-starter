import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, func, select

from app import crud
from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
)
from app.core.security import (
    generate_random_password,
    get_password_hash,
    verify_password,
)
from app.models import (
    Message,
    ResetPasswordResponse,
    UpdatePassword,
    User,
    UserCreate,
    UserPublic,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UsersPublic,
)
def read_users(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Retrieve users.
    """

    count_statement = select(func.count()).select_from(User)
    count = session.exec(count_statement).one()

    statement = (
        select(User).order_by(col(User.created_at).desc()).offset(skip).limit(limit)
    )
    users = session.exec(statement).all()

    users_public = [UserPublic.model_validate(user) for user in users]
    return UsersPublic(data=users_public, count=count)


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=UserPublic
)
def create_user(*, session: SessionDep, user_in: UserCreate) -> Any:
    """
    Create new user.
    """
    user = crud.get_user_by_code(session=session, user_code=user_in.user_code)
    if user:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "USERS_CODE_ALREADY_EXISTS",
                "message": "The user with this user_code already exists in the system.",
            },
        )

    user = crud.create_user(session=session, user_create=user_in)
    return user


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> Any:
    """
    Update own user.
    """

    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Any:
    """
    Update own password.
    """
    verified, _ = verify_password(body.current_password, current_user.hashed_password)
    if not verified:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "USERS_PASSWORD_INCORRECT",
                "message": "Incorrect password",
            },
        )
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "USERS_PASSWORD_UNCHANGED",
                "message": "New password cannot be the same as the current one",
            },
        )
    hashed_password = get_password_hash(body.new_password)
    current_user.hashed_password = hashed_password
    session.add(current_user)
    session.commit()
    return Message(message="Password updated successfully")


@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUser) -> Any:
    """
    Get current user.
    """
    return current_user


@router.delete("/me", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Delete own user.
    """
    if current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "USERS_SUPERUSER_DELETE_SELF",
                "message": "Super users are not allowed to delete themselves",
            },
        )
    session.delete(current_user)
    session.commit()
    return Message(message="User deleted successfully")


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Get a specific user by id.
    """
    user = session.get(User, user_id)
    if user == current_user:
        return user
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "USERS_FORBIDDEN",
                "message": "The user doesn't have enough privileges",
            },
        )
    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "USERS_NOT_FOUND", "message": "User not found"},
        )
    return user


@router.patch(
    "/{user_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
def update_user(
    *,
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
) -> Any:
    """
    Update a user.
    """

    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "USERS_ID_NOT_FOUND",
                "message": "The user with this id does not exist in the system",
            },
        )
    if user_in.user_code:
        existing_user = crud.get_user_by_code(
            session=session, user_code=user_in.user_code
        )
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "USERS_CODE_CONFLICT",
                    "message": "User with this user_code already exists",
                },
            )

    db_user = crud.update_user(session=session, db_user=db_user, user_in=user_in)
    return db_user


@router.delete("/{user_id}", dependencies=[Depends(get_current_active_superuser)])
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """
    Delete a user.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"code": "USERS_NOT_FOUND", "message": "User not found"},
        )
    if user == current_user:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "USERS_SUPERUSER_DELETE_SELF",
                "message": "Super users are not allowed to delete themselves",
            },
        )
    session.delete(user)
    session.commit()
    return Message(message="User deleted successfully")


@router.post(
    "/{user_id}/reset-password",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=ResetPasswordResponse,
)
def reset_user_password(session: SessionDep, user_id: uuid.UUID) -> Any:
    """
    Reset a user's password with a one-time temporary password.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"code": "USERS_NOT_FOUND", "message": "User not found"},
        )
    new_password = generate_random_password()
    user.hashed_password = get_password_hash(new_password)
    session.add(user)
    session.commit()
    return ResetPasswordResponse(new_password=new_password)
