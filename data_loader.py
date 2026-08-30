"""
data_loader.py — Public data loading module shared by FastAPI and BIAgent.
"""

import pandas as pd
from monday_api import get_boards, get_board_columns, get_board_items, MondayAPIError


def _get_board_dataframe(board_id: str, limit=None) -> pd.DataFrame:
    """Fetch board items → normalised DataFrame (column IDs mapped to titles)."""
    columns    = get_board_columns(board_id)
    id_to_title = {c["id"]: c["title"] for c in columns}

    items = get_board_items(board_id, limit=limit)
    if not items:
        return pd.DataFrame()

    data = []
    for item in items:
        row = {"Item Name": item.get("name", "Unknown")}
        for col in item.get("column_values", []):
            title = id_to_title.get(col.get("id"), col.get("id"))
            val   = col.get("text") or col.get("value")
            row[title] = val
        data.append(row)

    return pd.DataFrame(data)


def find_board(keyword: str):
    """Find a board whose name contains `keyword` (case-insensitive). Returns (id, name) or (None, None)."""
    try:
        boards = get_boards()
    except MondayAPIError:
        return None, None
    for b in boards:
        normalized_board_name = b["name"].lower().replace("_", " ")
        if keyword.lower() in normalized_board_name:
            return b["id"], b["name"]
    return None, None


def load_deals_df() -> tuple[pd.DataFrame, str]:
    """Load Deals board data. Returns (DataFrame, Board Name)."""
    bid, name = find_board("deal")
    if not bid:
        return pd.DataFrame(), "Deals board not found."
    df = _get_board_dataframe(bid, limit=None)
    return df, name


def load_wo_df() -> tuple[pd.DataFrame, str]:
    """Load Work Orders board data. Returns (DataFrame, Board Name)."""
    bid, name = find_board("work order")
    if not bid:
        return pd.DataFrame(), "Work Orders board not found."
    df = _get_board_dataframe(bid, limit=None)
    return df, name
