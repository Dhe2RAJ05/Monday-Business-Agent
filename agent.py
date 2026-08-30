"""
agent.py — Gemini-powered Founder BI Copilot agent.

All numeric calculations are delegated to analytics.py (deterministic Pandas).
The LLM only narrates; it never computes arithmetic directly.
"""

import os
import json
from datetime import datetime

import pandas as pd
from google import genai
from google.genai import types
from dotenv import load_dotenv

from monday_api import get_boards, get_data_freshness, invalidate_cache, MondayAPIError
from data_loader import load_deals_df, load_wo_df
import analytics as an

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# Internal data-fetching helpers
# ─────────────────────────────────────────────────────────────────────────────

_CLOSED_STATUSES = an.CLOSED_STATUSES
_WON_STATUSES    = an.WON_STATUSES


def _normalize_sector(val):
    return an._normalize_sector(val)


def _to_float(s):
    return an._to_float(s)


# ─────────────────────────────────────────────────────────────────────────────
# Agent-callable tools (12 total)
# ─────────────────────────────────────────────────────────────────────────────

def tool_get_boards() -> str:
    """
    Lists all available Monday.com boards with IDs, names, and connection status.
    Also shows data freshness (when data was last fetched from the API).
    """
    try:
        boards = get_boards()
    except MondayAPIError as e:
        return f"❌ Monday.com connection error: {e}"
    if not boards:
        return "No boards found."
    freshness = get_data_freshness()
    lines = [f"**Data freshness:** {freshness}\n"]
    for b in boards:
        lines.append(f"- ID: `{b['id']}` | Name: **{b['name']}**")
    return "\n".join(lines)


def tool_get_pipeline_summary(period: str = "", weighted: bool = False) -> str:
    """
    Returns a comprehensive pipeline summary: total pipeline, weighted pipeline,
    open deal count, win rate, average deal size, stalled deals, near-close deals,
    and data quality caveats. Closed (Won/Lost/Dead) deals are always excluded.
    period: 'this quarter', 'this month', 'last quarter', 'ytd', 'Q1 2026', or ''
    weighted: set True to apply closure probability to deal values
    """
    df, _ = load_deals_df()
    if df.empty:
        return "❌ No deals data available."

    summary = an.get_pipeline_summary(df, period=period)
    pipe_table = an.get_pipeline_by_dimension(df, "sector", period=period, weighted=weighted)

    output = [
        f"### Pipeline Summary — {summary['period']}",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Open Deals | {summary['open_deals']} |",
        f"| Total Pipeline | ₹{summary['total_pipeline']:,.0f} |",
    ]
    if summary.get("weighted_pipeline"):
        output.append(f"| Weighted Pipeline | ₹{summary['weighted_pipeline']:,.0f} |")
    output += [
        f"| Won Deals | {summary['won_deals']} |",
        f"| Win Rate | {summary['win_rate_pct']}% |",
        f"| Avg Deal Size | ₹{summary['avg_deal_size']:,.0f} |",
        f"| Largest Deal | ₹{summary['largest_deal']:,.0f} |",
        f"| Stalled Deals (>30d) | {summary['stalled_deals_count']} |",
        f"| Deals Closing in 30d | {summary['deals_near_close_30d']} |",
        "",
        "### By Sector",
        pipe_table,
    ]
    if summary["excluded_missing_value"]:
        output.append(f"\n📊 **Note:** {summary['excluded_missing_value']} deal(s) excluded due to missing value.")
    return "\n".join(output)


def tool_get_revenue_summary(dimension: str = "sector", period: str = "") -> str:
    """
    Returns won revenue summary with forecast scenarios and breakdown by dimension.
    dimension: 'sector', 'customer', 'owner', 'region' etc.
    period: 'this quarter', 'ytd', 'this year', etc.
    """
    df, _ = load_deals_df()
    if df.empty:
        return "❌ No deals data available."

    summary = an.get_revenue_summary(df, period=period)
    by_dim  = an.get_revenue_by_dimension(df, dimension, period=period)

    return (
        f"### Revenue Summary — {summary['period']}\n\n"
        f"| Metric | Value |\n|--------|-------|\n"
        f"| Won Revenue | ₹{summary['won_revenue']:,.0f} |\n"
        f"| Won Deals | {summary['won_deals_count']} |\n"
        f"| Avg Contract Value | ₹{summary['avg_contract_value']:,.0f} |\n"
        f"| Open Pipeline | ₹{summary['open_pipeline']:,.0f} |\n"
        f"| Forecast (Best Case) | ₹{summary['forecast_best_case']:,.0f} |\n"
        f"| Forecast (Expected) | ₹{summary['forecast_expected']:,.0f} |\n"
        f"| Forecast (Conservative) | ₹{summary['forecast_conservative']:,.0f} |\n\n"
        f"### By {dimension.title()}\n\n{by_dim}"
    )


def tool_get_operations_summary(dimension: str = "sector", period: str = "") -> str:
    """
    Returns work orders summary (active, completed, delayed, backlog) with breakdown by dimension.
    dimension: 'sector', 'customer', 'status', etc.
    period: 'this quarter', 'this month', etc.
    """
    df, name = load_wo_df()
    if df.empty:
        return "❌ No Work Orders data available."

    summary = an.get_workorder_summary(df, period=period)
    by_dim  = an.get_workorder_by_dimension(df, dimension, period=period)
    delayed = an.get_delayed_projects(df)

    return (
        f"### Operations Summary — {summary['period']} ({name})\n\n"
        f"| Status | Count |\n|--------|-------|\n"
        f"| Total | {summary['total']} |\n"
        f"| Active | {summary['active']} |\n"
        f"| Completed | {summary['completed']} |\n"
        f"| Pending | {summary['pending']} |\n"
        f"| Delayed | {summary['delayed']} |\n"
        f"| Cancelled | {summary['cancelled']} |\n\n"
        f"### By {dimension.title()}\n\n{by_dim}\n\n"
        f"### Delayed Projects\n\n{delayed}"
    )


def tool_get_sector_analysis(period: str = "") -> str:
    """
    Combined sector report across both boards: pipeline, won revenue, win rate, deal count, work orders.
    Identifies top-performing and underperforming sectors. Optional period filter.
    """
    deals_df, _ = load_deals_df()
    wo_df, _    = load_wo_df()
    if deals_df.empty:
        return "❌ No deals data available for sector analysis."
    return an.get_sector_analysis(deals_df, wo_df if not wo_df.empty else pd.DataFrame(), period=period)


def tool_get_customer_analysis(top_n: int = 10) -> str:
    """
    Top customers by pipeline value and won revenue. Flags customers with both
    active deals and active work orders (high-touch accounts).
    top_n: number of customers to return (default 10)
    """
    deals_df, _ = load_deals_df()
    wo_df, _    = load_wo_df()
    if deals_df.empty:
        return "❌ No deals data available."

    customer_table = an.get_customer_analysis(deals_df, wo_df if not wo_df.empty else pd.DataFrame(), top_n=top_n)
    cross          = an.get_cross_board_analysis(deals_df, wo_df if not wo_df.empty else pd.DataFrame())

    overlap_note = ""
    if cross["overlap_count"] > 0:
        names = ", ".join(cross["customers_with_both_pipeline_and_projects"][:5])
        overlap_note = f"\n\n🔗 **{cross['overlap_count']} customer(s) have both open deals and active projects:** {names}"

    return customer_table + overlap_note


def tool_get_owner_performance() -> str:
    """
    Salesperson/owner performance: pipeline value, won revenue, win rate, deal count.
    Identifies top performers and under-performing pipeline.
    """
    df, _ = load_deals_df()
    if df.empty:
        return "❌ No deals data available."
    return an.get_owner_performance(df)


def tool_get_deal_risks() -> str:
    """
    Automatically detects and flags at-risk deals:
    - Stalled deals (>30 days old, still open)
    - Overdue close dates
    - Large deals missing a close date
    - Missing deal values
    Also runs anomaly detection across both boards.
    """
    deals_df, _ = load_deals_df()
    wo_df, _    = load_wo_df()
    if deals_df.empty:
        return "❌ No deals data available."

    risks     = an.get_deal_risk_flags(deals_df)
    priority  = an.get_deal_prioritization(deals_df, top_n=5)
    anomalies = an.get_anomalies(deals_df, wo_df if not wo_df.empty else pd.DataFrame())

    return (
        f"## Deal Risk Report\n\n{risks}\n\n"
        f"## Top Deals by Priority Score\n\n{priority}\n\n"
        f"## Anomaly Detection\n\n{anomalies}"
    )


def tool_get_forecast(scenario: str = "expected") -> str:
    """
    Revenue forecasting across three scenarios.
    scenario: 'best', 'expected', 'conservative', or a what-if string like
              'close 50% of energy', 'win rate improves by 10%', 'lose top 3 deals'
    """
    df, _ = load_deals_df()
    if df.empty:
        return "❌ No deals data available."

    # If scenario is one of the standard forecast options
    if scenario.lower() in ("best", "expected", "conservative", ""):
        summary = an.get_revenue_summary(df)
        label   = scenario.lower() or "expected"
        val = {
            "best": summary["forecast_best_case"],
            "expected": summary["forecast_expected"],
            "conservative": summary["forecast_conservative"],
        }.get(label, summary["forecast_expected"])

        return (
            f"### Revenue Forecast\n\n"
            f"| Scenario | Forecast (₹) |\n|----------|-------------|\n"
            f"| Best Case | {summary['forecast_best_case']:,.0f} |\n"
            f"| Expected | {summary['forecast_expected']:,.0f} |\n"
            f"| Conservative | {summary['forecast_conservative']:,.0f} |\n\n"
            f"**Selected ({label}):** ₹{val:,.0f}\n\n"
            f"*Expected = open pipeline × closure probability. "
            f"Conservative = Expected × 70%. Best Case = full open pipeline.*"
        )

    # Otherwise treat as what-if scenario
    return an.get_scenario_analysis(df, scenario)


def tool_get_leadership_brief() -> str:
    """
    Generates a complete founder-level leadership brief:
    pipeline, revenue, operations, pipeline health score, deal risks,
    anomalies, and recommended actions. Use for 'morning brief', 'weekly update',
    'executive summary', or 'what should I know today?' queries.
    """
    deals_df, _ = _load_deals_df()
    wo_df, _    = _load_wo_df()

    if deals_df.empty:
        return "❌ No deals data available for leadership brief."

    brief = an.get_leadership_brief(deals_df, wo_df if not wo_df.empty else pd.DataFrame())
    morning = an.get_morning_brief(deals_df, wo_df if not wo_df.empty else pd.DataFrame())

    actions = "\n".join(f"- {a}" for a in brief["recommended_actions"]) or "- No urgent actions."

    return (
        f"{morning}\n\n"
        f"---\n\n"
        f"### 🔍 Detailed Metrics\n\n"
        f"**Pipeline Health:** {brief['pipeline_health']['score']}/100 — {brief['pipeline_health']['rating']}\n\n"
        f"**Recommended Actions:**\n{actions}\n\n"
        f"*Data freshness: {get_data_freshness()}*"
    )


def tool_get_cross_board_analysis() -> str:
    """
    Cross-board intelligence: customers with both active deals and active projects,
    pipeline vs operational capacity comparison, and overall business connectivity.
    """
    deals_df, _ = _load_deals_df()
    wo_df, _    = _load_wo_df()

    if deals_df.empty or wo_df.empty:
        return "❌ Both Deals and Work Orders boards are needed for cross-board analysis."

    cross = an.get_cross_board_analysis(deals_df, wo_df)
    sector = an.get_sector_analysis(deals_df, wo_df)

    overlap_list = "\n".join(f"- {c.title()}" for c in cross["customers_with_both_pipeline_and_projects"][:10]) or "None found."

    return (
        f"### Cross-Board Intelligence\n\n"
        f"| Metric | Value |\n|--------|-------|\n"
        f"| Open Pipeline Deals | {cross['open_pipeline_deals']} |\n"
        f"| Active Work Orders | {cross['active_work_orders']} |\n"
        f"| Customers in Both | {cross['overlap_count']} |\n\n"
        f"**High-touch customers (open deal + active project):**\n{overlap_list}\n\n"
        f"{sector}"
    )


def tool_get_data_quality_report() -> str:
    """
    Reports data quality issues across both boards: missing fields, null counts,
    duplicate records, confidence level. Use when the user asks about data reliability
    or why numbers might be incomplete.
    """
    deals_df, d_name = _load_deals_df()
    wo_df, w_name    = _load_wo_df()

    sections = []
    for df, name in [(deals_df, d_name), (wo_df, w_name)]:
        if df.empty:
            sections.append(f"### {name}\n⚠️ Board is empty or unavailable.")
            continue
        norm = an.normalize_dataframe(df.copy())
        report = an.data_quality_report(norm)
        missing_lines = "\n".join(
            f"  - `{col}`: {cnt} missing" for col, cnt in report["missing_by_column"].items()
        ) or "  - None"
        sections.append(
            f"### {name}\n"
            f"- **Total records:** {report['total_records']}\n"
            f"- **Confidence:** {report['confidence']}\n"
            f"- **Duplicate names:** {report['duplicate_item_names']}\n"
            f"- **Missing fields:**\n{missing_lines}"
        )

    return "\n\n".join(sections) + f"\n\n*Data freshness: {get_data_freshness()}*"


# ─────────────────────────────────────────────────────────────────────────────
# BIAgent class
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the Skylark Drones Founder BI Copilot — an AI business intelligence assistant for executives and founders.

You have access to Monday.com boards (Work Orders and Deals) via 12 specialised tools.

## RESPONSE FORMAT
Always structure answers as:
**Headline** (1 sentence) → **Key Metrics** (bullet points with ₹ values) → **Insights** (patterns, context) → **Risks** (if any) → **Recommended Actions** (if relevant)

## CRITICAL RULES
1. NEVER compute arithmetic yourself. Always call the appropriate tool first.
2. For pipeline questions: use tool_get_pipeline_summary (not calculate manually).
3. For revenue: use tool_get_revenue_summary.
4. For operations: use tool_get_operations_summary.
5. For leadership updates / "what should I know": use tool_get_leadership_brief.
6. If a question is ambiguous, ask ONE clarifying question before calling tools.
7. Always surface data quality caveats from tool responses — don't hide excluded records.
8. If a board is unavailable, say so and answer with available data.
9. Format ₹ values in Cr (crores, divide by 10M) or L (lakhs, divide by 100K) for readability.
10. Retain conversational context — use follow-up context like "only this quarter" or "break it down by customer".

## CLARIFICATION EXAMPLES
- "How's pipeline?" → Ask: "Do you want total pipeline, weighted pipeline, or a sector breakdown? Any specific time period?"
- "Which sector?" → Ask: "Do you want pipeline by sector or won revenue by sector?"
"""


class BIAgent:
    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set.")

        self.client   = genai.Client(api_key=api_key)
        self.model_id = "gemini-2.5-flash"
        self._init_chat()

    def _init_chat(self):
        self.chat = self.client.chats.create(
            model=self.model_id,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                tools=[
                    tool_get_boards,
                    tool_get_pipeline_summary,
                    tool_get_revenue_summary,
                    tool_get_operations_summary,
                    tool_get_sector_analysis,
                    tool_get_customer_analysis,
                    tool_get_owner_performance,
                    tool_get_deal_risks,
                    tool_get_forecast,
                    tool_get_leadership_brief,
                    tool_get_cross_board_analysis,
                    tool_get_data_quality_report,
                ],
                temperature=0.2,
            )
        )

    @property
    def data_freshness(self) -> str:
        return get_data_freshness()

    def refresh_data(self) -> None:
        """Force a cache invalidation so the next query fetches fresh Monday.com data."""
        invalidate_cache()

    def send_message(self, message: str) -> str:
        try:
            response = self.chat.send_message(message)
            return response.text
        except Exception as e:
            return f"⚠️ Error: {str(e)}"

    def reset_conversation(self) -> None:
        """Start a fresh conversation (clears chat history)."""
        self._init_chat()
