interface TranscriptPanelProps {
  transcript: string
  isProcessing: boolean
}

export function TranscriptPanel({ transcript, isProcessing }: TranscriptPanelProps) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 min-h-[120px]">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
        Your Answer
      </p>
      {transcript ? (
        <p className="text-gray-100 leading-relaxed">{transcript}</p>
      ) : (
        <p className="text-gray-600 italic">
          {isProcessing ? 'Transcribing…' : 'Start speaking to see your transcript here.'}
        </p>
      )}
      {isProcessing && (
        <div className="mt-3 flex items-center gap-2 text-brand-500 text-sm">
          <span className="animate-pulse">●</span>
          <span>Analysing your answer…</span>
        </div>
      )}
    </div>
  )
}
