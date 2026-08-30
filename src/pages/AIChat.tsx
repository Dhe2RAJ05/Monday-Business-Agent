import ChatPanel from '../components/ChatPanel'
import type { ChatMessage } from '../utils/api'

interface AIChatProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  isTyping: boolean
}

export default function AIChat({ messages, onSend, isTyping }: AIChatProps) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0F1629' }}>
      <ChatPanel
        onClose={() => {}}
        messages={messages}
        onSend={onSend}
        isTyping={isTyping}
        embedded
      />
    </div>
  )
}
