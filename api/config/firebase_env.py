"""Firebase environment awareness shared across API routes."""

from functools import lru_cache
from typing import Optional

import os

FALLBACK_DB_URL = "https://creditapp-tm-default-rtdb.firebaseio.com/"
_TRUE_VALUES = {"1", "true", "yes", "y", "on"}


def _is_truthy(value: Optional[str]) -> bool:
    if not value:
        return False
    return value.strip().lower() in _TRUE_VALUES


@lru_cache(maxsize=1)
def is_sandbox_env() -> bool:
    env_override = (os.environ.get("VITE_FIREBASE_ENV") or "").strip().lower()
    use_sandbox_flag = os.environ.get("VITE_USE_SANDBOX")
    return env_override == "sandbox" or _is_truthy(use_sandbox_flag)


FIREBASE_ENV = "sandbox" if is_sandbox_env() else "production"


def get_db_url() -> str:
    if is_sandbox_env():
        return (
            os.environ.get("VITE_SANDBOX_FIREBASE_DATABASE_URL")
            or os.environ.get("VITE_FIREBASE_DATABASE_URL")
            or FALLBACK_DB_URL
        )
    return os.environ.get("VITE_FIREBASE_DATABASE_URL") or FALLBACK_DB_URL


def get_sandbox_credentials_path() -> Optional[str]:
    if not is_sandbox_env():
        return None
    return (
        os.environ.get("VITE_SANDBOX_FIREBASE_CREDENTIALS_PATH")
        or os.environ.get("VITE_FIREBASE_CREDENTIALS_PATH")
    )


DEFAULT_FIREBASE_DB_URL = get_db_url()
DEFAULT_SANDBOX_CREDENTIALS_PATH = get_sandbox_credentials_path()
