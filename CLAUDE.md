# EchoCoach — CLAUDE.md

## Project Overview

EchoCoach is a real-time voice AI interview coach. A user speaks into the mic; their speech is transcribed, sent to GPT-4o for structured feedback, and the response is spoken back via Edge TTS — all with sub-second perceived latency.

**Stack:** Python 3.11 · FastAPI · WebSockets · Whisper (OpenAI) · GPT-4o (OpenAI API) · Edge TTS · LangChain · React 18 · TypeScript · Tailwind CSS

---

## Repo Structure

```
EchoCoach/
├── backend/
│   ├── main.py                  # FastAPI app, WebSocket endpoints
│   ├── pipeline/
│   │   ├── stt.py               # Whisper transcription (chunked async)
│   │   ├── llm.py               # GPT-4o via LangChain, structured JSON output
│   │   ├── tts.py               # Edge TTS async synthesis
│   │   └── memory.py            # LangChain session-scoped ConversationBufferMemory
│   ├── models/
│   │   └── schemas.py           # Pydantic models: TranscriptChunk, FeedbackResult
│   ├── prompts/
│   │   └── interview_coach.py   # System prompt + structured JSON output spec
│   ├── config.py                # Env vars, settings (pydantic-settings)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioRecorder.tsx    # MediaRecorder → WebSocket audio chunks
│   │   │   ├── TranscriptPanel.tsx  # Live transcription display
│   │   │   ├── FeedbackCard.tsx     # Per-answer structured feedback
│   │   │   └── SessionHistory.tsx   # Full session Q&A history
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts      # WS connection + message routing
│   │   │   └── useAudioPlayer.ts    # Queue + play TTS audio chunks
│   │   ├── types/
│   │   │   └── index.ts             # FeedbackResult, TranscriptMessage types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── .env.example
├── CLAUDE.md                    # ← this file
└── PROJECT_REQUIREMENTS.md
```

---

## Key Commands

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # Vite dev server on :5173
npm run build
```

### Run both (dev)
```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000
# Terminal 2
cd frontend && npm run dev
```

---

## Environment Variables (.env)

```env
OPENAI_API_KEY=sk-...
WHISPER_MODEL=whisper-1            # or base/small if running local
EDGE_TTS_VOICE=en-US-GuyNeural    # Edge TTS voice name
SESSION_SECRET=your-secret-here
CORS_ORIGINS=http://localhost:5173
```

---

## WebSocket Protocol

**Endpoint:** `ws://localhost:8000/ws/{session_id}`

### Client → Server messages
| Type | Payload | Description |
|------|---------|-------------|
| `audio_chunk` | `{ data: base64_audio }` | Raw PCM/webm audio chunk |
| `end_turn` | `{}` | User finished speaking |
| `start_session` | `{ role: string, jd: string }` | Init interview context |

### Server → Client messages
| Type | Payload | Description |
|------|---------|-------------|
| `transcript` | `{ text: string, is_final: bool }` | Live transcription |
| `feedback` | `FeedbackResult` | Structured JSON feedback |
| `tts_chunk` | `{ data: base64_audio }` | TTS audio chunk to play |
| `error` | `{ message: string }` | Error event |

---

## Feedback JSON Schema (FeedbackResult)

```json
{
  "question": "string",
  "answer_transcript": "string",
  "clarity_score": 1-10,
  "relevance_score": 1-10,
  "confidence_score": 1-10,
  "overall_score": 1-10,
  "strengths": ["string"],
  "improvements": ["string"],
  "ideal_answer_hint": "string",
  "follow_up_question": "string"
}
```

---

## Architecture & Data Flow

```
User Mic
  │
  ▼ (MediaRecorder chunks, ~250ms)
AudioRecorder.tsx
  │ WebSocket audio_chunk
  ▼
FastAPI /ws/{session_id}
  │
  ├─→ stt.py (Whisper API)
  │     └─→ transcript event → frontend TranscriptPanel
  │
  ├─→ llm.py (GPT-4o + LangChain memory)
  │     └─→ feedback event → frontend FeedbackCard
  │
  └─→ tts.py (Edge TTS async streaming)
        └─→ tts_chunk events → frontend useAudioPlayer
```

---

## Implementation Notes

### STT (stt.py)
- Buffer incoming audio chunks; flush when `end_turn` received or silence detected (VAD threshold)
- Use `openai.audio.transcriptions.create(model="whisper-1", file=buffer)`
- Stream partial transcripts back to client for live display

### LLM (llm.py)
- Use `langchain_openai.ChatOpenAI(model="gpt-4o")`
- Enforce JSON output via `with_structured_output()` or `response_format={"type": "json_object"}`
- Session memory: `ConversationBufferMemory(return_messages=True)` keyed by `session_id`
- Store in a dict `sessions: dict[str, ConversationBufferMemory]`; clear on session end

### TTS (tts.py)
- Use `edge_tts.Communicate(text, voice).stream()` — yields audio chunks
- Send each chunk immediately over WebSocket as base64 for low latency
- Do NOT wait for full synthesis before sending

### Frontend Audio
- `MediaRecorder` with `timeslice=250` for 250ms chunks
- `useAudioPlayer`: maintain a chunk queue; use `AudioContext` + `decodeAudioData` to play sequentially without gaps

---

## Coding Conventions

- **Backend:** async everywhere (`async def`), Pydantic v2 models, type hints on all functions
- **Frontend:** functional components only, custom hooks for all side effects, no inline styles (Tailwind only)
- **Error handling:** all WebSocket handlers wrapped in try/except; errors sent as `error` event type
- **Secrets:** never hardcode; always read from `config.py` via `pydantic-settings`
- **Tests:** pytest + pytest-asyncio for backend; Vitest for frontend hooks

---

## Common Gotchas

1. **Edge TTS rate limits** — add a small jitter if running many concurrent sessions
2. **Whisper silence** — Whisper can hallucinate on silent audio; gate STT calls with a minimum RMS threshold
3. **WebSocket message ordering** — TTS chunks must be enqueued and played in order; do not use `Promise.all` for playback
4. **CORS** — FastAPI CORS middleware must list the Vite dev origin (`localhost:5173`)
5. **LangChain memory thread safety** — each `session_id` gets its own memory object; never share across sessions
