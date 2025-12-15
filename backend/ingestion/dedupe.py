# backend/ingestion/dedupe.py
from __future__ import annotations

from typing import Iterable, List, Sequence, Tuple

from .schemas import IngestedRow


def _row_key(row: IngestedRow, key_fields: Sequence[str]) -> Tuple:
    return tuple(getattr(row, field, None) for field in key_fields)


def mark_duplicates(
    rows: Iterable[IngestedRow],
    key_fields: Sequence[str],
) -> Tuple[List[IngestedRow], int]:
    """
    Remove duplicate rows based on key_fields.

    Returns (unique_rows, duplicate_count).
    """
    seen = set()
    unique_rows: List[IngestedRow] = []
    duplicate_count = 0

    for row in rows:
        key = _row_key(row, key_fields)
        if key in seen:
            duplicate_count += 1
            continue
        seen.add(key)
        unique_rows.append(row)

    return unique_rows, duplicate_count
