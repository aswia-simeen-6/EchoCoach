import { useState } from 'react'
import type { FeedbackResult } from '../types'

interface FeedbackCardProps {
  feedback: FeedbackResult
  isPlaying: boolean
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 10) * 100
  const color =
    value >= 8 ? 'bg-green-500' : value >= 5 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="font-semibold text-gray-200">{value}/10</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function FeedbackCard({ feedback, isPlaying }: FeedbackCardProps) {
  const [hintOpen, setHintOpen] = useState(false)

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Feedback
        </p>
        {isPlaying && (
          <span className="flex items-center gap-1.5 text-xs text-brand-500">
            <span className="animate-pulse">🔊</span> Speaking…
          </span>
        )}
      </div>

      {/* Question */}
      <p className="text-sm text-gray-300 font-medium">
        Q: {feedback.question}
      </p>

      {/* Scores */}
      <div>
        <ScoreBar label="Clarity" value={feedback.clarity_score} />
        <ScoreBar label="Relevance" value={feedback.relevance_score} />
        <ScoreBar label="Confidence" value={feedback.confidence_score} />
        <div className="mt-3 pt-3 border-t border-gray-800">
          <ScoreBar label="Overall" value={feedback.overall_score} />
        </div>
      </div>

      {/* Strengths */}
      {feedback.strengths.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-1">
            Strengths
          </p>
          <ul className="space-y-1">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="text-sm text-gray-300 flex gap-2">
                <span className="text-green-500 mt-0.5">✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {feedback.improvements.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-1">
            To Improve
          </p>
          <ul className="space-y-1">
            {feedback.improvements.map((imp, i) => (
              <li key={i} className="text-sm text-gray-300 flex gap-2">
                <span className="text-yellow-500 mt-0.5">→</span> {imp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ideal answer hint (collapsible) */}
      <div>
        <button
          onClick={() => setHintOpen(o => !o)}
          className="text-xs text-brand-500 hover:text-brand-600 underline underline-offset-2 transition-colors"
        >
          {hintOpen ? 'Hide' : 'Show'} ideal answer hint
        </button>
        {hintOpen && (
          <p className="mt-2 text-sm text-gray-400 italic border-l-2 border-brand-500 pl-3">
            {feedback.ideal_answer_hint}
          </p>
        )}
      </div>
    </div>
  )
}
