# EchoCoach — Project Requirements & Build Guide

## What You're Building

A browser-based interview coach where the user speaks answers to interview questions. The system transcribes in real time, sends the answer to GPT-4o for structured critique (clarity, relevance, confidence), speaks the feedback aloud via Edge TTS, and displays a per-answer dashboard with session history.

---

## Requirements

### Functional Requirements

| # | Requirement |
|---|-------------|
| F1 | User can start a session by specifying a job role and optional job description |
| F2 | System asks an opening interview question (spoken + displayed) |
| F3 | User speaks their answer; audio is streamed to backend in real time |
| F4 | Live transcript appears on screen as the user speaks |
| F5 | On turn end, GPT-4o returns structured JSON feedback |
| F6 | Feedback (scores + suggestions) displayed on a card |
| F7 | Feedback is read aloud via Edge TTS with streaming playback |
| F8 | System asks the next follow-up question based on conversation context |
| F9 | Session history panel shows all Q&A + scores for the full interview |
| F10 | User can end the session and get a summary scorecard |

### Non-Functional Requirements

| # | Requirement |
|---|-------------|
| N1 | End-to-end voice response latency < 2 seconds (STT + LLM + TTS start) |
| N2 | WebSocket connection stable for sessions up to 30 minutes |
| N3 | Concurrent sessions isolated (no memory bleed between users) |
| N4 | No audio data persisted server-side beyond the active request |
| N5 | Frontend works in Chrome, Firefox, Safari (WebRTC MediaRecorder support) |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| API Server | FastAPI | Async-native, WebSocket support, fast |
| STT | OpenAI Whisper API | Best accuracy, no local GPU needed |
| LLM | GPT-4o via OpenAI API | Structured JSON output, fast |
| Memory | LangChain ConversationBufferMemory | Session context across turns |
| TTS | edge-tts (Microsoft Edge TTS) | Free, high quality, streaming |
| Frontend | React 18 + TypeScript + Vite | Fast dev, type safety |
| Styling | Tailwind CSS | Utility-first, no extra CSS files |
| Audio | Web Audio API + MediaRecorder | Native browser, no extra deps |

---

## Phase-by-Phase Build Plan

### Phase 1 — Backend Skeleton (Day 1)

**Goal:** FastAPI server with WebSocket endpoint, echo test working.

```bash
mkdir EchoCoach && cd EchoCoach
mkdir -p backend/pipeline backend/models backend/prompts
cd backend
python -m venv venv && source venv/bin/activate
```

**requirements.txt**
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
websockets==12.0
openai==1.30.0
edge-tts==6.1.9
langchain==0.2.1
langchain-openai==0.1.8
pydantic-settings==2.2.1
python-dotenv==1.0.1
numpy==1.26.4
```

**backend/config.py**
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str
    whisper_model: str = "whisper-1"
    edge_tts_voice: str = "en-US-GuyNeural"
    cors_origins: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"

settings = Settings()
```

**backend/main.py** (skeleton)
```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from config import settings
import json

app = FastAPI(title="EchoCoach")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            # Route to handlers (Phase 2+)
            await websocket.send_json({"type": "echo", "payload": data})
    except WebSocketDisconnect:
        pass  # cleanup session memory here
```

Test with: `wscat -c ws://localhost:8000/ws/test123`

---

### Phase 2 — STT Pipeline (Day 1-2)

**backend/pipeline/stt.py**
```python
import io, base64, numpy as np
from openai import AsyncOpenAI
from config import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)

def is_silent(audio_bytes: bytes, threshold: float = 0.01) -> bool:
    """Reject silent/near-silent audio to avoid Whisper hallucinations."""
    arr = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    return np.sqrt(np.mean(arr**2)) < threshold

async def transcribe(audio_bytes: bytes) -> str | None:
    if is_silent(audio_bytes):
        return None
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "audio.webm"
    result = await client.audio.transcriptions.create(
        model=settings.whisper_model,
        file=audio_file,
        response_format="text"
    )
    return result.strip() or None
```

**Hook into main.py:** accumulate `audio_chunk` messages into a buffer list; on `end_turn`, concatenate and call `transcribe()`, send result as `{"type": "transcript", "text": result, "is_final": true}`.

---

### Phase 3 — LLM + Memory (Day 2)

**backend/prompts/interview_coach.py**
```python
SYSTEM_PROMPT = """You are EchoCoach, an expert technical interview coach.
Your job is to ask one interview question at a time and evaluate the candidate's answer.

After each answer, return ONLY a valid JSON object with this exact schema:
{
  "question": "<the question you asked>",
  "answer_transcript": "<candidate's answer>",
  "clarity_score": <1-10>,
  "relevance_score": <1-10>,
  "confidence_score": <1-10>,
  "overall_score": <1-10>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<area 1>", "<area 2>"],
  "ideal_answer_hint": "<brief hint on what a great answer looks like>",
  "follow_up_question": "<your next interview question>"
}

Keep follow_up_question relevant to the conversation and progressively deeper.
Role: {role}
Job Description: {jd}
"""
```

**backend/pipeline/llm.py**
```python
import json
from langchain_openai import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.schema import SystemMessage, HumanMessage
from prompts.interview_coach import SYSTEM_PROMPT

# In-memory session store
_sessions: dict[str, dict] = {}

def get_session(session_id: str, role: str = "", jd: str = "") -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {
            "memory": ConversationBufferMemory(return_messages=True),
            "role": role,
            "jd": jd,
            "llm": ChatOpenAI(model="gpt-4o", temperature=0.7, response_format={"type": "json_object"})
        }
    return _sessions[session_id]

def clear_session(session_id: str):
    _sessions.pop(session_id, None)

async def get_feedback(session_id: str, transcript: str) -> dict:
    session = get_session(session_id)
    memory = session["memory"]
    llm = session["llm"]

    system = SYSTEM_PROMPT.format(role=session["role"], jd=session["jd"])
    history = memory.chat_memory.messages
    messages = [SystemMessage(content=system)] + history + [HumanMessage(content=transcript)]

    response = await llm.ainvoke(messages)
    result = json.loads(response.content)

    memory.chat_memory.add_user_message(transcript)
    memory.chat_memory.add_ai_message(response.content)

    return result
```

---

### Phase 4 — TTS Streaming (Day 2-3)

**backend/pipeline/tts.py**
```python
import base64, edge_tts
from config import settings

async def stream_tts(text: str, websocket):
    """Stream TTS audio chunks directly over the WebSocket."""
    communicate = edge_tts.Communicate(text, settings.edge_tts_voice)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            await websocket.send_json({
                "type": "tts_chunk",
                "data": base64.b64encode(chunk["data"]).decode()
            })
    # Signal end of TTS stream
    await websocket.send_json({"type": "tts_end"})
```

---

### Phase 5 — Wire Up main.py (Day 3)

```python
# Full message handler in websocket_endpoint
from pipeline.stt import transcribe
from pipeline.llm import get_session, get_feedback, clear_session
from pipeline.tts import stream_tts

audio_buffer: dict[str, list[bytes]] = {}

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    audio_buffer[session_id] = []
    try:
        while True:
            data = await websocket.receive_json()
            t = data["type"]

            if t == "start_session":
                get_session(session_id, data.get("role",""), data.get("jd",""))
                # Ask opening question
                opening = await get_feedback(session_id, "START_SESSION")
                await websocket.send_json({"type": "feedback", "payload": opening})
                await stream_tts(opening["follow_up_question"], websocket)

            elif t == "audio_chunk":
                import base64 as b64
                audio_buffer[session_id].append(b64.b64decode(data["data"]))

            elif t == "end_turn":
                raw = b"".join(audio_buffer[session_id])
                audio_buffer[session_id] = []
                transcript = await transcribe(raw)
                if not transcript:
                    await websocket.send_json({"type": "error", "message": "Could not transcribe audio"})
                    continue
                await websocket.send_json({"type": "transcript", "text": transcript, "is_final": True})
                feedback = await get_feedback(session_id, transcript)
                await websocket.send_json({"type": "feedback", "payload": feedback})
                await stream_tts(feedback["follow_up_question"], websocket)

    except WebSocketDisconnect:
        clear_session(session_id)
        audio_buffer.pop(session_id, None)
```

---

### Phase 6 — React Frontend (Day 3-4)

```bash
cd .. && npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install tailwindcss postcss autoprefixer && npx tailwindcss init -p
```

**Key files to build:**

**src/hooks/useWebSocket.ts**
- Connect to `ws://localhost:8000/ws/{uuid}`
- Parse incoming JSON messages and dispatch by type
- Expose: `sendJson(msg)`, `transcript`, `feedbackHistory`, `ttsQueue`

**src/hooks/useAudioRecorder.ts**
- `navigator.mediaDevices.getUserMedia({ audio: true })`
- `new MediaRecorder(stream, { timeslice: 250 })`
- On each `dataavailable`: read as ArrayBuffer → base64 → send `audio_chunk`
- On stop: send `end_turn`

**src/hooks/useAudioPlayer.ts**
- Maintain a chunk queue `Uint8Array[]`
- Use `AudioContext.decodeAudioData` → `AudioBufferSourceNode`
- On `tts_end`: flush remaining queue

**src/components/FeedbackCard.tsx**
```tsx
// Displays scores as colored progress bars
// clarity_score, relevance_score, confidence_score → 0-100% bar
// strengths / improvements as bullet lists
// ideal_answer_hint collapsed by default (click to expand)
```

**src/components/SessionHistory.tsx**
```tsx
// Scrollable list of FeedbackResult objects
// Each entry: question | answer excerpt | overall score chip
```

**src/App.tsx**
```tsx
// Layout: left panel = TranscriptPanel (live) + AudioRecorder controls
//         right panel = FeedbackCard (current) + SessionHistory
// State machine: idle → session_starting → listening → processing → feedback
```

---

### Phase 7 — Polish & Testing (Day 4-5)

**Latency optimizations:**
- Start TTS synthesis as soon as `follow_up_question` is extracted from LLM JSON (don't wait for full `feedback` send)
- Use `asyncio.gather` to send feedback JSON and begin TTS concurrently
- Pre-warm Whisper on server start with a dummy request

**Error handling:**
- Reconnect logic in `useWebSocket` with exponential backoff
- Show toast on `error` event type
- Gracefully handle mic permission denied

**Testing:**
```bash
# Backend
pip install pytest pytest-asyncio httpx
pytest backend/tests/

# Frontend
npm run test  # Vitest
```

---

## Skills File Setup (for Claude/AI assistant use)

Create `backend/.claude-skills.md` or a top-level `SKILLS.md` to teach Claude about this project:

```markdown
# EchoCoach Skills

## Run dev server
cd backend && uvicorn main:app --reload --port 8000

## Run frontend
cd frontend && npm run dev

## Add a new WebSocket message type
1. Add handler in backend/main.py websocket_endpoint
2. Add type to frontend/src/types/index.ts
3. Handle in useWebSocket.ts dispatch switch

## Add a new feedback field
1. Add to SYSTEM_PROMPT JSON schema in backend/prompts/interview_coach.py
2. Add to FeedbackResult type in frontend/src/types/index.ts
3. Render in FeedbackCard.tsx

## Change TTS voice
Set EDGE_TTS_VOICE in .env. List voices: `edge-tts --list-voices`

## Debug WebSocket
Use wscat: wscat -c ws://localhost:8000/ws/test-session
```

---

## .env.example

```env
OPENAI_API_KEY=sk-your-key-here
WHISPER_MODEL=whisper-1
EDGE_TTS_VOICE=en-US-GuyNeural
CORS_ORIGINS=http://localhost:5173
SESSION_SECRET=change-me-in-production
```

---

## Milestone Checklist

- [ ] Phase 1: WebSocket echo works
- [ ] Phase 2: Audio → Whisper transcript returned
- [ ] Phase 3: Transcript → GPT-4o JSON feedback returned
- [ ] Phase 4: TTS chunks stream to client
- [ ] Phase 5: Full pipeline end-to-end in terminal test
- [ ] Phase 6: React UI mic → transcript → feedback card
- [ ] Phase 7: TTS plays in browser, session history renders
- [ ] Bonus: VAD silence detection, reconnect logic, summary scorecard
