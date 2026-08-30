import { useState, useEffect, useCallback } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { AlertTriangle, RefreshCw, Loader, AlertCircle } from 'lucide-react'
import { api } from '../utils/api'
import type { OperationsResponse } from '../utils/api'

const SECTOR_PALETTE = ['#0052CC', '#6554C0', '#36B37E', '#FF8B00', '#DE350B', '#00B8D9']

const STATUS_COLORS_PIE: Record<string, string> = {
  Completed: '#36B37E',
  Active: '#0052CC',
  Pending: '#97A0AF',
  Delayed: '#FF5630',
}

const StatusTooltip = ({ active, payload }: {
  active?: boolean
  payload?: { name: string; value: number; payload: { status?: string; count: number } }[]
}) => {
  if (active && payload && payload.length) {
    const p = payload[0]
    return (
      <div className="px-3 py-2 rounded-lg text-xs shadow-lg" style={{ backgroundColor: '#172B4D', color: '#E8EDF4' }}>
        <p className="font-medium">{p.payload.status ?? p.name}</p>
        <p style={{ color: '#7C9EF0' }}>{p.value} work orders</p>
      </div>
    )
  }
  return null
}

const SectorTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="px-3 py-2 rounded-lg text-xs shadow-lg" style={{ backgroundColor: '#172B4D', color: '#E8EDF4' }}>
        <p className="font-medium mb-0.5">{label}</p>
        <p style={{ color: '#7C9EF0' }}>{payload[0].value} work orders</p>
      </div>
    )
  }
  return null
}

function LoadingState() {
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-3" style={{ minHeight: 400, color: '#6B778C' }}>
      <Loader size={28} className="animate-spin" style={{ color: '#0052CC' }} />
      <p className="text-sm font-medium">Loading operations data…</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-3" style={{ minHeight: 400 }}>
      <AlertCircle size={32} style={{ color: '#DE350B' }} />
      <p className="text-sm font-semibold" style={{ color: '#172B4D' }}>Unable to load operations</p>
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

export default function Operations() {
  const [data, setData] = useState<OperationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.operations()
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return null

  // Build status chart data
  const statusEntries = [
    { status: 'Active', count: data.active },
    { status: 'Completed', count: data.completed },
    { status: 'Pending', count: data.pending },
    { status: 'Delayed', count: data.delayed },
  ].filter(s => s.count > 0)

  // Build sector chart data
  const sectorChart = (data.by_sector ?? []).map((s) => ({
    sector: String(s.sector ?? s['sector'] ?? 'Unknown'),
    count: Number(s.count ?? 0),
  }))

  // Delayed work orders
  const delayedProjects = (data.delayed_projects ?? []).map(d => ({
    name: String(d.name ?? d['name'] ?? 'Work Order'),
    status: 'Delayed',
    sector: String(d.sector ?? d['sector'] ?? ''),
  }))

  return (
    <div className="p-6 space-y-5" style={{ backgroundColor: '#F4F5F7', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#172B4D' }}>Operations</h1>
          <p className="text-sm" style={{ color: '#6B778C' }}>
            Work order execution status · {data.data_quality.records_analyzed} records
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ border: '1px solid #DFE1E6', backgroundColor: '#FFFFFF', color: '#6B778C' }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Big stat KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Work Orders', value: data.total_work_orders, color: '#172B4D' },
          { label: 'Active',            value: data.active,            color: '#0052CC' },
          { label: 'Completed',         value: data.completed,         color: '#36B37E' },
          { label: 'Delayed',           value: data.delayed,           color: '#FF5630' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 text-center" style={{ border: '1px solid #DFE1E6' }}>
            <p className="text-5xl font-bold mb-1" style={{ color }}>{value}</p>
            <p className="text-sm font-medium" style={{ color: '#6B778C' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* By Status donut */}
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #DFE1E6' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: '#172B4D' }}>By Status</p>
          {statusEntries.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="relative" style={{ width: 140, height: 140 }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={statusEntries}
                      cx={65}
                      cy={65}
                      innerRadius={44}
                      outerRadius={62}
                      dataKey="count"
                      nameKey="status"
                      stroke="none"
                    >
                      {statusEntries.map(s => (
                        <Cell key={s.status} fill={STATUS_COLORS_PIE[s.status] ?? '#97A0AF'} />
                      ))}
                    </Pie>
                    <Tooltip content={<StatusTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold" style={{ color: '#172B4D' }}>{data.total_work_orders}</span>
                  <span className="text-xs" style={{ color: '#97A0AF' }}>Total</span>
                </div>
              </div>
              <div className="space-y-2.5 flex-1">
                {statusEntries.map(s => {
                  const pct = data.total_work_orders > 0
                    ? ((s.count / data.total_work_orders) * 100).toFixed(1)
                    : '0'
                  return (
                    <div key={s.status} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: STATUS_COLORS_PIE[s.status] ?? '#97A0AF' }} />
                      <span className="text-sm flex-1" style={{ color: '#6B778C' }}>{s.status}</span>
                      <span className="text-sm font-semibold" style={{ color: '#172B4D' }}>{s.count}</span>
                      <span className="text-xs" style={{ color: '#97A0AF' }}>({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-center pt-8" style={{ color: '#97A0AF' }}>No status data available.</p>
          )}
        </div>

        {/* By Sector bar */}
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #DFE1E6' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: '#172B4D' }}>By Sector (Work Orders)</p>
          {sectorChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={sectorChart} margin={{ top: 0, right: 8, left: -16, bottom: 0 }} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F7" vertical={false} />
                <XAxis
                  dataKey="sector"
                  tick={{ fontSize: 10, fill: '#97A0AF' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v.length > 8 ? v.slice(0, 8) + '…' : v}
                />
                <YAxis tick={{ fontSize: 10, fill: '#97A0AF' }} axisLine={false} tickLine={false} />
                <Tooltip content={<SectorTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {sectorChart.map((s, i) => <Cell key={s.sector} fill={SECTOR_PALETTE[i % SECTOR_PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-center pt-8" style={{ color: '#97A0AF' }}>No sector data available.</p>
          )}
        </div>
      </div>

      {/* Delayed Projects */}
      {delayedProjects.length > 0 && (
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #DFE1E6' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: '#FF5630' }} />
            <p className="text-sm font-semibold" style={{ color: '#172B4D' }}>Delayed Projects</p>
          </div>
          <div className="space-y-2">
            {delayedProjects.map((wo, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 rounded-lg"
                style={{ backgroundColor: '#FFFBFA', border: '1px solid #FFEBE6' }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: '#172B4D' }}>{wo.name}</p>
                  {wo.sector && <p className="text-xs mt-0.5" style={{ color: '#6B778C' }}>{wo.sector}</p>}
                </div>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: '#FFEBE6', color: '#DE350B' }}
                >
                  Delayed
                </span>
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
