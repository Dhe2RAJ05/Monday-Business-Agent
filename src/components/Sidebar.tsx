import { LayoutDashboard, Grid3x3, TrendingUp, Wrench, FileText, MessageSquare } from 'lucide-react'
import type { Page } from '../App'

interface SidebarProps {
  page: Page
  setPage: (p: Page) => void
}

const NAV = [
  { id: 'dashboard' as Page, label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'boards'    as Page, label: 'Boards',    Icon: Grid3x3 },
  { id: 'pipeline'  as Page, label: 'Pipeline',  Icon: TrendingUp },
  { id: 'operations'as Page, label: 'Operations',Icon: Wrench },
  { id: 'leadership'as Page, label: 'Leadership',Icon: FileText },
  { id: 'chat'      as Page, label: 'AI Chat',   Icon: MessageSquare },
]


export default function Sidebar({ page, setPage }: SidebarProps) {
  return (
    <aside
      className="flex flex-col shrink-0 sidebar-scroll overflow-y-auto"
      style={{ width: 220, backgroundColor: '#151C2E', borderRight: '1px solid #1E2844' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid #1E2844' }}>
        <div
          className="flex items-center justify-center rounded-lg text-white font-bold text-sm"
          style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)', flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" fill="white" fillOpacity="0.3" />
            <path d="M8 3L12 5.5V10.5L8 13L4 10.5V5.5L8 3Z" fill="white" fillOpacity="0.6" />
            <circle cx="8" cy="8" r="2" fill="white" />
          </svg>
        </div>
        <div>
          <div className="text-white font-semibold text-sm leading-tight">Skylark BI Copilot</div>
          <div className="text-xs leading-tight" style={{ color: '#4A6FA5' }}>Founder Intelligence</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ id, label, Icon }) => {
          const active = page === id
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative"
              style={{
                color: active ? '#FFFFFF' : '#8B9BB4',
                backgroundColor: active ? '#1A2540' : 'transparent',
                borderLeft: active ? '3px solid #4B6FD0' : '3px solid transparent',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1E2844'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#C4CFDE'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#8B9BB4'
                }
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              <span>{label}</span>
              {id === 'chat' && (
                <span
                  className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#0052CC', color: '#ffffff' }}
                >
                  AI
                </span>
              )}
            </button>
          )
        })}
      </nav>

    </aside>
  )
}
