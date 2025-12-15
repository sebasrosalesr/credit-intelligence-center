# backend/ingestion/requestor_templates.py

import io
import pandas as pd

# --- Standard Output Schema ---
standard_columns = [
    'Date', 'Credit Type', 'Issue Type', 'Customer Number', 'Invoice Number',
    'Item Number', 'QTY', 'Unit Price', 'Extended Price', 'Corrected Unit Price',
    'Extended Correct Price',
    'Item Non-Taxable Credit', 'Item Taxable Credit',
    'Credit Request Total',
    'Requested By', 'Reason for Credit', 'Status', 'Ticket Number'
]

# --- Macro File Mapping ---
macro_mapping = {
    'Date': 'Req Date',
    'Credit Type': 'CRType',
    'Issue Type': 'Type',
    'Customer Number': 'Cust ID',
    'Invoice Number': 'Doc No',
    'Item Number': 'Item No.',
    'Item Non-Taxable Credit': 'Item Non-Taxable Credit',
    'Item Taxable Credit': 'Item Taxable Credit',
    'Requested By': 'Requested By',
    'Reason for Credit': 'Reason',
    'Status': 'Status'
}

# --- DOC Analysis Mapping (with alternate names) ---
doc_analysis_mapping = {
    'Date': ['DOCDATE', 'Doc Date'],
    'Credit Type': None,
    'Issue Type': None,
    'Customer Number': ['CUSTNMBR','Cust Number', 'Customer Num'],
    'Invoice Number': [
        'SOPNUMBE',
        'SOP Number',
        'Sales Doc Num',
        'Sales Doc Number',
        'Sales Doc Nbr',
        'Doc Num',
        'Doc Number',
        'Doc No',
    ],
    'Item Number': [
        'ITEMNMBR',
        'Item Number',
        'Item Num',
        'Item Nbr',
    ],
    # Incoming variations → Standardized field
    'QTY': ['QUANTITY', 'Qty on Invoice'],

    # Old + New mappings
    'Unit Price': ['UNITPRCE', 'UOM Price', 'Price'],
    'Extended Price': ['XTNDPRCE', 'Extended Price', 'Ext Price'],

    'Corrected Unit Price': ['Price (new)'],
    'Extended Correct Price': ['Ext Price(new)','Ext Price (new)'],

    'Item Non-Taxable Credit': None,
    'Item Taxable Credit': None,

    # New credit total mapping
    'Credit Request Total': ['Credit'],

    'Requested By': None,
    'Reason for Credit': None,
    'Status': None,
    'Ticket Number': None,
}

# --- JF Request Mapping ---
jf_mapping = {
    'Date': 'Doc Date',
    'Credit Type': None,
    'Issue Type': None,
    'Customer Number': 'Cust Number',
    'Invoice Number': 'SOP Number',
    'Item Number': 'Item Number',
    'QTY': 'Qty on Invoice',
    'Unit Price': 'UOM Price',
    'Extended Price': 'Extended Price',
    'Corrected Unit Price': 'New UOM Price',
    'Extended Correct Price': 'New Extended Price',
    'Item Non-Taxable Credit': None,
    'Item Taxable Credit': None,
    'Credit Request Total': 'Difference to Be Credited',
    'Requested By': None,
    'Reason for Credit': None,
    'Status': None,
    'Ticket Number': None
}

# -------- Helpers --------
def _money_to_float(s):
    """coerce money-like strings to float (handles $, commas, parentheses)"""
    if pd.isna(s):
        return None
    s = str(s).strip()
    if s == "":
        return None
    neg = s.startswith("(") and s.endswith(")")
    s = s.replace("$", "").replace(",", "").replace("−", "-")
    if neg:
        s = "-" + s[1:-1]
    try:
        return float(s)
    except Exception:
        return None

def convert_money_columns(df, cols):
    df = df.copy()
    for c in cols:
        if c in df.columns:
            df[c] = df[c].apply(_money_to_float)
    return df

# --- Detect header row in DOC Analysis ---
INVOICE_HEADER_ALIASES = {
    'SOPNUMBE',
    'SOP NUMBER',
    'SALES DOC NUM',
    'SALES DOC NUMBER',
    'SALES DOC NMBR',
    'SALES DOC #',
    'DOC NUMBER',
    'DOC NO',
    'DOC NUM',
}

ITEM_HEADER_ALIASES = {
    'ITEMNMBR',
    'ITEM NUMBER',
    'ITEM NUM',
    'ITEM NBR',
    'ITEM #',
    'LINE ITEM',
}

def load_doc_analysis_file(file_path_or_obj):
    raw_df = pd.read_excel(file_path_or_obj, header=None)
    header_row = None
    for i in range(10):
        row = raw_df.iloc[i].astype(str).str.upper().str.strip()
        if any(col in row.values for col in INVOICE_HEADER_ALIASES) and \
           any(col in row.values for col in ITEM_HEADER_ALIASES):
            header_row = i
            break
    if header_row is None:
        raise ValueError(
            "Could not detect header row. "
            "Ensure SOPNUMBE/SOP Number and ITEMNMBR/Item Number exist."
        )
    df = pd.read_excel(file_path_or_obj, header=header_row)
    df.columns = df.columns.str.strip()
    return df

# --- Filter DOC rows where price is zero ---
def filter_doc_analysis(df):
    df = df.copy()
    for col in ['UNITPRCE', 'Unit Price', 'UOM Price']:
        if col in df.columns:
            return df[df[col] != 0]
    return df

# --- Generic column mapper ---
def convert_file(df, mapping):
    df_out = pd.DataFrame(columns=standard_columns)
    cols_upper = {col.strip().upper(): col for col in df.columns}

    for std_col in standard_columns:
        source = mapping.get(std_col)
        if isinstance(source, list):
            found = None
            for alt in source:
                match = cols_upper.get(alt.strip().upper())
                if match:
                    found = match
                    break
            df_out[std_col] = df[found] if found else None
        elif isinstance(source, str):
            match = cols_upper.get(source.strip().upper())
            df_out[std_col] = df[match] if match else None
        else:
            df_out[std_col] = None
    return df_out

# --- Utilities for downstream enrichment ---
def normalize_date_column(df, column="Date"):
    if column not in df.columns:
        return df

    dates = pd.to_datetime(df[column], errors="coerce")
    formatted = dates.dt.strftime("%Y-%m-%d")
    mask_valid = dates.notna()
    df.loc[mask_valid, column] = formatted[mask_valid]
    df.loc[~mask_valid, column] = ""
    return df


def _clean_text_value(val):
    if pd.isna(val):
        return ""
    s = str(val).strip()
    if not s or s in {"—", "-", "nan", "null", "undefined", "n/a"}:
        return ""
    return s


def filter_real_rows(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drop rows that are just template noise: missing invoice/item or entirely empty.
    """
    if df.empty:
        return df
    df = df.copy()
    for col in ["Invoice Number", "Item Number"]:
        if col in df.columns:
            df[col] = df[col].apply(_clean_text_value)
    if "Invoice Number" not in df.columns or "Item Number" not in df.columns:
        return df

    mask = (df["Invoice Number"] != "") & (df["Item Number"] != "")

    numeric_cols = [
        "Credit Request Total",
        "QTY",
        "Unit Price",
        "Extended Price",
        "Corrected Unit Price",
        "Extended Correct Price",
    ]
    numeric_mask = pd.Series(False, index=df.index)
    for col in numeric_cols:
        if col in df.columns:
            numeric_mask |= df[col].apply(
                lambda v: pd.to_numeric(v, errors="coerce")
            ).notna() & (df[col].apply(lambda v: pd.to_numeric(v, errors="coerce")).abs() > 0)

    text_cols = ["Requested By", "Reason for Credit", "Status", "Credit Type"]
    text_mask = pd.Series(False, index=df.index)
    for col in text_cols:
        if col in df.columns:
            text_mask |= df[col].astype(str).str.strip().astype(bool)

    keep = mask & (numeric_mask | text_mask)
    return df[keep]

def apply_ticket_metadata(df, ticket_number):
    ticket_number = (ticket_number or "").strip()
    if not ticket_number:
        return df
    if "Ticket Number" not in df.columns:
        df["Ticket Number"] = ticket_number
        return df
    current = df["Ticket Number"].astype(str).fillna("").str.strip()
    mask = current == ""
    if mask.any():
        df.loc[mask, "Ticket Number"] = ticket_number
    return df

# --- Format detection (Standard / Macro / JF / DOC) ---
def detect_requestor_format(df_sample):
    sample_cols = set(df_sample.columns.str.strip())

    # Detect already-standard template
    standard_keys = {
        'Credit Type',
        'Issue Type',
        'Customer Number',
        'Invoice Number',
        'Item Number',
        'QTY',
    }
    if standard_keys.issubset(sample_cols):
        return "standard"

    # Macro format detection
    if {'Req Date', 'Cust ID', 'Total Credit Amt'}.issubset(sample_cols):
        return "macro"

    # JF Request detection
    jf_hits = {'Doc Date', 'SOP Number', 'Cust Number'}
    if jf_hits.issubset(sample_cols) or 'Difference to Be Credited' in sample_cols:
        return "jf"

    # Fallback: DOC Analysis
    return "doc"

# --- Original entrypoint (path / file-like) ---
def convert_requestor_template(path_or_file, force_format: str = None):
    """
    Convert a single requestor template file (Standard / Macro / DOC Analysis / JF Request)
    into the standard credit schema.

    path_or_file: file path or file-like object supported by pandas.read_excel
    force_format: one of {"standard", "macro", "jf", "doc"} to bypass auto-detection
    """
    # Peek at first rows to detect format
    df_sample = pd.read_excel(path_or_file, nrows=5)
    fmt = force_format or detect_requestor_format(df_sample)

    if fmt == "macro":
        df_full = pd.read_excel(path_or_file)
        converted = convert_file(df_full, macro_mapping)
        # Pull total directly
        if 'Total Credit Amt' in df_full.columns:
            converted['Credit Request Total'] = df_full['Total Credit Amt']
        converted['Source File'] = getattr(path_or_file, "name", str(path_or_file))
        converted['Format'] = 'Macro File'
        fmt_used = "Macro File"

    elif fmt == "jf":
        df_full = pd.read_excel(path_or_file)
        # Make sure money-like columns are numeric
        df_full = convert_money_columns(
            df_full,
            ['UOM Price', 'Extended Price', 'New UOM Price', 'New Extended Price', 'Difference to Be Credited']
        )
        converted = convert_file(df_full, jf_mapping)
        converted['Source File'] = getattr(path_or_file, "name", str(path_or_file))
        converted['Format'] = 'JF Request'
        fmt_used = "JF Request"

    elif fmt == "standard":
        df_full = pd.read_excel(path_or_file)

        # Drop Excel junk columns like "Unnamed: 17"
        df_full = df_full.loc[:, ~df_full.columns.str.startswith("Unnamed")]

        # Ensure all standard columns exist
        for col in standard_columns:
            if col not in df_full.columns:
                df_full[col] = None

        # Clean money-like columns
        numeric_like = [
            'QTY','Unit Price','Extended Price','Corrected Unit Price',
            'Extended Correct Price','Item Non-Taxable Credit','Item Taxable Credit',
            'Credit Request Total'
        ]
        df_full = convert_money_columns(df_full, numeric_like)

        df_full['Source File'] = getattr(path_or_file, "name", str(path_or_file))
        df_full['Format'] = 'Standard Template'

        # Keep standard columns in canonical order + meta
        converted = df_full[standard_columns + ['Source File', 'Format']]
        fmt_used = "Standard Template"

    else:  # "doc"
        df_doc = load_doc_analysis_file(path_or_file)
        df_doc = filter_doc_analysis(df_doc)
        converted = convert_file(df_doc, doc_analysis_mapping)
        converted['Source File'] = getattr(path_or_file, "name", str(path_or_file))
        converted['Format'] = 'DOC Analysis'
        fmt_used = "DOC Analysis"

    # Optional: ensure numeric in standard numeric columns (idempotent)
    numeric_like = [
        'QTY','Unit Price','Extended Price','Corrected Unit Price',
        'Extended Correct Price','Item Non-Taxable Credit','Item Taxable Credit',
        'Credit Request Total'
    ]
    for c in numeric_like:
        if c in converted.columns:
            converted[c] = pd.to_numeric(converted[c], errors='coerce')

    converted = filter_real_rows(converted)
    return converted, fmt_used

# --- Backend-friendly wrapper: bytes + filename ---
def convert_requestor_template_bytes(content: bytes, filename: str, force_format: str = None):
    """
    Wrapper used by FastAPI:
      - content: raw file bytes from UploadFile.read()
      - filename: original filename (for Source File column)
    """
    buffer = io.BytesIO(content)
    # Give pandas something with a name attribute for Source File
    buffer.name = filename
    return convert_requestor_template(buffer, force_format=force_format)
