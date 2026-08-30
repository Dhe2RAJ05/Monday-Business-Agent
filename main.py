"""
main.py — FastAPI backend for the Skylark BI Copilot.
"""
import os
import uuid
import time
from typing import Dict, Any, List, Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd

from dotenv import load_dotenv
load_dotenv()

from agent import BIAgent
from monday_api import get_boards, get_data_freshness, MondayAPIError
from data_loader import load_deals_df, load_wo_df
import analytics as an

app = FastAPI(title="Skylark BI Copilot API")

# Configure CORS securely
ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Local Vite dev server (default)
    "http://localhost:8443",  # Figma Make / configured Vite port
    "http://127.0.0.1:8443",
]
if frontend_origin := os.environ.get("FRONTEND_ORIGIN"):
    ALLOWED_ORIGINS.append(frontend_origin.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Conversation Store
# ─────────────────────────────────────────────────────────────────────────────

class SessionData:
    def __init__(self):
        self.agent = BIAgent()
        self.last_accessed = time.time()

# In-memory store: conversation_id -> SessionData
# A production app would use Redis or a database.
CONVERSATIONS: Dict[str, SessionData] = {}
SESSION_TTL = 3600 * 24 # 24 hours

def get_session(conversation_id: str | None) -> tuple[str, BIAgent]:
    now = time.time()
    
    # Cleanup expired sessions
    expired = [cid for cid, sess in CONVERSATIONS.items() if now - sess.last_accessed > SESSION_TTL]
    for cid in expired:
        del CONVERSATIONS[cid]

    if not conversation_id or conversation_id not in CONVERSATIONS:
        conversation_id = str(uuid.uuid4())
        try:
            CONVERSATIONS[conversation_id] = SessionData()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    CONVERSATIONS[conversation_id].last_accessed = now
    return conversation_id, CONVERSATIONS[conversation_id].agent

# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None

class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    metrics: Dict[str, Any] = {}
    insights: List[str] = []
    risks: List[str] = []
    actions: List[str] = []
    data_quality: Dict[str, Any] | None = None
    sources: List[Dict[str, Any]] = []
    visualization: Any | None = None

class ErrorResponse(BaseModel):
    error: Dict[str, Any]


def _error(status_code: int, code: str, message: str, retryable: bool = False) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "retryable": retryable},
    )


def _quality(deals_df, wo_df=None) -> dict:
    frames = [df for df in (deals_df, wo_df) if df is not None and not df.empty]
    if not frames:
        return {"records_analyzed": 0, "records_excluded": 0, "warnings": [], "confidence": "low"}
    reports = [an.data_quality_report(an.normalize_dataframe(df)) for df in frames]
    missing = sum(sum(report["missing_by_column"].values()) for report in reports)
    warnings = [] if not missing else [f"{missing} missing field value(s) were detected in source data."]
    confidence = "Low" if any(r["confidence"] == "Low" for r in reports) else (
        "Medium" if any(r["confidence"] == "Medium" for r in reports) else "High"
    )
    return {
        "records_analyzed": sum(len(df) for df in frames),
        "records_excluded": 0,
        "warnings": warnings,
        "confidence": confidence.lower(),
    }


def _column(df, *keywords: str):
    return an._find_col(df, *keywords)


def _string(value) -> str | None:
    if value is None or str(value).lower() in {"nan", "none", "nat"}:
        return None
    return str(value)


def _board_rows(df, kind: Literal["deals", "work-orders"]) -> list[dict]:
    normalized = an.normalize_dataframe(df)
    sector_col = _column(normalized, "sector")
    owner_col = _column(normalized, "owner", "personnel")
    if kind == "deals":
        status_col = _column(normalized, "deal stage", "stage", "deal status", "status")
        value_col = _column(normalized, "deal value", "masked deal value", "value")
        date_col = _column(normalized, "close date", "tentative close", "close")
        values = an._to_float(normalized[value_col]) if value_col else pd.Series([None] * len(normalized), index=normalized.index)
        return [
            {
                "id": str(index), "name": _string(row.get("Item Name")) or "Untitled deal",
                "sector": _string(row.get(sector_col)) or "Unknown",
                "stage": _string(row.get(status_col)) or "Unknown",
                "value": None if pd.isna(values.loc[index]) else float(values.loc[index]),
                "owner": _string(row.get(owner_col)), "closeDate": _string(row.get(date_col)),
                "lastUpdated": "Live Monday data",
            }
            for index, row in normalized.iterrows()
        ]
    status_col = _column(normalized, "execution status", "wo status", "status")
    value_col = _column(normalized, "amount", "value", "billed value")
    values = an._to_float(normalized[value_col]) if value_col else pd.Series([None] * len(normalized), index=normalized.index)
    return [
        {
            "id": str(index), "name": _string(row.get("Item Name")) or "Untitled work order",
            "sector": _string(row.get(sector_col)) or "Unknown",
            "status": _string(row.get(status_col)) or "Unknown",
            "value": None if pd.isna(values.loc[index]) else float(values.loc[index]),
            "owner": _string(row.get(owner_col)), "location": "—",
            "lastUpdated": "Live Monday data",
        }
        for index, row in normalized.iterrows()
    ]

# ─────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "monday_connected": bool(os.environ.get("MONDAY_API_TOKEN")),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }


@app.get("/api/monday/status")
def monday_status():
    try:
        boards = get_boards()
        freshness = get_data_freshness()
        # Filter to only deals and work orders if needed, or return all
        board_data = [{"id": b["id"], "name": b["name"], "item_count": -1} for b in boards]
        return {
            "connected": True,
            "boards": board_data,
            "last_refresh": freshness
        }
    except MondayAPIError as e:
        return {
            "connected": False,
            "error": str(e),
            "boards": [],
            "last_refresh": "Never"
        }


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    if not request.message.strip():
        raise _error(422, "INVALID_REQUEST", "Message cannot be empty.")
    try:
        cid, agent = get_session(request.conversation_id)
        # BIAgent.send_message returns a markdown string
        answer = agent.send_message(request.message)
        
        return ChatResponse(
            conversation_id=cid,
            answer=answer,
            metrics={},
            insights=[],
            risks=[],
            actions=[],
            sources=[],
        )
    except MondayAPIError as e:
        raise _error(503, "MONDAY_CONNECTION_FAILED", str(e), True)
    except Exception:
        raise _error(500, "INTERNAL_ERROR", "Unable to process the chat request.", True)


@app.get("/api/dashboard")
def dashboard(period: str = "this_quarter", start_date: str = None, end_date: str = None):
    deals_df, _ = load_deals_df()
    wo_df, _ = load_wo_df()
    
    if deals_df.empty and wo_df.empty:
        raise _error(404, "NO_DATA_FOUND", "No data found.")

    # Basic KPI calculations using analytics.py
    # We use the raw endpoints which we will implement in analytics.py next.
    pipe_summary = an.get_pipeline_summary(deals_df, period=period) if not deals_df.empty else {}
    rev_summary = an.get_revenue_summary(deals_df, period=period) if not deals_df.empty else {}
    wo_summary = an.get_workorder_summary(wo_df, period=period) if not wo_df.empty else {}
    health = an.get_pipeline_health_score(deals_df) if not deals_df.empty else {"score": 0}
    
    sector_breakdown = an.get_pipeline_by_dimension_raw(deals_df, dimension="sector", period=period) if hasattr(an, 'get_pipeline_by_dimension_raw') else []
    pipeline_funnel = an.get_pipeline_by_dimension_raw(deals_df, dimension="stage", period=period) if hasattr(an, 'get_pipeline_by_dimension_raw') else []
    revenue_trend = an.get_revenue_trends_raw(deals_df) if hasattr(an, 'get_revenue_trends_raw') else []
    
    return {
        "period": period,
        "kpis": {
            "pipeline": float(pipe_summary.get("total_pipeline") or 0),
            "weighted_pipeline": float(pipe_summary.get("weighted_pipeline") or 0),
            "won_revenue": float(rev_summary.get("won_revenue") or 0),
            "win_rate": float(rev_summary.get("win_rate_pct") or 0),
            "active_projects": int(wo_summary.get("active") or 0),
            "delayed_projects": int(wo_summary.get("delayed") or 0),
            "health_score": float(health.get("score") or 0)
        },
        "sector_breakdown": sector_breakdown,
        "pipeline_funnel": pipeline_funnel,
        "revenue_trend": revenue_trend,
        "top_risks": [
            {"title": f"{pipe_summary.get('stalled_deals_count', 0)} stalled open deal(s)", "severity": "high", "count": int(pipe_summary.get('stalled_deals_count', 0))},
            {"title": f"{wo_summary.get('delayed', 0)} delayed work order(s)", "severity": "medium", "count": int(wo_summary.get('delayed', 0))},
        ],
        "data_quality": _quality(deals_df, wo_df)
    }


@app.get("/api/pipeline")
def pipeline_deep_dive(period: str = "this_quarter", sector: str = None, weighted: bool = False):
    deals_df, _ = load_deals_df()
    if deals_df.empty:
         raise _error(404, "NO_DATA_FOUND", "No deals data found.")
         
    # Apply raw filters
    pipe_summary = an.get_pipeline_summary(deals_df, period=period)
    
    return {
        "total_pipeline": float(pipe_summary.get("total_pipeline") or 0),
        "weighted_pipeline": float(pipe_summary.get("weighted_pipeline") or 0),
        "by_stage": an.get_pipeline_by_dimension_raw(deals_df, dimension="stage", period=period) if hasattr(an, 'get_pipeline_by_dimension_raw') else [],
        "by_sector": an.get_pipeline_by_dimension_raw(deals_df, dimension="sector", period=period) if hasattr(an, 'get_pipeline_by_dimension_raw') else [],
        "by_owner": an.get_pipeline_by_dimension_raw(deals_df, dimension="owner", period=period) if hasattr(an, 'get_pipeline_by_dimension_raw') else [],
        "top_deals": [],
        "stalled_deals": [],
        "risk_flags": [],
        "data_quality": _quality(deals_df)
    }


@app.get("/api/operations")
def operations_deep_dive(period: str = "this_quarter"):
    wo_df, _ = load_wo_df()
    if wo_df.empty:
         raise _error(404, "NO_DATA_FOUND", "No work orders data found.")
         
    wo_summary = an.get_workorder_summary(wo_df, period=period)
    
    return {
        "total_work_orders": int(wo_summary.get("total", 0)),
        "active": int(wo_summary.get("active", 0)),
        "completed": int(wo_summary.get("completed", 0)),
        "pending": int(wo_summary.get("pending", 0)),
        "delayed": int(wo_summary.get("delayed", 0)),
        "backlog_value": float(wo_summary.get("backlog_value") or 0),
        "by_status": an.get_workorder_by_dimension_raw(wo_df, dimension="status", period=period) if hasattr(an, 'get_workorder_by_dimension_raw') else [],
        "by_sector": an.get_workorder_by_dimension_raw(wo_df, dimension="sector", period=period) if hasattr(an, 'get_workorder_by_dimension_raw') else [],
        "delayed_projects": [],
        "data_quality": _quality(wo_df)
    }


@app.get("/api/boards")
def board_rows(kind: Literal["deals", "work-orders"], page: int = 1, page_size: int = 12):
    if page < 1 or not 1 <= page_size <= 100:
        raise _error(422, "INVALID_REQUEST", "page must be positive and page_size must be between 1 and 100.")
    df, board_name = load_deals_df() if kind == "deals" else load_wo_df()
    if df.empty:
        raise _error(404, "NO_DATA_FOUND", f"No records found in {board_name}.")
    rows = _board_rows(df, kind)
    start = (page - 1) * page_size
    return {"kind": kind, "board_name": board_name, "total": len(rows), "items": rows[start:start + page_size], "data_quality": _quality(df)}


def _leadership_template(title: str, text: str):
    # Extracts basic insights from the markdown text to satisfy schema
    return {
        "title": title,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "headline": "Generated Leadership Brief",
        "key_metrics": [],
        "insights": [text], # Embed the markdown here for now
        "risks": [],
        "actions": [],
        "data_quality": {"records_analyzed": 0, "records_excluded": 0, "warnings": []},
        "sources": []
    }

@app.get("/api/leadership/brief")
def leadership_brief():
    deals_df, _ = load_deals_df()
    wo_df, _ = load_wo_df()
    data = an.get_leadership_brief(deals_df, wo_df)
    
    pipe = data.get("pipeline", {})
    rev = data.get("revenue", {})
    ops = data.get("operations", {})
    health = data.get("pipeline_health", {})
    
    key_metrics = [
        {"label": "Total Pipeline", "value": f"INR {float(pipe.get('total_pipeline', 0))/10000000:.2f} Cr"},
        {"label": "Win Rate", "value": f"{rev.get('win_rate_pct', 0)}%"},
        {"label": "Health Score", "value": f"{health.get('score', 0)}/100"},
    ]
    
    insights = [
        f"Pipeline stands at INR {float(pipe.get('total_pipeline', 0))/10000000:.2f} Cr across {pipe.get('open_deals', 0)} open deals.",
        f"Total won revenue is INR {float(rev.get('won_revenue', 0))/10000000:.2f} Cr.",
        f"Operations has {ops.get('active', 0)} active work orders and {ops.get('delayed', 0)} delayed."
    ]
    
    if data.get("anomalies"):
        insights.append("Anomalies: " + str(data["anomalies"]).replace('\n', ' '))
        
    risks = ["Some deals are missing close dates or values."] if "missing deal value" in str(data.get("deal_risk_summary", "")).lower() else []
    
    actions = data.get("recommended_actions", [])
    if not actions:
        actions = ["Review active deals and verify close dates."]
        
    return {
        "title": "Leadership Brief",
        "generated_at": data.get("generated_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
        "headline": "Current State of Business",
        "key_metrics": key_metrics,
        "insights": insights,
        "risks": risks,
        "actions": actions,
        "data_quality": _quality(deals_df, wo_df),
        "sources": ["Deals", "Work Orders"]
    }

@app.get("/api/leadership/morning-brief")
def morning_brief():
    deals_df, _ = load_deals_df()
    wo_df, _ = load_wo_df()
    text = an.get_morning_brief(deals_df, wo_df)
    return _leadership_template("Morning Brief", text)

@app.get("/api/leadership/qbr")
def qbr_brief(quarter: str = "Q3-2026"):
    deals_df, _ = load_deals_df()
    wo_df, _ = load_wo_df()
    text = an.get_qbr_summary(deals_df, wo_df)
    return _leadership_template(f"QBR Summary {quarter}", text)
