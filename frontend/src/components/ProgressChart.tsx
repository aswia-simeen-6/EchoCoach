import type { PastSession } from '../hooks/usePastSessions'

interface ProgressChartProps {
  sessions: PastSession[]
}

const W = 480
const H = 120
const PAD = { top: 12, right: 16, bottom: 28, left: 32 }

export function ProgressChart({ sessions }: ProgressChartProps) {
  // Only sessions with at least one answered question, oldest first
  const data = [...sessions]
    .filter(s => s.question_count > 0)
    .reverse()
    .slice(-12) // last 12 sessions

  if (data.length < 2) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-center">
        <p className="text-xs text-gray-500">
          Complete at least 2 sessions to see your progress chart.
        </p>
      </div>
    )
  }

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const scores = data.map(s => s.avg_overall)
  const minScore = Math.max(0, Math.min(...scores) - 1)
  const maxScore = Math.min(10, Math.max(...scores) + 1)

  const xScale = (i: number) => (i / (data.length - 1)) * innerW
  const yScale = (v: number) => innerH - ((v - minScore) / (maxScore - minScore)) * innerH

  const points = scores.map((s, i) => `${xScale(i)},${yScale(s)}`).join(' ')
  const areaPoints = [
    `0,${innerH}`,
    ...scores.map((s, i) => `${xScale(i)},${yScale(s)}`),
    `${innerW},${innerH}`,
  ].join(' ')

  // Y-axis labels
  const yLabels = [minScore, (minScore + maxScore) / 2, maxScore].map(v => Math.round(v))

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
        Overall Score Trend
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Grid lines */}
          {yLabels.map(v => (
            <line
              key={v}
              x1={0} y1={yScale(v)} x2={innerW} y2={yScale(v)}
              stroke="#374151" strokeWidth={1} strokeDasharray="4 4"
            />
          ))}

          {/* Area fill */}
          <polygon
            points={areaPoints}
            fill="rgba(79,110,247,0.12)"
          />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="#4f6ef7"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Data points */}
          {scores.map((s, i) => (
            <circle key={i} cx={xScale(i)} cy={yScale(s)} r={4}
              fill="#4f6ef7" stroke="#111827" strokeWidth={2}>
              <title>{`Session ${i + 1}: ${s.toFixed(1)}/10`}</title>
            </circle>
          ))}

          {/* Y-axis labels */}
          {yLabels.map(v => (
            <text key={v} x={-6} y={yScale(v) + 4}
              textAnchor="end" fontSize={10} fill="#6b7280">
              {v}
            </text>
          ))}

          {/* X-axis labels: first and last */}
          <text x={0} y={innerH + 16} textAnchor="middle" fontSize={9} fill="#6b7280">
            {new Date(data[0].started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
          <text x={innerW} y={innerH + 16} textAnchor="middle" fontSize={9} fill="#6b7280">
            {new Date(data[data.length - 1].started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        </g>
      </svg>
    </div>
  )
}
