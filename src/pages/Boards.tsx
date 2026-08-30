import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { api, formatINR } from '../utils/api'
import { StageBadge, StatusBadge, MissingBadge } from '../components/StatusBadge'

type Tab = 'deals' | 'work-orders'

const ITEMS_PER_PAGE = 12

type DealRow = {
  id: string; name: string; sector: string; stage: string; value: number | null
  owner: string | null; closeDate: string | null; lastUpdated: string
}
type WorkOrderRow = {
  id: string; name: string; sector: string; status: string; value: number | null
  owner: string | null; location: string; lastUpdated: string; overdueBy?: number
}

export default function Boards() {
  const [tab, setTab] = useState<Tab>('deals')
  const [page, setPage] = useState(1)
  const [deals, setDeals] = useState<DealRow[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])
  const [totals, setTotals] = useState({ deals: 0, workOrders: 0 })
  const [notice, setNotice] = useState('Loading live board data…')

  const load = useCallback(async () => {
    try {
      setNotice('Loading live board data…')
      const result = await api.boards({ kind: tab, page, page_size: ITEMS_PER_PAGE })
      if (tab === 'deals') {
        setDeals(result.items as unknown as DealRow[])
        setTotals(prev => ({ ...prev, deals: result.total }))
      } else {
        setWorkOrders(result.items as unknown as WorkOrderRow[])
        setTotals(prev => ({ ...prev, workOrders: result.total }))
      }
      setNotice(result.data_quality.warnings.length ? result.data_quality.warnings.join(' ') : 'Live Monday.com data is shown read-only.')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to load board data. Please retry.')
    }
  }, [page, tab])

  useEffect(() => { void load() }, [load])

  const totalDeals = totals.deals
  const totalWOs = totals.workOrders
  const visibleDeals = deals
  const visibleWOs = workOrders

  const totalItems = tab === 'deals' ? totalDeals : totalWOs
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
  const start = totalItems ? (page - 1) * ITEMS_PER_PAGE + 1 : 0
  const end = Math.min(page * ITEMS_PER_PAGE, totalItems)

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setPage(1)
  }

  return (
    <div className="p-6" style={{ backgroundColor: '#F4F5F7', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#172B4D' }}>Boards</h1>
          <p className="text-sm" style={{ color: '#6B778C' }}>Read-only mirror of your Monday.com boards</p>
        </div>
        {/* Tabs */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid #DFE1E6', backgroundColor: '#FFFFFF' }}
        >
          {([['deals', `Deals (${totalDeals})`], ['work-orders', `Work Orders (${totalWOs})`]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                color: tab === id ? '#0052CC' : '#6B778C',
                backgroundColor: tab === id ? '#E6F2FF' : 'transparent',
                borderRight: id === 'deals' ? '1px solid #DFE1E6' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Data quality warning */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm"
        style={{ backgroundColor: '#FFFBEA', border: '1px solid #F6C000', color: '#7A5300' }}
      >
        <AlertTriangle size={14} style={{ color: '#F6C000', flexShrink: 0 }} />
        <span>
          3 items on this board have missing fields — flagged below rather than hidden.
        </span>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #DFE1E6' }}>
        {tab === 'deals' ? (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #DFE1E6', backgroundColor: '#F8F9FC' }}>
                {['Name', 'Sector', 'Stage', 'Value', 'Owner', 'Close Date', 'Last Updated'].map(col => (
                  <th
                    key={col}
                    className="text-left px-4 py-3 text-xs font-semibold"
                    style={{ color: '#6B778C' }}
                  >
                    <div className="flex items-center gap-1">
                      {col}
                      <ChevronDown size={12} style={{ opacity: 0.5 }} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleDeals.map((deal, i) => (
                <tr
                  key={deal.id}
                  style={{ borderBottom: i < visibleDeals.length - 1 ? '1px solid #F4F5F7' : 'none' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#FAFBFC')}
                  onMouseLeave={e => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent')}
                  className="transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium max-w-xs" style={{ color: '#172B4D' }}>
                    <span className="block truncate" title={deal.name}>{deal.name}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6B778C' }}>{deal.sector}</td>
                  <td className="px-4 py-3"><StageBadge stage={deal.stage} /></td>
                  <td className="px-4 py-3">
                    {deal.value !== null
                      ? <span className="font-medium" style={{ color: '#172B4D' }}>{formatINR(deal.value)}</span>
                      : <MissingBadge />}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6B778C' }}>
                    {deal.owner ?? <MissingBadge />}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6B778C' }}>
                    {deal.closeDate ?? <MissingBadge />}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#97A0AF' }}>{deal.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #DFE1E6', backgroundColor: '#F8F9FC' }}>
                {['Name', 'Sector', 'Status', 'Value', 'Owner', 'Location', 'Last Updated'].map(col => (
                  <th
                    key={col}
                    className="text-left px-4 py-3 text-xs font-semibold"
                    style={{ color: '#6B778C' }}
                  >
                    <div className="flex items-center gap-1">
                      {col}
                      <ChevronDown size={12} style={{ opacity: 0.5 }} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleWOs.map((wo, i) => (
                <tr
                  key={wo.id}
                  style={{ borderBottom: i < visibleWOs.length - 1 ? '1px solid #F4F5F7' : 'none' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#FAFBFC')}
                  onMouseLeave={e => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent')}
                  className="transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium max-w-xs" style={{ color: '#172B4D' }}>
                    <div className="flex items-start gap-2">
                      <span className="block truncate" title={wo.name}>{wo.name}</span>
                      {wo.overdueBy && (
                        <span
                          className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: '#FFEBE6', color: '#DE350B' }}
                        >
                          {wo.overdueBy}d overdue
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6B778C' }}>{wo.sector}</td>
                  <td className="px-4 py-3"><StatusBadge status={wo.status} /></td>
                  <td className="px-4 py-3">
                    {wo.value !== null
                      ? <span className="font-medium" style={{ color: '#172B4D' }}>{formatINR(wo.value)}</span>
                      : <MissingBadge />}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6B778C' }}>
                    {wo.owner ?? <span className="italic" style={{ color: '#97A0AF' }}>Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6B778C' }}>{wo.location}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#97A0AF' }}>{wo.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid #DFE1E6', backgroundColor: '#FAFBFC' }}
        >
          <span className="text-xs" style={{ color: '#6B778C' }}>
            Showing {start} to {end} of {totalItems}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded disabled:opacity-30 transition-colors"
              style={{ color: '#6B778C' }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F4F5F7')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="w-8 h-8 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: page === p ? '#0052CC' : 'transparent',
                  color: page === p ? '#FFFFFF' : '#6B778C',
                }}
                onMouseEnter={e => {
                  if (page !== p) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F4F5F7'
                }}
                onMouseLeave={e => {
                  if (page !== p) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                }}
              >
                {p}
              </button>
            ))}
            {totalPages > 5 && (
              <>
                <span className="text-xs" style={{ color: '#97A0AF' }}>...</span>
                <button
                  onClick={() => setPage(totalPages)}
                  className="w-8 h-8 rounded text-xs font-medium transition-colors"
                  style={{ color: '#6B778C' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F4F5F7')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                >
                  {totalPages}
                </button>
              </>
            )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded disabled:opacity-30 transition-colors"
              style={{ color: '#6B778C' }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F4F5F7')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
            >
              <ChevronRight size={14} />
            </button>
            <span className="ml-2 text-xs" style={{ color: '#97A0AF' }}>{ITEMS_PER_PAGE} / page</span>
          </div>
        </div>
      </div>
    </div>
  )
}
