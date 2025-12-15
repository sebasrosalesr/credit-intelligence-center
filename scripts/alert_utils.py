from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Dict, Tuple


def to_number(v) -> float:
    try:
        return float(str(v).replace(",", "").replace("$", ""))
    except Exception:
        return 0.0


def to_date(dstr) -> date | None:
    if not dstr:
        return None
    try:
        # Accept YYYY-MM-DD or ISO datetime
        return datetime.fromisoformat(str(dstr)).date()
    except Exception:
        try:
            return date.fromisoformat(str(dstr))
        except Exception:
            return None


def days_since(dstr) -> int | None:
    d = to_date(dstr)
    if not d:
        return None
    return (date.today() - d).days


def build_windowed_stats(credits: Dict, days_window: int) -> Tuple[float, Dict[str, float], Dict[str, float]]:
    """Aggregate totals over a window (defaults used: 90d). credits = {id: rec, ...} from Firebase."""
    global_total = 0.0
    rep_totals: Dict[str, float] = {}
    item_totals: Dict[str, float] = {}

    today = date.today()
    cutoff = today - timedelta(days=days_window)

    for rec in credits.values():
        rec_date = to_date(rec.get("Date"))
        if not rec_date or rec_date < cutoff:
            continue  # older than window or bad date

        amt = to_number(rec.get("Credit Request Total"))
        if amt <= 0:
            continue

        rep = rec.get("Sales Rep") or "Unknown"
        item = rec.get("Item Number") or "Unknown"

        global_total += amt
        rep_totals[rep] = rep_totals.get(rep, 0.0) + amt
        item_totals[item] = item_totals.get(item, 0.0) + amt

    return global_total, rep_totals, item_totals


def build_windowed_counts(credits: Dict, days_window: int) -> Tuple[Dict, Dict]:
    """Rolling counts for duplicates and customer frequency over a window."""
    today = date.today()
    cutoff = today - timedelta(days=days_window)

    pair_counts: Dict = {}
    cust_counts: Dict = {}

    for rec in credits.values():
        rec_date = to_date(rec.get("Date"))
        if not rec_date or rec_date < cutoff:
            continue

        key = (rec.get("Invoice Number"), rec.get("Item Number"))
        if all(key):
            pair_counts[key] = pair_counts.get(key, 0) + 1

        cust = rec.get("Customer Number")
        if cust:
            cust_counts[cust] = cust_counts.get(cust, 0) + 1

    return pair_counts, cust_counts


def compute_pending_trend_pct(credits: Dict, days_window: int = 7) -> float:
    """Percent change in pending volume over the most recent window vs prior window."""
    today = date.today()
    current_start = today - timedelta(days=days_window)
    prev_start = current_start - timedelta(days=days_window)

    current = 0
    previous = 0

    for rec in credits.values():
        if rec.get("RTN_CR_No") not in [None, "", "nan"]:
            continue
        d = to_date(rec.get("Created At") or rec.get("created_at") or rec.get("Date"))
        if not d:
            continue
        if d >= current_start:
            current += 1
        elif d >= prev_start:
            previous += 1

    if previous > 0:
        return ((current - previous) / previous) * 100.0
    if current > 0:
        return 100.0
    return 0.0


__all__ = [
    "to_number",
    "to_date",
    "days_since",
    "build_windowed_stats",
    "build_windowed_counts",
    "compute_pending_trend_pct",
]
