import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import ChatPanel from './components/ChatPanel'
import Dashboard from './pages/Dashboard'
import Boards from './pages/Boards'
import Pipeline from './pages/Pipeline'
import Operations from './pages/Operations'
import Leadership from './pages/Leadership'
import AIChat from './pages/AIChat'
import type { ChatMessage } from './utils/api'
import { api, createUserMessage, chatResponseToMessage } from './utils/api'

export type Page = 'dashboard' | 'boards' | 'pipeline' | 'operations' | 'leadership' | 'chat'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [pendingQuery, setPendingQuery] = useState<string | undefined>()
  const [conversationId, setConversationId] = useState<string | null>(null)

  const handleSend = useCallback(async (text: string) => {
    setMessages(prev => [...prev, createUserMessage(text)])
    setIsTyping(true)
    try {
      const res = await api.chat({ message: text, conversation_id: conversationId })
      // Persist the conversation_id for multi-turn chat
      if (res.conversation_id && !conversationId) {
        setConversationId(res.conversation_id)
      }
      setMessages(prev => [...prev, chatResponseToMessage(res)])
    } catch (err) {
      // Show an error bubble in the chat thread rather than crashing
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          role: 'assistant' as const,
          content: `⚠️ ${msg}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }, [conversationId])

  const handleAskAI = (q?: string) => {
    if (page === 'chat' || page === 'leadership') {
      // chat is inline for these pages
      return
    }
    if (q) {
      setPendingQuery(q)
      handleSend(q)
    }
    setChatOpen(true)
  }

  const showFloatingChat = chatOpen && page !== 'leadership' && page !== 'chat'

  return (
    <div className="flex h-full" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar page={page} setPage={(p) => { setPage(p); if (p !== 'leadership' && p !== 'chat') {/* keep chat state */} }} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onAskAI={handleAskAI} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {page === 'dashboard'  && <Dashboard />}
          {page === 'boards'     && <Boards />}
          {page === 'pipeline'   && <Pipeline />}
          {page === 'operations' && <Operations />}
          {page === 'leadership' && (
            <Leadership
              messages={messages}
              onSend={handleSend}
              isTyping={isTyping}
              onOpenChat={() => setChatOpen(true)}
            />
          )}
          {page === 'chat' && (
            <AIChat messages={messages} onSend={handleSend} isTyping={isTyping} />
          )}
        </main>
      </div>

      {showFloatingChat && (
        <ChatPanel
          onClose={() => setChatOpen(false)}
          messages={messages}
          onSend={handleSend}
          isTyping={isTyping}
          initialQuery={pendingQuery}
        />
      )}
    </div>
  )
}
