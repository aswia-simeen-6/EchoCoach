import { useCallback, useRef, useState } from 'react'

const CHUNK_INTERVAL_MS = 250

// VAD settings
const VAD_SILENCE_THRESHOLD = 0.01   // RMS below this = silence
const VAD_SILENCE_DURATION_MS = 1500 // stop after this long of continuous silence

interface UseAudioRecorderReturn {
  isRecording: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
  permissionDenied: boolean
}

/**
 * Captures mic audio via MediaRecorder, slices into 250ms chunks,
 * and calls onChunk(base64) for each chunk.
 *
 * Voice Activity Detection (VAD): once speech is detected, a 1.5s silence
 * window auto-fires stopRecording() so the user doesn't have to click Stop.
 * Calls onStop() when recording ends so the caller can send end_turn.
 */
export function useAudioRecorder(
  onChunk: (base64: string) => void,
  onStop: () => void,
): UseAudioRecorderReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechDetectedRef = useRef(false)

  const [isRecording, setIsRecording] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const clearVadTimer = () => {
    if (vadTimerRef.current) {
      clearTimeout(vadTimerRef.current)
      vadTimerRef.current = null
    }
  }

  const stopRecording = useCallback(() => {
    clearVadTimer()
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  /**
   * Compute RMS from the AnalyserNode and return a 0–1 float.
   */
  const getRms = (): number => {
    const analyser = analyserRef.current
    if (!analyser) return 0
    const buf = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const val = (buf[i] - 128) / 128
      sum += val * val
    }
    return Math.sqrt(sum / buf.length)
  }

  /**
   * Poll the AnalyserNode every CHUNK_INTERVAL_MS.
   * If silence persists for VAD_SILENCE_DURATION_MS after speech was detected,
   * auto-stop the recording.
   */
  const startVad = useCallback(() => {
    const tick = () => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return
      const rms = getRms()
      if (rms >= VAD_SILENCE_THRESHOLD) {
        speechDetectedRef.current = true
        clearVadTimer()
      } else if (speechDetectedRef.current) {
        // Silence after speech — start countdown if not already running
        if (!vadTimerRef.current) {
          vadTimerRef.current = setTimeout(() => {
            stopRecording()
          }, VAD_SILENCE_DURATION_MS)
        }
      }
      setTimeout(tick, CHUNK_INTERVAL_MS)
    }
    tick()
  }, [stopRecording])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      speechDetectedRef.current = false

      // Set up AnalyserNode for VAD
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = async (e: BlobEvent) => {
        if (e.data.size === 0) return
        const buffer = await e.data.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        bytes.forEach(b => (binary += String.fromCharCode(b)))
        onChunk(btoa(binary))
      }

      recorder.onstop = () => {
        clearVadTimer()
        audioCtxRef.current?.close().catch(() => {})
        audioCtxRef.current = null
        analyserRef.current = null
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        setIsRecording(false)
        onStop()
      }

      recorder.start(CHUNK_INTERVAL_MS)
      setIsRecording(true)
      setPermissionDenied(false)
      startVad()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPermissionDenied(true)
      } else {
        console.error('Mic error:', err)
      }
    }
  }, [onChunk, onStop, startVad])

  return { isRecording, startRecording, stopRecording, permissionDenied }
}
