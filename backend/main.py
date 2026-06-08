import asyncio
import base64
import io
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import settings
from db import init_db
from pipeline.stt import transcribe
from pipeline.llm import get_session, get_feedback, clear_session
from pipeline.tts import stream_tts
from pipeline.persist import (
    save_session,
    save_feedback,
    end_session as persist_end_session,
    get_all_sessions,
    get_session_detail,
)
from prompts.modes import InterviewMode, Difficulty

session_state: dict[str, dict] = {}
limiter = Limiter(key_func=get_remote_address)


async def _warmup_whisper() -> None:
    """Send silent audio through Groq Whisper on startup to eliminate cold-start latency."""
    import numpy as np
    import wave
    from groq import AsyncGroq
    client = AsyncGroq(api_key=settings.groq_api_key)
    # Create 0.1s of silent PCM16 at 16kHz and wrap in a valid WAV container
    sample_rate = 16000
    duration_s = 0.1
    num_samples = int(sample_rate * duration_s)
    silent = np.zeros(num_samples, dtype=np.int16).tobytes()
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(silent)
    buf.seek(0)
    buf.name = "warmup.wav"
    try:
        await client.audio.transcriptions.create(
            model=settings.whisper_model,
            file=buf,
            response_format="text",
        )
        print("Groq Whisper pre-warmed OK")
    except Exception as e:
        print(f"Whisper warmup skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("EchoCoach backend starting...")
    await init_db()
    await _warmup_whisper()
    yield
    print("EchoCoach backend shutting down.")


app = FastAPI(title="EchoCoach", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.get("/health")
@limiter.limit("60/minute")
async def health(request: Request):
    return {"status": "ok"}


@app.get("/sessions")
@limiter.limit("30/minute")
async def list_sessions(request: Request, limit: int = 50):
    return await get_all_sessions(limit=limit)


@app.get("/sessions/{session_id}")
@limiter.limit("30/minute")
async def get_session_route(request: Request, session_id: str):
    detail = await get_session_detail(session_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return detail


async def _send_feedback_and_tts(websocket: WebSocket, feedback: dict, tts_text: str) -> None:
    await websocket.send_json({"type": "feedback", "payload": feedback})
    await stream_tts(tts_text, websocket)


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session_state[session_id] = {"audio": [], "turn": 0}

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "start_session":
                role = data.get("role", "Software Engineer")
                jd = data.get("jd", "")
                mode_str = data.get("mode", "behavioral")
                difficulty_str = data.get("difficulty", "mid")
                try:
                    mode = InterviewMode(mode_str)
                    difficulty = Difficulty(difficulty_str)
                except ValueError:
                    mode = InterviewMode.BEHAVIORAL
                    difficulty = Difficulty.MID

                get_session(session_id, role=role, jd=jd, mode=mode, difficulty=difficulty)
                await save_session(session_id, role=role, jd=jd, mode=mode.value, difficulty=difficulty.value)
                opening_feedback = await get_feedback(session_id, "__START__")
                await _send_feedback_and_tts(
                    websocket, opening_feedback, opening_feedback["follow_up_question"]
                )

            elif msg_type == "audio_chunk":
                raw = base64.b64decode(data["data"])
                session_state[session_id]["audio"].append(raw)

            elif msg_type == "end_turn":
                audio_chunks = session_state[session_id]["audio"]
                session_state[session_id]["audio"] = []
                if not audio_chunks:
                    await websocket.send_json({"type": "error", "message": "No audio received for this turn."})
                    continue
                raw_audio = b"".join(audio_chunks)
                transcript = await transcribe(raw_audio)
                if not transcript:
                    await websocket.send_json({"type": "error", "message": "Could not transcribe audio. Please speak louder or try again."})
                    continue
                await websocket.send_json({"type": "transcript", "text": transcript, "is_final": True})
                session_state[session_id]["turn"] += 1
                turn = session_state[session_id]["turn"]
                feedback = await get_feedback(session_id, transcript)
                asyncio.create_task(save_feedback(session_id, turn, feedback))
                await _send_feedback_and_tts(websocket, feedback, feedback["follow_up_question"])

            elif msg_type == "end_session":
                asyncio.create_task(persist_end_session(session_id))
                clear_session(session_id)
                await websocket.send_json({"type": "session_ended"})

            else:
                await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        asyncio.create_task(persist_end_session(session_id))
        clear_session(session_id)
        session_state.pop(session_id, None)
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
        clear_session(session_id)
        session_state.pop(session_id, None)
