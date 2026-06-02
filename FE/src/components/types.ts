export type Level = 'L1' | 'L2' | 'L3' | 'L4'
export type Role = 'user' | 'assistant'

export interface Chunk {
  id: string
  filename: string
  score: number
  content: string
}

export interface ToolCall {
  id: string
  name: string
  input: any
  output: any
  durationMs: number
  status: 'success' | 'error'
}

export interface Trace {
  chunks: Chunk[]
  tools: ToolCall[]
  inputTokens: number
  outputTokens: number
  latencyMs: number
  systemPrompt: string
  metadata?: Record<string, any>
  llmInput?: string
  llmDecision?: string
  finalOutput?: string
}

export interface Message {
  id: string
  role: Role
  content: string
  level?: Level
  citations?: string[]
  trace?: Trace
}

export interface SystemService {
  name: string
  latency: number
  sla: number
  status: 'healthy' | 'warning' | 'critical'
}
