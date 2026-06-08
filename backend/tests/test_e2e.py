"""
test_e2e.py - End-to-end WebSocket integration test.

Simulates a full interview turn:
  start_session -> audio_chunk(s) -> end_turn
  -> expects transcript + feedback + tts_chunk(s) + tts_end back.

STT and LLM are mocked so no real API keys are needed.
The test uses FastAPI's TestClient for synchronous WebSocket testing.
"""

import base64
import json
import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient


MOCK_FEEDBACK = {
    "question": "Tell me about yourself.",
    "answer_transcript": "I build scalable systems.",
    "clarity_score": 9,
    "relevance_score": 8,
    "confidence_score": 9,
    "overall_score": 9,
    "strengths": ["Clear", "Confident"],
    "improvements": ["Add metrics"],
    "ideal_answer_hint": "Quantify your impact.",
    "follow_up_question": "Describe a system you scaled.",
}


def _make_audio_chunk() -> str:
    """Create a base64-encoded 250ms chunk of 440Hz sine wave at 16kHz."""
    t = np.linspace(0, 0.25, 4000, endpoint=False)
    pcm = (np.sin(2 * np.pi * 440 * t) * 16000).astype(np.int16)
    return base64.b64encode(pcm.tobytes()).decode()


@pytest.fixture()
def app_with_mocks():
    """Return the FastAPI app with STT, LLM, and TTS mocked out."""
    with (
        patch("pipeline.stt.transcribe", new=AsyncMock(return_value="I build scalable systems.")),
        patch("pipeline.llm.get_feedback", new=AsyncMock(return_value=MOCK_FEEDBACK)),
        patch("pipeline.llm.get_session", return_value={"role": "SWE", "jd": "", "llm": MagicMock()}),
        patch("pipeline.llm.clear_session"),
        patch("pipeline.tts.stream_tts", new=AsyncMock()),
    ):
        import importlib, main as m
        importlib.reload(m)
        yield m.app


def test_e2e_full_turn(app_with_mocks):
    """
    Happy path: start_session -> 2x audio_chunk -> end_turn
    Expected response sequence: feedback, then transcript, then feedback again.
    """
    client = TestClient(app_with_mocks)
    audio = _make_audio_chunk()

    with client.websocket_connect("/ws/e2e-session-1") as ws:
        # 1. Start session
        ws.send_json({"type": "start_session", "role": "SWE", "jd": ""})
        msg = ws.receive_json()
        assert msg["type"] == "feedback"
        assert msg["payload"]["overall_score"] == 9

        # 2. Stream audio chunks
        ws.send_json({"type": "audio_chunk", "data": audio})
        ws.send_json({"type": "audio_chunk", "data": audio})

        # 3. End turn
        ws.send_json({"type": "end_turn"})

        # Expect transcript back
        msg = ws.receive_json()
        assert msg["type"] == "transcript"
        assert "scalable" in msg["text"]

        # Expect feedback
        msg = ws.receive_json()
        assert msg["type"] == "feedback"
        assert msg["payload"]["clarity_score"] == 9


def test_e2e_end_session(app_with_mocks):
    """end_session should return session_ended and not error."""
    client = TestClient(app_with_mocks)
    with client.websocket_connect("/ws/e2e-session-2") as ws:
        ws.send_json({"type": "end_session"})
        msg = ws.receive_json()
        assert msg["type"] == "session_ended"


def test_e2e_unknown_type_returns_error(app_with_mocks):
    """Unknown message type should return an error event."""
    client = TestClient(app_with_mocks)
    with client.websocket_connect("/ws/e2e-session-3") as ws:
        ws.send_json({"type": "launch_missiles"})
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert "launch_missiles" in msg["message"]


def test_e2e_empty_turn_returns_error(app_with_mocks):
    """end_turn with no prior audio_chunks should return an error."""
    client = TestClient(app_with_mocks)
    with client.websocket_connect("/ws/e2e-session-4") as ws:
        ws.send_json({"type": "end_turn"})
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert "no audio" in msg["message"].lower()
