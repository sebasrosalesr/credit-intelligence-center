"""
Alert engine to score/flag credit requests in Firebase Realtime Database.

Prereqs:
  - firebase_admin initialized elsewhere (import firebase_admin; firebase_admin.initialize_app(...))
  - Database rules permit server SDK read/write on credit_requests
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from typing import Dict

import firebase_admin
from firebase_admin import db, credentials, initialize_app

from scripts.alert_config import load_config, env_bool
from scripts.alert_scoring import apply_rules
from scripts.alert_utils import (
    build_windowed_counts,
    build_windowed_stats,
    compute_pending_trend_pct,
    to_number,
)


def run_alert_engine():
    parser = argparse.ArgumentParser(description="Alert engine scorer")
    parser.add_argument("--dry-run", action="store_true", help="Skip writes to RTDB")
    parser.add_argument("--target", default=None, help="RTDB path to update (default credit_requests)")
    parser.add_argument("--batch-size", type=int, default=None, help="Batch size for RTDB updates (default 300)")
    args = parser.parse_args()

    config = load_config()
    dry_run = args.dry_run or env_bool("ALERT_DRY_RUN", False)
    target_path = args.target or os.environ.get("ALERT_TARGET_PATH", "credit_requests")
    batch_size = args.batch_size or int(os.environ.get("ALERT_BATCH_SIZE", 300))

    # Ensure Firebase app is initialized (uses GOOGLE_APPLICATION_CREDENTIALS + FIREBASE_DATABASE_URL)
    if not firebase_admin._apps:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        db_url = os.environ.get("FIREBASE_DATABASE_URL")
        if not cred_path or not db_url:
            raise RuntimeError(
                "Set GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_DATABASE_URL before running."
            )
        initialize_app(credentials.Certificate(cred_path), {"databaseURL": db_url})

    ref_root = db.reference(target_path)
    credits = ref_root.get() or {}

    # Rolling context maps (duplicates + customer frequency)
    pair_counts, cust_counts = build_windowed_counts(credits, days_window=config["windows"]["duplicates_days"])

    # Aggregates (rep + item) for concentration
    global_total_90d, rep_totals_90d, item_totals_90d = build_windowed_stats(
        credits, days_window=config["windows"]["concentration_days"]
    )

    # Pending trend (recent vs prior window)
    trend_pct = compute_pending_trend_pct(credits, days_window=config["windows"]["trend_days"])

    label_counts = {"High": 0, "Medium": 0, "Low": 0}
    max_score = -1
    min_score = 101
    processed = 0
    updates: Dict[str, Dict] = {}

    samples = []

    # Per-record flagging
    for rec_id, rec in credits.items():
        result = apply_rules(
            rec,
            pair_counts,
            cust_counts,
            global_total_90d,
            rep_totals_90d,
            item_totals_90d,
            trend_pct,
            config,
        )
        processed += 1
        label_counts[result["label"]] = label_counts.get(result["label"], 0) + 1
        max_score = max(max_score, result["score"])
        min_score = min(min_score, result["score"])

        samples.append(
            {
                "id": rec_id,
                "score": result["score"],
                "label": result["label"],
                "flags": result["flags"],
                "amount": to_number(rec.get("Credit Request Total")),
                "invoice": rec.get("Invoice Number"),
                "item": rec.get("Item Number"),
            }
        )

        updates[rec_id] = {
            "alert_flags": result["flags"],
            "alert_score": result["score"],
            "alert_label": result["label"],
            "alert_factors": result["factors"],
            "alert_last_run": datetime.utcnow().isoformat(),
        }

        if not dry_run and len(updates) >= batch_size:
            ref_root.update(updates)
            updates.clear()

    if not dry_run and updates:
        ref_root.update(updates)

    top_samples = sorted(samples, key=lambda s: s["score"], reverse=True)[:3]
    bottom_samples = sorted(samples, key=lambda s: s["score"])[:3]

    summary = {
        "processed": processed,
        "highs": label_counts.get("High", 0),
        "mediums": label_counts.get("Medium", 0),
        "lows": label_counts.get("Low", 0),
        "max_score": max_score,
        "min_score": min_score,
        "dry_run": dry_run,
        "target": target_path,
        "batch_size": batch_size,
        "top_samples": top_samples,
        "bottom_samples": bottom_samples,
    }
    print(json.dumps({"alert_engine_summary": summary}, default=str))


if __name__ == "__main__":
    run_alert_engine()
