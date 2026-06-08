/**
 * Tests for useAudioPlayer hook.
 *
 * AudioContext is not available in jsdom, so we mock it and verify
 * the hook's chunk-accumulation and flush logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioPlayer } from './useAudioPlayer'

// ── Mock Web Audio API ────────────────────────────────────────────────────────

const mockSource = {
  buffer: null as AudioBuffer | null,
  connect: vi.fn(),
  start: vi.fn(),
  onended: null as (() => void) | null,
}

const mockCtx = {
  state: 'running',
  decodeAudioData: vi.fn(),
  createBufferSource: vi.fn(() => mockSource),
  destination: {},
  close: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
}

vi.stubGlobal('AudioContext', vi.fn(() => mockCtx))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useAudioPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.decodeAudioData.mockResolvedValue({} as AudioBuffer)
  })

  it('starts with isPlaying = false', () => {
    const { result } = renderHook(() => useAudioPlayer())
    expect(result.current.isPlaying).toBe(false)
  })

  it('enqueueChunk does not start playback immediately', () => {
    const { result } = renderHook(() => useAudioPlayer())
    act(() => {
      result.current.enqueueChunk(new Uint8Array([1, 2, 3]))
    })
    expect(mockSource.start).not.toHaveBeenCalled()
    expect(result.current.isPlaying).toBe(false)
  })

  it('flushAndPlay does nothing when no chunks queued', async () => {
    const { result } = renderHook(() => useAudioPlayer())
    await act(async () => {
      await result.current.flushAndPlay()
    })
    expect(mockCtx.decodeAudioData).not.toHaveBeenCalled()
  })

  it('flushAndPlay calls decodeAudioData with merged buffer', async () => {
    const { result } = renderHook(() => useAudioPlayer())
    act(() => {
      result.current.enqueueChunk(new Uint8Array([1, 2]))
      result.current.enqueueChunk(new Uint8Array([3, 4]))
    })
    await act(async () => {
      await result.current.flushAndPlay()
    })
    expect(mockCtx.decodeAudioData).toHaveBeenCalledTimes(1)
    // The merged buffer should be 4 bytes
    const calledWith = mockCtx.decodeAudioData.mock.calls[0][0] as ArrayBuffer
    expect(calledWith.byteLength).toBe(4)
  })

  it('calls onPlaybackEnd when source ends', async () => {
    const onEnd = vi.fn()
    const { result } = renderHook(() => useAudioPlayer(onEnd))
    act(() => {
      result.current.enqueueChunk(new Uint8Array([0, 0, 0, 0]))
    })
    await act(async () => {
      await result.current.flushAndPlay()
    })
    // Simulate AudioBufferSourceNode ending
    act(() => {
      mockSource.onended?.()
    })
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('clears chunk queue after flush', async () => {
    const { result } = renderHook(() => useAudioPlayer())
    act(() => {
      result.current.enqueueChunk(new Uint8Array([1]))
    })
    await act(async () => {
      await result.current.flushAndPlay()
    })
    // Second flush should not call decodeAudioData again
    await act(async () => {
      await result.current.flushAndPlay()
    })
    expect(mockCtx.decodeAudioData).toHaveBeenCalledTimes(1)
  })
})
