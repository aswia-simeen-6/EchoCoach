"""
stt.py - Speech-to-Text via Groq Whisper API.

Groq's Whisper endpoint is interface-compatible with OpenAI's —
same parameters, same response format, much faster and free-tier available.

Model: whisper-large-v3-turbo (fastest) or whisper-large-v3 (most accurate)
Sign up: https://console.groq.com
"""

import io
import wave
from typing import Optional

import numpy as np

from config import settings

SILENCE_THRESHOLD = 0.01
SAMPLE_RATE = 16_000


def _get_client():
    from groq import AsyncGroq
    return AsyncGroq(api_key=settings.groq_api_key)


def _is_silent(audio_bytes: bytes) -> bool:
    if len(audio_bytes) < 2:
        return True
    arr = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    rms = float(np.sqrt(np.mean(arr ** 2)))
    return rms < SILENCE_THRESHOLD


def _to_wav(pcm_bytes: bytes, sample_rate: int = SAMPLE_RATE) -> io.BytesIO:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    buf.seek(0)
    buf.name = "audio.wav"
    return buf


async def transcribe(audio_bytes: bytes) -> Optional[str]:
    if _is_silent(audio_bytes):
        return None
    is_webm = audio_bytes[:4] == b'\x1a\x45\xdf\xa3'
    if is_webm:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "audio.webm"
    else:
        audio_file = _to_wav(audio_bytes)
    client = _get_client()
    result = await client.audio.transcriptions.create(
        model=settings.whisper_model,
        file=audio_file,
        response_format="text",
    )
    transcript = result.strip() if isinstance(result, str) else ""
    return transcript or None
