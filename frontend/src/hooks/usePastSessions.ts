import { useCallback, useEffect, useState } from 'react'

const API_BASE = 'http://localhost:8000'

export interface PastSession {
  id: string
  role: string
  started_at: string
  ended_at: string | null
  avg_overall: number
  question_count: number
}

export interface SessionDetail extends PastSession {
  entries: SessionEntry[]
}

export interface SessionEntry {
  id: number
  turn: number
  created_at: string
  question: string
  answer_transcript: string
  clarity_score: number
  relevance_score: number
  confidence_score: number
  overall_score: number
  strengths: string[]
  improvements: string[]
  ideal_answer_hint: string
  follow_up_question: string
}

interface UsePastSessionsReturn {
  sessions: PastSession[]
  loading: boolean
  error: string | null
  refresh: () => void
  fetchDetail: (id: string) => Promise<SessionDetail | null>
}

export function usePastSessions(): UsePastSessionsReturn {
  const [sessions, setSessions] = useState<PastSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/sessions`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: PastSession[] = await res.json()
      setSessions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const fetchDetail = useCallback(async (id: string): Promise<SessionDetail | null> => {
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}`)
      if (!res.ok) return null
      return await res.json() as SessionDetail
    } catch {
      return null
    }
  }, [])

  return { sessions, loading, error, refresh, fetchDetail }
}
