import { useState } from 'react'
import type { PastSession, SessionDetail } from '../hooks/usePastSessions'

interface PastSessionsProps {
  sessions: PastSession[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  onFetchDetail: (id: string) => Promise<SessionDetail | null>
}

function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-400'
  if (score >= 5) return 'text-yellow-400'
  return 'text-red-400'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function DetailPanel({ detail, onClose }: { detail: SessionDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-white">{detail.role}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{formatDate(detail.started_at)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">
            &times;
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {detail.entries.map((e, i) => (
            <div key={e.id} className="rounded-lg bg-gray-800 p-4 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm font-medium text-gray-200">{i + 1}. {e.question}</p>
                <span className={`text-sm font-bold shrink-0 ${scoreColor(e.overall_score)}`}>
                  {e.overall_score}/10
                </span>
              </div>
              <p className="text-xs text-gray-400 italic">&ldquo;{e.answer_transcript}&rdquo;</p>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>Clarity {e.clarity_score}</span>
                <span>Relevance {e.relevance_score}</span>
                <span>Confidence {e.confidence_score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PastSessions({
  sessions, loading, error, onRefresh, onFetchDetail,
}: PastSessionsProps) {
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)

  const openDetail = async (id: string) => {
    setLoadingDetail(id)
    const d = await onFetchDetail(id)
    setLoadingDetail(null)
    if (d) setDetail(d)
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
        <p className="text-gray-400 animate-pulse text-sm">Loading sessions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-950 border border-red-800 p-4">
        <p className="text-red-300 text-sm">{error}</p>
        <button onClick={onRefresh} className="mt-2 text-xs text-red-400 underline">Retry</button>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
        <p className="text-gray-500 text-sm">No past sessions yet. Complete an interview to see your history.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Past Sessions ({sessions.length})
          </p>
          <button
            onClick={onRefresh}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Refresh
          </button>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => void openDetail(s.id)}
              disabled={loadingDetail === s.id}
              className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{s.role}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatDate(s.started_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${scoreColor(s.avg_overall)}`}>
                  {s.avg_overall.toFixed(1)}/10
                </p>
                <p className="text-xs text-gray-500">{s.question_count} Q</p>
              </div>
              {loadingDetail === s.id && (
                <span className="text-xs text-gray-500 animate-pulse">Loading...</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {detail && <DetailPanel detail={detail} onClose={() => setDetail(null)} />}
    </>
  )
}
