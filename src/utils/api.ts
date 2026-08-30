/**
 * api.ts — Skylark BI Copilot frontend API client.
 *
 * All communication with the FastAPI backend (main.py) goes through this
 * module.  Pages and components must never call fetch() directly.
 *
 * Base URL resolution:
 *   1. VITE_API_BASE_URL environment variable (set in .env.local or CI)
 *   2. Falls back to http://localhost:8000 for local development
 */

const BASE_URL: string =
  (import.meta as Record<string, unknown> & { env?: { VITE_API_BASE_URL?: string } }).env
    ?.VITE_API_BASE_URL ?? 'http://localhost:8000'

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export interface DataQuality {
  records_analyzed: number
  records_excluded: number
  warnings: string[]
  confidence?: string
}

export interface ApiError {
  code: string
  message: string
  retryable: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint response types (mirror the FastAPI contract in frontend_integration.txt)
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded'
  monday_connected: boolean
  timestamp: string
}

export interface BoardInfo {
  id: string
  name: string
  item_count: number
}

export interface MondayStatusResponse {
  connected: boolean
  boards: BoardInfo[]
  last_refresh: string
  error?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metrics?: { label: string; value: string }[]
  insights?: string[]
  risks?: string[]
  actions?: string[]
  sources?: string[]
}

export interface ChatRequest {
  message: string
  conversation_id?: string | null
}

export interface ChatApiResponse {
  conversation_id: string
  answer: string
  metrics: Record<string, number>
  insights: string[]
  risks: string[]
  actions: string[]
  sources: Array<string | { board_id?: string; board_name?: string; records_used?: number }>
  data_quality?: DataQuality
}

export interface SectorBreakdown {
  sector: string
  value: number
  count: number
}

export interface PipelineFunnelStage {
  stage: string
  count: number
  value: number
}

export interface RevenueTrendPoint {
  period: string
  value: number
}

export interface RiskFlag {
  title: string
  severity: 'high' | 'medium' | 'low'
  count: number
}

export interface DashboardKpis {
  pipeline: number
  weighted_pipeline: number
  won_revenue: number
  win_rate: number
  active_projects: number
  delayed_projects: number
  health_score: number
}

export interface DashboardResponse {
  period: string
  kpis: DashboardKpis
  sector_breakdown: SectorBreakdown[]
  pipeline_funnel: PipelineFunnelStage[]
  revenue_trend: RevenueTrendPoint[]
  top_risks: RiskFlag[]
  data_quality: DataQuality
}

export interface DimensionEntry {
  [key: string]: string | number
  count: number
  value: number
}

export interface PipelineResponse {
  total_pipeline: number
  weighted_pipeline: number
  by_stage: DimensionEntry[]
  by_sector: DimensionEntry[]
  by_owner: DimensionEntry[]
  top_deals: DimensionEntry[]
  stalled_deals: DimensionEntry[]
  risk_flags: RiskFlag[]
  data_quality: DataQuality
}

export interface OperationsResponse {
  total_work_orders: number
  active: number
  completed: number
  pending: number
  delayed: number
  backlog_value: number
  by_status: DimensionEntry[]
  by_sector: DimensionEntry[]
  delayed_projects: DimensionEntry[]
  data_quality: DataQuality
}

export interface LeadershipResponse {
  title: string
  generated_at: string
  headline: string
  key_metrics: { label: string; value: string }[]
  insights: string[]
  risks: string[]
  actions: string[]
  data_quality: DataQuality
  sources: string[]
}

export interface BoardRowResponse {
  kind: 'deals' | 'work-orders'
  board_name: string
  total: number
  items: Array<Record<string, string | number | null>>
  data_quality: DataQuality
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────

class BackendError extends Error {
  constructor(public code: string, message: string, public retryable: boolean) {
    super(message)
    this.name = 'BackendError'
  }
}

async function get<T>(path: string, params?: Record<string, string | boolean | number | undefined | null>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    let apiErr: ApiError = { code: 'INTERNAL_ERROR', message: `HTTP ${res.status}`, retryable: true }
    try {
      const body = await res.json()
      if (body?.detail) apiErr = body.detail as ApiError
    } catch { /* ignore */ }
    throw new BackendError(apiErr.code, apiErr.message, apiErr.retryable)
  }
  return res.json() as Promise<T>
}

async function post<T, B>(path: string, body: B): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let apiErr: ApiError = { code: 'INTERNAL_ERROR', message: `HTTP ${res.status}`, retryable: true }
    try {
      const b = await res.json()
      if (b?.detail) apiErr = b.detail as ApiError
    } catch { /* ignore */ }
    throw new BackendError(apiErr.code, apiErr.message, apiErr.retryable)
  }
  return res.json() as Promise<T>
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API surface
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  health: () => get<HealthResponse>('/api/health'),

  mondayStatus: () => get<MondayStatusResponse>('/api/monday/status'),

  chat: (req: ChatRequest) => post<ChatApiResponse, ChatRequest>('/api/chat', req),

  dashboard: (params?: { period?: string; start_date?: string; end_date?: string }) =>
    get<DashboardResponse>('/api/dashboard', params as Record<string, string | boolean | number | undefined>),

  pipeline: (params?: { period?: string; sector?: string; weighted?: boolean }) =>
    get<PipelineResponse>('/api/pipeline', params as Record<string, string | boolean | number | undefined>),

  operations: (params?: { period?: string }) =>
    get<OperationsResponse>('/api/operations', params as Record<string, string | boolean | number | undefined>),

  boards: (params: { kind: 'deals' | 'work-orders'; page: number; page_size: number }) =>
    get<BoardRowResponse>('/api/boards', params),

  leadership: {
    brief: () => get<LeadershipResponse>('/api/leadership/brief'),
    morningBrief: () => get<LeadershipResponse>('/api/leadership/morning-brief'),
    qbr: (quarter?: string) =>
      get<LeadershipResponse>('/api/leadership/qbr', quarter ? { quarter } : undefined),
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat message helpers (mirrors mockChat.ts interface for backward compat)
// ─────────────────────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2)
}

export function createUserMessage(content: string): ChatMessage {
  return { id: makeId(), role: 'user', content, timestamp: new Date() }
}

/** Format raw API response into a frontend ChatMessage */
export function chatResponseToMessage(res: ChatApiResponse): ChatMessage {
  // Convert metrics dict to label/value pills
  const metrics = Object.entries(res.metrics ?? {}).map(([label, val]) => ({
    label,
    value: typeof val === 'number' ? formatINRShort(val) : String(val),
  }))

  return {
    id: makeId(),
    role: 'assistant',
    content: res.answer,
    timestamp: new Date(),
    metrics: metrics.length ? metrics : undefined,
    insights: res.insights?.length ? res.insights : undefined,
    risks: res.risks?.length ? res.risks : undefined,
    actions: res.actions?.length ? res.actions : undefined,
    sources: res.sources?.length
      ? res.sources.map(source => typeof source === 'string'
        ? source
        : `${source.board_name ?? 'Monday board'}${source.records_used != null ? ` — ${source.records_used} records` : ''}`)
      : undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers (kept here so pages don't need to import mockData)
// ─────────────────────────────────────────────────────────────────────────────

export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatINRShort(value: number): string {
  if (value >= 10_000_000) return `INR ${(value / 10_000_000).toFixed(2)} Cr`
  if (value >= 100_000) return `INR ${(value / 100_000).toFixed(2)} L`
  return formatINR(value)
}

export { BackendError }
