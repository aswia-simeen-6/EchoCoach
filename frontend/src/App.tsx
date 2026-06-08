import { useCallback, useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

import { useWebSocket } from './hooks/useWebSocket'
import { useAudioRecorder } from './hooks/useAudioRecorder'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import { usePastSessions } from './hooks/usePastSessions'

import { AudioRecorder } from './components/AudioRecorder'
import { TranscriptPanel } from './components/TranscriptPanel'
import { FeedbackCard } from './components/FeedbackCard'
import { SessionHistory } from './components/SessionHistory'
import { Toast } from './components/Toast'
import { SummaryModal } from './components/SummaryModal'
import { PastSessions } from './components/PastSessions'
import { ProgressChart } from './components/ProgressChart'
import { InterviewSetup } from './components/InterviewSetup'

import type { AppState, FeedbackResult, InterviewMode, Difficulty } from './types'
import { MODE_LABELS, DIFFICULTY_LABELS } from './types'

type Tab = 'interview' | 'history'

// Stable session ID for the lifetime of the page
const SESSION_ID = uuidv4()

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [role, setRole] = useState('Software Engineer')
  const [jd, setJd] = useState('')
  const [mode, setMode] = useState<InterviewMode>('behavioral')
  const [difficulty, setDifficulty] = useState<Difficulty>('mid')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [sessionHistory, setSessionHistory] = useState<FeedbackResult[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('interview')

  const { sessions, loading: sessionsLoading, error: sessionsError, refresh: refreshSessions, fetchDetail } = usePastSessions()

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const {
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
  } = useWebSocket(SESSION_ID)

  // Mirror feedbackHistory into local state so summary modal keeps it after session ends
  useEffect(() => {
    if (feedbackHistory.length > 0) setSessionHistory(feedbackHistory)
  }, [feedbackHistory])

  // Show toast on WS errors
  useEffect(() => {
    if (error) setToastMessage(error)
  }, [error])

  // ── Audio player ───────────────────────────────────────────────────────────
  const handlePlaybackEnd = useCallback(() => {
    setAppState('ready')
  }, [])

  const { isPlaying, enqueueChunk, flushAndPlay } = useAudioPlayer(handlePlaybackEnd)

  // Forward TTS chunks into the player
  useEffect(() => {
    if (ttsQueue.length === 0) return
    ttsQueue.forEach(chunk => enqueueChunk(chunk))
    clearTtsQueue()
  }, [ttsQueue, enqueueChunk, clearTtsQueue])

  // Flush + play when server signals TTS stream is complete
  useEffect(() => {
    if (!ttsEnded) return
    resetTtsEnded()
    void flushAndPlay()
    setAppState('feedback')
  }, [ttsEnded, flushAndPlay, resetTtsEnded])

  // ── Audio recorder ─────────────────────────────────────────────────────────
  const handleChunk = useCallback(
    (base64: string) => sendJson({ type: 'audio_chunk', data: base64 }),
    [sendJson],
  )

  const handleStop = useCallback(() => {
    sendJson({ type: 'end_turn' })
    setAppState('processing')
  }, [sendJson])

  const { isRecording, startRecording, stopRecording, permissionDenied } =
    useAudioRecorder(handleChunk, handleStop)

  // ── Actions ────────────────────────────────────────────────────────────────
  const startSession = () => {
    sendJson({ type: 'start_session', role, jd, mode, difficulty })
    setAppState('starting')
  }

  const endSession = () => {
    sendJson({ type: 'end_session' })
    setShowSummary(true)
  }

  const resetSession = () => {
    setShowSummary(false)
    setSessionHistory([])
    setAppState('idle')
    void refreshSessions()
  }

  // ── Derived booleans ───────────────────────────────────────────────────────
  const isProcessing = appState === 'processing'
  const isAiSpeaking = appState === 'feedback' && isPlaying

  // ── Setup form ─────────────────────────────────────────────────────────────
  if (appState === 'idle') {
    return (
      <>
        <InterviewSetup
          role={role} jd={jd} mode={mode} difficulty={difficulty}
          connected={connected}
          onRoleChange={setRole} onJdChange={setJd}
          onModeChange={setMode} onDifficultyChange={setDifficulty}
          onStart={startSession}
        />
        
      </>
    )
  }

  // ── Main session UI ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 p-6">
      {/* Top bar */}
      <div className="max-w-5xl mx-auto mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">EchoCoach</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-gray-500 text-xs">{role}</span>
            <span className="text-gray-700">·</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-medium">
              {MODE_LABELS[mode]}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-medium">
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-500">{connected ? 'Connected' : 'Reconnecting…'}</span>
          {appState !== 'idle' && (
            <button
              onClick={endSession}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="max-w-5xl mx-auto mb-6 flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {(['interview', 'history'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              if (tab === 'history') void refreshSessions()
            }}
            className={[
              'px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors',
              activeTab === tab
                ? 'bg-brand-500 text-white'
                : 'text-gray-400 hover:text-gray-200',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="max-w-5xl mx-auto space-y-6">
          <ProgressChart sessions={sessions} />
          <PastSessions
            sessions={sessions}
            loading={sessionsLoading}
            error={sessionsError}
            onRefresh={refreshSessions}
            onFetchDetail={fetchDetail}
          />
        </div>
      )}

      {/* Interview tab — main layout */}
      {activeTab === 'interview' && <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — mic + transcript */}
        <div className="space-y-6">
          {/* Current question */}
          {currentFeedback && (
            <div className="rounded-xl bg-gray-900 border border-brand-500/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-2">
                {isAiSpeaking ? '🔊 AI Speaking' : 'Next Question'}
              </p>
              <p className="text-gray-100 font-medium">
                {currentFeedback.follow_up_question}
              </p>
            </div>
          )}

          {appState === 'starting' && !currentFeedback && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
              <p className="text-gray-400 animate-pulse">Starting your interview…</p>
            </div>
          )}

          {/* Mic control */}
          {(appState === 'ready' || appState === 'listening' || appState === 'processing') && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 flex flex-col items-center">
              <AudioRecorder
                isRecording={isRecording}
                isProcessing={isProcessing}
                isAiSpeaking={isAiSpeaking}
                permissionDenied={permissionDenied}
                onStart={() => {
                  setAppState('listening')
                  void startRecording()
                }}
                onStop={stopRecording}
              />
            </div>
          )}

          <TranscriptPanel transcript={liveTranscript} isProcessing={isProcessing} />
        </div>

        {/* Right — feedback + history */}
        <div className="space-y-6">
          {currentFeedback && feedbackHistory.length > 0 && (
            <FeedbackCard
              feedback={feedbackHistory[feedbackHistory.length - 1]}
              isPlaying={isAiSpeaking}
            />
          )}
          <SessionHistory history={feedbackHistory} />
        </div>
      </div>}

      {/* Toast */}
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}

      {/* Summary modal */}
      {showSummary && (
        <SummaryModal
          history={sessionHistory}
          role={role}
          onClose={resetSession}
        />
      )}
    </div>
  )
}
