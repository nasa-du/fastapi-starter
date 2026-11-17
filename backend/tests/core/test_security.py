import re

from app.core.security import generate_random_password


def test_generate_random_password_is_at_least_16_chars() -> None:
    assert len(generate_random_password()) >= 16


def test_generate_random_password_is_unique_per_call() -> None:
    assert generate_random_password() != generate_random_password()


def test_generate_random_password_charset_is_url_safe() -> None:
    assert re.fullmatch(r"[A-Za-z0-9_-]+", generate_random_password())
