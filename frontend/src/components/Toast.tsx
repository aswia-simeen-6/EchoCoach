import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  onDismiss: () => void
  durationMs?: number
}

export function Toast({ message, onDismiss, durationMs = 4000 }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300) // wait for fade-out transition
    }, durationMs)
    return () => clearTimeout(timer)
  }, [durationMs, onDismiss])

  return (
    <div
      className={[
        'fixed bottom-6 right-6 z-50 flex items-start gap-3 max-w-sm',
        'bg-red-950 border border-red-700 text-red-200 rounded-xl shadow-xl px-4 py-3',
        'transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      ].join(' ')}
    >
      <span className="mt-0.5 text-red-400 shrink-0">⚠</span>
      <p className="text-sm flex-1">{message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300) }}
        className="text-red-400 hover:text-red-200 text-lg leading-none shrink-0 ml-1"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
