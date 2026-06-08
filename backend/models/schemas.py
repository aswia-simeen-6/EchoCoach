"""
schemas.py — Pydantic v2 models for EchoCoach WebSocket messages.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Inbound (client → server) ──────────────────────────────────────────────────

class StartSessionMessage(BaseModel):
    type: str = "start_session"
    role: str = "Software Engineer"
    jd: str = ""


class AudioChunkMessage(BaseModel):
    type: str = "audio_chunk"
    data: str  # base64-encoded audio bytes


class EndTurnMessage(BaseModel):
    type: str = "end_turn"


class EndSessionMessage(BaseModel):
    type: str = "end_session"


# ── Outbound (server → client) ─────────────────────────────────────────────────

class TranscriptMessage(BaseModel):
    type: str = "transcript"
    text: str
    is_final: bool = True


class FeedbackResult(BaseModel):
    """Structured GPT-4o feedback for one interview answer."""
    question: str
    answer_transcript: str
    clarity_score: int = Field(ge=1, le=10)
    relevance_score: int = Field(ge=1, le=10)
    confidence_score: int = Field(ge=1, le=10)
    overall_score: int = Field(ge=1, le=10)
    strengths: List[str]
    improvements: List[str]
    ideal_answer_hint: str
    follow_up_question: str


class FeedbackMessage(BaseModel):
    type: str = "feedback"
    payload: FeedbackResult


class TtsChunkMessage(BaseModel):
    type: str = "tts_chunk"
    data: str  # base64-encoded audio bytes


class TtsEndMessage(BaseModel):
    type: str = "tts_end"


class ErrorMessage(BaseModel):
    type: str = "error"
    message: str
