/**
 * Tests for useWebSocket hook — message routing and state updates.
 *
 * WebSocket is mocked via vi.stubGlobal so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from './useWebSocket'

// ── Mock WebSocket ────────────────────────────────────────────────────────────

type WsListener = (event: { data: string }) => void

let mockWsInstance: {
  onopen: (() => void) | null
  onmessage: WsListener | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  readyState: number
}

const MockWebSocket = vi.fn(() => {
  mockWsInstance = {
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
  }
  return mockWsInstance
})

// Add OPEN constant
;(MockWebSocket as unknown as { OPEN: number }).OPEN = 1

vi.stubGlobal('WebSocket', MockWebSocket)

// ── Helpers ───────────────────────────────────────────────────────────────────

function fireOpen() {
  act(() => { mockWsInstance.onopen?.() })
}

function fireMessage(payload: object) {
  act(() => {
    mockWsInstance.onmessage?.({ data: JSON.stringify(payload) })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts disconnected, becomes connected on open', () => {
    const { result } = renderHook(() => useWebSocket('session-1'))
    expect(result.current.connected).toBe(false)
    fireOpen()
    expect(result.current.connected).toBe(true)
  })

  it('updates liveTranscript on transcript message', () => {
    const { result } = renderHook(() => useWebSocket('session-2'))
    fireOpen()
    fireMessage({ type: 'transcript', text: 'Hello world', is_final: true })
    expect(result.current.liveTranscript).toBe('Hello world')
  })

  it('appends to feedbackHistory on feedback message', () => {
    const { result } = renderHook(() => useWebSocket('session-3'))
    fireOpen()
    const fb = {
      type: 'feedback',
      payload: {
        question: 'Q1', answer_transcript: 'A1',
        clarity_score: 8, relevance_score: 7, confidence_score: 9, overall_score: 8,
        strengths: [], improvements: [],
        ideal_answer_hint: 'hint', follow_up_question: 'Next Q',
      },
    }
    fireMessage(fb)
    expect(result.current.feedbackHistory).toHaveLength(1)
    expect(result.current.currentFeedback?.question).toBe('Q1')
  })

  it('accumulates tts_chunk messages', () => {
    const { result } = renderHook(() => useWebSocket('session-4'))
    fireOpen()
    // base64 of [1,2,3,4]
    const b64 = btoa(String.fromCharCode(1, 2, 3, 4))
    fireMessage({ type: 'tts_chunk', data: b64 })
    expect(result.current.ttsQueue).toHaveLength(1)
    expect(result.current.ttsQueue[0]).toBeInstanceOf(Uint8Array)
  })

  it('sets ttsEnded on tts_end message', () => {
    const { result } = renderHook(() => useWebSocket('session-5'))
    fireOpen()
    fireMessage({ type: 'tts_end' })
    expect(result.current.ttsEnded).toBe(true)
  })

  it('sets error on error message', () => {
    const { result } = renderHook(() => useWebSocket('session-6'))
    fireOpen()
    fireMessage({ type: 'error', message: 'Something failed' })
    expect(result.current.error).toBe('Something failed')
  })

  it('sendJson sends JSON string over the socket', () => {
    const { result } = renderHook(() => useWebSocket('session-7'))
    fireOpen()
    act(() => { result.current.sendJson({ type: 'end_turn' }) })
    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'end_turn' }),
    )
  })

  it('clearTtsQueue empties the queue', () => {
    const { result } = renderHook(() => useWebSocket('session-8'))
    fireOpen()
    fireMessage({ type: 'tts_chunk', data: btoa('\x00') })
    expect(result.current.ttsQueue).toHaveLength(1)
    act(() => { result.current.clearTtsQueue() })
    expect(result.current.ttsQueue).toHaveLength(0)
  })
})
