# backend/ingestion/service.py

from __future__ import annotations

import io
from datetime import datetime
import os
from typing import Any, Dict, List, Optional, Union

import pandas as pd

from .schemas import IngestedRow, IngestionResult, IngestionSource, FileFormat
from .dedupe import mark_duplicates
from .billing_matcher import (
    credit_vs_billing_from_bytes,
    credit_vs_billing,
    fill_customer_numbers_from_billing,
)
from .requestor_template import (
    apply_ticket_metadata,
    convert_requestor_template_bytes,
    normalize_date_column,
)
from .input_stage import prepare_input_stage, push_input_stage


# ============================================
# Helper: generic DF -> IngestedRow[]
# ============================================
def _df_to_ingested_rows_generic(df: pd.DataFrame) -> List[IngestedRow]:
    """
    Generic mapper from a credit/billing match DataFrame to IngestedRow.
    We try to populate some top-level fields and keep everything in raw.
    """
    rows: List[IngestedRow] = []

    for _, row in df.iterrows():
        ing = IngestedRow(
            account=str(row.get("Customer Number")) if row.get("Customer Number") is not None else None,
            customer_number=str(row.get("Customer Number")) if row.get("Customer Number") is not None else None,
            invoice_number=str(row.get("Invoice Number")) if row.get("Invoice Number") is not None else None,
            item_number=str(row.get("Item Number")) if row.get("Item Number") is not None else None,
            date=str(row.get("Date")) if row.get("Date") is not None else None,
            raw=row.to_dict(),
        )
        rows.append(ing)

    return rows


# ============================================
# Pipeline 0: single requestor template -> standard schema
# ============================================
def run_requestor_template_ingestion(
    content: bytes,
    filename: str,
    source: IngestionSource = IngestionSource.MANUAL_UPLOAD,
) -> IngestionResult:
    """
    Normalize a requestor template file into the standard schema and
    wrap in an IngestionResult for the API.
    """
    df_std, fmt_used = convert_requestor_template_bytes(content, filename)
    rows = _df_to_ingested_rows_generic(df_std)

    rows, duplicate_count = mark_duplicates(
        rows,
        key_fields=("customer_number", "invoice_number", "item_number"),
    )

    return IngestionResult(
        source=source,
        file_format=FileFormat.EXCEL,
        row_count=len(rows),
        duplicate_count=duplicate_count,
        rows=rows,
        warnings=[f"Requestor template normalized using format: {fmt_used}"],
        errors=[],
    )


# ============================================
# Pipeline A: billing vs credit (reconciliation)
# ============================================
def run_billing_vs_credit_pipeline(
    credit_content: bytes,
    billing_content: bytes,
    edi_lookup: Optional[Dict[str, str]] = None,
    mapping_content: Optional[bytes] = None,
    source: IngestionSource = IngestionSource.MANUAL_UPLOAD,
) -> IngestionResult:
    """
    High-level pipeline for:
      - Matching credit request file vs billing master
      - Enriching with RTN/CR No. and EDI provider
      - Returning IngestionResult compatible with the rest of the app
    """
    df_match = credit_vs_billing_from_bytes(
        credit_bytes=credit_content,
        billing_bytes=billing_content,
        edi_lookup=edi_lookup or {},
        mapping_bytes=mapping_content,
    )

    rows = _df_to_ingested_rows_generic(df_match)

    # We *could* dedupe here or assume your logic already handles match uniqueness.
    rows, duplicate_count = mark_duplicates(
        rows,
        key_fields=("customer_number", "invoice_number", "item_number"),
    )

    result = IngestionResult(
        source=source,
        file_format=FileFormat.EXCEL,  # these are Excel in your current flow
        row_count=len(rows),
        duplicate_count=duplicate_count,
        rows=rows,
        warnings=[
            "Billing vs credit reconciliation completed. "
            "EDI columns available in raw['EDI Service Provider'] and raw['EDI Source']."
        ],
        errors=[],
    )
    return result


# ============================================
# Pipeline B: full credit intake (agentic path)
# ============================================
def run_credit_input_pipeline_bytes(
    requestor_content: bytes,
    requestor_filename: str,
    billing_content: bytes,
    edi_mapping_content: Optional[bytes] = None,
    *,
    ticket_number: str = "",
    ticket_date: Optional[Union[str, datetime]] = None,
    status: str = "Open",
    cred_json_path: Optional[str] = None,
    db_url: str = "https://creditapp-tm-default-rtdb.firebaseio.com/",
    edi_lookup: Optional[dict] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Full agentic pipeline (backend/bytes version):

    1) Convert requestor template (Macro / DOC / JF / STD) -> df_std
    2) Compare with Billing (credit_vs_billing)
         - if we find matches: return them, do NOT push to Firebase
         - if no matches: go to input stage
    3) Prepare input stage rows + (optionally) push to Firebase

    Returns a dict:

        {
          "mode": "already_in_billing" | "new_request",
          "df_std": DataFrame,
          "matches": DataFrame,
          "input_preview": DataFrame | None,
          "stats": dict | None,
          "dry_run": bool,
        }

    ⚠️ NOTE: DataFrames are Python objects here.
            In your FastAPI route, convert them with .to_dict(orient="records")
            before returning JSON.
    """

    # 1) Convert requestor file -> standard schema
    df_std, fmt_used = convert_requestor_template_bytes(
        content=requestor_content,
        filename=requestor_filename,
    )
    df_std = normalize_date_column(df_std, "Date")
    df_std = apply_ticket_metadata(df_std, ticket_number)

    # 2) Billing vs Credit match
    billing_buf = io.BytesIO(billing_content)
    df_billing = pd.read_excel(billing_buf)
    df_std = fill_customer_numbers_from_billing(df_std, df_billing)

    mapping_df = None
    if edi_mapping_content is not None:
        mapping_buf = io.BytesIO(edi_mapping_content)
        mapping_df = pd.read_excel(mapping_buf)

    df_matches = credit_vs_billing(
        df_credit_raw=df_std,
        df_billing_raw=df_billing,
        edi_lookup=edi_lookup or {},
        mapping_df=mapping_df,
    )

    result: Dict[str, Any] = {
        "mode": None,
        "df_std": df_std,
        "matches": df_matches,
        "input_preview": None,
        "stats": None,
        "dry_run": dry_run,
        "requestor_format": fmt_used,
    }

    # If we found matches in billing: we stop here (no Firebase write)
    if len(df_matches) > 0:
        result["mode"] = "already_in_billing"
        return result

    # 3) Input-stage path (no billing matches)
    result["mode"] = "new_request"

    df_input = prepare_input_stage(df_std)
    result["input_preview"] = df_input

    sa_path = cred_json_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    # DRY RUN or no Firebase credentials path -> do NOT push
    if dry_run or not sa_path:
        result["stats"] = {
            "submitted": 0,
            "skipped_duplicates": 0,
            "failed": 0,
            "details": [
                f"DRY RUN: {len(df_input)} row(s) prepared for input stage; no records written to Firebase."
            ],
        }
        return result

    # Parse ticket_date
    if isinstance(ticket_date, str):
        ticket_date = datetime.fromisoformat(ticket_date)
    elif ticket_date is None:
        ticket_date = datetime.today()

    stats = push_input_stage(
        df_source=df_input,
        ticket_number=ticket_number,
        ticket_date=ticket_date,
        status=status,
        cred_json_path=sa_path,
        db_url=db_url,
    )
    result["stats"] = stats
    return result
