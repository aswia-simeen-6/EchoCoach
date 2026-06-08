import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServerMessage, FeedbackResult } from '../types'

const WS_URL = (sessionId: string) => `ws://localhost:8000/ws/${sessionId}`
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

interface UseWebSocketReturn {
  connected: boolean
  sendJson: (payload: object) => void
  liveTranscript: string
  feedbackHistory: FeedbackResult[]
  currentFeedback: FeedbackResult | null
  ttsQueue: Uint8Array[]
  ttsEnded: boolean
  error: string | null
  clearTtsQueue: () => void
  resetTtsEnded: () => void
}

export function useWebSocket(sessionId: string): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)

  const [connected, setConnected] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackResult[]>([])
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackResult | null>(null)
  const [ttsQueue, setTtsQueue] = useState<Uint8Array[]>([])
  const [ttsEnded, setTtsEnded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL(sessionId))
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      retriesRef.current = 0
      setError(null)
    }

    ws.onmessage = (event: MessageEvent) => {
      let msg: ServerMessage
      try {
        msg = JSON.parse(event.data as string) as ServerMessage
      } catch {
        return
      }

      switch (msg.type) {
        case 'transcript':
          if (msg.is_final) setLiveTranscript(msg.text)
          else setLiveTranscript(msg.text)
          break

        case 'feedback': {
          const fb = msg.payload
          setCurrentFeedback(fb)
          setFeedbackHistory(prev => [...prev, fb])
          break
        }

        case 'tts_chunk': {
          const binary = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0))
          setTtsQueue(prev => [...prev, binary])
          break
        }

        case 'tts_end':
          setTtsEnded(true)
          break

        case 'error':
          setError(msg.message)
          break

        case 'session_ended':
          ws.close()
          break
      }
    }

    ws.onclose = () => {
      setConnected(false)
      if (retriesRef.current < MAX_RETRIES) {
        retriesRef.current += 1
        setTimeout(connect, RETRY_DELAY_MS * retriesRef.current)
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection error.')
      ws.close()
    }
  }, [sessionId])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])

  const sendJson = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
    }
  }, [])

  const clearTtsQueue = useCallback(() => setTtsQueue([]), [])
  const resetTtsEnded = useCallback(() => setTtsEnded(false), [])

  return {
    connected,
    sendJson,
    liveTranscript,
    feedbackHistory,
    currentFeedback,
    ttsQueue,
    ttsEnded,
    error,
    clearTtsQueue,
    resetTtsEnded,
  }
}
