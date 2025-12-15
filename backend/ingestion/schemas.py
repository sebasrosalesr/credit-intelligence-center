# backend/ingestion/schemas.py
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class IngestionSource(str, Enum):
    MANUAL_UPLOAD = "manual_upload"
    AI_INTAKE = "ai_intake"


class FileFormat(str, Enum):
    EXCEL = "excel"
    CSV = "csv"
    UNKNOWN = "unknown"


class IngestedRow(BaseModel):
    account: Optional[str]
    customer_number: Optional[str]
    invoice_number: Optional[str]
    item_number: Optional[str]
    date: Optional[str]
    raw: Dict[str, Any]


class IngestionResult(BaseModel):
    source: IngestionSource
    file_format: FileFormat
    row_count: int
    duplicate_count: int
    rows: List[IngestedRow]
    warnings: List[str]
    errors: List[str]
