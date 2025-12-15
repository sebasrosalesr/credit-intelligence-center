# backend/ingestion/status.py

import os
import sys
from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter()

def _truthy(v: str | None) -> bool:
    return str(v).strip().lower() in {"1", "true", "yes", "y", "on"}

@router.get("/status")
def ingestion_status():
    return {"ok": True, "service": "ingestion"}

@router.get("/ready")
def ingestion_ready():
    # Prefer backend flag if you have it; fallback to Vite-style flag if shared
    use_sandbox = _truthy(os.getenv("USE_SANDBOX")) or _truthy(os.getenv("VITE_USE_SANDBOX"))

    env_name = "sandbox" if use_sandbox else "prod"

    return {
        "ok": True,
        "service": "ingestion",
        "env": env_name,
        "use_sandbox": use_sandbox,
        "ts_utc": datetime.now(timezone.utc).isoformat(),
        "python": sys.version.split(" ")[0],
        "pid": os.getpid(),
        # Optional: set APP_VERSION in your env if you want
        "version": os.getenv("APP_VERSION", "dev"),
    }