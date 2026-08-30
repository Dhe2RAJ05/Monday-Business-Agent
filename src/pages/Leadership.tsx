import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ArrowUpRight, AlertTriangle, CheckCircle, Database, MessageSquare, Loader, AlertCircle } from 'lucide-react'
import ChatPanel from '../components/ChatPanel'
import type { ChatMessage } from '../utils/api'
import { api, formatINRShort } from '../utils/api'
import type { LeadershipResponse } from '../utils/api'

interface LeadershipProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  isTyping: boolean
  onOpenChat: () => void
}

function LoadingState() {
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-3" style={{ minHeight: 400, color: '#6B778C' }}>
      <Loader size={28} className="animate-spin" style={{ color: '#0052CC' }} />
      <p className="text-sm font-medium">Generating leadership brief…</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-3" style={{ minHeight: 400 }}>
      <AlertCircle size={32} style={{ color: '#DE350B' }} />
      <p className="text-sm font-semibold" style={{ color: '#172B4D' }}>Unable to generate brief</p>
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

export default function Leadership({ messages, onSend, isTyping }: LeadershipProps) {
  const [data, setData] = useState<LeadershipResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.leadership.brief()
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

  const generatedAt = new Date(data.generated_at)

  return (
    <div className="flex h-full" style={{ backgroundColor: '#F4F5F7' }}>
      {/* Brief area */}
      <div className="flex-1 min-w-0 p-6 overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#172B4D' }}>Leadership Brief</h1>
            <p className="text-sm" style={{ color: '#6B778C' }}>A print-ready summary for the weekly leadership sync.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChat(c => !c)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                border: '1px solid #DFE1E6',
                backgroundColor: showChat ? '#E6F2FF' : '#FFFFFF',
                color: showChat ? '#0052CC' : '#6B778C',
              }}
            >
              <MessageSquare size={14} />
              {showChat ? 'Hide Chat' : 'AI Chat'}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Generating...' : 'Regenerate'}
            </button>
          </div>
        </div>

        {/* Document card */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #DFE1E6' }}>
          {/* Doc header */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ backgroundColor: '#F8F9FC', borderBottom: '3px solid #0052CC' }}
          >
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#0052CC' }}>
                Skylark BI Copilot · Leadership Brief
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#97A0AF' }}>
                Generated {generatedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at{' '}
                {generatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="4" fill="white" fillOpacity="0.9" />
                <path d="M8 2L10 6H14L11 8.5L12 12.5L8 10L4 12.5L5 8.5L2 6H6L8 2Z" fill="white" fillOpacity="0.5" />
              </svg>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Headline */}
            <p className="text-base font-medium leading-relaxed" style={{ color: '#172B4D' }}>{data.headline}</p>

            {/* Metrics grid */}
            {data.key_metrics.length > 0 && (
              <div
                className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
                style={{ backgroundColor: '#DFE1E6' }}
              >
                {data.key_metrics.map(({ label, value }) => (
                  <div key={label} className="bg-white px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-0.5" style={{ color: '#97A0AF' }}>{label}</p>
                    <p className="text-lg font-bold" style={{ color: '#172B4D' }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Insights */}
            {data.insights.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight size={14} style={{ color: '#36B37E' }} />
                  <h3 className="text-sm font-semibold" style={{ color: '#172B4D' }}>Insights</h3>
                </div>
                <ul className="space-y-1.5">
                  {data.insights.map((ins, i) => (
                    <li key={i} className="flex gap-2 text-sm" style={{ color: '#6B778C' }}>
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#36B37E' }} />
                      {ins}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risks */}
            {data.risks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} style={{ color: '#FF8B00' }} />
                  <h3 className="text-sm font-semibold" style={{ color: '#172B4D' }}>Risks</h3>
                </div>
                <ul className="space-y-1.5">
                  {data.risks.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm" style={{ color: '#6B778C' }}>
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#FF8B00' }} />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            {data.actions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} style={{ color: '#0052CC' }} />
                  <h3 className="text-sm font-semibold" style={{ color: '#172B4D' }}>Actions</h3>
                </div>
                <ul className="space-y-1.5">
                  {data.actions.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm" style={{ color: '#6B778C' }}>
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#0052CC' }} />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div
              className="flex items-center justify-between pt-3"
              style={{ borderTop: '1px solid #DFE1E6' }}
            >
              <div className="flex items-center gap-3">
                {data.sources.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: '#97A0AF' }}>
                    <Database size={11} />
                    {s}
                  </div>
                ))}
              </div>
              {data.data_quality.records_analyzed > 0 && (
                <span className="text-xs" style={{ color: '#97A0AF' }}>
                  {data.data_quality.records_analyzed} records · {data.data_quality.records_excluded} excluded
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat panel (embedded) — uses the real API via parent's onSend */}
      {showChat && (
        <div
          className="flex flex-col shrink-0"
          style={{ width: 380, borderLeft: '1px solid #DFE1E6' }}
        >
          <ChatPanel
            onClose={() => setShowChat(false)}
            messages={messages}
            onSend={onSend}
            isTyping={isTyping}
            embedded
          />
        </div>
      )}
    </div>
  )
}
