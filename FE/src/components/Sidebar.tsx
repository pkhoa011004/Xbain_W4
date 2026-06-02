import React from 'react'
import { Brain, Activity, Database, Server, Shield, Zap } from 'lucide-react'
interface SidebarProps {
  onSelectQuestion: (q: string) => void
}
const SAMPLE_QUESTIONS = [
  {
    level: 'L1',
    text: 'Who is the Team Platform lead?',
  },
  {
    level: 'L1',
    text: "What is PaymentGW's API rate limit?",
  },
  {
    level: 'L2',
    text: 'If Team Commerce discovers a P1 bug in OrderSvc at 21:00 on a Friday, can they deploy a fix?',
  },
  {
    level: 'L2',
    text: 'What is PaymentGW API rate limit?',
  },
  {
    level: 'L3',
    text: 'What was PaymentGW total cost in Q1 2026?',
  },
  {
    level: 'L3',
    text: 'Is PaymentGW within its latency SLA?',
  },
  {
    level: 'L4',
    text: 'Which service had the highest infrastructure cost in March 2026?',
  },
  {
    level: 'L4',
    text: 'Which team is responsible?',
  },
]
const CONNECTED_STACK = [
  { label: 'API Gateway', detail: '/prod/chat', icon: Server },
  { label: 'Lambda', detail: 'router + memory', icon: Zap },
  { label: 'SQLite', detail: 'costs, incidents, SLA', icon: Database },
  { label: 'Monitoring API', detail: 'current metrics', icon: Activity },
  { label: 'Bedrock KB', detail: 'L1/L2 retrieval', icon: Shield },
]
export function Sidebar({ onSelectQuestion }: SidebarProps) {
  return (
    <div className="w-64 bg-surface border-r border-border flex flex-col h-full overflow-y-auto shrink-0">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2 text-cyan-400 mb-1">
          <Brain className="w-6 h-6" />
          <h1 className="font-bold text-lg tracking-tight text-white">
            GeekBrain
          </h1>
        </div>
        <p className="text-xs text-zinc-400 font-medium tracking-wide uppercase">
          AI Ops Assistant
        </p>
      </div>

      <div className="p-5 flex-1">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
          Sample Queries
        </h2>
        <div className="space-y-4">
          {(['L1', 'L2', 'L3', 'L4'] as const).map((level) => (
            <div key={level} className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider
                  ${level === 'L1' ? 'bg-blue-500/20 text-blue-400' : level === 'L2' ? 'bg-purple-500/20 text-purple-400' : level === 'L3' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                >
                  {level}
                </span>
                <span className="text-xs text-zinc-500 font-medium">
                  {level === 'L1'
                    ? 'Retrieval'
                    : level === 'L2'
                      ? 'Multi-Source'
                      : level === 'L3'
                        ? 'Tools'
                        : 'Memory'}
                </span>
              </div>
              <div className="space-y-1.5">
                {SAMPLE_QUESTIONS.filter((q) => q.level === level).map(
                  (q, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectQuestion(q.text)}
                      className="w-full text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/50 p-2 rounded transition-colors border border-transparent hover:border-zinc-700/50 line-clamp-2"
                    >
                      {q.text}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 border-t border-border bg-zinc-900/30">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" /> Connected Stack
        </h2>
        <div className="space-y-2.5">
          {CONNECTED_STACK.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                  <span className="truncate text-zinc-300">{item.label}</span>
                </div>
                <span className="max-w-28 truncate text-right font-mono text-[10px] text-zinc-500">
                  {item.detail}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
