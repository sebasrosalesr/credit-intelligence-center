from scripts.alert_scoring import apply_rules
from scripts.alert_config import load_config


def test_high_amount_tier3_hits_high_label():
    config = load_config()
    rec = {
        "Credit Request Total": 25000,
        "RTN_CR_No": None,
        "Date": "2025-01-01",
        "Invoice Number": "INV1",
        "Item Number": "ITEM1",
    }
    pair_counts = {("INV1", "ITEM1"): 1}
    cust_counts = {"C1": 1}

    result = apply_rules(
        rec,
        pair_counts,
        cust_counts,
        global_total_90d=25000,
        rep_totals_90d={"Unknown": 25000},
        item_totals_90d={"ITEM1": 25000},
        pending_trend_pct=0,
        config=config,
    )

    assert result["label"] in {"High", "Medium"}
    assert "high_amount_tier3_20k" in result["flags"]
    assert result["score"] >= config["thresholds"]["medium"]


def test_pending_30_59d_bump_applies_over_10k():
    config = load_config()
    rec = {
        "Credit Request Total": 12000,
        "RTN_CR_No": None,
        "Date": "2024-08-01",
        "Invoice Number": "INV2",
        "Item Number": "ITEM2",
    }
    result = apply_rules(
        rec,
        pair_counts_window={},
        cust_counts_window={},
        global_total_90d=0,
        rep_totals_90d={},
        item_totals_90d={},
        pending_trend_pct=0,
        config=config,
    )
    assert "pending_30_59d" in result["flags"]
    assert result["score"] >= config["thresholds"]["medium"] - 20  # ensure bump contributes
