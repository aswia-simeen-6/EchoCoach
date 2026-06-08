import type { FeedbackResult } from '../types'

interface SummaryModalProps {
  history: FeedbackResult[]
  role: string
  onClose: () => void
}

function exportSession(history: FeedbackResult[], role: string): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    role,
    questionCount: history.length,
    averageOverall: history.length
      ? (history.reduce((s, f) => s + f.overall_score, 0) / history.length).toFixed(1)
      : null,
    questions: history,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `echocoach-session-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function avg(vals: number[]): string {
  if (!vals.length) return '—'
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
}

function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-400'
  if (score >= 5) return 'text-yellow-400'
  return 'text-red-400'
}

function GaugeStat({ label, value }: { label: string; value: string }) {
  const num = parseFloat(value)
  const pct = isNaN(num) ? 0 : (num / 10) * 100
  const barColor = num >= 8 ? 'bg-green-500' : num >= 5 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className={`font-bold ${scoreColor(num)}`}>{value}/10</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function SummaryModal({ history, role, onClose }: SummaryModalProps) {
  const clarity    = avg(history.map(f => f.clarity_score))
  const relevance  = avg(history.map(f => f.relevance_score))
  const confidence = avg(history.map(f => f.confidence_score))
  const overall    = avg(history.map(f => f.overall_score))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Session Complete</h2>
          <p className="text-brand-100 text-sm mt-0.5">
            {role} · {history.length} question{history.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Score summary */}
        <div className="px-6 py-5 space-y-4 border-b border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Average Scores
          </p>
          <GaugeStat label="Clarity"    value={clarity} />
          <GaugeStat label="Relevance"  value={relevance} />
          <GaugeStat label="Confidence" value={confidence} />
          <div className="pt-3 border-t border-gray-800">
            <GaugeStat label="Overall"  value={overall} />
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="px-6 py-4 max-h-52 overflow-y-auto space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Question Breakdown
          </p>
          {history.map((fb, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-5 shrink-0">{i + 1}.</span>
              <span className="flex-1 text-gray-300 truncate">{fb.question}</span>
              <span className={`font-bold shrink-0 ${scoreColor(fb.overall_score)}`}>
                {fb.overall_score}/10
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex justify-between items-center border-t border-gray-800">
          <button
            onClick={() => exportSession(history, role)}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium border border-gray-700 transition-colors"
          >
            Download JSON
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
          >
            Start New Session
          </button>
        </div>
      </div>
    </div>
  )
}
