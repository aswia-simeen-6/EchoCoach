"""
llm.py - GPT feedback engine using Groq (Llama 3.3 70B).

Groq free tier: 14,400 req/day, 500,000 tokens/min.
Model: llama-3.3-70b-versatile supports JSON mode natively.
Sign up: https://console.groq.com
"""

import json
import logging
from typing import Any

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from config import settings
from prompts.modes import InterviewMode, Difficulty, get_prompt_for_mode
from pipeline.memory import get_history, append_messages, clear_history

logger = logging.getLogger(__name__)

_sessions: dict[str, dict[str, Any]] = {}
MAX_RETRIES = 2


def get_session(
    session_id: str,
    role: str = "",
    jd: str = "",
    mode: InterviewMode = InterviewMode.BEHAVIORAL,
    difficulty: Difficulty = Difficulty.MID,
) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {
            "role": role,
            "jd": jd,
            "mode": mode,
            "difficulty": difficulty,
            "llm": ChatGroq(
                model=settings.groq_llm_model,
                temperature=0.7,
                groq_api_key=settings.groq_api_key,
                model_kwargs={"response_format": {"type": "json_object"}},
            ),
        }
    return _sessions[session_id]


def clear_session(session_id: str) -> None:
    _sessions.pop(session_id, None)
    clear_history(session_id)


async def get_feedback(session_id: str, transcript: str) -> dict:
    session = get_session(session_id)
    llm: ChatGroq = session["llm"]

    system_content = get_prompt_for_mode(
        mode=session["mode"],
        difficulty=session["difficulty"],
        role=session["role"],
        jd=session["jd"],
    )

    if transcript == "__START__":
        human_content = (
            "Please start the interview. Ask the candidate your first question for this mode. "
            "Return a JSON object where 'question' and 'follow_up_question' are both the "
            "opening question, and all scores are 0 with empty strengths/improvements."
        )
    else:
        human_content = transcript

    history = get_history(session_id)
    messages = [SystemMessage(content=system_content)] + history + [HumanMessage(content=human_content)]

    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await llm.ainvoke(messages)
            result = json.loads(response.content)
            append_messages(
                session_id,
                HumanMessage(content=human_content),
                AIMessage(content=response.content),
            )
            return result
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
            logger.warning("JSON parse failed attempt %d/%d: %s", attempt, MAX_RETRIES, exc)

    raise ValueError(f"Groq returned invalid JSON after {MAX_RETRIES} attempts: {last_error}")
