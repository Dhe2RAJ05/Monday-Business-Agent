import { useState } from 'react'
import { Search, Bell, Settings, ChevronDown } from 'lucide-react'

interface TopBarProps {
  onAskAI: (q?: string) => void
}

export default function TopBar({ onAskAI }: TopBarProps) {
  const [query, setQuery] = useState('')

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      onAskAI(query.trim())
      setQuery('')
    }
  }

  return (
    <header
      className="flex items-center gap-3 px-5 h-14 shrink-0"
      style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #DFE1E6', zIndex: 10 }}
    >
      {/* Search */}
      <div className="flex-1 relative max-w-xl">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#97A0AF' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about your business..."
          className="w-full pl-9 pr-10 py-2 text-sm rounded-lg outline-none transition-all"
          style={{
            backgroundColor: '#F4F5F7',
            border: '1px solid #DFE1E6',
            color: '#172B4D',
          }}
          onFocus={e => (e.target.style.borderColor = '#4B6FD0')}
          onBlur={e => (e.target.style.borderColor = '#DFE1E6')}
        />
        <kbd
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ backgroundColor: '#DFE1E6', color: '#6B778C', lineHeight: '1.4' }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Ask AI */}
      <button
        onClick={() => onAskAI(query.trim() || undefined)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
        style={{ background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)', whiteSpace: 'nowrap' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1L8.5 5.5H13L9.5 8L11 12.5L7 10L3 12.5L4.5 8L1 5.5H5.5L7 1Z" fill="white" fillOpacity="0.9" />
        </svg>
        Ask AI
      </button>

      <div style={{ width: 1, height: 24, backgroundColor: '#DFE1E6' }} />

      {/* Icons */}
      <button
        className="p-2 rounded-lg transition-colors"
        style={{ color: '#6B778C' }}
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F4F5F7')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
      >
        <Bell size={18} />
      </button>
      <button
        className="p-2 rounded-lg transition-colors"
        style={{ color: '#6B778C' }}
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F4F5F7')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
      >
        <Settings size={18} />
      </button>

      {/* Avatar */}
      <button className="flex items-center gap-2 pl-1">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)' }}
        >
          SK
        </div>
        <ChevronDown size={14} style={{ color: '#6B778C' }} />
      </button>
    </header>
  )
}
