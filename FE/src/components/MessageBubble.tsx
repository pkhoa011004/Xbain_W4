import React from 'react'
import { motion } from 'framer-motion'
import { Brain, User } from 'lucide-react'
import { Message } from './types'
interface MessageBubbleProps {
  message: Message
}
export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const formatContent = (text: string) => {
    // Simple bold formatting
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        )
      }
      return <span key={i}>{part}</span>
    })
  }
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 10,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className={`flex gap-4 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-zinc-800 text-zinc-400' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
      </div>

      <div
        className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}
      >
        {!isUser && message.level && (
          <div
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1.5
            ${message.level === 'L1' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : message.level === 'L2' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : message.level === 'L3' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}
          >
            {message.level} Response
            {message.trace?.tools && message.trace.tools.length > 0 && (
              <span className="text-zinc-500 font-normal border-l border-zinc-700 pl-1.5">
                {message.trace.tools.length} tool
                {message.trace.tools.length > 1 ? 's' : ''} used
              </span>
            )}
          </div>
        )}

        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser ? 'bg-zinc-800 text-zinc-200 rounded-tr-sm' : 'bg-surface border border-border text-zinc-300 rounded-tl-sm'}`}
        >
          <div className="whitespace-pre-wrap">
            {formatContent(message.content)}
          </div>
        </div>

        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {message.citations.map((cite, i) => (
              <span
                key={i}
                className="text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md flex items-center gap-1"
              >
                <FileIcon /> {cite}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
function FileIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
