"""
analytics.py — Deterministic BI analytics engine for the Skylark Drones BI Copilot.

All functions accept pandas DataFrames and return either dicts or markdown strings.
The LLM never computes arithmetic; it calls these functions as tools.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

import pandas as pd

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

CLOSED_STATUSES = {"won", "lost", "dead", "closed", "cancelled", "canceled"}
WON_STATUSES    = {"won", "closed won"}
LOST_STATUSES   = {"lost", "closed lost", "dead"}

SECTOR_ALIASES: dict[str, str] = {
    "energy": "Energy", "power": "Energy", "oil & gas": "Energy",
    "infra": "Infrastructure", "infrastructure": "Infrastructure",
    "construction": "Construction", "civil": "Construction",
    "mining": "Mining", "mines": "Mining",
    "government": "Government", "govt": "Government", "gov": "Government",
    "utilities": "Utilities", "utility": "Utilities",
    "telecom": "Telecom", "telecommunications": "Telecom",
    "industrial": "Industrial",
}

STATUS_ALIASES: dict[str, str] = {
    "in progress": "In Progress", "wip": "In Progress", "ongoing": "In Progress",
    "active": "Active",
    "completed": "Completed", "complete": "Completed", "done": "Completed",
    "pending": "Pending", "not started": "Pending", "new": "Pending",
    "delayed": "Delayed", "overdue": "Delayed", "late": "Delayed",
    "cancelled": "Cancelled", "canceled": "Cancelled",
    "won": "Won", "closed won": "Won",
    "lost": "Lost", "closed lost": "Lost",
    "dead": "Dead",
    "on hold": "On Hold",
}


# ─────────────────────────────────────────────────────────────────────────────
# Normalization helpers
# ─────────────────────────────────────────────────────────────────────────────

def _to_float(series: pd.Series) -> pd.Series:
    """Strip currency symbols/commas and coerce to float."""
    return pd.to_numeric(
        series.astype(str).str.replace(r"[₹$€£,\s]", "", regex=True),
        errors="coerce",
    )


def _normalize_sector(val) -> str:
    if not isinstance(val, str) or not val.strip():
        return "Unknown"
    return SECTOR_ALIASES.get(val.strip().lower(), val.strip().title())


def _normalize_status(val) -> str:
    if not isinstance(val, str) or not val.strip():
        return "Unknown"
    return STATUS_ALIASES.get(val.strip().lower(), val.strip().title())


def _find_col(df: pd.DataFrame, *keywords: str) -> Optional[str]:
    """Return the first column whose name contains any of the keywords (case-insensitive)."""
    for kw in keywords:
        for col in df.columns:
            if kw.lower() in col.lower():
                return col
    return None


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply all standard cleaning to a raw board DataFrame:
    - Sector normalization
    - Status normalization
    - Strip whitespace from string columns
    - Coerce date columns
    """
    df = df.copy()
    for col in df.columns:
        lc = col.lower()
        if df[col].dtype == object:
            df[col] = df[col].astype(str).str.strip()
            df[col] = df[col].replace({"nan": None, "None": None, "": None})
        if "sector" in lc:
            df[col] = df[col].apply(_normalize_sector)
        if "status" in lc or "stage" in lc:
            df[col] = df[col].apply(_normalize_status)
        if "date" in lc or "close" in lc or "start" in lc or "end" in lc:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def data_quality_report(df: pd.DataFrame) -> dict:
    """
    Return a structured data-quality summary:
    {
        total_records, missing_by_column, null_counts,
        unparseable_dates, duplicate_names, confidence
    }
    """
    total = len(df)
    missing = {}
    for col in df.columns:
        null_count = df[col].isna().sum() + (df[col].astype(str) == "None").sum()
        if null_count:
            missing[col] = int(null_count)

    duplicate_names = int(df["Item Name"].duplicated().sum()) if "Item Name" in df.columns else 0

    # Confidence: High if <5% missing, Medium if <20%, Low otherwise
    avg_missing_pct = sum(missing.values()) / max(total * len(df.columns), 1)
    confidence = "High" if avg_missing_pct < 0.05 else ("Medium" if avg_missing_pct < 0.20 else "Low")

    return {
        "total_records": total,
        "missing_by_column": missing,
        "duplicate_item_names": duplicate_names,
        "confidence": confidence,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Time-based filtering
# ─────────────────────────────────────────────────────────────────────────────

def filter_by_period(df: pd.DataFrame, date_col: str, period: str) -> tuple[pd.DataFrame, str]:
    """
    Filter DataFrame rows by a natural-language period string.
    Returns (filtered_df, description_string).
    Supported: 'today', 'this week', 'this month', 'this quarter',
               'last quarter', 'last month', 'ytd', 'this year',
               'Q1/Q2/Q3/Q4 YYYY', custom 'YYYY-MM-DD:YYYY-MM-DD'
    """
    if date_col not in df.columns:
        return df, "no date filter applied (column not found)"

    now = pd.Timestamp.now()
    p = period.strip().lower()

    if p == "today":
        mask = df[date_col].dt.date == now.date()
        label = "today"
    elif p == "this week":
        week_start = now - pd.Timedelta(days=now.dayofweek)
        mask = df[date_col] >= week_start
        label = "this week"
    elif p == "this month":
        mask = (df[date_col].dt.month == now.month) & (df[date_col].dt.year == now.year)
        label = f"{now.strftime('%B %Y')}"
    elif p == "last month":
        lm = now - pd.DateOffset(months=1)
        mask = (df[date_col].dt.month == lm.month) & (df[date_col].dt.year == lm.year)
        label = f"{lm.strftime('%B %Y')}"
    elif p == "this quarter":
        q = now.quarter
        mask = (df[date_col].dt.quarter == q) & (df[date_col].dt.year == now.year)
        label = f"Q{q} {now.year}"
    elif p == "last quarter":
        lq_end = pd.Timestamp(now.year, (now.quarter - 1) * 3 or 12, 1) - pd.DateOffset(days=1) if now.quarter > 1 else pd.Timestamp(now.year - 1, 12, 31)
        lq_start = pd.Timestamp(lq_end.year, lq_end.month - 2 if lq_end.month > 2 else 1, 1)
        mask = (df[date_col] >= lq_start) & (df[date_col] <= lq_end)
        label = f"Q{lq_end.quarter} {lq_end.year}"
    elif p in ("ytd", "this year"):
        mask = df[date_col].dt.year == now.year
        label = f"YTD {now.year}"
    elif re.match(r"q[1-4]\s*\d{4}", p):
        m = re.match(r"q([1-4])\s*(\d{4})", p)
        q, yr = int(m.group(1)), int(m.group(2))
        mask = (df[date_col].dt.quarter == q) & (df[date_col].dt.year == yr)
        label = f"Q{q} {yr}"
    elif ":" in period:
        parts = period.split(":")
        start, end = pd.to_datetime(parts[0].strip(), errors="coerce"), pd.to_datetime(parts[1].strip(), errors="coerce")
        mask = (df[date_col] >= start) & (df[date_col] <= end)
        label = f"{parts[0].strip()} to {parts[1].strip()}"
    else:
        return df, "no date filter applied (unrecognised period)"

    filtered = df[mask]
    return filtered, label


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline Intelligence
# ─────────────────────────────────────────────────────────────────────────────

def get_pipeline_summary(deals_df: pd.DataFrame, period: str = "") -> dict:
    """
    Returns a comprehensive pipeline summary dict:
    total_pipeline, weighted_pipeline, open_count, won_count, lost_count,
    avg_deal_size, largest_deal, stalled_deals (>30 days no update),
    deals_near_close (within 30 days), excluded_closed, period_label, quality.
    """
    df = normalize_dataframe(deals_df.copy())

    value_col  = _find_col(df, "deal value", "masked deal value", "value", "amount")
    status_col = _find_col(df, "deal status", "status", "stage")
    prob_col   = _find_col(df, "prob", "probability", "closure")
    close_col  = _find_col(df, "close date", "expected close", "close")
    date_col   = _find_col(df, "created", "date")

    total_records = len(df)

    # Split by status
    def is_closed(row):
        if status_col and pd.notna(row.get(status_col)):
            return str(row[status_col]).lower() in CLOSED_STATUSES
        return False

    closed_mask = df.apply(is_closed, axis=1)
    won_mask    = df[status_col].astype(str).str.lower().isin(WON_STATUSES)  if status_col else pd.Series([False] * len(df))
    lost_mask   = df[status_col].astype(str).str.lower().isin(LOST_STATUSES) if status_col else pd.Series([False] * len(df))
    open_df     = df[~closed_mask].copy()

    # Period filter on open deals
    period_label = "all time"
    if period and close_col:
        open_df, period_label = filter_by_period(open_df, close_col, period)

    # Value
    if value_col:
        open_df["_value"] = _to_float(open_df[value_col])
    else:
        open_df["_value"] = float("nan")

    total_pipeline   = open_df["_value"].sum()
    avg_deal_size    = open_df["_value"].mean()
    largest_deal     = open_df["_value"].max()
    excluded_numeric = open_df["_value"].isna().sum()

    # Weighted pipeline
    weighted_pipeline = float("nan")
    if prob_col:
        open_df["_prob"] = _to_float(open_df[prob_col]) / 100.0
        open_df["_prob"] = open_df["_prob"].clip(0, 1).fillna(0.5)
        open_df["_weighted"] = open_df["_value"] * open_df["_prob"]
        weighted_pipeline = open_df["_weighted"].sum()

    # Stalled deals: no close_date change proxy — use age >30 days from created
    stalled = 0
    if date_col:
        open_df["_created"] = pd.to_datetime(open_df[date_col], errors="coerce")
        age = (pd.Timestamp.now() - open_df["_created"]).dt.days
        stalled = int((age > 30).sum())

    # Deals approaching close (within 30 days)
    near_close = 0
    if close_col:
        open_df["_close"] = pd.to_datetime(open_df[close_col], errors="coerce")
        days_to_close = (open_df["_close"] - pd.Timestamp.now()).dt.days
        near_close = int(((days_to_close >= 0) & (days_to_close <= 30)).sum())

    return {
        "period": period_label,
        "total_records": total_records,
        "open_deals": len(open_df),
        "won_deals": int(won_mask.sum()),
        "lost_deals": int(lost_mask.sum()),
        "excluded_closed": int(closed_mask.sum()),
        "total_pipeline": round(total_pipeline, 2) if not pd.isna(total_pipeline) else 0,
        "weighted_pipeline": round(weighted_pipeline, 2) if not pd.isna(weighted_pipeline) else None,
        "avg_deal_size": round(avg_deal_size, 2) if not pd.isna(avg_deal_size) else 0,
        "largest_deal": round(largest_deal, 2) if not pd.isna(largest_deal) else 0,
        "stalled_deals_count": stalled,
        "deals_near_close_30d": near_close,
        "excluded_missing_value": int(excluded_numeric),
        "win_rate_pct": round(won_mask.sum() / max(won_mask.sum() + lost_mask.sum(), 1) * 100, 1),
    }


def get_pipeline_by_dimension(deals_df: pd.DataFrame, dimension: str,
                               period: str = "", weighted: bool = False) -> str:
    """
    Returns a markdown table: pipeline value (and optionally weighted) grouped by `dimension`.
    Automatically excludes closed deals. Supports period filter.
    dimension examples: 'sector', 'owner', 'customer', 'stage', 'region'
    """
    df = normalize_dataframe(deals_df.copy())

    value_col  = _find_col(df, "deal value", "masked deal value", "value")
    status_col = _find_col(df, "deal status", "status", "stage")
    prob_col   = _find_col(df, "prob", "probability", "closure")
    close_col  = _find_col(df, "close date", "expected close", "close")
    dim_col    = _find_col(df, dimension)

    if not dim_col:
        return f"⚠️ No column matching '{dimension}'. Available: {', '.join(df.columns)}"
    if not value_col:
        return f"⚠️ No deal value column found. Available: {', '.join(df.columns)}"

    # Exclude closed
    if status_col:
        df = df[~df[status_col].astype(str).str.lower().isin(CLOSED_STATUSES)]

    # Period filter
    period_label = "all time"
    if period and close_col:
        df, period_label = filter_by_period(df, close_col, period)

    df["_value"] = _to_float(df[value_col])
    excluded = df["_value"].isna().sum()

    if weighted and prob_col:
        df["_prob"] = (_to_float(df[prob_col]) / 100.0).clip(0, 1).fillna(0.5)
        df["_value"] = df["_value"] * df["_prob"]
        val_label = "Weighted Pipeline (₹)"
    else:
        val_label = "Pipeline Value (₹)"

    df = df.dropna(subset=["_value", dim_col])
    summary = (
        df.groupby(dim_col)["_value"]
        .agg(["sum", "count"])
        .reset_index()
        .rename(columns={"sum": val_label, "count": "Deal Count"})
        .sort_values(val_label, ascending=False)
    )

    total = summary[val_label].sum()
    summary["Share %"] = (summary[val_label] / total * 100).round(1)
    summary = pd.concat([
        summary,
        pd.DataFrame([{dim_col: "TOTAL", val_label: total, "Deal Count": int(summary["Deal Count"].sum()), "Share %": 100.0}])
    ], ignore_index=True)

    caveat = f"\n\n📊 Period: **{period_label}** | {excluded} records excluded (missing value) | {'Weighted' if weighted else 'Unweighted'} pipeline"
    return summary.to_markdown(index=False) + caveat


def get_pipeline_health_score(deals_df: pd.DataFrame) -> dict:
    """
    Generates a 0–100 pipeline health score with component breakdown:
    - Size score (30 pts): pipeline vs average deal size
    - Win rate (20 pts): conversion rate
    - Age score (20 pts): penalise stalled deals
    - Stage distribution (15 pts): spread across stages
    - Concentration (15 pts): penalise if top 3 deals >60% of pipeline
    """
    summary = get_pipeline_summary(deals_df)

    scores: dict[str, int] = {}

    # Win rate (20 pts)
    wr = summary["win_rate_pct"]
    scores["win_rate"] = int(min(20, wr / 5))  # 20 pts at 100% win rate

    # Pipeline size (30 pts) — heuristic: score 30 if pipeline > 10x avg deal size
    total = summary["total_pipeline"]
    avg   = summary["avg_deal_size"] or 1
    size_ratio = min(total / (avg * 10), 1.0)
    scores["pipeline_size"] = int(size_ratio * 30)

    # Stall penalty (20 pts) — lose pts for stalled deals ratio
    open_d = summary["open_deals"] or 1
    stall_ratio = summary["stalled_deals_count"] / open_d
    scores["deal_freshness"] = int((1 - stall_ratio) * 20)

    # Near-close score (15 pts) — reward having deals approaching close
    near_ratio = min(summary["deals_near_close_30d"] / max(open_d, 1), 1.0)
    scores["near_close"] = int(near_ratio * 15)

    # Concentration (15 pts) — approximate: if largest deal > 50% of pipeline, penalise
    largest = summary["largest_deal"] or 0
    concentration_pct = largest / max(total, 1) * 100
    scores["concentration"] = int((1 - min(concentration_pct / 100, 1.0)) * 15)

    total_score = sum(scores.values())
    rating = "Excellent" if total_score >= 80 else ("Healthy" if total_score >= 60 else ("At Risk" if total_score >= 40 else "Critical"))

    return {
        "score": total_score,
        "rating": rating,
        "breakdown": scores,
        "summary": summary,
    }


def get_deal_risk_flags(deals_df: pd.DataFrame) -> str:
    """
    Returns a markdown table of at-risk deals flagged for:
    - Stalled (>30 days old, still open)
    - Large deal (>2x avg) with missing close date
    - Overdue close date (past expected close, still open)
    - Missing deal value
    """
    df = normalize_dataframe(deals_df.copy())
    if df.empty or len(df.columns) == 0:
        return "No deals data available to analyse for risk."

    status_col = _find_col(df, "deal status", "status", "stage")
    value_col  = _find_col(df, "deal value", "masked deal value", "value")
    close_col  = _find_col(df, "close date", "expected close", "close")
    date_col   = _find_col(df, "created", "date")
    name_col   = "Item Name" if "Item Name" in df.columns else (df.columns[0] if len(df.columns) > 0 else "Name")

    # Filter to open deals only
    if status_col:
        df = df[~df[status_col].astype(str).str.lower().isin(CLOSED_STATUSES)]

    if df.empty:
        return "No open deals to analyse for risk."

    df["_value"] = _to_float(df[value_col]) if value_col else float("nan")
    avg_value = df["_value"].mean()

    flags = []
    now = pd.Timestamp.now()

    for _, row in df.iterrows():
        deal_flags = []
        name  = row.get(name_col, "Unknown")
        value = row.get("_value", float("nan"))

        # Missing value
        if pd.isna(value):
            deal_flags.append("Missing deal value")

        # Stalled
        if date_col:
            created = pd.to_datetime(row.get(date_col), errors="coerce")
            if pd.notna(created) and (now - created).days > 30:
                deal_flags.append(f"Stalled {(now - created).days}d")

        # Overdue close
        if close_col:
            close_dt = pd.to_datetime(row.get(close_col), errors="coerce")
            if pd.notna(close_dt) and close_dt < now:
                deal_flags.append(f"Overdue by {(now - close_dt).days}d")
            # Missing close date on large deal
            if pd.isna(close_dt) and not pd.isna(value) and value > avg_value * 2:
                deal_flags.append("Large deal — no close date")

        if deal_flags:
            flags.append({
                "Deal": name,
                "Value (₹)": f"{value:,.0f}" if not pd.isna(value) else "N/A",
                "Sector": row.get(_find_col(df, "sector") or "", "—"),
                "Flags": " | ".join(deal_flags),
            })

    if not flags:
        return "✅ No at-risk deals detected."

    result_df = pd.DataFrame(flags).sort_values("Flags")
    return f"⚠️ **{len(flags)} at-risk deals**\n\n" + result_df.to_markdown(index=False)


def get_deal_prioritization(deals_df: pd.DataFrame, top_n: int = 10) -> str:
    """
    Ranks open deals by a composite score: value × probability × recency.
    Returns top_n as a markdown table.
    """
    df = normalize_dataframe(deals_df.copy())
    if df.empty or len(df.columns) == 0:
        return "No deals data available to analyse for risk."

    status_col = _find_col(df, "deal status", "status", "stage")
    value_col  = _find_col(df, "deal value", "masked deal value", "value")
    prob_col   = _find_col(df, "prob", "probability", "closure")
    close_col  = _find_col(df, "close date", "expected close", "close")
    name_col   = "Item Name" if "Item Name" in df.columns else df.columns[0]
    sector_col = _find_col(df, "sector")

    if status_col:
        df = df[~df[status_col].astype(str).str.lower().isin(CLOSED_STATUSES)]

    df["_value"] = _to_float(df[value_col]) if value_col else 0.0
    df["_prob"]  = (_to_float(df[prob_col]) / 100.0).clip(0, 1).fillna(0.5) if prob_col else 0.5

    # Recency: invert days-to-close (closer = higher score)
    if close_col:
        df["_close"] = pd.to_datetime(df[close_col], errors="coerce")
        days = (df["_close"] - pd.Timestamp.now()).dt.days.clip(lower=0).fillna(90)
        df["_recency"] = 1 / (1 + days / 30)
    else:
        df["_recency"] = 0.5

    df["_score"] = df["_value"] * df["_prob"] * df["_recency"]
    df = df.sort_values("_score", ascending=False).head(top_n)

    output_cols = {
        "Rank": range(1, len(df) + 1),
        "Deal": df[name_col].values,
        "Value (₹)": df["_value"].apply(lambda x: f"{x:,.0f}" if not pd.isna(x) else "N/A").values,
        "Probability": df["_prob"].apply(lambda x: f"{x*100:.0f}%").values,
    }
    if sector_col:
        output_cols["Sector"] = df[sector_col].values
    if close_col:
        output_cols["Expected Close"] = df["_close"].dt.strftime("%Y-%m-%d").values

    return pd.DataFrame(output_cols).to_markdown(index=False)


# ─────────────────────────────────────────────────────────────────────────────
# Revenue Intelligence
# ─────────────────────────────────────────────────────────────────────────────

def get_revenue_summary(deals_df: pd.DataFrame, period: str = "") -> dict:
    """Won revenue summary: total won, avg contract value, forecast (best/expected/conservative)."""
    df = normalize_dataframe(deals_df.copy())

    value_col  = _find_col(df, "deal value", "masked deal value", "value")
    status_col = _find_col(df, "deal status", "status", "stage")
    prob_col   = _find_col(df, "prob", "probability", "closure")
    close_col  = _find_col(df, "close date", "expected close", "close")

    won_df  = df[df[status_col].astype(str).str.lower().isin(WON_STATUSES)].copy()  if status_col else pd.DataFrame()
    open_df = df[~df[status_col].astype(str).str.lower().isin(CLOSED_STATUSES)].copy() if status_col else df.copy()

    period_label = "all time"
    if period and close_col:
        won_df, period_label = filter_by_period(won_df, close_col, period)
        open_df, _ = filter_by_period(open_df, close_col, period)

    def total_value(frame):
        if frame.empty or not value_col:
            return 0.0
        return _to_float(frame[value_col]).sum()

    won_revenue = total_value(won_df)
    open_pipeline = total_value(open_df)

    # Forecast scenarios
    if prob_col and not open_df.empty:
        prob = (_to_float(open_df[prob_col]) / 100.0).clip(0, 1).fillna(0.5)
        val  = _to_float(open_df[value_col]) if value_col else pd.Series([0.0] * len(open_df))
        expected    = (val * prob).sum()
        best_case   = val.sum()
        conservative= (val * (prob * 0.7)).sum()
    else:
        expected = open_pipeline * 0.5
        best_case = open_pipeline
        conservative = open_pipeline * 0.3

    return {
        "period": period_label,
        "won_revenue": round(won_revenue, 2),
        "won_deals_count": len(won_df),
        "avg_contract_value": round(won_revenue / max(len(won_df), 1), 2),
        "open_pipeline": round(open_pipeline, 2),
        "forecast_best_case": round(best_case, 2),
        "forecast_expected": round(expected, 2),
        "forecast_conservative": round(conservative, 2),
    }


def get_revenue_by_dimension(deals_df: pd.DataFrame, dimension: str, period: str = "") -> str:
    """Revenue (won deals) grouped by a dimension with period filter."""
    df = normalize_dataframe(deals_df.copy())

    value_col  = _find_col(df, "deal value", "masked deal value", "value")
    status_col = _find_col(df, "deal status", "status", "stage")
    close_col  = _find_col(df, "close date", "expected close", "close")
    dim_col    = _find_col(df, dimension)

    if not dim_col:
        return f"⚠️ No column matching '{dimension}'. Available: {', '.join(df.columns)}"

    won_df = df[df[status_col].astype(str).str.lower().isin(WON_STATUSES)].copy() if status_col else df.copy()

    period_label = "all time"
    if period and close_col:
        won_df, period_label = filter_by_period(won_df, close_col, period)

    won_df["_value"] = _to_float(won_df[value_col]) if value_col else float("nan")
    won_df = won_df.dropna(subset=["_value", dim_col])

    summary = (
        won_df.groupby(dim_col)["_value"]
        .agg(["sum", "count"])
        .reset_index()
        .rename(columns={"sum": "Won Revenue (₹)", "count": "Deals Won"})
        .sort_values("Won Revenue (₹)", ascending=False)
    )
    total = summary["Won Revenue (₹)"].sum()
    summary["Share %"] = (summary["Won Revenue (₹)"] / total * 100).round(1)
    summary = pd.concat([
        summary,
        pd.DataFrame([{dim_col: "TOTAL", "Won Revenue (₹)": total, "Deals Won": int(summary["Deals Won"].sum()), "Share %": 100.0}])
    ], ignore_index=True)

    return summary.to_markdown(index=False) + f"\n\n📊 Period: **{period_label}**"


def get_revenue_trends(deals_df: pd.DataFrame, freq: str = "Q") -> str:
    """
    Month-over-month or quarter-over-quarter won revenue trend.
    freq: 'M' for monthly, 'Q' for quarterly
    """
    df = normalize_dataframe(deals_df.copy())
    status_col = _find_col(df, "deal status", "status", "stage")
    value_col  = _find_col(df, "deal value", "masked deal value", "value")
    close_col  = _find_col(df, "close date", "expected close", "close")

    if not all([status_col, value_col, close_col]):
        return "⚠️ Cannot compute trends — missing status, value, or close date columns."

    won_df = df[df[status_col].astype(str).str.lower().isin(WON_STATUSES)].copy()
    won_df["_value"] = _to_float(won_df[value_col])
    won_df["_close"] = pd.to_datetime(won_df[close_col], errors="coerce")
    won_df = won_df.dropna(subset=["_value", "_close"])

    trend = (
        won_df.set_index("_close")["_value"]
        .resample(freq)
        .sum()
        .reset_index()
        .rename(columns={"_close": "Period", "_value": "Won Revenue (₹)"})
    )
    trend["Period"] = trend["Period"].dt.to_period(freq).astype(str)
    trend["Change"] = trend["Won Revenue (₹)"].diff()
    trend["Change %"] = trend["Won Revenue (₹)"].pct_change().mul(100).round(1)
    trend["Change"] = trend["Change"].apply(lambda x: f"+{x:,.0f}" if x > 0 else f"{x:,.0f}" if not pd.isna(x) else "—")
    trend["Change %"] = trend["Change %"].apply(lambda x: f"+{x}%" if x > 0 else f"{x}%" if not pd.isna(x) else "—")

    label = "Quarterly" if freq == "Q" else "Monthly"
    return f"### {label} Won Revenue Trend\n\n" + trend.to_markdown(index=False)


def get_scenario_analysis(deals_df: pd.DataFrame, scenario: str) -> str:
    """
    What-if scenario analysis.
    Supported scenario strings:
      - 'close X% of DIMENSION' e.g. 'close 50% of energy'
      - 'win rate improves by X%'
      - 'lose top N deals'
    """
    df = normalize_dataframe(deals_df.copy())
    status_col = _find_col(df, "deal status", "status", "stage")
    value_col  = _find_col(df, "deal value", "masked deal value", "value")
    prob_col   = _find_col(df, "prob", "probability", "closure")

    if status_col:
        df = df[~df[status_col].astype(str).str.lower().isin(CLOSED_STATUSES)]
    df["_value"] = _to_float(df[value_col]) if value_col else float("nan")
    current_pipeline = df["_value"].sum()

    s = scenario.lower().strip()

    # Pattern: "close X% of <dimension>"
    m = re.match(r"close\s+(\d+)%\s+of\s+(.+)", s)
    if m:
        pct, target = float(m.group(1)) / 100, m.group(2).strip()
        # Try to match target to a sector/stage column
        sector_col = _find_col(df, "sector")
        match_df   = df[df[sector_col].astype(str).str.lower().str.contains(target)] if sector_col else df
        closed_val = match_df["_value"].sum() * pct
        remaining  = current_pipeline - match_df["_value"].sum() + (match_df["_value"].sum() * (1 - pct))
        return (
            f"**Scenario: Close {pct*100:.0f}% of '{target.title()}' pipeline**\n\n"
            f"- {target.title()} pipeline: ₹{match_df['_value'].sum():,.0f}\n"
            f"- Revenue recognised at {pct*100:.0f}%: **₹{closed_val:,.0f}**\n"
            f"- Remaining open pipeline: ₹{remaining:,.0f}\n"
            f"- Total pipeline (before): ₹{current_pipeline:,.0f}"
        )

    # Pattern: "win rate improves by X%"
    m = re.match(r"win rate.*?(\d+)%", s)
    if m:
        improvement = float(m.group(1)) / 100
        if prob_col:
            df["_prob"] = (_to_float(df[prob_col]) / 100).clip(0, 1).fillna(0.5)
        else:
            df["_prob"] = 0.5
        base_expected    = (df["_value"] * df["_prob"]).sum()
        new_prob         = (df["_prob"] + improvement).clip(0, 1)
        improved_expected = (df["_value"] * new_prob).sum()
        uplift           = improved_expected - base_expected
        return (
            f"**Scenario: Win rate improves by {m.group(1)}%**\n\n"
            f"- Current expected revenue: ₹{base_expected:,.0f}\n"
            f"- Improved expected revenue: **₹{improved_expected:,.0f}**\n"
            f"- Uplift: **+₹{uplift:,.0f}**"
        )

    # Pattern: "lose top N deals"
    m = re.match(r"lose\s+top\s+(\d+)", s)
    if m:
        n = int(m.group(1))
        top_deals = df.nlargest(n, "_value")
        lost_value = top_deals["_value"].sum()
        remaining  = current_pipeline - lost_value
        return (
            f"**Scenario: Lose top {n} deals**\n\n"
            f"- Combined value of top {n} deals: ₹{lost_value:,.0f} "
            f"({lost_value/current_pipeline*100:.1f}% of pipeline)\n"
            f"- Remaining pipeline: **₹{remaining:,.0f}**\n\n"
            + top_deals[["Item Name" if "Item Name" in top_deals.columns else top_deals.columns[0], "_value"]].rename(
                columns={"Item Name": "Deal", "_value": "Value (₹)"}
            ).to_markdown(index=False)
        )

    return f"⚠️ Unrecognised scenario: '{scenario}'. Try: 'close 50% of energy', 'win rate improves by 10%', or 'lose top 3 deals'."


# ─────────────────────────────────────────────────────────────────────────────
# Operations Intelligence
# ─────────────────────────────────────────────────────────────────────────────

def get_workorder_summary(wo_df: pd.DataFrame, period: str = "") -> dict:
    """Returns total, active, completed, pending, delayed counts plus backlog."""
    df = normalize_dataframe(wo_df.copy())
    status_col = _find_col(df, "execution status", "wo status", "status")
    date_col   = _find_col(df, "start date", "date", "created")

    period_label = "all time"
    if period and date_col:
        df, period_label = filter_by_period(df, date_col, period)

    counts: dict[str, int] = {"total": len(df), "active": 0, "completed": 0,
                               "pending": 0, "delayed": 0, "cancelled": 0, "unknown": 0}

    if status_col:
        statuses = df[status_col].astype(str).str.lower()
        counts["completed"] = int(statuses.isin({"completed", "done", "complete"}).sum())
        counts["active"]    = int(statuses.isin({"active", "in progress", "ongoing"}).sum())
        counts["pending"]   = int(statuses.isin({"pending", "not started", "new"}).sum())
        counts["delayed"]   = int(statuses.isin({"delayed", "overdue", "late"}).sum())
        counts["cancelled"] = int(statuses.isin({"cancelled", "canceled"}).sum())
        counts["unknown"]   = counts["total"] - sum(v for k, v in counts.items() if k != "total")

    return {"period": period_label, **counts}


def get_workorder_by_dimension(wo_df: pd.DataFrame, dimension: str, period: str = "") -> str:
    """Work order counts grouped by a dimension (sector, customer, status, region)."""
    df = normalize_dataframe(wo_df.copy())
    dim_col  = _find_col(df, dimension)
    date_col = _find_col(df, "start date", "date", "created")

    if not dim_col:
        return f"⚠️ No column matching '{dimension}'. Available: {', '.join(df.columns)}"

    period_label = "all time"
    if period and date_col:
        df, period_label = filter_by_period(df, date_col, period)

    summary = (
        df.groupby(dim_col)
        .size()
        .reset_index(name="Work Orders")
        .sort_values("Work Orders", ascending=False)
    )
    total = summary["Work Orders"].sum()
    summary["Share %"] = (summary["Work Orders"] / total * 100).round(1)

    return summary.to_markdown(index=False) + f"\n\n📊 Period: **{period_label}** | Total: {total}"


def get_delayed_projects(wo_df: pd.DataFrame) -> str:
    """Returns delayed/overdue work orders sorted by how late they are."""
    df = normalize_dataframe(wo_df.copy())
    status_col  = _find_col(df, "execution status", "wo status", "status")
    end_col     = _find_col(df, "end date", "due date", "completion date")
    name_col    = "Item Name" if "Item Name" in df.columns else df.columns[0]
    sector_col  = _find_col(df, "sector")
    customer_col = _find_col(df, "customer", "client")

    if status_col:
        is_delayed = df[status_col].astype(str).str.lower().isin({"delayed", "overdue", "late", "in progress", "active"})
        df = df[is_delayed]

    if end_col:
        df["_end"] = pd.to_datetime(df[end_col], errors="coerce")
        now = pd.Timestamp.now()
        df["Days Overdue"] = (now - df["_end"]).dt.days.clip(lower=0)
        df = df[df["_end"] < now].sort_values("Days Overdue", ascending=False)

    if df.empty:
        return "✅ No delayed projects detected."

    output = {"Project": df[name_col]}
    if sector_col:
        output["Sector"] = df[sector_col]
    if customer_col:
        output["Customer"] = df[customer_col]
    if end_col:
        output["Due Date"] = df["_end"].dt.strftime("%Y-%m-%d")
        output["Days Overdue"] = df["Days Overdue"].astype(int)

    return f"⚠️ **{len(df)} delayed projects**\n\n" + pd.DataFrame(output).to_markdown(index=False)


def get_operational_backlog(wo_df: pd.DataFrame, top_n: int = 15) -> str:
    """Returns upcoming / pending work orders sorted by start date."""
    df = normalize_dataframe(wo_df.copy())
    status_col = _find_col(df, "execution status", "wo status", "status")
    start_col  = _find_col(df, "start date", "date")
    name_col   = "Item Name" if "Item Name" in df.columns else df.columns[0]
    sector_col = _find_col(df, "sector")

    if status_col:
        is_upcoming = df[status_col].astype(str).str.lower().isin({"pending", "not started", "new", "active", "in progress"})
        df = df[is_upcoming]

    if start_col:
        df["_start"] = pd.to_datetime(df[start_col], errors="coerce")
        df = df.sort_values("_start")

    if df.empty:
        return "No upcoming work orders found."

    output = {"Project": df[name_col].values[:top_n]}
    if sector_col:
        output["Sector"] = df[sector_col].values[:top_n]
    if start_col:
        output["Start Date"] = df["_start"].dt.strftime("%Y-%m-%d").values[:top_n]

    return f"### Operational Backlog (next {min(top_n, len(df))} projects)\n\n" + pd.DataFrame(output).to_markdown(index=False)


# ─────────────────────────────────────────────────────────────────────────────
# Cross-Board Intelligence
# ─────────────────────────────────────────────────────────────────────────────

def get_cross_board_analysis(deals_df: pd.DataFrame, wo_df: pd.DataFrame) -> dict:
    """
    Returns customers with both open deals and active work orders,
    plus a comparison of pipeline vs delivered work value.
    """
    deals = normalize_dataframe(deals_df.copy())
    work  = normalize_dataframe(wo_df.copy())

    d_cust = _find_col(deals, "customer", "client", "account")
    w_cust = _find_col(work,  "customer", "client", "account")

    overlap: list[str] = []
    if d_cust and w_cust:
        deals_customers = set(deals[d_cust].dropna().str.lower())
        work_customers  = set(work[w_cust].dropna().str.lower())
        overlap = sorted(deals_customers & work_customers)

    d_status = _find_col(deals, "deal status", "status")
    if d_status:
        open_pipeline_count = len(deals[~deals[d_status].astype(str).str.lower().isin(CLOSED_STATUSES)])
    else:
        open_pipeline_count = len(deals)

    w_status = _find_col(work, "execution status", "status")
    active_wo = 0
    if w_status:
        active_wo = int(work[work[w_status].astype(str).str.lower().isin({"active", "in progress"})].shape[0])

    return {
        "customers_with_both_pipeline_and_projects": overlap,
        "overlap_count": len(overlap),
        "open_pipeline_deals": open_pipeline_count,
        "active_work_orders": active_wo,
        "note": "Overlap customers have both active open deals and active work orders — high-touch accounts.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Sector, Customer, Owner Analysis
# ─────────────────────────────────────────────────────────────────────────────

def get_sector_analysis(deals_df: pd.DataFrame, wo_df: pd.DataFrame, period: str = "") -> str:
    """
    Combined sector report: pipeline, won revenue, win rate, deal count, work orders.
    """
    deals = normalize_dataframe(deals_df.copy())
    work  = normalize_dataframe(wo_df.copy())

    d_sector = _find_col(deals, "sector")
    w_sector = _find_col(work,  "sector")
    d_status = _find_col(deals, "deal status", "status", "stage")
    d_value  = _find_col(deals, "deal value", "masked deal value", "value")

    if not d_sector:
        return "⚠️ No sector column found in deals board."

    # Open pipeline by sector
    open_deals = deals[~deals[d_status].astype(str).str.lower().isin(CLOSED_STATUSES)].copy() if d_status else deals.copy()
    open_deals["_value"] = _to_float(open_deals[d_value]) if d_value else 0.0
    pipeline_by_sector = open_deals.groupby(d_sector)["_value"].sum().rename("Pipeline (₹)")

    # Won revenue by sector
    won_deals = deals[deals[d_status].astype(str).str.lower().isin(WON_STATUSES)].copy() if d_status else pd.DataFrame()
    if not won_deals.empty and d_value:
        won_deals["_value"] = _to_float(won_deals[d_value])
        revenue_by_sector = won_deals.groupby(d_sector)["_value"].sum().rename("Won Revenue (₹)")
    else:
        revenue_by_sector = pd.Series(dtype=float, name="Won Revenue (₹)")

    # Win rate by sector
    if d_status:
        won_c  = deals[deals[d_status].astype(str).str.lower().isin(WON_STATUSES)].groupby(d_sector).size()
        lost_c = deals[deals[d_status].astype(str).str.lower().isin(LOST_STATUSES)].groupby(d_sector).size()
        win_rate = (won_c / (won_c + lost_c).replace(0, float("nan")) * 100).round(1).rename("Win Rate %")
    else:
        win_rate = pd.Series(dtype=float, name="Win Rate %")

    # Work orders by sector
    wo_by_sector = pd.Series(dtype=int, name="Work Orders")
    if w_sector:
        wo_by_sector = work.groupby(w_sector).size().rename("Work Orders")

    summary = pd.DataFrame({
        "Pipeline (₹)": pipeline_by_sector,
        "Won Revenue (₹)": revenue_by_sector,
        "Win Rate %": win_rate,
        "Work Orders": wo_by_sector,
    }).fillna(0).sort_values("Pipeline (₹)", ascending=False).reset_index()
    summary.rename(columns={summary.columns[0]: "Sector"}, inplace=True)

    return "### Sector Analysis\n\n" + summary.to_markdown(index=False)


def get_customer_analysis(deals_df: pd.DataFrame, wo_df: pd.DataFrame, top_n: int = 10) -> str:
    """Top customers by pipeline + revenue + work orders. Flags dormant accounts."""
    deals = normalize_dataframe(deals_df.copy())
    work  = normalize_dataframe(wo_df.copy())

    d_cust   = _find_col(deals, "customer", "client", "account")
    d_status = _find_col(deals, "deal status", "status")
    d_value  = _find_col(deals, "deal value", "masked deal value", "value")
    w_cust   = _find_col(work,  "customer", "client", "account")

    if not d_cust:
        return "⚠️ No customer column found in deals board."

    deals["_value"] = _to_float(deals[d_value]) if d_value else 0.0
    open_deals = deals[~deals[d_status].astype(str).str.lower().isin(CLOSED_STATUSES)] if d_status else deals
    won_deals  = deals[deals[d_status].astype(str).str.lower().isin(WON_STATUSES)]      if d_status else pd.DataFrame()

    pipeline = open_deals.groupby(d_cust)["_value"].sum().rename("Open Pipeline (₹)")
    revenue  = won_deals.groupby(d_cust)["_value"].sum().rename("Won Revenue (₹)") if not won_deals.empty else pd.Series(dtype=float, name="Won Revenue (₹)")
    deal_cnt = deals.groupby(d_cust).size().rename("Total Deals")

    wo_cnt = pd.Series(dtype=int, name="Work Orders")
    if w_cust:
        wo_cnt = work.groupby(w_cust).size().rename("Work Orders")

    summary = pd.DataFrame({
        "Open Pipeline (₹)": pipeline,
        "Won Revenue (₹)": revenue,
        "Total Deals": deal_cnt,
        "Work Orders": wo_cnt,
    }).fillna(0).sort_values("Open Pipeline (₹)", ascending=False).head(top_n).reset_index()
    summary.rename(columns={summary.columns[0]: "Customer"}, inplace=True)

    return f"### Top {top_n} Customers\n\n" + summary.to_markdown(index=False)


def get_owner_performance(deals_df: pd.DataFrame) -> str:
    """Pipeline, won revenue, win rate, deal count per salesperson/owner."""
    df = normalize_dataframe(deals_df.copy())
    owner_col  = _find_col(df, "owner", "sales", "assigned", "rep")
    status_col = _find_col(df, "deal status", "status", "stage")
    value_col  = _find_col(df, "deal value", "masked deal value", "value")

    if not owner_col:
        return "⚠️ No owner/salesperson column found."

    df["_value"] = _to_float(df[value_col]) if value_col else 0.0
    open_df = df[~df[status_col].astype(str).str.lower().isin(CLOSED_STATUSES)] if status_col else df
    won_df  = df[df[status_col].astype(str).str.lower().isin(WON_STATUSES)]     if status_col else pd.DataFrame()
    lost_df = df[df[status_col].astype(str).str.lower().isin(LOST_STATUSES)]    if status_col else pd.DataFrame()

    pipeline = open_df.groupby(owner_col)["_value"].sum().rename("Open Pipeline (₹)")
    revenue  = won_df.groupby(owner_col)["_value"].sum().rename("Won Revenue (₹)")    if not won_df.empty  else pd.Series(dtype=float, name="Won Revenue (₹)")
    won_cnt  = won_df.groupby(owner_col).size().rename("Won")                          if not won_df.empty  else pd.Series(dtype=int,   name="Won")
    lost_cnt = lost_df.groupby(owner_col).size().rename("Lost")                        if not lost_df.empty else pd.Series(dtype=int,   name="Lost")

    summary = pd.DataFrame({"Open Pipeline (₹)": pipeline, "Won Revenue (₹)": revenue,
                            "Won": won_cnt, "Lost": lost_cnt}).fillna(0)
    summary["Win Rate %"] = (summary["Won"] / (summary["Won"] + summary["Lost"]).replace(0, float("nan")) * 100).round(1)
    summary = summary.sort_values("Won Revenue (₹)", ascending=False).reset_index()
    summary.rename(columns={summary.columns[0]: "Owner"}, inplace=True)

    return "### Owner / Salesperson Performance\n\n" + summary.to_markdown(index=False)


# ─────────────────────────────────────────────────────────────────────────────
# Anomaly & Trend Detection
# ─────────────────────────────────────────────────────────────────────────────

def get_anomalies(deals_df: pd.DataFrame, wo_df: pd.DataFrame) -> str:
    """Flag statistically unusual records: giant deals, duplicate customers, very old open deals."""
    deals = normalize_dataframe(deals_df.copy())
    work  = normalize_dataframe(wo_df.copy())

    findings: list[str] = []

    # Abnormally large deals (>3 std devs above mean)
    value_col = _find_col(deals, "deal value", "masked deal value", "value")
    if value_col:
        vals = _to_float(deals[value_col]).dropna()
        if len(vals) > 3:
            mean, std = vals.mean(), vals.std()
            outliers  = deals[_to_float(deals[value_col]) > mean + 3 * std]
            if not outliers.empty:
                names = outliers["Item Name"].tolist() if "Item Name" in outliers.columns else []
                findings.append(f"🔴 **{len(outliers)} abnormally large deal(s)** (>3σ): {', '.join(names[:5])}")

    # Duplicate customer names in deals
    d_cust = _find_col(deals, "customer", "client")
    if d_cust:
        dupes = deals[d_cust].dropna().duplicated(keep=False)
        if dupes.sum():
            findings.append(f"🟡 **{dupes.sum()} deals share duplicate customer names** — possible data entry inconsistency.")

    # Very old open deals (>180 days since created)
    d_status = _find_col(deals, "deal status", "status")
    d_date   = _find_col(deals, "created", "date")
    if d_status and d_date:
        open_df = deals[~deals[d_status].astype(str).str.lower().isin(CLOSED_STATUSES)]
        open_df["_created"] = pd.to_datetime(open_df[d_date], errors="coerce")
        old = open_df[(pd.Timestamp.now() - open_df["_created"]).dt.days > 180]
        if not old.empty:
            findings.append(f"🟠 **{len(old)} open deal(s) older than 180 days** — consider reviewing or closing.")

    # Operations: work orders with no status
    w_status = _find_col(work, "execution status", "status")
    if w_status:
        no_status = work[work[w_status].isna() | (work[w_status].astype(str).str.lower() == "unknown")]
        if not no_status.empty:
            findings.append(f"🟡 **{len(no_status)} work order(s) with missing/unknown status**.")

    return "\n".join(findings) if findings else "✅ No anomalies detected."


# ─────────────────────────────────────────────────────────────────────────────
# Comparative Analysis
# ─────────────────────────────────────────────────────────────────────────────

def compare_dimensions(df: pd.DataFrame, dim_col: str, val_col: str,
                        dim_a: str, dim_b: str) -> str:
    """
    Side-by-side comparison of two dimension values (e.g., Energy vs Infrastructure).
    Returns a markdown table.
    """
    d = normalize_dataframe(df.copy())
    col_d = _find_col(d, dim_col)
    col_v = _find_col(d, val_col)

    if not col_d or not col_v:
        return f"⚠️ Could not find columns for '{dim_col}' or '{val_col}'."

    d["_val"] = _to_float(d[col_v])

    def stats(name):
        subset = d[d[col_d].astype(str).str.lower().str.contains(name.lower())]
        return {
            "Dimension": name.title(),
            "Count": len(subset),
            "Total (₹)": round(subset["_val"].sum(), 2),
            "Average (₹)": round(subset["_val"].mean(), 2) if not subset.empty else 0,
            "Max (₹)": round(subset["_val"].max(), 2) if not subset.empty else 0,
        }

    result = pd.DataFrame([stats(dim_a), stats(dim_b)])
    return f"### {dim_a.title()} vs {dim_b.title()}\n\n" + result.to_markdown(index=False)


def period_over_period(df: pd.DataFrame, date_col: str, val_col: str,
                        current_period: str, prior_period: str) -> str:
    """Compare a metric between two periods and show the delta + contribution."""
    d = normalize_dataframe(df.copy())
    col_d = _find_col(d, date_col)
    col_v = _find_col(d, val_col)

    if not col_d or not col_v:
        return f"⚠️ Could not find '{date_col}' or '{val_col}' columns."

    d["_val"] = _to_float(d[col_v])
    curr_df, curr_lbl = filter_by_period(d, col_d, current_period)
    prior_df, prior_lbl = filter_by_period(d, col_d, prior_period)

    curr_total  = curr_df["_val"].sum()
    prior_total = prior_df["_val"].sum()
    delta       = curr_total - prior_total
    delta_pct   = (delta / prior_total * 100) if prior_total else float("nan")

    direction = "▲" if delta >= 0 else "▼"

    return (
        f"### Period-over-Period: {val_col}\n\n"
        f"| Period | Total (₹) |\n|--------|----------|\n"
        f"| {curr_lbl} | {curr_total:,.0f} |\n"
        f"| {prior_lbl} | {prior_total:,.0f} |\n\n"
        f"**Change:** {direction} ₹{abs(delta):,.0f} "
        f"({'%.1f' % delta_pct}%)"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Leadership Summaries
# ─────────────────────────────────────────────────────────────────────────────

def get_leadership_brief(deals_df: pd.DataFrame, wo_df: pd.DataFrame) -> dict:
    """
    Structured leadership brief dict containing headline metrics, wins, risks,
    trends, and recommended actions. Designed for LLM narration.
    """
    pipe_summary = get_pipeline_summary(deals_df)
    rev_summary  = get_revenue_summary(deals_df)
    wo_summary   = get_workorder_summary(wo_df)
    health       = get_pipeline_health_score(deals_df)
    risks        = get_deal_risk_flags(deals_df)
    anomalies    = get_anomalies(deals_df, wo_df)

    recommended_actions = []
    if pipe_summary["stalled_deals_count"] > 0:
        recommended_actions.append(f"Follow up on {pipe_summary['stalled_deals_count']} stalled deals.")
    if wo_summary["delayed"] > 0:
        recommended_actions.append(f"Review {wo_summary['delayed']} delayed work orders.")
    if pipe_summary["deals_near_close_30d"] > 0:
        recommended_actions.append(f"Prioritise {pipe_summary['deals_near_close_30d']} deals closing within 30 days.")
    if health["score"] < 60:
        recommended_actions.append("Pipeline health is below threshold — diversify deal stages and close aging deals.")

    return {
        "pipeline": pipe_summary,
        "revenue": rev_summary,
        "operations": wo_summary,
        "pipeline_health": {"score": health["score"], "rating": health["rating"]},
        "deal_risk_summary": risks[:500] if isinstance(risks, str) else risks,
        "anomalies": anomalies,
        "recommended_actions": recommended_actions,
        "generated_at": datetime.now().isoformat(),
    }


def get_morning_brief(deals_df: pd.DataFrame, wo_df: pd.DataFrame) -> str:
    """
    'What should the founder know today?' — top 5 most important signals,
    returned as a concise markdown brief.
    """
    brief = get_leadership_brief(deals_df, wo_df)
    pipe  = brief["pipeline"]
    rev   = brief["revenue"]
    ops   = brief["operations"]
    health = brief["pipeline_health"]

    lines = [
        f"## 🌅 Morning Founder Brief — {datetime.now().strftime('%d %b %Y')}",
        "",
        f"**Business Health: {health['score']}/100 — {health['rating']}**",
        "",
        "### 📊 Key Numbers",
        f"- Open Pipeline: ₹{pipe['total_pipeline']:,.0f} across {pipe['open_deals']} deals",
        f"- Weighted Pipeline: ₹{pipe['weighted_pipeline']:,.0f}" if pipe.get('weighted_pipeline') else "",
        f"- Won Revenue (all time): ₹{rev['won_revenue']:,.0f}",
        f"- Active Work Orders: {ops['active']} | Delayed: {ops['delayed']} | Completed: {ops['completed']}",
        f"- Win Rate: {pipe['win_rate_pct']}%",
        "",
        "### ⚠️ Watch Out",
    ]
    if pipe["stalled_deals_count"]:
        lines.append(f"- {pipe['stalled_deals_count']} deals stalled (>30 days old, still open)")
    if ops["delayed"]:
        lines.append(f"- {ops['delayed']} work orders are delayed")
    if pipe["deals_near_close_30d"]:
        lines.append(f"- {pipe['deals_near_close_30d']} deals closing within 30 days — needs attention")
    if not lines[-1].startswith("-"):
        lines.append("- No immediate watchouts detected ✅")

    lines += ["", "### 🎯 Recommended Actions"]
    for action in brief["recommended_actions"]:
        lines.append(f"- {action}")
    if not brief["recommended_actions"]:
        lines.append("- No urgent actions required today.")

    return "\n".join(l for l in lines if l is not None)


def get_attention_items(deals_df: pd.DataFrame, wo_df: pd.DataFrame) -> str:
    """
    'What needs my attention?' — prioritised list of risks + data issues.
    """
    sections = []

    # High-value deals at risk
    risk_table = get_deal_risk_flags(deals_df)
    sections.append("### 🔴 Deal Risks\n" + risk_table)

    # Delayed projects
    delayed = get_delayed_projects(wo_df)
    sections.append("### 🟠 Delayed Projects\n" + delayed)

    # Data quality
    d_df = normalize_dataframe(deals_df.copy())
    w_df = normalize_dataframe(wo_df.copy())
    dq_deals = data_quality_report(d_df)
    dq_wo    = data_quality_report(w_df)
    missing_d = sum(dq_deals["missing_by_column"].values())
    missing_w = sum(dq_wo["missing_by_column"].values())

    dq_lines = []
    if missing_d:
        dq_lines.append(f"- Deals board: {missing_d} missing field(s) across {dq_deals['total_records']} records")
    if missing_w:
        dq_lines.append(f"- Work Orders board: {missing_w} missing field(s) across {dq_wo['total_records']} records")
    if dq_deals["duplicate_item_names"]:
        dq_lines.append(f"- {dq_deals['duplicate_item_names']} duplicate deal names detected")
    sections.append("### 🟡 Data Quality\n" + ("\n".join(dq_lines) if dq_lines else "✅ No data issues found."))

    return "\n\n".join(sections)


def get_qbr_summary(deals_df: pd.DataFrame, wo_df: pd.DataFrame, quarter: str = "this quarter") -> str:
    """
    Quarterly Business Review summary — revenue, pipeline, sector, customer,
    operations, risks, and opportunities.
    """
    rev   = get_revenue_summary(deals_df, period=quarter)
    pipe  = get_pipeline_summary(deals_df, period=quarter)
    health = get_pipeline_health_score(deals_df)

    wo_s  = get_workorder_summary(wo_df, period=quarter)
    sector = get_sector_analysis(deals_df, wo_df, period=quarter)

    lines = [
        f"# Quarterly Business Review — {quarter.title()}",
        "",
        "## Revenue Performance",
        f"- Won Revenue: ₹{rev['won_revenue']:,.0f} across {rev['won_deals_count']} deals",
        f"- Avg Contract Value: ₹{rev['avg_contract_value']:,.0f}",
        f"- Expected Forecast: ₹{rev['forecast_expected']:,.0f} (conservative: ₹{rev['forecast_conservative']:,.0f})",
        "",
        "## Pipeline Performance",
        f"- Open Pipeline: ₹{pipe['total_pipeline']:,.0f} ({pipe['open_deals']} deals)",
        f"- Win Rate: {pipe['win_rate_pct']}%",
        f"- Pipeline Health: {health['score']}/100 — {health['rating']}",
        f"- Deals near close (30d): {pipe['deals_near_close_30d']}",
        f"- Stalled deals: {pipe['stalled_deals_count']}",
        "",
        "## Operational Performance",
        f"- Total Work Orders: {wo_s['total']} | Active: {wo_s['active']} | Completed: {wo_s['completed']}",
        f"- Delayed: {wo_s['delayed']} | Pending: {wo_s['pending']}",
        "",
        "## Sector Performance",
        sector,
    ]

    return "\n".join(lines)

# -----------------------------------------------------------------------------
# Raw data endpoints for FastAPI (frontend integration)
# -----------------------------------------------------------------------------

def get_pipeline_by_dimension_raw(df: pd.DataFrame, dimension: str, period: str = '') -> list[dict]:
    # Date filters require datetime values.  Normalise before calling the
    # period helper; applying `.dt` to raw Monday text values raises at runtime.
    norm_df = normalize_dataframe(df)
    if period:
        date_col = _find_col(norm_df, "close date", "date", "time")
        norm_df, _ = filter_by_period(norm_df, date_col, period)
    if norm_df.empty:
        return []
    dim_col = _find_col(norm_df, dimension)
    val_col = _find_col(norm_df, 'deal value', 'masked deal value', 'value')
    status_col = _find_col(norm_df, 'deal status', 'status', 'stage')
    
    if not (dim_col and val_col and status_col):
        return []

    open_deals = norm_df[~norm_df[status_col].astype(str).str.lower().isin(CLOSED_STATUSES)].copy()
    open_deals['Value'] = _to_float(open_deals[val_col])
    
    grouped = open_deals.groupby(dim_col).agg(
        Count=(val_col, 'count'),
        Value=('Value', 'sum')
    ).reset_index()
    
    grouped = grouped[grouped['Value'] > 0].sort_values('Value', ascending=False)
    
    result = []
    for _, row in grouped.iterrows():
        # Frontend expects key matching the dimension, e.g., 'sector' or 'stage'
        result.append({
            dimension: str(row[dim_col]),
            'count': int(row['Count']),
            'value': float(row['Value'])
        })
    return result


def get_workorder_by_dimension_raw(df: pd.DataFrame, dimension: str, period: str = '') -> list[dict]:
    norm_df = normalize_dataframe(df)
    if period:
        date_col = _find_col(norm_df, "date", "close", "time")
        norm_df, _ = filter_by_period(norm_df, date_col, period)
    if norm_df.empty:
        return []
    dim_col = _find_col(norm_df, dimension)
    if not dim_col:
        return []

    grouped = norm_df.groupby(dim_col).size().reset_index(name='count')
    grouped = grouped.sort_values('count', ascending=False)
    
    result = []
    for _, row in grouped.iterrows():
        result.append({
            dimension: str(row[dim_col]),
            'count': int(row['count'])
        })
    return result


def get_revenue_trends_raw(df: pd.DataFrame) -> list[dict]:
    norm_df = normalize_dataframe(df)
    status_col = _find_col(norm_df, 'deal status', 'status', 'stage')
    date_col = _find_col(norm_df, 'close date', 'actual close date', 'date')
    val_col = _find_col(norm_df, 'deal value', 'masked deal value', 'value')
    
    if not (status_col and date_col and val_col):
        return []

    won_deals = norm_df[norm_df[status_col].astype(str).str.lower().isin(WON_STATUSES)].copy()
    if won_deals.empty:
        return []

    won_deals['Value'] = _to_float(won_deals[val_col])
    won_deals['Period'] = pd.to_datetime(won_deals[date_col], errors='coerce').dt.to_period('M').astype(str)
    
    # drop NaT
    won_deals = won_deals[won_deals['Period'] != 'NaT']
    
    grouped = won_deals.groupby('Period')['Value'].sum().reset_index()
    grouped = grouped.sort_values('Period')
    
    result = []
    for _, row in grouped.iterrows():
        result.append({
            'period': str(row['Period']),
            'value': float(row['Value'])
        })
    return result

