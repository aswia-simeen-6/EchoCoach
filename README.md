# EchoCoach

Real-time voice AI interview coach. Speak your answer — get instant structured feedback on clarity, relevance, and confidence, spoken back via AI voice.

## Architecture

```
Browser (React)
  |-- MediaRecorder (250ms chunks, base64) --> WebSocket
  |<- transcript, feedback JSON, TTS audio chunks ------- WebSocket

FastAPI Backend
  |-- Whisper API  (speech to text)
  |-- Groq       (structured JSON feedback)
  |-- Edge TTS     (text to speech, streamed)
```

## Stack

| Layer    | Tech                                          |
|----------|-----------------------------------------------|
| Backend  | Python 3.11, FastAPI, WebSockets, uvicorn     |
| STT      | OpenAI Whisper API                            |
| LLM      | Groq via LangChain                          |
| TTS      | edge-tts (Microsoft Edge TTS, free)           |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS      |
| Audio    | Web Audio API, MediaRecorder                  |

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- An [OpenAI API key](https://platform.openai.com/api-keys)

---

## Local Development

### 1. Clone and configure

```bash
git clone https://github.com/your-username/echocoach.git
cd echocoach

cp .env.example backend/.env
# Edit backend/.env and set OPENAI_API_KEY=sk-...
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend starts at http://localhost:8000. Health check: http://localhost:8000/health

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at http://localhost:5173. Open it in your browser.

### 4. Run tests

**Backend:**
```bash
cd backend
PYTHONPATH=. pytest tests/ -v -p no:cacheprovider
```

**Frontend:**
```bash
cd frontend
npm test
```

---

## Docker

Run both services with one command:

```bash
# Copy and fill in your API key first
cp .env.example backend/.env

docker compose up --build
```

App is served at http://localhost (port 80).

---

## Environment Variables

| Variable          | Default                   | Description                         |
|-------------------|---------------------------|-------------------------------------|
| `OPENAI_API_KEY`  | required                  | Your OpenAI API key                 |
| `WHISPER_MODEL`   | `whisper-1`               | Whisper model to use                |
| `EDGE_TTS_VOICE`  | `en-US-GuyNeural`         | Edge TTS voice name                 |
| `CORS_ORIGINS`    | `http://localhost:5173`   | Allowed CORS origins (comma list)   |
| `SESSION_SECRET`  | `change-me-in-production` | Secret for session signing          |

List all available TTS voices:
```bash
edge-tts --list-voices
```

---

## WebSocket Protocol

**Endpoint:** `ws://localhost:8000/ws/{session_id}`

### Client to Server

| `type`          | Payload                        | When to send              |
|-----------------|--------------------------------|---------------------------|
| `start_session` | `{ role, jd }`                 | On interview start        |
| `audio_chunk`   | `{ data: base64 }`             | Every 250ms while speaking|
| `end_turn`      | `{}`                           | When user stops speaking  |
| `end_session`   | `{}`                           | On session end            |

### Server to Client

| `type`       | Payload                | Description                      |
|--------------|------------------------|----------------------------------|
| `transcript` | `{ text, is_final }`   | Live transcription                |
| `feedback`   | `FeedbackResult`       | Structured JSON feedback          |
| `tts_chunk`  | `{ data: base64 }`     | TTS audio chunk to play           |
| `tts_end`    | `{}`                   | TTS stream complete               |
| `error`      | `{ message }`          | Error event                       |

---

## Feedback Schema

```json
{
  "question": "string",
  "answer_transcript": "string",
  "clarity_score": 8,
  "relevance_score": 7,
  "confidence_score": 9,
  "overall_score": 8,
  "strengths": ["Clear structure"],
  "improvements": ["Be more concise"],
  "ideal_answer_hint": "Focus on measurable impact.",
  "follow_up_question": "Tell me about a time you failed."
}
```

---

## Project Structure

```
EchoCoach/
├── backend/
│   ├── main.py                  # FastAPI app + WebSocket router
│   ├── config.py                # pydantic-settings env loader
│   ├── pipeline/
│   │   ├── stt.py               # Whisper STT + silence gate + VAD
│   │   ├── llm.py               # Groq + session message history
│   │   └── tts.py               # Edge TTS streaming
│   ├── models/schemas.py        # Pydantic v2 models
│   ├── prompts/interview_coach.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_stt.py          # 11 unit tests
│   │   ├── test_schemas.py      # 9 unit tests
│   │   └── test_websocket.py    # 4 integration tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioRecorder.tsx
│   │   │   ├── FeedbackCard.tsx
│   │   │   ├── TranscriptPanel.tsx
│   │   │   ├── SessionHistory.tsx
│   │   │   ├── SummaryModal.tsx
│   │   │   └── Toast.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useAudioRecorder.ts  # includes VAD auto-stop
│   │   │   ├── useAudioPlayer.ts
│   │   │   ├── useAudioPlayer.test.ts
│   │   │   └── useWebSocket.test.ts
│   │   ├── types/index.ts
│   │   └── App.tsx
│   ├── vitest.config.ts
│   └── package.json
├── docker-compose.yml
├── .env.example
├── CLAUDE.md
└── PROJECT_REQUIREMENTS.md
```

---

## Latency Optimisations

- Whisper pre-warmed on server startup (eliminates ~800ms cold start)
- TTS streaming starts immediately after LLM JSON is received
- Transcript surfaced to client as soon as STT completes (before LLM call)
- VAD auto-stop: 1.5s silence window fires `end_turn` automatically

## Known Limitations

- Edge TTS requires an outbound internet connection
- Whisper hallucination on silence: mitigated by RMS silence gate
- Session memory is in-process; restart clears all sessions
- No authentication; add a reverse proxy with auth for production use
