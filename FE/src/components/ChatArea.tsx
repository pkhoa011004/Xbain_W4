import React, { useEffect, useRef } from 'react'
import { Send, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Message } from './types'
import { MessageBubble } from './MessageBubble'
interface ChatAreaProps {
  messages: Message[]
  inputValue: string
  setInputValue: (val: string) => void
  onSend: () => void
  isProcessing: boolean
  onReset: () => void
}
export function ChatArea({
  messages,
  inputValue,
  setInputValue,
  onSend,
  isProcessing,
  onReset,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }
  useEffect(() => {
    scrollToBottom()
  }, [messages, isProcessing])
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (inputValue.trim() && !isProcessing) onSend()
    }
  }
  return (
    <div className="flex-1 flex flex-col h-full bg-background relative">
      {/* Top Bar */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-background/80 backdrop-blur-sm z-10 absolute top-0 left-0 right-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300 bg-surface px-3 py-1.5 rounded-md border border-border">
            Bedrock KB + Tools
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900/50 px-2.5 py-1 rounded-full border border-zinc-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            API Gateway connected
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-2 rounded-md hover:bg-zinc-800"
          title="Reset Conversation"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pt-20 pb-6 px-6 lg:px-12 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-6">
            <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mb-2">
              <BrainIcon className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              Welcome to GeekBrain AI
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Ask about GeekBrain documents, service costs, incidents, SLA
              checks, current metrics, or follow-up context from the same
              session.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full text-left mt-4">
              <FeatureCard
                level="L1"
                title="Retrieval"
                desc="Bedrock KB"
              />
              <FeatureCard
                level="L2"
                title="Multi-Source"
                desc="KB synthesis"
              />
              <FeatureCard
                level="L3"
                title="Tools"
                desc="SQLite + Metrics API"
              />
              <FeatureCard
                level="L4"
                title="Memory"
                desc="Session follow-ups"
              />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isProcessing && (
              <div className="flex gap-4 w-full">
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                </div>
                <div className="bg-surface border border-border px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-zinc-400 flex items-center gap-2">
                  Processing pipeline...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t border-border shrink-0">
        <div className="max-w-3xl mx-auto relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about GeekBrain services, costs, SLA, incidents, or policies..."
            className="w-full bg-surface border border-border rounded-xl pl-4 pr-12 py-3.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 resize-none min-h-[52px] max-h-32"
            rows={1}
          />
          <button
            onClick={onSend}
            disabled={!inputValue.trim() || isProcessing}
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-background rounded-lg transition-colors"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
          <div className="absolute -top-6 left-2 text-[10px] text-zinc-500 font-medium tracking-wide">
            Same browser session keeps{' '}
            <span className="text-emerald-500">L4 memory</span> for follow-ups
          </div>
        </div>
      </div>
    </div>
  )
}
function FeatureCard({
  level,
  title,
  desc,
}: {
  level: string
  title: string
  desc: string
}) {
  return (
    <div className="bg-surface border border-border p-3 rounded-lg">
      <div className="text-[10px] font-bold text-zinc-500 mb-1">{level}</div>
      <div className="text-sm font-medium text-zinc-200 mb-0.5">{title}</div>
      <div className="text-xs text-zinc-500">{desc}</div>
    </div>
  )
}
function BrainIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  )
}
