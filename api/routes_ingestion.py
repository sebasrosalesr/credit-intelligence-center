# api/routes_ingestion.py

from typing import Optional, List, Tuple, Set

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
import re
from pydantic import BaseModel, validator
import pandas as pd
import numpy as np
import json
from urllib import request, error
from datetime import datetime
import io

from backend.ingestion.service import (
    run_requestor_template_ingestion,
    run_billing_vs_credit_pipeline,
    run_credit_input_pipeline_bytes,
    push_input_stage,
)
from backend.ingestion.pdf_parser import pdf_to_standard_df
from backend.ingestion.billing_matcher import credit_vs_billing_from_bytes
from backend.ingestion.status import router as status_router

from .config.firebase_env import (
    DEFAULT_FIREBASE_DB_URL,
    DEFAULT_SANDBOX_CREDENTIALS_PATH,
)

try:
    import firebase_admin
    from firebase_admin import credentials, initialize_app
except ImportError:
    firebase_admin = None

# Rate limiting for file uploads and processing
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


class PushPayload(BaseModel):
    rows: List[dict]
    ticket_number: str = ""
    ticket_date: Optional[str] = None
    status: str = "Open"
    dry_run: bool = False
    cred_json_path: Optional[str] = DEFAULT_SANDBOX_CREDENTIALS_PATH
    db_url: str = DEFAULT_FIREBASE_DB_URL

    @validator('rows')
    def validate_rows(cls, v):
        if not v:
            raise ValueError('Rows cannot be empty')

        required_fields = {
            'Date', 'Customer Number', 'Invoice Number', 'Item Number',
            'Credit Request Total', 'Credit Type', 'Ticket Number'
        }
        valid_credit_types = {'Credit Memo', 'Internal'}
        issues = []

        # Track unique combos for duplicate detection
        seen_combos = set()
        seen_ids = set()

        for i, row in enumerate(v, 1):
            # Validate required fields
            missing_fields = []
            for field in required_fields:
                if not row.get(field) or str(row.get(field, '')).strip() in ('', 'nan', 'null', 'undefined'):
                    missing_fields.append(field)

            if missing_fields:
                issues.append(f"Row {i}: Missing required fields - {', '.join(missing_fields)}")

            # Validate data types and ranges
            # Date validation - basic check for date-like format
            date_val = row.get('Date')
            if date_val and str(date_val).strip() not in ('', 'nan'):
                date_str = str(date_val).strip()
                # Allow YYYY-MM-DD format only (most common for CSV files)
                if not re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
                    issues.append(f"Row {i}: Invalid date format for Date field (expected YYYY-MM-DD)")

            # Credit Request Total validation
            total_val = row.get('Credit Request Total')
            if total_val is not None:
                try:
                    total_float = float(total_val)
                    if total_float < 0:
                        issues.append(f"Row {i}: Credit Request Total cannot be negative")
                    if total_float > 1000000:  # Reasonable upper limit
                        issues.append(f"Row {i}: Credit Request Total seems unreasonably high: ${total_float:,.2f}")
                except (ValueError, TypeError):
                    issues.append(f"Row {i}: Credit Request Total must be a valid number")

            # QTY validation
            qty_val = row.get('QTY')
            if qty_val is not None and str(qty_val).strip() not in ('', 'nan'):
                try:
                    qty_float = float(qty_val)
                    if qty_float < 0:
                        issues.append(f"Row {i}: QTY cannot be negative")
                    if qty_float > 100000:  # Reasonable upper limit
                        issues.append(f"Row {i}: QTY seems unreasonably high: {qty_float}")
                except (ValueError, TypeError):
                    issues.append(f"Row {i}: QTY must be a valid number")

            # Credit Type validation
            credit_type = row.get('Credit Type', '').strip()
            if credit_type and credit_type not in valid_credit_types:
                issues.append(f"Row {i}: Invalid Credit Type '{credit_type}'. Must be one of: {', '.join(valid_credit_types)}")

            # Invoice Number validation (not empty and reasonable length)
            inv_num = str(row.get('Invoice Number', '')).strip()
            if not inv_num or inv_num.lower() in ('', 'nan', 'null', 'undefined'):
                issues.append(f"Row {i}: Invoice Number is required and cannot be empty")
            elif len(inv_num) > 50:
                issues.append(f"Row {i}: Invoice Number too long (max 50 chars)")

            # Item Number validation
            item_num = str(row.get('Item Number', '')).strip()
            if not item_num or item_num.lower() in ('', 'nan', 'null', 'undefined'):
                issues.append(f"Row {i}: Item Number is required and cannot be empty")
            elif len(item_num) > 50:
                issues.append(f"Row {i}: Item Number too long (max 50 chars)")

            # Ticket Number validation (reasonable length)
            ticket_num = str(row.get('Ticket Number', '')).strip()
            if ticket_num and len(ticket_num) > 100:
                issues.append(f"Row {i}: Ticket Number too long (max 100 chars)")

            # RTN_CR_No validation (if present, check format)
            rtn_val = row.get('RTN_CR_No')
            if rtn_val and str(rtn_val).strip():
                # Basic format check - should be alphanumeric with possible dashes
                if not re.match(r'^[A-Z0-9\-]+$', str(rtn_val).strip().upper()):
                    issues.append(f"Row {i}: RTN/CR No contains invalid characters")

            # Check for duplicates within dataset
            row_id = row.get('id')
            inv_num_clean = inv_num.upper().strip()
            item_num_clean = item_num.upper().strip()

            if row_id:
                if row_id in seen_ids:
                    issues.append(f"Row {i}: Duplicate ID '{row_id}' within dataset")
                else:
                    seen_ids.add(row_id)

            # Combo key deduplication
            combo_key = f"{inv_num_clean}|{item_num_clean}"
            if combo_key in seen_combos:
                issues.append(f"Row {i}: Duplicate Invoice+Item combination {combo_key} within dataset")
            else:
                seen_combos.add(combo_key)

        # If we have validation issues, raise them
        if issues:
            # Limit the number of issues shown to avoid overwhelming responses
            max_issues = 50
            displayed_issues = issues[:max_issues]
            if len(issues) > max_issues:
                displayed_issues.append(f"... and {len(issues) - max_issues} more issues")
            error_msg = f"Data validation failed with {len(issues)} issues:\n" + "\n".join(f"• {issue}" for issue in displayed_issues)
            raise ValueError(error_msg)

        return v


def clean_item_number(val):
    """
    Normalize Item Number:
    - Strip whitespace
    - Convert floats like 1004360.0 -> '1004360'
    - Always return as string
    """
    s = str(val).strip()
    if s.endswith(".0"):
        try:
            f = float(s)
            if f.is_integer():
                s = str(int(f))
        except ValueError:
            pass
    return s


@router.post("/requestor-upload")
@limiter.limit("10/minute")
async def upload_requestor_file(request: Request, file: UploadFile = File(...)):
    """
    Endpoint for normalizing a single requestor template file
    (Macro / DOC / JF / Standard) into the standard schema and
    returning an IngestionResult.
    """
    content = await file.read()
    try:
        result = run_requestor_template_ingestion(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # IngestionResult is a Pydantic model
    return result.model_dump()


@router.post("/ai-intake/push")
async def ai_intake_push(payload: PushPayload):
    """
    Push edited input-stage rows to Firebase (or simulate if dry_run=True).
    """
    if not payload.rows:
        raise HTTPException(status_code=400, detail="No rows provided to push.")

    df_source = pd.DataFrame(payload.rows)

    ticket_date = payload.ticket_date
    if ticket_date:
        try:
            ticket_date = datetime.fromisoformat(ticket_date)
        except Exception:
            ticket_date = datetime.today()
    else:
        ticket_date = datetime.today()

    if payload.dry_run:
        return {
            "dry_run": True,
            "submitted": 0,
            "skipped_duplicates": 0,
            "failed": 0,
            "details": [f"DRY RUN: {len(df_source)} rows would be pushed to Firebase."],
        }

    stats = push_input_stage(
        df_source=df_source,
        ticket_number=payload.ticket_number,
        ticket_date=ticket_date,
        status=payload.status,
        cred_json_path=payload.cred_json_path,
        db_url=payload.db_url,
    )
    return {"dry_run": False, **stats}


@router.post("/ai-intake")
@limiter.limit("5/minute")
async def ai_intake_engine(
    request: Request,
    requestor_file: UploadFile = File(...),
    billing_file: UploadFile = File(...),
    mapping_file: Optional[UploadFile] = File(None),
    ticket_number: str = Form(""),
    ticket_date: Optional[str] = Form(None),
    status: str = Form("Open"),
    dry_run: bool = Form(True),
    cred_json_path: Optional[str] = Form(DEFAULT_SANDBOX_CREDENTIALS_PATH),
    db_url: str = Form(DEFAULT_FIREBASE_DB_URL),
):
    """
    AI Intake Engine:
      - Normalize the requestor template
      - Attempt billing reconciliation
      - If no matches, prepare input-stage rows (optionally push to Firebase)
    """
    requestor_bytes = await requestor_file.read()
    billing_bytes = await billing_file.read()
    mapping_bytes = await mapping_file.read() if mapping_file is not None else None

    try:
        result = run_credit_input_pipeline_bytes(
            requestor_content=requestor_bytes,
            requestor_filename=requestor_file.filename,
            billing_content=billing_bytes,
            edi_mapping_content=mapping_bytes,
            ticket_number=ticket_number,
            ticket_date=ticket_date,
            status=status,
            cred_json_path=cred_json_path,
            db_url=db_url,
            edi_lookup={},
            dry_run=dry_run,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    def _df_to_records(df):
        if df is None:
            return None
        # Normalize out-of-range / missing values for JSON safety
        safe_df = df.replace([pd.NA, pd.NaT, np.nan, np.inf, -np.inf, float("inf"), float("-inf")], None)
        safe_df = safe_df.where(pd.notnull(safe_df), None)
        return safe_df.to_dict(orient="records")

    def _collect_existing_pairs(db_url: str) -> Tuple[Set[Tuple[str, str]], Optional[str]]:
        """
        Fetch existing credit_requests from Firebase and return a set of (invoice, item) pairs.
        """
        try:
            with request.urlopen(f"{db_url.rstrip('/')}/credit_requests.json", timeout=10) as resp:
                raw = resp.read()
                data = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception as exc:
            return set(), f"Firebase duplicate check skipped: {exc}"

        pairs: Set[Tuple[str, str]] = set()
        for rec in data.values():
            inv = str(rec.get("Invoice Number") or rec.get("InvoiceNumber") or "").strip().lower()
            item = str(rec.get("Item Number") or rec.get("ItemNumber") or "").strip().lower()
            if inv and item:
                pairs.add((inv, item))
        return pairs, None

    firebase_warnings: List[str] = []

    input_preview_records = _df_to_records(result.get("input_preview"))
    if input_preview_records:
        existing_pairs, warning = _collect_existing_pairs(db_url)
        if warning:
            firebase_warnings.append(warning)
        else:
            for rec in input_preview_records:
                inv = str(rec.get("Invoice Number") or "").strip().lower()
                item = str(rec.get("Item Number") or "").strip().lower()
                rec["__firebase_duplicate"] = (inv, item) in existing_pairs if inv and item else False

    return {
        "mode": result["mode"],
        "requestor_format": result.get("requestor_format"),
        "dry_run": result.get("dry_run", True),
        "df_std": _df_to_records(result.get("df_std")),
        "matches": _df_to_records(result.get("matches")),
        "input_preview": input_preview_records,
        "stats": result.get("stats"),
        "firebase_warnings": firebase_warnings,
    }


def _fetch_credit_requests(db_url: str):
    """
    Fetch credit_requests as a dict via REST (unauthenticated). Returns {} on failure.
    """
    try:
        with request.urlopen(f"{db_url.rstrip('/')}/credit_requests.json", timeout=15) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except Exception:
        return {}


def _update_credit_request_rest(db_url: str, key: str, payload: dict):
    """
    Update a credit_request record via REST PATCH (unauthenticated).
    """
    try:
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
          f"{db_url.rstrip('/')}/credit_requests/{key}.json",
          data=data,
          method="PATCH",
          headers={"Content-Type": "application/json"},
        )
        with request.urlopen(req, timeout=10):
            return True
    except Exception:
        return False


@router.post("/sync-cr-numbers")
@limiter.limit("5/minute")
async def sync_cr_numbers(
    request: Request,
    billing_file: UploadFile = File(...),
    db_url: str = Form(DEFAULT_FIREBASE_DB_URL),
    cred_json_path: Optional[str] = Form(DEFAULT_SANDBOX_CREDENTIALS_PATH),
    dry_run: bool = Form(True),
):
    """
    Sync RTN/CR numbers from a billing master Excel into Firebase credit_requests where RTN_CR_No is missing.
    """
    content = await billing_file.read()
    try:
        df_billing = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel: {e}")

    df_billing.rename(
        columns={"Doc No": "Invoice Number", "Item No.": "Item Number", "RTN/CR No.": "RTN/CR No."},
        inplace=True,
    )

    required_cols = {"Invoice Number", "Item Number", "RTN/CR No."}
    if not required_cols.issubset(set(df_billing.columns)):
        raise HTTPException(status_code=400, detail="Missing required columns: Invoice Number, Item Number, RTN/CR No.")

    df_billing = df_billing.dropna(subset=["Invoice Number", "Item Number", "RTN/CR No."])
    if df_billing.empty:
        return {"updated": 0, "checked": 0, "matched": 0, "dry_run": dry_run}

    df_billing["Invoice Number"] = df_billing["Invoice Number"].astype(str).str.strip().str.upper()
    df_billing["Item Number"] = df_billing["Item Number"].apply(clean_item_number)
    df_billing["RTN/CR No."] = df_billing["RTN/CR No."].astype(str).str.strip().str.upper()

    billing_lookup = {
        (row["Invoice Number"], row["Item Number"]): row["RTN/CR No."]
        for _, row in df_billing.iterrows()
    }

    data = _fetch_credit_requests(db_url)
    if not data:
        raise HTTPException(status_code=400, detail="Failed to fetch credit_requests from Firebase (unauthenticated).")

    fb_ref = None
    if not dry_run:
        # Allow cred_json_path override, else fallback to GOOGLE_APPLICATION_CREDENTIALS for admin writes
        sa_path = cred_json_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if sa_path:
            try:
                if not firebase_admin._apps:
                    initialize_app(credentials.Certificate(sa_path), {"databaseURL": db_url})
                fb_ref = db.reference("credit_requests")
            except Exception as exc:
                # If admin init fails, still allow REST fallback
                fb_ref = None

    updated_count = 0
    checked_count = 0
    matched_count = 0
    sample_updates = []

    for key, record in (data or {}).items():
        inv = str(record.get("Invoice Number", "")).strip().upper()
        item = clean_item_number(record.get("Item Number", ""))
        existing_rtn = str(record.get("RTN_CR_No", "")).strip().upper()
        pair = (inv, item)
        checked_count += 1

        if existing_rtn:
            continue
        if pair not in billing_lookup:
            continue

        matched_count += 1
        new_rtn = billing_lookup[pair]
        sample_updates.append({"id": key, "invoice": inv, "item": item, "rtn": new_rtn})

        if dry_run:
            continue

        if fb_ref:
            fb_ref.child(key).update({"RTN_CR_No": new_rtn})
            updated_count += 1
        else:
            if _update_credit_request_rest(db_url, key, {"RTN_CR_No": new_rtn}):
                updated_count += 1

    return {
        "checked": checked_count,
        "matched": matched_count,
        "updated": updated_count if not dry_run else 0,
        "dry_run": dry_run,
        "sample_updates": sample_updates[:15],
    }


router.include_router(status_router)


@router.post("/pdf-invoice")
@limiter.limit("10/minute")
async def parse_pdf_invoice(
    request: Request,
    pdf_file: UploadFile = File(...),
    prefer_account_code: bool = Form(True),
    db_url: str = Form(DEFAULT_FIREBASE_DB_URL),
    billing_file: Optional[UploadFile] = File(None),
    mapping_file: Optional[UploadFile] = File(None),
):
    """
    Parse a TwinMed invoice PDF into the standard schema and flag duplicates in Firebase.
    """
    pdf_bytes = await pdf_file.read()
    try:
        df = pdf_to_standard_df(pdf_bytes, prefer_account_code=prefer_account_code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    def _df_to_records(df_local):
        if df_local is None:
            return None
        safe_df = df_local.replace(
            [pd.NA, pd.NaT, np.nan, np.inf, -np.inf, float("inf"), float("-inf")], None
        )
        safe_df = safe_df.where(pd.notnull(safe_df), None)
        return safe_df.to_dict(orient="records")

    records = _df_to_records(df)
    firebase_warnings: List[str] = []
    matches_records: List[dict] = []

    def _collect_existing_pairs(db_url: str) -> Tuple[Set[Tuple[str, str]], Optional[str]]:
        try:
            with request.urlopen(f"{db_url.rstrip('/')}/credit_requests.json", timeout=10) as resp:
                raw = resp.read()
                data = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception as exc:
            return set(), f"Firebase duplicate check skipped: {exc}"

        pairs: Set[Tuple[str, str]] = set()
        for rec in data.values():
            inv = str(rec.get("Invoice Number") or rec.get("InvoiceNumber") or "").strip().lower()
            item = str(rec.get("Item Number") or rec.get("ItemNumber") or "").strip().lower()
            if inv and item:
                pairs.add((inv, item))
        return pairs, None

    if records:
        existing_pairs, warning = _collect_existing_pairs(db_url)
        if warning:
            firebase_warnings.append(warning)
        else:
            for rec in records:
                inv = str(rec.get("Invoice Number") or "").strip().lower()
                item = str(rec.get("Item Number") or "").strip().lower()
                rec["__firebase_duplicate"] = (inv, item) in existing_pairs if inv and item else False

    # Optional billing vs credit validation
    if billing_file is not None:
        billing_bytes = await billing_file.read()
        mapping_bytes = await mapping_file.read() if mapping_file is not None else None

        # Convert parsed rows to Excel bytes for reuse of matcher
        buf = io.BytesIO()
        pd.DataFrame(records).to_excel(buf, index=False)
        credit_bytes = buf.getvalue()

        try:
            df_matches = credit_vs_billing_from_bytes(
                credit_bytes=credit_bytes,
                billing_bytes=billing_bytes,
                edi_lookup={},
                mapping_bytes=mapping_bytes,
            )
            matches_records = _df_to_records(df_matches)
        except Exception as exc:
            firebase_warnings.append(f"Billing validation failed: {exc}")

    return {
        "row_count": len(records or []),
        "rows": records,
        "matches": matches_records,
        "firebase_warnings": firebase_warnings,
    }


@router.post("/billing-vs-credit")
async def upload_billing_vs_credit(
    credit_file: UploadFile = File(...),
    billing_file: UploadFile = File(...),
    mapping_file: Optional[UploadFile] = File(None),
):
    """
    Endpoint for reconciling a credit request file vs billing master:
      - match on (Invoice Number, Item Number)
      - enrich with RTN/CR No. and EDI info
      - return IngestionResult (rows + metadata)
    """
    credit_bytes = await credit_file.read()
    billing_bytes = await billing_file.read()
    mapping_bytes = await mapping_file.read() if mapping_file is not None else None

    # TODO: pull edi_lookup dict from Firebase/cache
    edi_lookup = {}

    try:
        result = run_billing_vs_credit_pipeline(
            credit_content=credit_bytes,
            billing_content=billing_bytes,
            edi_lookup=edi_lookup,
            mapping_content=mapping_bytes,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result.model_dump()
