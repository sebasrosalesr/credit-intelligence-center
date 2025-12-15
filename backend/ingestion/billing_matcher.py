# backend/ingestion/billing_matcher.py
from __future__ import annotations

import io
from typing import Dict, Optional

import pandas as pd


def _standardize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    rename_map = {
        "Doc No": "Invoice Number",
        "SOP Number": "Invoice Number",
        "SOPNUMBE": "Invoice Number",
        "Item No.": "Item Number",
        "ITEMNMBR": "Item Number",
        "ITEM NUMBER": "Item Number",
        "Cust Number": "Customer Number",
        "CUSTNMBR": "Customer Number",
        "Cust ID": "Customer Number",
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})
    return df


def _ensure_invoice_item(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for required in ("Invoice Number", "Item Number"):
        if required not in df.columns:
            df[required] = None
    return df


def _extract_customer_lookup(df: pd.DataFrame) -> pd.DataFrame:
    df = _standardize_columns(df)
    df = _ensure_invoice_item(df)
    if "Customer Number" not in df.columns:
        return pd.DataFrame(columns=["Invoice Number", "Item Number", "Customer Number"])
    return (
        df[["Invoice Number", "Item Number", "Customer Number"]]
        .dropna(subset=["Invoice Number", "Item Number"])
        .drop_duplicates()
    )


def credit_vs_billing(
    df_credit_raw: pd.DataFrame,
    df_billing_raw: pd.DataFrame,
    edi_lookup: Dict[str, str],
    mapping_df: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    Lightweight reconciliation:
      - normalize column names
      - join on (Invoice Number, Item Number)
      - attach EDI info if available
    """
    credit_df = _standardize_columns(df_credit_raw)
    billing_df = _standardize_columns(df_billing_raw)

    credit_df = _ensure_invoice_item(credit_df)
    billing_df = _ensure_invoice_item(billing_df)

    merged = pd.merge(
        credit_df,
        billing_df,
        on=["Invoice Number", "Item Number"],
        how="inner",
        suffixes=("_credit", "_billing"),
    )

    if mapping_df is not None and "Customer Number" in mapping_df.columns:
        mapping_df = mapping_df.copy()
        mapping_df.columns = [str(c).strip() for c in mapping_df.columns]
        mapping_cols = {
            "Customer Number": "Customer Number",
            "EDI Service Provider": "EDI Service Provider",
            "EDI Source": "EDI Source",
        }
        mapping_df = mapping_df[[c for c in mapping_cols if c in mapping_df.columns]]
        merged = merged.merge(
            mapping_df,
            on="Customer Number",
            how="left",
        )

    # Apply edi_lookup override if provided (simple map on Customer Number)
    if edi_lookup and "Customer Number" in merged.columns:
        merged["EDI Lookup"] = merged["Customer Number"].map(edi_lookup)

    return merged


def fill_customer_numbers_from_billing(
    df_credit_raw: pd.DataFrame, df_billing_raw: pd.DataFrame
) -> pd.DataFrame:
    """
    Fill empty Customer Number values in df_credit_raw using billing lookup.
    """
    credit_df = _standardize_columns(df_credit_raw)
    billing_df = _standardize_columns(df_billing_raw)
    lookup = _extract_customer_lookup(billing_df)
    if lookup.empty:
        return credit_df

    merged = credit_df.merge(
        lookup,
        on=["Invoice Number", "Item Number"],
        how="left",
        suffixes=("", "_billing"),
    )
    if "Customer Number" not in merged.columns:
        return merged
    merged["Customer Number"] = merged["Customer Number"].fillna(merged["Customer Number_billing"])
    merged = merged.drop(columns=[col for col in merged.columns if col.endswith("_billing")], errors="ignore")
    return merged


def credit_vs_billing_from_bytes(
    credit_bytes: bytes,
    billing_bytes: bytes,
    edi_lookup: Dict[str, str],
    mapping_bytes: Optional[bytes] = None,
) -> pd.DataFrame:
    credit_df = pd.read_excel(io.BytesIO(credit_bytes))
    billing_df = pd.read_excel(io.BytesIO(billing_bytes))

    mapping_df = None
    if mapping_bytes is not None:
        mapping_df = pd.read_excel(io.BytesIO(mapping_bytes))

    return credit_vs_billing(
        df_credit_raw=credit_df,
        df_billing_raw=billing_df,
        edi_lookup=edi_lookup,
        mapping_df=mapping_df,
    )
