from __future__ import annotations

from typing import Dict

from scripts.alert_config import load_config
from scripts.alert_utils import to_number, days_since


def apply_rules(
    rec: Dict,
    pair_counts_window: Dict,
    cust_counts_window: Dict,
    global_total_90d: float,
    rep_totals_90d: Dict[str, float],
    item_totals_90d: Dict[str, float],
    pending_trend_pct: float,
    config: Dict | None = None,
) -> Dict:
    """Apply scoring rules with dollar tiers, concentration, aging dollars, trend, and explainable factors."""
    if config is None:
        config = load_config()

    flags: list[str] = []
    factors = {
        "high_amount": 0,
        "aging": 0,
        "aging_dollars": 0,
        "concentration": 0,
        "duplicates": 0,
        "customer_frequency": 0,
        "trend": 0,
    }

    amt = to_number(rec.get("Credit Request Total"))
    # Prefer created/ingested timestamp if available; fall back to Date
    created_date = rec.get("Created At") or rec.get("created_at") or rec.get("Date")
    d = days_since(created_date)
    pending = rec.get("RTN_CR_No") in [None, "", "nan"]

    # ---------- basic aging / duplicate context ----------
    pair_key = (rec.get("Invoice Number"), rec.get("Item Number"))
    pair_count = pair_counts_window.get(pair_key, 0)
    cust_count = cust_counts_window.get(rec.get("Customer Number"), 0)

    # High amount per line (tiered)
    for tier in sorted(config["weights"]["high_amount"], key=lambda t: t["min"], reverse=True):
        if amt >= tier["min"]:
            flags.append(tier["flag"])
            factors["high_amount"] += tier["score"]
            break

    # Concentration (applies even for smaller lines)
    if global_total_90d > 0:
        rep = rec.get("Sales Rep") or "Unknown"
        item = rec.get("Item Number") or "Unknown"
        rep_total = rep_totals_90d.get(rep, 0.0)
        item_total = item_totals_90d.get(item, 0.0)
        rep_share = rep_total / global_total_90d
        item_share = item_total / global_total_90d

        # Rep weighting
        if rep_share >= 0.30:
            flags.append("heavy_rep_90d")
            factors["concentration"] += 15
        elif rep_share >= 0.15:
            flags.append("mid_rep_90d")
            factors["concentration"] += 10
        elif rep_share >= 0.05:
            flags.append("light_rep_90d")
            factors["concentration"] += 5

        # Item weighting
        if item_share >= 0.30:
            flags.append("heavy_item_90d")
            factors["concentration"] += 15
        elif item_share >= 0.15:
            flags.append("mid_item_90d")
            factors["concentration"] += 10
        elif item_share >= 0.05:
            flags.append("light_item_90d")
            factors["concentration"] += 5

        # Cap concentration impact to avoid dominance
        factors["concentration"] = min(factors["concentration"], config["weights"]["concentration_cap"])

    # Aging on pending + dollar severity
    if pending and d is not None and d >= 60:
        flags.append("pending_60d_plus")
        factors["aging"] += config["weights"]["aging"]["pending_60d"]
        factors["aging_dollars"] += min(
            config["weights"]["aging"]["aging_dollars_60d_cap"],
            amt / 5000 * config["weights"]["aging"]["aging_dollars_60d_scale"],
        )
    elif pending and d is not None and d >= 30:
        flags.append("pending_30_59d")
        factors["aging"] += config["weights"]["aging"]["pending_30_59d"]
        factors["aging_dollars"] += min(
            config["weights"]["aging"]["aging_dollars_30d_cap"],
            amt / 5000 * config["weights"]["aging"]["aging_dollars_30d_scale"],
        )
        if amt >= config["weights"]["high_amount"][1]["min"]:
            factors["aging_dollars"] += config["weights"]["aging"]["aging_30_59d_10k_bump"]  # small bump for 10k+ in 30-59d

    # Duplicate invoice+item within window
    if pair_count > 1:
        flags.append("repeat_invoice_item_window")
        factors["duplicates"] += min(
            config["weights"]["duplicates_cap"],
            config["weights"]["duplicates_base"] + (pair_count - 1) * config["weights"]["duplicates_step"],
        )

    # Frequent customer credits within window
    if cust_count >= 5:
        flags.append("frequent_customer_credits_window")
        factors["customer_frequency"] += min(
            config["weights"]["customer_freq_cap"],
            config["weights"]["customer_freq_base"] + (cust_count - 4),
        )

    # Pending trend (rising pending increases risk, decreasing lowers slightly)
    if pending_trend_pct > 0:
        factors["trend"] += min(config["weights"]["trend_up_cap"], pending_trend_pct / 5)
    elif pending_trend_pct < 0:
        factors["trend"] -= min(config["weights"]["trend_down_cap"], abs(pending_trend_pct) / 10)

    raw_score = sum(factors.values())
    score = max(0, min(100, round(raw_score)))

    if score >= config["thresholds"]["high"]:
        label = "High"
    elif score >= config["thresholds"]["medium"]:
        label = "Medium"
    else:
        label = "Low"

    return {
        "flags": flags,
        "score": score,
        "label": label,
        "factors": {k: round(v, 2) for k, v in factors.items()},
    }


__all__ = ["apply_rules"]
