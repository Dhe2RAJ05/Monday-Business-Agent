import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, AlertCircle, AlertTriangle, RefreshCw, Loader } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { api, formatINR, formatINRShort } from '../utils/api'
import type { PipelineResponse } from '../utils/api'

const PERIODS = ['this_quarter', 'last_quarter', 'this_month', 'ytd'] as const
type Period = typeof PERIODS[number]
const PERIOD_LABELS: Record<Period, string> = {
  this_quarter: 'This Quarter',
  last_quarter: 'Last Quarter',
  this_month: 'This Month',
  ytd: 'Year to Date',
}

const STAGE_COLORS_BAR = ['#0052CC', '#2E7DD6', '#5BA3E0', '#88C3EE', '#36B37E', '#6554C0']
const OWNER_COLORS_BAR = ['#6554C0', '#7E6DD6', '#9787E8', '#B0A0F8', '#C8C0FF']

function SelectFilter({ options, labels, value, onChange }: {
  options: string[]
  labels?: Record<string, string>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg text-sm font-medium outline-none cursor-pointer"
        style={{ border: '1px solid #DFE1E6', backgroundColor: '#FFFFFF', color: '#172B4D' }}
      >
        {options.map(o => (
          <option key={o} value={o}>{labels ? labels[o] ?? o : o}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6B778C' }} />
    </div>
  )
}

const CustomBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="px-3 py-2 rounded-lg text-xs shadow-lg" style={{ backgroundColor: '#172B4D', color: '#E8EDF4' }}>
        <p className="font-medium mb-0.5">{label}</p>
        <p style={{ color: '#7C9EF0' }}>{formatINRShort(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

function LoadingState() {
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-3" style={{ minHeight: 400, color: '#6B778C' }}>
      <Loader size={28} className="animate-spin" style={{ color: '#0052CC' }} />
      <p className="text-sm font-medium">Loading pipeline data…</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-3" style={{ minHeight: 400 }}>
      <AlertCircle size={32} style={{ color: '#DE350B' }} />
      <p className="text-sm font-semibold" style={{ color: '#172B4D' }}>Unable to load pipeline</p>
      <p className="text-xs text-center max-w-xs" style={{ color: '#6B778C' }}>{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
        style={{ background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)' }}
      >
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  )
}

export default function Pipeline() {
  const [period, setPeriod] = useState<Period>('this_quarter')
  const [weighted, setWeighted] = useState(false)
  const [data, setData] = useState<PipelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.pipeline({ period, weighted })
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }, [period, weighted])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return null

  // Build chart-friendly arrays
  const byStageChart = (data.by_stage ?? []).map((s, i) => ({
    stage: String(s.stage ?? s['stage']),
    value: Number(s.value ?? 0),
    count: Number(s.count ?? 0),
    _i: i,
  }))
  const byOwnerChart = (data.by_owner ?? []).map((o, i) => ({
    owner: String(o.owner ?? o['owner'] ?? `Owner ${i + 1}`),
    value: Number(o.value ?? 0),
    count: Number(o.count ?? 0),
    _i: i,
  }))

  return (
    <div className="p-6 space-y-5" style={{ backgroundColor: '#F4F5F7', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#172B4D' }}>Pipeline Deep Dive</h1>
          <p className="text-sm" style={{ color: '#6B778C' }}>Excludes Won, Lost, Dead, and Cancelled deals.</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ border: '1px solid #DFE1E6', backgroundColor: '#FFFFFF', color: '#6B778C' }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <SelectFilter
          options={[...PERIODS]}
          labels={PERIOD_LABELS}
          value={period}
          onChange={v => setPeriod(v as Period)}
        />
        {/* Weighted toggle */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #DFE1E6' }}>
          {([['Unweighted', false], ['Weighted', true]] as [string, boolean][]).map(([label, val]) => (
            <button
              key={String(label)}
              onClick={() => setWeighted(val)}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: weighted === val ? '#0052CC' : '#FFFFFF',
                color: weighted === val ? '#FFFFFF' : '#6B778C',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Pipeline', value: formatINRShort(data.total_pipeline) },
          { label: 'Weighted Pipeline', value: formatINRShort(data.weighted_pipeline) },
          { label: 'Records Analyzed', value: String(data.data_quality.records_analyzed) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#6B778C' }}>{label}</p>
            <p className="text-xl font-bold" style={{ color: '#172B4D' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Pipeline by Stage */}
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#172B4D' }}>
            Pipeline by Stage ({weighted ? 'Weighted' : 'Unweighted'})
          </p>
          {byStageChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byStageChart} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="stage"
                  type="category"
                  tick={{ fontSize: 11, fill: '#6B778C' }}
                  width={90}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                  {byStageChart.map((entry) => <Cell key={entry._i} fill={STAGE_COLORS_BAR[entry._i % STAGE_COLORS_BAR.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-center pt-8" style={{ color: '#97A0AF' }}>No stage data for this period.</p>
          )}
        </div>

        {/* Pipeline by Owner */}
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#172B4D' }}>Pipeline by Owner</p>
          {byOwnerChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byOwnerChart} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="owner"
                  type="category"
                  tick={{ fontSize: 11, fill: '#6B778C' }}
                  width={100}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                  {byOwnerChart.map((entry) => <Cell key={entry._i} fill={OWNER_COLORS_BAR[entry._i % OWNER_COLORS_BAR.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-center pt-8" style={{ color: '#97A0AF' }}>No owner data for this period.</p>
          )}
        </div>
      </div>

      {/* Risk flags */}
      {(data.risk_flags ?? []).length > 0 && (
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: '#FF8B00' }} />
            <p className="text-sm font-semibold" style={{ color: '#172B4D' }}>Risk Flags</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {data.risk_flags.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFEBE6' }}>
                <span className="text-xs font-medium" style={{ color: '#172B4D' }}>{r.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Quality footer */}
      {(data.data_quality.records_excluded > 0 || data.data_quality.warnings.length > 0) && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-lg text-xs"
          style={{ backgroundColor: '#FFF0E0', border: '1px solid #FF8B0033', color: '#6B778C' }}
        >
          <AlertTriangle size={13} style={{ color: '#FF8B00', marginTop: 1 }} />
          <span>
            {data.data_quality.records_excluded > 0 && `${data.data_quality.records_excluded} records excluded. `}
            {data.data_quality.warnings.join(' ')}
          </span>
        </div>
      )}
    </div>
  )
}
