import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

ITEMS_PATH = f"{settings.API_V1_STR}/items/"
ITEM_ID_PATH = f"{settings.API_V1_STR}/items/{uuid.uuid4()}"


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("GET", ITEMS_PATH),
        ("POST", ITEMS_PATH),
        ("GET", ITEM_ID_PATH),
        ("PUT", ITEM_ID_PATH),
        ("DELETE", ITEM_ID_PATH),
    ],
)
def test_items_endpoints_return_default_404(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    method: str,
    url: str,
) -> None:
    """
    Removed Item routes must behave as unmatched routes: FastAPI's default
    404, not 401, 405, or the old CRUD responses.

    The request carries a valid token on purpose: an unregistered route must
    not even reach authentication.
    """
    response = client.request(method, url, headers=superuser_token_headers)
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"detail": "Not Found"}


def test_openapi_has_no_items_paths(client: TestClient) -> None:
    response = client.get(f"{settings.API_V1_STR}/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    items_paths = [
        path for path in paths if path.startswith(f"{settings.API_V1_STR}/items")
    ]
    assert items_paths == []


def test_other_routes_still_registered(client: TestClient) -> None:
    response = client.get(f"{settings.API_V1_STR}/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    for expected in (
        f"{settings.API_V1_STR}/login/access-token",
        f"{settings.API_V1_STR}/login/test-token",
        f"{settings.API_V1_STR}/users/",
        f"{settings.API_V1_STR}/users/me",
        f"{settings.API_V1_STR}/users/me/password",
        f"{settings.API_V1_STR}/users/{{user_id}}",
        f"{settings.API_V1_STR}/users/{{user_id}}/reset-password",
    ):
        assert expected in paths
