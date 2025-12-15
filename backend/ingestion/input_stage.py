from datetime import datetime
import os
from typing import Any, Dict

import pandas as pd

import firebase_admin
from firebase_admin import credentials, db


def _get_firebase_app(cred_json_path: str, db_url: str, app_name: str = "input_stage_sandbox"):
    """
    Get or initialize a named Firebase app for the input-stage sandbox.
    Using a named app avoids conflicts if you already initialized a default app elsewhere.
    """
    try:
        return firebase_admin.get_app(app_name)
    except ValueError:
        cred = credentials.Certificate(cred_json_path)
        return firebase_admin.initialize_app(
            cred,
            {"databaseURL": db_url},
            name=app_name,
        )


def prepare_input_stage(df_std: pd.DataFrame) -> pd.DataFrame:
    """
    Transform your standard-credit-schema DataFrame into the
    'input stage' rows you currently send to Firebase.
    """
    # TODO: add any extra transformations needed for Firebase if you have them.
    return df_std.copy()


def push_input_stage(
    df_source: pd.DataFrame,
    ticket_number: str,
    ticket_date: datetime,
    status: str,
    cred_json_path: str,
    db_url: str,
) -> Dict[str, Any]:
    """
    Push input-stage rows to Firebase Realtime DB (sandbox).

    df_source: DataFrame in your standard credit schema / input-stage schema.
    ticket_number: e.g. "TM-CR-24837"
    ticket_date: datetime of the ticket creation
    status: e.g. "Pending", "New"
    cred_json_path: path to the sandbox service account JSON
    db_url: sandbox RTDB URL (e.g. https://creditapp-sandbox-default-rtdb.firebaseio.com)
    """

    sa_path = cred_json_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not sa_path:
        raise ValueError(
            "Sandbox credential path is missing. Provide 'cred_json_path' or set GOOGLE_APPLICATION_CREDENTIALS."
        )
    app = _get_firebase_app(sa_path, db_url, app_name="input_stage_sandbox")
    root_ref = db.reference("sandbox_input_stage", app=app)

    submitted = 0
    skipped_duplicates = 0
    failed = 0
    details = []

    records = df_source.to_dict(orient="records")

    for row in records:
        try:
            invoice = str(row.get("Invoice Number") or "")
            item = str(row.get("Item Number") or "")
            customer = str(row.get("Customer Number") or "")
            combo_key = row.get("combo_key") or f"{invoice}|{item}|{customer}|{ticket_number}"

            payload = {
                **row,
                "Ticket Number": ticket_number,
                "ticket_date": ticket_date.isoformat(),
                "Status": status,
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }

            rec_ref = root_ref.child(combo_key)
            if rec_ref.get() is not None:
                skipped_duplicates += 1

            rec_ref.set(payload)
            submitted += 1
        except Exception as exc:
            failed += 1
            details.append(f"Failed to push record {row.get('combo_key') or combo_key}: {exc!r}")

    if submitted and not details:
        details.append(f"{submitted} rows submitted to sandbox_input_stage.")

    return {
        "submitted": submitted,
        "skipped_duplicates": skipped_duplicates,
        "failed": failed,
        "details": details,
    }
