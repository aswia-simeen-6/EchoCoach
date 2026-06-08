interface AudioRecorderProps {
  isRecording: boolean
  isProcessing: boolean
  isAiSpeaking: boolean
  permissionDenied: boolean
  onStart: () => void
  onStop: () => void
}

export function AudioRecorder({
  isRecording,
  isProcessing,
  isAiSpeaking,
  permissionDenied,
  onStart,
  onStop,
}: AudioRecorderProps) {
  const disabled = isProcessing || isAiSpeaking

  if (permissionDenied) {
    return (
      <div className="rounded-xl bg-red-950 border border-red-800 p-4 text-center">
        <p className="text-sm text-red-300">
          Microphone access denied. Please allow mic access in your browser settings and reload.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Big mic button */}
      <button
        onClick={isRecording ? onStop : onStart}
        disabled={disabled}
        className={[
          'w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all duration-200 shadow-lg',
          isRecording
            ? 'bg-red-600 hover:bg-red-700 animate-pulse scale-110'
            : disabled
            ? 'bg-gray-700 cursor-not-allowed opacity-50'
            : 'bg-brand-500 hover:bg-brand-600 hover:scale-105',
        ].join(' ')}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? '⏹' : '🎙'}
      </button>

      {/* Status label */}
      <p className="text-sm text-gray-400">
        {isRecording
          ? 'Recording… click to stop'
          : isProcessing
          ? 'Analysing…'
          : isAiSpeaking
          ? 'AI is speaking…'
          : 'Click to answer'}
      </p>

      {/* Recording waveform indicator — fixed heights, pure CSS animation */}
      {isRecording && (
        <div className="flex items-end gap-1 h-6">
          {([40, 75, 55, 90, 60] as const).map((pct, i) => (
            <div
              key={i}
              className="w-1.5 bg-red-500 rounded-full animate-bounce"
              style={{
                height: `${pct}%`,
                animationDelay: `${i * 80}ms`,
                minHeight: '6px',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
