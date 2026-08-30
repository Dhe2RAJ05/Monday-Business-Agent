import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, AlertCircle, Loader } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { api, formatINR, formatINRShort } from '../utils/api'
import type { DashboardResponse } from '../utils/api'

const SECTOR_PALETTE = ['#0052CC', '#6554C0', '#36B37E', '#FF8B00', '#DE350B', '#00B8D9']
const FUNNEL_COLORS = ['#0052CC', '#3D7FD6', '#6B9FE4', '#4B6FD0', '#36B37E']

const RISK_COLORS = {
  high: { bg: '#FFEBE6', text: '#DE350B', dot: '#FF5630' },
  medium: { bg: '#FFF0E0', text: '#D97706', dot: '#FF8B00' },
  low: { bg: '#E6F2FF', text: '#0052CC', dot: '#0052CC' },
}

function KpiCard({
  label, value, trend, trendLabel = 'vs last quarter', isPercent = false, isMoney = false
}: {
  label: string; value: string | number; trend?: number; trendLabel?: string; isPercent?: boolean; isMoney?: boolean
}) {
  const up = (trend ?? 0) >= 0
  const displayValue = isMoney && typeof value === 'number'
    ? formatINRShort(value)
    : typeof value === 'number' && isPercent
      ? `${value.toFixed(1)}%`
      : value
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
      <p className="text-xs font-medium mb-1" style={{ color: '#6B778C' }}>{label}</p>
      <p className="text-2xl font-bold mb-1" style={{ color: '#172B4D' }}>{displayValue}</p>
      {trend !== undefined && (
        <div className="flex items-center gap-1">
          {up
            ? <TrendingUp size={12} style={{ color: '#36B37E' }} />
            : <TrendingDown size={12} style={{ color: '#DE350B' }} />}
          <span className="text-xs font-medium" style={{ color: up ? '#36B37E' : '#DE350B' }}>
            {up ? '+' : ''}{trend}{isPercent ? 'pp' : '%'}
          </span>
          <span className="text-xs" style={{ color: '#97A0AF' }}>{trendLabel}</span>
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
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

const SectorTooltip = ({ active, payload }: {
  active?: boolean
  payload?: { name: string; value: number; payload: { sector: string; count: number } }[]
}) => {
  if (active && payload && payload.length) {
    const p = payload[0]
    return (
      <div className="px-3 py-2 rounded-lg text-xs shadow-lg" style={{ backgroundColor: '#172B4D', color: '#E8EDF4' }}>
        <p className="font-medium">{p.payload.sector}</p>
        <p style={{ color: '#7C9EF0' }}>{formatINR(p.value)}</p>
        <p style={{ color: '#8B9BB4' }}>{p.payload.count} deals</p>
      </div>
    )
  }
  return null
}

function LoadingState() {
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-3" style={{ minHeight: 400, color: '#6B778C' }}>
      <Loader size={28} className="animate-spin" style={{ color: '#0052CC' }} />
      <p className="text-sm font-medium">Retrieving Monday.com data…</p>
      <p className="text-xs" style={{ color: '#97A0AF' }}>Running business analysis…</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-3" style={{ minHeight: 400 }}>
      <AlertCircle size={32} style={{ color: '#DE350B' }} />
      <p className="text-sm font-semibold" style={{ color: '#172B4D' }}>Unable to load dashboard</p>
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

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period] = useState('this_quarter')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.dashboard({ period })
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return null

  const { kpis, sector_breakdown, pipeline_funnel, revenue_trend, top_risks, data_quality } = data

  // Compute sector pcts for chart labels
  const totalSectorValue = sector_breakdown.reduce((s, x) => s + x.value, 0)
  const sectorWithPct = sector_breakdown.map(s => ({
    ...s,
    pct: totalSectorValue > 0 ? +(s.value / totalSectorValue * 100).toFixed(1) : 0,
  }))

  // Revenue trend: convert raw INR to Cr for chart display
  const revChartData = revenue_trend.map(r => ({
    month: r.period,
    value: +(r.value / 10_000_000).toFixed(2),
  }))

  // Funnel: compute relative widths
  const maxFunnelVal = pipeline_funnel[0]?.value || 1

  const healthRating = kpis.health_score >= 80 ? 'Excellent' : kpis.health_score >= 60 ? 'Good' : kpis.health_score >= 40 ? 'At Risk' : 'Critical'
  const healthColor = kpis.health_score >= 60 ? '#006644' : kpis.health_score >= 40 ? '#D97706' : '#DE350B'
  const healthBg = kpis.health_score >= 60 ? '#E3FCEF' : kpis.health_score >= 40 ? '#FFF0E0' : '#FFEBE6'

  return (
    <div className="p-6 space-y-5" style={{ backgroundColor: '#F4F5F7', minHeight: '100%' }}>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#172B4D' }}>Executive Dashboard</h1>
          <p className="text-sm" style={{ color: '#6B778C' }}>
            This Quarter · {data_quality.records_analyzed} records analysed
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data_quality.warnings.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: '#FFF0E0', color: '#D97706' }}
              title={data_quality.warnings.join('; ')}
            >
              <AlertTriangle size={11} />
              {data_quality.warnings.length} data warning{data_quality.warnings.length > 1 ? 's' : ''}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: '#E3FCEF', color: '#006644' }}
          >
            <CheckCircle size={11} />
            Live data
          </span>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ border: '1px solid #DFE1E6', backgroundColor: '#FFFFFF', color: '#6B778C' }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F4F5F7')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FFFFFF')}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Open Pipeline" value={kpis.pipeline} isMoney />
        <KpiCard label="Weighted Pipeline" value={kpis.weighted_pipeline} isMoney />
        <KpiCard label="Won Revenue" value={kpis.won_revenue} isMoney />
        <KpiCard label="Win Rate" value={kpis.win_rate} isPercent />
      </div>

      {/* Secondary KPIs + Health */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <p className="text-xs font-medium mb-1" style={{ color: '#6B778C' }}>Active Projects</p>
          <p className="text-2xl font-bold mb-1" style={{ color: '#172B4D' }}>{kpis.active_projects}</p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <p className="text-xs font-medium mb-1" style={{ color: '#6B778C' }}>Delayed Projects</p>
          <p className="text-2xl font-bold mb-1" style={{ color: kpis.delayed_projects > 0 ? '#DE350B' : '#172B4D' }}>
            {kpis.delayed_projects}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <p className="text-xs font-medium mb-1" style={{ color: '#6B778C' }}>Health Score</p>
          <div className="flex items-baseline gap-2 mb-1">
            <p className="text-2xl font-bold" style={{ color: '#172B4D' }}>{kpis.health_score}/100</p>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: healthBg, color: healthColor }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: healthColor }} />
              {healthRating}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ backgroundColor: '#F4F5F7' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${kpis.health_score}%`,
                background: 'linear-gradient(90deg, #36B37E 0%, #57D9A3 100%)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {/* Revenue Trend */}
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#172B4D' }}>Revenue Trend (INR Cr)</p>
          {revChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={revChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F7" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#97A0AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#97A0AF' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0052CC"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0052CC', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#0052CC' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-center pt-8" style={{ color: '#97A0AF' }}>No revenue data for this period.</p>
          )}
        </div>

        {/* Pipeline by Sector */}
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: '#172B4D' }}>Pipeline by Sector</p>
          {sectorWithPct.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="relative" style={{ width: 110, height: 110 }}>
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie
                      data={sectorWithPct}
                      cx={50}
                      cy={50}
                      innerRadius={34}
                      outerRadius={50}
                      dataKey="value"
                      nameKey="sector"
                      stroke="none"
                    >
                      {sectorWithPct.map((_, i) => (
                        <Cell key={i} fill={SECTOR_PALETTE[i % SECTOR_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<SectorTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-medium" style={{ color: '#97A0AF' }}>Total</span>
                  <span className="text-[11px] font-bold leading-tight" style={{ color: '#172B4D' }}>
                    {formatINRShort(totalSectorValue)}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                {sectorWithPct.slice(0, 5).map((s, i) => (
                  <div key={s.sector} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: SECTOR_PALETTE[i % SECTOR_PALETTE.length] }} />
                    <span className="text-xs" style={{ color: '#6B778C', flex: 1 }}>{s.sector}</span>
                    <span className="text-xs font-semibold" style={{ color: '#172B4D' }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-center pt-8" style={{ color: '#97A0AF' }}>No sector data available.</p>
          )}
        </div>

        {/* Pipeline Funnel */}
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#172B4D' }}>Pipeline Funnel (Value)</p>
          {pipeline_funnel.length > 0 ? (
            <div className="space-y-1.5">
              {pipeline_funnel.map((item, i) => {
                const pct = (item.value / maxFunnelVal) * 100
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs w-20 shrink-0" style={{ color: '#6B778C' }}>{item.stage}</span>
                    <div className="flex-1 rounded-full overflow-hidden" style={{ height: 14, backgroundColor: '#F4F5F7' }}>
                      <div
                        className="h-full rounded-full flex items-center justify-end pr-2"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                          minWidth: 40,
                          transition: 'width 0.6s ease',
                        }}
                      >
                        <span className="text-[9px] font-semibold text-white">{formatINRShort(item.value)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-center pt-8" style={{ color: '#97A0AF' }}>No funnel data available.</p>
          )}
        </div>
      </div>

      {/* Top Risks */}
      {top_risks.length > 0 && (
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: '#FF8B00' }} />
            <p className="text-sm font-semibold" style={{ color: '#172B4D' }}>Top Risks</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {top_risks.map((risk, i) => {
              const c = RISK_COLORS[risk.severity] ?? RISK_COLORS.low
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: c.bg, border: `1px solid ${c.dot}22` }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
                  <span className="text-xs font-medium" style={{ color: '#172B4D' }}>{risk.title}</span>
                  <span
                    className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: c.dot + '22', color: c.text }}
                  >
                    {risk.severity}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Data quality caveat */}
      {(data_quality.records_excluded > 0 || data_quality.warnings.length > 0) && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-lg text-xs"
          style={{ backgroundColor: '#FFF0E0', border: '1px solid #FF8B0033', color: '#6B778C' }}
        >
          <AlertTriangle size={13} style={{ color: '#FF8B00', marginTop: 1, flexShrink: 0 }} />
          <span>
            {data_quality.records_excluded > 0 && `${data_quality.records_excluded} records excluded from analysis. `}
            {data_quality.warnings.join(' ')}
          </span>
        </div>
      )}
    </div>
  )
}
