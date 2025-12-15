from __future__ import annotations

import os


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except Exception:
        return default


def env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except Exception:
        return default


def env_bool(name: str, default: bool = False) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return str(val).lower() in {"1", "true", "yes", "y"}


def load_config():
    """Load tunables with env overrides."""
    return {
        "windows": {
            "duplicates_days": env_int("ALERT_WINDOW_DUPLICATES_DAYS", 120),
            "concentration_days": env_int("ALERT_WINDOW_CONCENTRATION_DAYS", 120),
            "trend_days": env_int("ALERT_WINDOW_TREND_DAYS", 14),
        },
        "thresholds": {
            "high": env_int("ALERT_THRESHOLD_HIGH", 70),
            "medium": env_int("ALERT_THRESHOLD_MEDIUM", 50),
        },
        "weights": {
            "high_amount": [
                {"min": env_float("ALERT_TIER3_MIN", 20000), "score": env_float("ALERT_TIER3_SCORE", 65), "flag": "high_amount_tier3_20k"},
                {"min": env_float("ALERT_TIER2_MIN", 10000), "score": env_float("ALERT_TIER2_SCORE", 48), "flag": "high_amount_tier2_10k"},
                {"min": env_float("ALERT_TIER1_MIN", 2500), "score": env_float("ALERT_TIER1_SCORE", 15), "flag": "high_amount_tier1_2_5k"},
            ],
            "aging": {
                "pending_60d": 18,
                "pending_30_59d": 10,
                "aging_dollars_60d_cap": env_float("ALERT_AGING_60D_CAP", 25),
                "aging_dollars_30d_cap": env_float("ALERT_AGING_30D_CAP", 16),
                "aging_dollars_60d_scale": env_float("ALERT_AGING_60D_SCALE", 6),  # per $5k
                "aging_dollars_30d_scale": env_float("ALERT_AGING_30D_SCALE", 4),  # per $5k
                "aging_30_59d_10k_bump": env_float("ALERT_AGING_30_59D_10K_BUMP", 4),
            },
            "concentration_cap": env_float("ALERT_CONCENTRATION_CAP", 20),
            "duplicates_base": 5,
            "duplicates_step": 3,
            "duplicates_cap": 15,
            "customer_freq_base": 4,
            "customer_freq_cap": 12,
            "trend_up_cap": env_float("ALERT_TREND_UP_CAP", 10),
            "trend_down_cap": env_float("ALERT_TREND_DOWN_CAP", 5),
        },
    }


__all__ = ["load_config", "env_bool"]
