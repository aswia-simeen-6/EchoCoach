import type { InterviewMode, Difficulty } from '../types'

interface InterviewSetupProps {
  role: string
  jd: string
  mode: InterviewMode
  difficulty: Difficulty
  connected: boolean
  onRoleChange: (v: string) => void
  onJdChange: (v: string) => void
  onModeChange: (v: InterviewMode) => void
  onDifficultyChange: (v: Difficulty) => void
  onStart: () => void
}

const MODES: { value: InterviewMode; label: string; icon: string; desc: string }[] = [
  { value: 'behavioral',    label: 'Behavioral',    icon: '💬', desc: 'STAR-method stories, teamwork, leadership' },
  { value: 'technical',     label: 'Technical',     icon: '⚙️',  desc: 'Data structures, algorithms, code concepts' },
  { value: 'system_design', label: 'System Design', icon: '🏗️',  desc: 'Architecture, scalability, trade-offs' },
  { value: 'coding',        label: 'Coding',        icon: '💻', desc: 'Algorithm walkthroughs, complexity analysis' },
]

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'junior', label: 'Junior',    color: 'border-green-600 text-green-400' },
  { value: 'mid',    label: 'Mid-Level', color: 'border-yellow-600 text-yellow-400' },
  { value: 'senior', label: 'Senior',    color: 'border-red-600 text-red-400' },
]

export function InterviewSetup({
  role, jd, mode, difficulty,
  connected,
  onRoleChange, onJdChange, onModeChange, onDifficultyChange,
  onStart,
}: InterviewSetupProps) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">EchoCoach</h1>
          <p className="text-gray-400 mt-1">AI-powered real-time interview coach</p>
        </div>

        {/* Mode selector */}
        <div>
          <p className="text-sm font-semibold text-gray-300 mb-3">Interview Type</p>
          <div className="grid grid-cols-2 gap-3">
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => onModeChange(m.value)}
                className={[
                  'flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-150',
                  mode === m.value
                    ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                    : 'border-gray-700 bg-gray-900 hover:border-gray-600',
                ].join(' ')}
              >
                <span className="text-2xl mt-0.5">{m.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{m.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty selector */}
        <div>
          <p className="text-sm font-semibold text-gray-300 mb-3">Difficulty Level</p>
          <div className="flex gap-3">
            {DIFFICULTIES.map(d => (
              <button
                key={d.value}
                onClick={() => onDifficultyChange(d.value)}
                className={[
                  'flex-1 py-2 rounded-lg border text-sm font-medium transition-all duration-150',
                  difficulty === d.value
                    ? `${d.color} bg-gray-800`
                    : 'border-gray-700 text-gray-400 hover:border-gray-600',
                ].join(' ')}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Role + JD */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Target Role
            </label>
            <input
              type="text"
              value={role}
              onChange={e => onRoleChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Software Engineer, Product Manager"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Job Description{' '}
              <span className="text-gray-500 font-normal">(optional — tailors questions)</span>
            </label>
            <textarea
              value={jd}
              onChange={e => onJdChange(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Paste the job description here..."
            />
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={onStart}
          disabled={!connected || !role.trim()}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-base"
        >
          {connected ? 'Start Interview' : 'Connecting...'}
        </button>
      </div>
    </div>
  )
}
