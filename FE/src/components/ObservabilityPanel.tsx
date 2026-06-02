import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Brain,
  CheckCircle2,
  Clock,
  Code,
  Database,
  FileText,
  GitBranch,
  Radio,
  Terminal,
} from 'lucide-react'
import { Trace } from './types'

interface ObservabilityPanelProps {
  trace: Trace | null
  isProcessing: boolean
  stage: 'idle' | 'retrieving' | 'tools' | 'generating'
}

const STAGES = [
  { id: 'retrieving', label: 'Retrieve', icon: FileText },
  { id: 'tools', label: 'Tools', icon: Database },
  { id: 'generating', label: 'LLM', icon: Brain },
] as const

const formatValue = (value: unknown) => {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

export function ObservabilityPanel({
  trace,
  isProcessing,
  stage,
}: ObservabilityPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payload'>(
    'dashboard',
  )
  const routingEntries = trace?.metadata
    ? Object.entries(trace.metadata).filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      )
    : []
  const observability =
    trace?.metadata?.observability &&
    typeof trace.metadata.observability === 'object'
      ? (trace.metadata.observability as Record<string, unknown>)
      : {}
  const processingDetails = [
    ['Question', observability.question],
    ['Rewritten Question', observability.rewritten_question],
    ['Routing Decision', observability.route_decision || trace?.llmDecision],
    ['Tool Used', observability.tool],
    ['SQL', observability.sql],
    ['Rows Returned', observability.rows],
    ['Memory Loaded', observability.memory_loaded],
    ['Metrics Endpoint', observability.metrics_endpoint],
    ['Final Answer', observability.final_answer || trace?.finalOutput],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')
  const sessionId =
    typeof trace?.metadata?.session_id === 'string'
      ? trace.metadata.session_id
      : 'active'

  const stageStatus = (id: (typeof STAGES)[number]['id']) => {
    if (!trace && !isProcessing) return 'waiting'
    if (stage === id && isProcessing) return 'active'
    if (trace && trace.tools.length > 0) return 'done'
    if (id === 'retrieving' && trace?.chunks.length) return 'done'
    return 'waiting'
  }

  return (
    <div className="w-80 lg:w-[28rem] bg-surface border-l border-border flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-border bg-zinc-900/50">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="font-semibold text-sm text-white">
              Observability Dashboard
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">
              {isProcessing ? 'Running' : 'Ready'}
            </span>
            <div
              className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse-fast' : 'bg-emerald-500'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {STAGES.map((item) => {
            const Icon = item.icon
            const status = stageStatus(item.id)
            return (
              <div
                key={item.id}
                className={`rounded-md border px-2 py-2 ${
                  status === 'active'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : status === 'done'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-zinc-800 bg-zinc-900/70 text-zinc-500'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
                  <Icon className="h-3 w-3" />
                  {item.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
        >
          Live Pipeline
        </button>
        <button
          onClick={() => setActiveTab('payload')}
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeTab === 'payload' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
        >
          Raw Evidence
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {!trace && !isProcessing && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-zinc-500">
            <Radio className="w-8 h-8 opacity-50" />
            <p className="text-sm">
              Send a question to watch retrieval, tools, routing, and output.
            </p>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <AnimatePresence mode="popLayout">
            {(trace || isProcessing) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                <SummaryGrid
                  sessionId={sessionId}
                  latencyMs={trace?.latencyMs || 0}
                  toolCount={trace?.tools.length || 0}
                  evidenceCount={trace?.chunks.length || 0}
                />

                {processingDetails.length > 0 && (
                  <Section
                    icon={<Activity className="w-3.5 h-3.5" />}
                    title="AI Processing Details"
                  >
                    <div className="space-y-1.5">
                      {processingDetails.map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2"
                        >
                          <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                            {String(label)}
                          </div>
                          <div className="break-words font-mono text-[11px] leading-relaxed text-zinc-300">
                            {formatValue(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                <Section
                  icon={<FileText className="w-3.5 h-3.5" />}
                  title="Retrieved Context"
                >
                  {!trace?.chunks.length && isProcessing ? (
                    <SkeletonCard />
                  ) : (
                    <div className="space-y-2">
                      {trace?.chunks.map((chunk, index) => (
                        <EvidenceCard key={chunk.id} chunk={chunk} index={index} />
                      ))}
                    </div>
                  )}
                </Section>

                <Section
                  icon={<Database className="w-3.5 h-3.5" />}
                  title="Tools Called"
                >
                  {!trace?.tools.length && isProcessing ? (
                    <SkeletonCard />
                  ) : (
                    <div className="space-y-2">
                      {trace?.tools.map((tool, index) => (
                        <ToolCard key={tool.id} tool={tool} index={index} />
                      ))}
                    </div>
                  )}
                </Section>

                <Section
                  icon={<Terminal className="w-3.5 h-3.5" />}
                  title="LLM Input"
                >
                  <CodeBlock value={trace?.llmInput || 'Waiting for context...'} />
                </Section>

                <Section
                  icon={<GitBranch className="w-3.5 h-3.5" />}
                  title="LLM Decision"
                >
                  <div className="rounded-md border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs leading-relaxed text-cyan-100">
                    {trace?.llmDecision || 'Waiting for route decision...'}
                  </div>
                </Section>

                <Section
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  title="Returned Result"
                >
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-100">
                    {trace?.finalOutput || 'Waiting for final answer...'}
                  </div>
                </Section>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {activeTab === 'payload' && trace && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                icon={<Terminal className="w-3 h-3" />}
                label="Session"
                value={sessionId}
              />
              <StatCard
                icon={<Clock className="w-3 h-3" />}
                label="Latency"
                value={`${trace.latencyMs}ms`}
              />
            </div>

            {routingEntries.length > 0 && (
              <Section title="Routing Metadata">
                <div className="space-y-1.5">
                  {routingEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2"
                    >
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="break-words font-mono text-[11px] leading-relaxed text-zinc-300">
                        {formatValue(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Route Rule">
              <CodeBlock value={trace.systemPrompt} />
            </Section>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function SummaryGrid({
  sessionId,
  latencyMs,
  toolCount,
  evidenceCount,
}: {
  sessionId: string
  latencyMs: number
  toolCount: number
  evidenceCount: number
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard
        icon={<Terminal className="w-3 h-3" />}
        label="Session"
        value={sessionId}
      />
      <StatCard
        icon={<Clock className="w-3 h-3" />}
        label="Latency"
        value={latencyMs ? `${latencyMs}ms` : 'running'}
      />
      <StatCard
        icon={<Code className="w-3 h-3" />}
        label="Tools"
        value={String(toolCount)}
      />
      <StatCard
        icon={<FileText className="w-3 h-3" />}
        label="Evidence"
        value={String(evidenceCount)}
      />
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  )
}

function EvidenceCard({
  chunk,
  index,
}: {
  chunk: Trace['chunks'][number]
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-zinc-900/80 border border-zinc-800 rounded-md p-3"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="truncate text-xs font-mono text-cyan-400">
          {chunk.filename}
        </span>
        <span className="shrink-0 text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
          Score {chunk.score.toFixed(2)}
        </span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">{chunk.content}</p>
    </motion.div>
  )
}

function ToolCard({
  tool,
  index,
}: {
  tool: Trace['tools'][number]
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-zinc-900/80 border border-zinc-800 rounded-md p-3 space-y-2"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-xs font-semibold text-amber-400 flex items-center gap-1.5">
          <Code className="w-3 h-3 shrink-0" /> {tool.name}
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
            tool.status === 'success'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {tool.durationMs}ms
        </span>
      </div>
      <CodeBlock label="input" value={tool.input} />
      <CodeBlock label="output" value={tool.output} positive />
    </motion.div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-md p-3 flex flex-col gap-1">
      <span className="text-[10px] text-zinc-500 uppercase flex items-center gap-1">
        {icon} {label}
      </span>
      <span className="truncate text-sm font-mono text-zinc-200">{value}</span>
    </div>
  )
}

function CodeBlock({
  label,
  value,
  positive = false,
}: {
  label?: string
  value: unknown
  positive?: boolean
}) {
  return (
    <div
      className={`rounded-md border p-2 overflow-x-auto ${
        positive
          ? 'border-emerald-900/30 bg-emerald-950/20'
          : 'border-zinc-800 bg-black/40'
      }`}
    >
      {label && (
        <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">
          {label}
        </div>
      )}
      <pre
        className={`whitespace-pre-wrap text-[10px] font-mono leading-relaxed ${
          positive ? 'text-emerald-300' : 'text-zinc-300'
        }`}
      >
        {formatValue(value)}
      </pre>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-md p-3 space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-3 w-24 bg-zinc-800 rounded" />
        <div className="h-3 w-12 bg-zinc-800 rounded" />
      </div>
      <div className="space-y-1.5">
        <div className="h-2 w-full bg-zinc-800 rounded" />
        <div className="h-2 w-5/6 bg-zinc-800 rounded" />
        <div className="h-2 w-4/6 bg-zinc-800 rounded" />
      </div>
    </div>
  )
}
