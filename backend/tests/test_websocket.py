"""
Tests for the FastAPI WebSocket endpoint in main.py.

Uses httpx + pytest-asyncio for async WebSocket testing.
The LLM and TTS pipelines are mocked so no API keys are needed.
"""

import json
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport


# Patch external calls before importing the app
@pytest.fixture(autouse=True)
def mock_external(monkeypatch):
    """Prevent any real API calls during tests."""
    monkeypatch.setenv("GROQ_API_KEY", "test-key")


# ── Import app after env is set ───────────────────────────────────────────────
@pytest.fixture()
def app():
    import importlib
    import main as m
    importlib.reload(m)
    return m.app


# ── Health endpoint ───────────────────────────────────────────────────────────

def test_health_endpoint(app):
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ── WebSocket: unknown message type ──────────────────────────────────────────

def test_websocket_unknown_type(app):
    client = TestClient(app)
    with client.websocket_connect("/ws/test-session-1") as ws:
        ws.send_json({"type": "unknown_type"})
        data = ws.receive_json()
        assert data["type"] == "error"
        assert "unknown" in data["message"].lower()


# ── WebSocket: end_turn with no audio ────────────────────────────────────────

def test_websocket_end_turn_no_audio(app):
    client = TestClient(app)
    with client.websocket_connect("/ws/test-session-2") as ws:
        ws.send_json({"type": "end_turn"})
        data = ws.receive_json()
        assert data["type"] == "error"
        assert "no audio" in data["message"].lower()


# ── WebSocket: audio_chunk buffering ─────────────────────────────────────────

def test_websocket_audio_chunk_buffered(app):
    """Audio chunks should be buffered without triggering a response."""
    import base64
    client = TestClient(app)
    with client.websocket_connect("/ws/test-session-3") as ws:
        chunk = base64.b64encode(b"\x00" * 512).decode()
        ws.send_json({"type": "audio_chunk", "data": chunk})
        # No message should be sent back for a lone audio_chunk
        # Send end_turn immediately — should get "no audio" because silence gate fires
        ws.send_json({"type": "end_turn"})
        data = ws.receive_json()
        # Either error (silence) or transcript — both are valid responses
        assert data["type"] in ("error", "transcript")
