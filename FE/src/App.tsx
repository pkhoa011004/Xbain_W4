import React, { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { ObservabilityPanel } from './components/ObservabilityPanel'
import { Message, Trace } from './components/types'
import { processQuestion, resetChatSession } from './components/chatApi'
export function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [stage, setStage] = useState<
    'idle' | 'retrieving' | 'tools' | 'generating'
  >('idle')
  const [currentTrace, setCurrentTrace] = useState<Trace | null>(null)
  const handleSend = async () => {
    if (!inputValue.trim() || isProcessing) return
    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: inputValue.trim(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsProcessing(true)
    setStage('retrieving')
    // Clear trace for new question, but keep structure ready
    setCurrentTrace({
      chunks: [],
      tools: [],
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      systemPrompt: '',
    })
    try {
      const response = await processQuestion(
        userMsg.content,
        messages,
        (newStage, partialTrace) => {
          setStage(newStage)
          if (partialTrace) {
            setCurrentTrace((prev) =>
              prev
                ? {
                    ...prev,
                    ...partialTrace,
                  }
                : null,
            )
          }
        },
      )
      setMessages((prev) => [...prev, response])
      setCurrentTrace(response.trace || null)
    } catch (error) {
      console.error('Failed to process question', error)
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content:
            error instanceof Error
              ? `Could not reach the chat API: ${error.message}`
              : 'Could not reach the chat API.',
          level: 'L3',
        },
      ])
    } finally {
      setIsProcessing(false)
      setStage('idle')
    }
  }
  const handleReset = () => {
    resetChatSession()
    setMessages([])
    setCurrentTrace(null)
    setStage('idle')
  }
  return (
    <div className="flex h-screen w-full bg-background text-zinc-300 overflow-hidden font-sans">
      <div className="hidden md:block">
        <Sidebar onSelectQuestion={setInputValue} />
      </div>

      <ChatArea
        messages={messages}
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSend={handleSend}
        isProcessing={isProcessing}
        onReset={handleReset}
      />

      <div className="hidden lg:block">
        <ObservabilityPanel
          trace={currentTrace}
          isProcessing={isProcessing}
          stage={stage}
        />
      </div>
    </div>
  )
}
