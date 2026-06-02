import { Message, Trace, ToolCall } from './types'

const generateId = () => Math.random().toString(36).substring(2, 9)

const API_URL =
  'https://rnitt0jxzd.execute-api.ap-southeast-1.amazonaws.com/prod/chat'

const getSessionId = () => {
  const key = 'geekbrain_session_id'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing

  const sessionId = `web-${Math.random().toString(36).substring(2, 12)}`
  window.localStorage.setItem(key, sessionId)
  return sessionId
}

export const resetChatSession = () => {
  const key = 'geekbrain_session_id'
  const sessionId = `web-${Math.random().toString(36).substring(2, 12)}`
  window.localStorage.setItem(key, sessionId)
  return sessionId
}

const asRecord = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== 'object') return {}
  return payload as Record<string, unknown>
}

const unwrapProxyBody = (payload: unknown): unknown => {
  const data = asRecord(payload)
  if (typeof data.body !== 'string') return payload

  try {
    return unwrapProxyBody(JSON.parse(data.body))
  } catch {
    return payload
  }
}

const extractAnswer = (payload: unknown): string => {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return ''

  const data = payload as Record<string, unknown>

  if (typeof data.answer === 'string') return data.answer
  if (typeof data.response === 'string') return data.response
  if (typeof data.message === 'string') return data.message

  if (typeof data.body === 'string') {
    try {
      return extractAnswer(JSON.parse(data.body))
    } catch {
      return data.body
    }
  }

  return ''
}

const extractCitations = (payload: unknown): string[] => {
  const data = asRecord(payload)
  return Array.isArray(data.citations)
    ? data.citations.filter((item): item is string => typeof item === 'string')
    : []
}

const summarizeOutput = (payload: unknown) => {
  const data = asRecord(payload)
  const observability = asRecord(data.observability)
  return {
    answer: typeof data.answer === 'string' ? data.answer : undefined,
    service: data.service,
    tool_used: data.tool_used || data.toolUsed,
    source: data.source,
    current: data.current,
    target: data.target,
    metrics: data.metrics,
    data: data.data,
    citations: data.citations,
    observability,
  }
}

const inferKnowledgeLevel = (question: string): Message['level'] => {
  const q = ` ${question.toLowerCase()} `
  const l2Signals = [
    /\bif\b/,
    /\bcompare\b/,
    /\bconflict\b/,
    /\bresolve\b/,
    /\bcan they\b/,
    /\bcan we\b/,
    /\bcan .* deploy\b/,
    /\bdeployment\b/,
    /\bdeploy\b/,
    /\bshould\b/,
    /\bwhy\b/,
    /\bexplain\b/,
    /\bimpact\b/,
    /\baccording to\b/,
    /\bversus\b/,
    /\bvs\b/,
  ]

  return l2Signals.some((signal) => signal.test(q)) ? 'L2' : 'L1'
}

const inferLevel = (
  payload: unknown,
  originalQuestion: string,
  routedQuestion: string,
): Message['level'] => {
  const data = asRecord(payload)
  if (data.original_question && data.original_question !== data.question) return 'L4'
  if (originalQuestion !== routedQuestion) return 'L4'
  if (data.tool_used || data.toolUsed) return 'L3'
  if (data.source === 'Amazon Bedrock Knowledge Base') {
    return inferKnowledgeLevel(routedQuestion)
  }
  return 'L3'
}

const inferDecision = (
  payload: unknown,
  originalQuestion: string,
  routedQuestion: string,
) => {
  const data = asRecord(payload)
  const observability = asRecord(data.observability)
  if (typeof observability.route_decision === 'string') {
    return observability.route_decision
  }

  const toolUsed =
    typeof data.tool_used === 'string'
      ? data.tool_used
      : typeof data.toolUsed === 'string'
        ? data.toolUsed
        : ''

  if (routedQuestion !== originalQuestion) {
    return `Resolved follow-up with session memory, then routed to ${toolUsed || data.source || 'Bedrock KB'}.`
  }

  if (toolUsed.includes('Database') && toolUsed.includes('Metrics')) {
    return 'Selected multi-tool route: SQLite data plus Monitoring API metrics.'
  }

  if (toolUsed.includes('Database')) {
    return 'Selected Database Query Tool for structured CSV-derived data.'
  }

  if (toolUsed.includes('Metrics')) {
    return 'Selected Service Metrics Tool for current monitoring data.'
  }

  return 'Selected Bedrock Knowledge Base for L1/L2 retrieval and synthesis.'
}

const buildLogicalTools = (
  payload: unknown,
  response: Response,
  durationMs: number,
  sessionId: string,
  userQuestion: string,
  originalQuestion: string,
  routedQuestion: string,
): ToolCall[] => {
  const data = asRecord(payload)
  const observability = asRecord(data.observability)
  const databaseQueries = Array.isArray(observability.database_queries)
    ? observability.database_queries
    : []
  const rawTool =
    typeof data.tool_used === 'string'
      ? data.tool_used
      : typeof data.toolUsed === 'string'
        ? data.toolUsed
        : ''
  const tools: ToolCall[] = [
    {
      id: 'api-gateway',
      name: 'API Gateway /prod/chat',
      input: { url: API_URL, session_id: sessionId, question: userQuestion },
      output: { status: response.status, ok: response.ok },
      durationMs,
      status: response.ok ? 'success' : 'error',
    },
  ]

  if (routedQuestion !== originalQuestion) {
    tools.push({
      id: 'conversation-memory',
      name: 'Conversation Memory',
      input: {
        session_id: sessionId,
        original_question: originalQuestion,
        memory_loaded: observability.memory_loaded || {},
      },
      output: {
        rewritten_question:
          observability.rewritten_question || routedQuestion,
      },
      durationMs: 1,
      status: 'success',
    })
  }

  if (rawTool.includes('Database')) {
    if (databaseQueries.length > 0) {
      databaseQueries.forEach((query, index) => {
        const queryData = asRecord(query)
        tools.push({
          id: `database-query-${index}`,
          name: 'Database Query Tool',
          input: {
            question: routedQuestion,
            sql: queryData.sql,
            params: queryData.params,
          },
          output: {
            rows: queryData.rows,
            preview: queryData.preview,
          },
          durationMs,
          status: response.ok ? 'success' : 'error',
        })
      })
    } else {
      tools.push({
        id: 'database-query',
        name: 'Database Query Tool',
        input: {
          question: routedQuestion,
          citations: extractCitations(payload),
        },
        output: summarizeOutput(payload),
        durationMs,
        status: response.ok ? 'success' : 'error',
      })
    }
  }

  if (rawTool.includes('Metrics')) {
    tools.push({
      id: 'service-metrics',
      name: 'Service Metrics Tool',
      input: {
        service: data.service,
        endpoint:
          observability.metrics_endpoint || 'MONITORING_API_URL /metrics/{service}',
      },
      output: {
        metrics: data.metrics || data.current_metrics,
        current: data.current,
        target: data.target,
      },
      durationMs,
      status: response.ok ? 'success' : 'error',
    })
  }

  if (!rawTool) {
    tools.push({
      id: 'bedrock-kb',
      name: 'Bedrock Knowledge Base',
      input: {
        question: routedQuestion,
        numberOfResults: 10,
        memory_loaded: observability.memory_loaded || {},
      },
      output: {
        source: data.source,
        retrieved_source: observability.retrieved_source,
        retrieved_chunks: observability.retrieved_chunks,
        answer: data.answer,
      },
      durationMs,
      status: response.ok ? 'success' : 'error',
    })
  }

  return tools
}

export const processQuestion = async (
  query: string,
  history: Message[],
  onProgress: (
    stage: 'retrieving' | 'tools' | 'generating',
    partialTrace?: Partial<Trace>,
  ) => void,
): Promise<Message> => {
  const userQuestion = query
  const sessionId = getSessionId()
  const startedAt = performance.now()

  onProgress('retrieving')

  const chunks = [
    {
      id: 'api-gateway',
      filename: 'API Gateway /prod/chat',
      score: 1,
      content: 'Sending question to Lambda and Bedrock Knowledge Base.',
    },
  ]

  onProgress('tools', { chunks })

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
    },
    body: JSON.stringify({
      session_id: sessionId,
      question: userQuestion,
    }),
  })

  const rawText = await response.text()
  let payload: unknown = rawText

  try {
    payload = rawText ? JSON.parse(rawText) : {}
  } catch {
    payload = rawText
  }
  payload = unwrapProxyBody(payload)

  const durationMs = Math.round(performance.now() - startedAt)
  const data = asRecord(payload)
  const observability = asRecord(data.observability)
  const toolName =
    typeof data.tool_used === 'string'
      ? data.tool_used
      : typeof data.toolUsed === 'string'
        ? data.toolUsed
        : 'Bedrock Knowledge Base'
  const originalQuestion =
    typeof data.original_question === 'string' ? data.original_question : userQuestion
  const routedQuestion =
    typeof data.question === 'string' ? data.question : userQuestion

  const traceChunks = [
    {
      id: 'api-gateway',
      filename: 'API Gateway /prod/chat',
      score: 1,
      content: `Session ${sessionId} sent the question to Lambda.`,
    },
  ]

  const citations = extractCitations(payload)

  if (observability.rewritten_question) {
    traceChunks.push({
      id: 'memory-rewrite',
      filename: 'Conversation Memory',
      score: 1,
      content: `Memory loaded and rewrote question: ${observability.rewritten_question}`,
    })
  } else if (routedQuestion !== originalQuestion) {
    traceChunks.push({
      id: 'memory-rewrite',
      filename: 'Conversation Memory',
      score: 1,
      content: `Rewritten question: ${routedQuestion}`,
    })
  }

  if (citations.length > 0) {
    citations.forEach((citation, index) => {
      traceChunks.push({
        id: `citation-${index}`,
        filename: citation,
        score: 0.92 - index * 0.03,
        content: `Lambda used evidence from ${citation}.`,
      })
    })
  } else {
    traceChunks.push({
      id: toolName.toLowerCase().replace(/\s+/g, '-'),
      filename: toolName,
      score: 0.88,
      content:
        toolName === 'Bedrock Knowledge Base'
          ? 'Lambda routed this question to Bedrock KB retrieval.'
          : `Lambda selected ${toolName} for this question.`,
    })
  }

  const tools = buildLogicalTools(
    payload,
    response,
    durationMs,
    sessionId,
    userQuestion,
    originalQuestion,
    routedQuestion,
  )

  onProgress('generating', { chunks: traceChunks, tools })

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${rawText}`)
  }

  const content = extractAnswer(payload)
  const recentHistory = history
    .slice(-4)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n')
  const llmInput = [
    `Original question: ${originalQuestion}`,
    `Routed question: ${routedQuestion}`,
    `Memory loaded:\n${JSON.stringify(observability.memory_loaded || {}, null, 2)}`,
    recentHistory ? `Recent browser history:\n${recentHistory}` : '',
    `Lambda observability:\n${JSON.stringify(observability, null, 2)}`,
    `Evidence/tool result:\n${JSON.stringify(summarizeOutput(payload), null, 2)}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const trace: Trace = {
    chunks: traceChunks,
    tools,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: durationMs,
    systemPrompt:
      'Frontend calls API Gateway. Lambda routes L1/L2 to Bedrock KB, L3 to tools, and L4 follow-ups through session memory.',
    llmInput,
    llmDecision: inferDecision(payload, originalQuestion, routedQuestion),
    finalOutput: content || 'The API returned no answer field.',
    metadata: {
      session_id: sessionId,
      original_question: originalQuestion,
      routed_question: routedQuestion,
      source: data.source,
      tool_used: toolName,
      observability,
    },
  }

  return {
    id: generateId(),
    role: 'assistant',
    content: content || 'The API returned no answer field.',
    level: inferLevel(payload, originalQuestion, routedQuestion),
    citations,
    trace,
  }
}
