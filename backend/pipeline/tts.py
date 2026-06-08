"""
tts.py — Edge TTS streaming synthesis.
(Stub for Day 1 — full implementation in Phase 4)
"""

import base64

import edge_tts
from fastapi import WebSocket

from config import settings


async def stream_tts(text: str, websocket: WebSocket) -> None:
    """
    Synthesize text with Edge TTS and stream audio chunks over the WebSocket.

    Sends individual `tts_chunk` messages as soon as each chunk is ready,
    then sends `tts_end` to signal completion.
    """
    communicate = edge_tts.Communicate(text, settings.edge_tts_voice)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            await websocket.send_json({
                "type": "tts_chunk",
                "data": base64.b64encode(chunk["data"]).decode(),
            })
    await websocket.send_json({"type": "tts_end"})
