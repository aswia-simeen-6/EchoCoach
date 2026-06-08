import type { FeedbackResult } from '../types'

interface SessionHistoryProps {
  history: FeedbackResult[]
}

function scoreColor(score: number): string {
  if (score >= 8) return 'bg-green-900 text-green-300'
  if (score >= 5) return 'bg-yellow-900 text-yellow-300'
  return 'bg-red-900 text-red-300'
}

export function SessionHistory({ history }: SessionHistoryProps) {
  if (history.length === 0) return null

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
        Session History ({history.length} answer{history.length !== 1 ? 's' : ''})
      </p>
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {history.map((fb, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors"
          >
            <span className="text-gray-500 text-xs mt-0.5 w-5 shrink-0">
              {i + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 font-medium truncate">
                {fb.question}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {fb.answer_transcript}
              </p>
            </div>
            <span
              className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(fb.overall_score)}`}
            >
              {fb.overall_score}/10
            </span>
          </div>
        ))}
      </div>

      {/* Average score */}
      {history.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between text-sm">
          <span className="text-gray-400">Session average</span>
          <span className="font-bold text-gray-100">
            {(history.reduce((sum, fb) => sum + fb.overall_score, 0) / history.length).toFixed(1)}/10
          </span>
        </div>
      )}
    </div>
  )
}
