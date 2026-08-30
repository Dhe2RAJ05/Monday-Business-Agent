import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot } from 'lucide-react'
import type { ChatMessage } from '../utils/api'

interface ChatPanelProps {
  onClose: () => void
  messages: ChatMessage[]
  onSend: (text: string) => void
  isTyping: boolean
  initialQuery?: string
  embedded?: boolean
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm text-white"
          style={{ background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)' }}
        >
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)' }}
      >
        <Bot size={13} color="white" />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="rounded-2xl rounded-tl-sm p-3 text-sm"
          style={{ backgroundColor: '#1E2844', color: '#C4CFDE' }}
        >
          <p className="leading-relaxed mb-2" style={{ color: '#E8EDF4' }}>{msg.content}</p>

          {/* Metric pills */}
          {msg.metrics && msg.metrics.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-2.5" style={{ borderTop: '1px solid #2D3A55' }}>
              {msg.metrics.map((m, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[10px] font-medium" style={{ color: '#8B9BB4' }}>{m.label}</span>
                  <span className="text-xs font-semibold" style={{ color: '#7C9EF0' }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Insights */}
          {msg.insights && msg.insights.length > 0 && (
            <div className="mt-2.5">
              {msg.insights.map((ins, i) => (
                <p key={i} className="text-xs flex gap-1.5" style={{ color: '#8B9BB4' }}>
                  <span style={{ color: '#36B37E' }}>↗</span>
                  {ins}
                </p>
              ))}
            </div>
          )}

          {/* Risks */}
          {msg.risks && msg.risks.length > 0 && (
            <div className="mt-2">
              {msg.risks.map((r, i) => (
                <p key={i} className="text-xs flex gap-1.5" style={{ color: '#8B9BB4' }}>
                  <span style={{ color: '#FF8B00' }}>⚠</span>
                  {r}
                </p>
              ))}
            </div>
          )}

          {/* Sources */}
          {msg.sources && msg.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2" style={{ borderTop: '1px solid #2D3A55' }}>
              {msg.sources.map((s, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#0A1628', color: '#4B6FD0', border: '1px solid #2D3A55' }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 items-start">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)' }}
      >
        <Bot size={13} color="white" />
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center"
        style={{ backgroundColor: '#1E2844' }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: '#4B6FD0',
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
        <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }`}</style>
      </div>
    </div>
  )
}

export default function ChatPanel({ onClose, messages, onSend, isTyping, initialQuery, embedded = false }: ChatPanelProps) {
  const [input, setInput] = useState(initialQuery ?? '')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const submit = () => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  const containerStyle = embedded
    ? { display: 'flex', flexDirection: 'column' as const, height: '100%' }
    : {
        position: 'fixed' as const,
        top: 56,
        right: 0,
        bottom: 0,
        width: 380,
        display: 'flex',
        flexDirection: 'column' as const,
        zIndex: 50,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
      }

  return (
    <div style={{ ...containerStyle, backgroundColor: '#0F1629' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid #1E2844' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)' }}
          >
            <Bot size={14} color="white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Skylark AI</div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px]" style={{ color: '#8B9BB4' }}>Connected to Monday.com</span>
            </div>
          </div>
        </div>
        {!embedded && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#8B9BB4' }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1E2844')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-8">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)' }}
            >
              <Bot size={22} color="white" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">Skylark BI Copilot</p>
            <p className="text-xs" style={{ color: '#8B9BB4' }}>
              Ask me anything about your pipeline, operations, or business metrics.
            </p>
            <div className="mt-4 space-y-2">
              {[
                "How's our Energy pipeline this quarter?",
                "Which work orders are delayed?",
                "What's our win rate?",
              ].map(q => (
                <button
                  key={q}
                  onClick={() => onSend(q)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: '#1E2844', color: '#8B9BB4', border: '1px solid #2D3A55' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = '#4B6FD0')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = '#2D3A55')}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 shrink-0" style={{ borderTop: '1px solid #1E2844' }}>
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{ backgroundColor: '#1E2844', border: '1px solid #2D3A55' }}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Ask about pipeline, revenue, operations..."
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none resize-none"
            style={{ color: '#E8EDF4', lineHeight: '1.5', maxHeight: 120 }}
          />
          <button
            onClick={submit}
            disabled={!input.trim() || isTyping}
            className="p-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{
              background: input.trim() && !isTyping
                ? 'linear-gradient(135deg, #0052CC 0%, #6554C0 100%)'
                : '#2D3A55',
            }}
          >
            <Send size={14} color="white" />
          </button>
        </div>
        <p className="text-center text-[10px] mt-1.5" style={{ color: '#4A5568' }}>
          Querying Monday.com boards dynamically
        </p>
      </div>
    </div>
  )
}
