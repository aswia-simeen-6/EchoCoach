import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAudioPlayerReturn {
  isPlaying: boolean
  enqueueChunk: (chunk: Uint8Array) => void
  flushAndPlay: () => void
}

/**
 * Gapless sequential audio player for TTS chunks.
 *
 * Strategy:
 *  - Accumulate all Uint8Array chunks into a buffer.
 *  - When flushAndPlay() is called (on tts_end), concatenate and decode
 *    the full buffer, then play it as a single AudioBufferSourceNode.
 *  - This avoids the scheduling complexity of per-chunk decoding
 *    while still starting playback promptly after the last chunk arrives.
 */
export function useAudioPlayer(onPlaybackEnd?: () => void): UseAudioPlayerReturn {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Uint8Array[]>([])
  const [isPlaying, setIsPlaying] = useState(false)

  // Ensure AudioContext is created on user gesture (required by browsers)
  const getCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }, [])

  const enqueueChunk = useCallback((chunk: Uint8Array) => {
    chunksRef.current.push(chunk)
  }, [])

  const flushAndPlay = useCallback(async () => {
    const chunks = chunksRef.current
    chunksRef.current = []
    if (chunks.length === 0) return

    // Concatenate all chunks into one ArrayBuffer
    const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0)
    const merged = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }

    const ctx = getCtx()
    try {
      const audioBuffer = await ctx.decodeAudioData(merged.buffer)
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      setIsPlaying(true)
      source.onended = () => {
        setIsPlaying(false)
        onPlaybackEnd?.()
      }
      source.start(0)
    } catch (err) {
      console.error('Audio decode error:', err)
      setIsPlaying(false)
      onPlaybackEnd?.()
    }
  }, [getCtx, onPlaybackEnd])

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  return { isPlaying, enqueueChunk, flushAndPlay }
}
