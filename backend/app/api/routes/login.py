from datetime import timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.core import security
from app.core.config import settings
from app.crud import UserAmbiguousIdentifierError
from app.models import Token, UserPublic

router = APIRouter(tags=["login"])


@router.post("/login/access-token")
def login_access_token(
    session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests

    The ``username`` field carries the user's code, or their full name when
    that name is unique.
    """
    try:
        user = crud.authenticate(
            session=session, identifier=form_data.username, password=form_data.password
        )
    except UserAmbiguousIdentifierError:
        raise HTTPException(
            status_code=400,
            detail="Multiple users share this name, please log in with your user code",
        )
    if not user:
        raise HTTPException(
            status_code=400, detail="Incorrect user code/name or password"
        )
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return Token(
        access_token=security.create_access_token(
            user.id, expires_delta=access_token_expires
        )
    )


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> Any:
    """
    Test access token
    """
    return current_user
