// ── Interview mode + difficulty ───────────────────────────────────────────────

export type InterviewMode = 'behavioral' | 'technical' | 'system_design' | 'coding'
export type Difficulty    = 'junior' | 'mid' | 'senior'

export const MODE_LABELS: Record<InterviewMode, string> = {
  behavioral:    'Behavioral',
  technical:     'Technical',
  system_design: 'System Design',
  coding:        'Coding',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  junior: 'Junior',
  mid:    'Mid-Level',
  senior: 'Senior',
}

// ── Shared feedback shape ─────────────────────────────────────────────────────

export interface FeedbackResult {
  question: string
  answer_transcript: string
  clarity_score: number       // 1-10
  relevance_score: number     // 1-10
  confidence_score: number    // 1-10
  overall_score: number       // 1-10
  strengths: string[]
  improvements: string[]
  ideal_answer_hint: string
  follow_up_question: string
}

// ── Inbound WebSocket messages (server → client) ──────────────────────────────

export interface TranscriptMessage {
  type: 'transcript'
  text: string
  is_final: boolean
}

export interface FeedbackMessage {
  type: 'feedback'
  payload: FeedbackResult
}

export interface TtsChunkMessage {
  type: 'tts_chunk'
  data: string  // base64 audio
}

export interface TtsEndMessage {
  type: 'tts_end'
}

export interface ErrorMessage {
  type: 'error'
  message: string
}

export interface SessionEndedMessage {
  type: 'session_ended'
}

export type ServerMessage =
  | TranscriptMessage
  | FeedbackMessage
  | TtsChunkMessage
  | TtsEndMessage
  | ErrorMessage
  | SessionEndedMessage

// ── Outbound WebSocket messages (client → server) ─────────────────────────────

export interface StartSessionPayload {
  type: 'start_session'
  role: string
  jd: string
}

export interface AudioChunkPayload {
  type: 'audio_chunk'
  data: string  // base64 audio
}

export interface EndTurnPayload {
  type: 'end_turn'
}

export interface EndSessionPayload {
  type: 'end_session'
}

// ── App-level state ───────────────────────────────────────────────────────────

export type AppState =
  | 'idle'          // no session — show setup form
  | 'starting'      // sent start_session, waiting for first question TTS
  | 'listening'     // mic active, recording
  | 'processing'    // end_turn sent, waiting for transcript + feedback
  | 'feedback'      // received feedback, AI is speaking
  | 'ready'         // AI finished speaking, ready for next answer
